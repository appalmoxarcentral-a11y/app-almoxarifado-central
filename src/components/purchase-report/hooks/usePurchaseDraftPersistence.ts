import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RascunhoCompra, PurchaseDraftItem, CreateDraftRequest, UpdateDraftRequest } from "@/types/purchase-draft";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function usePurchaseDraftPersistence() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [stockError, setStockError] = useState<{ title: string; items: string[] } | null>(null);

  const isManagement = user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN';
  const hasGlobalAccess = user?.tipo === 'SUPER_ADMIN' || 
                         user?.tipo === 'ADMIN' || 
                         hasPermission('acesso_global_pedidos');

  // Check permissions - allow both types of users to manage drafts
  const canManageDrafts = hasPermission('gerenciar_rascunhos_compras') || hasPermission('relatorio_compras');
  const canAccessReports = hasPermission('relatorio_compras');

  // Função para validar estoque antes de salvar ou confirmar
  const validateStockAvailability = async (dados_produtos: PurchaseDraftItem[], unidadeOrigemId?: string) => {
    // Só valida se o usuário for do Almoxarifado (acesso global)
    if (!hasGlobalAccess) return;

    const originId = unidadeOrigemId || (user as any).unidade_id;
    if (!originId) return;

    const itemsToDeliver = dados_produtos.filter(item => (item.quantidade_reposicao || 0) > 0);
    
    if (itemsToDeliver.length > 0) {
      console.log(`📦 Calculando estoque real para ${itemsToDeliver.length} itens na unidade: ${originId}`);
      
      const faltantes: string[] = [];

      for (const item of itemsToDeliver) {
        // 1. Buscar produto pelo código para obter o ID correto (catálogo compartilhado)
        const { data: produto } = await supabase
          .from('produtos')
          .select('id, descricao')
          .eq('codigo', item.codigo)
          .limit(1)
          .single();

        if (!produto) continue;

        // 2. Buscar estoque real desta unidade na tabela de estoque por unidade
        const { data: estoqueData } = await supabase
          .from('produtos_estoque')
          .select('estoque_atual')
          .eq('produto_id', produto.id)
          .eq('unidade_id', originId)
          .maybeSingle();

        const estoqueReal = estoqueData?.estoque_atual || 0;

        console.log(`🔍 Produto: ${produto.descricao} | Estoque Real: ${estoqueReal}`);

        if (estoqueReal < (item.quantidade_reposicao || 0)) {
          faltantes.push(`${produto.descricao} (Disponível: ${estoqueReal}, Necessário: ${item.quantidade_reposicao})`);
        }
      }

      if (faltantes.length > 0) {
        const errorTitle = `Estoque insuficiente na sua unidade`;
        setStockError({ title: errorTitle, items: faltantes });
        throw new Error('STOCK_ERROR');
      }
    }
  };

  // Buscar todos os rascunhos ativos (Pedidos)
  const { data: drafts = [], isLoading, refetch } = useQuery({
    queryKey: ['rascunhos-compras-todos'],
    queryFn: async () => {
      if (!user?.id || (!canManageDrafts && !canAccessReports)) {
        console.log('⚠️ Usuário não autorizado para rascunhos');
        return [];
      }

      console.log('🔍 Buscando todos os rascunhos compartilhados');
      
      // Buscar rascunhos sem JOIN para evitar problemas de RLS
      let query = supabase
        .from('rascunhos_compras')
        .select('*')
        .eq('ativo', true)
        .order('data_atualizacao', { ascending: false });

      // Lógica de Filtro:
      // 1. Super Admin e Admin vêem tudo do município
      // 2. Usuário Comum com 'acesso_global_pedidos' vê tudo do município
      // 3. Usuário Comum sem permissão vê apenas o da sua unidade_id
      if (!hasGlobalAccess && (user as any)?.unidade_id) {
        query = query.eq('unidade_id', (user as any).unidade_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar rascunhos:', error);
        throw error;
      }

      console.log('✅ Rascunhos encontrados:', data?.length || 0);
      
      // Buscar dados dos usuários e unidades separadamente
      const userIds = [...new Set(data?.map(item => item.usuario_id) || [])];
      
      const [usersData, unitsData] = await Promise.all([
        userIds.length > 0 ? supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds) : { data: [] },
        supabase
          .from('unidades_saude')
          .select('id, nome')
      ]);

      const usersMap = new Map(
        (usersData.data || []).map(p => [p.id, { nome: p.full_name, email: p.email }])
      );

      const unitsMap = new Map(
        (unitsData.data || []).map(u => [u.id, u.nome])
      );
      
      return (data || []).map(item => ({
        ...item,
        dados_produtos: Array.isArray(item.dados_produtos) ? (item.dados_produtos as unknown as PurchaseDraftItem[]) : [],
        criado_por: usersMap.get(item.usuario_id) || {
          nome: 'Usuário desconhecido',
          email: ''
        },
        unidade_nome: unitsMap.get((item as any).unidade_id) || 'Unidade não informada',
        unidade_origem_nome: unitsMap.get((item as any).unidade_origem_id) || 'Almoxarifado'
      })) as RascunhoCompra[];
    },
    enabled: !!user?.id && (canManageDrafts || canAccessReports),
  });

  // Criar novo rascunho
  const createDraftMutation = useMutation({
    mutationFn: async ({ nome_rascunho, dados_produtos, unidade_id }: CreateDraftRequest & { unidade_id?: string }) => {
      if (!user?.id) {
        throw new Error('Usuário não logado');
      }
      if (!canManageDrafts) {
        throw new Error('Usuário sem permissão para gerenciar rascunhos');
      }

      console.log('📝 Criando novo rascunho:', nome_rascunho);

      const targetUnidadeId = unidade_id || (user as any).unidade_id;
      const unidadeOrigemId = (user as any).unidade_id; // Unidade atual do usuário logado

      // Validar estoque se for usuário global
      await validateStockAvailability(dados_produtos, unidadeOrigemId);

      const { data, error } = await supabase
        .from('rascunhos_compras')
        .insert({
          usuario_id: user.id,
          nome_rascunho,
          dados_produtos: dados_produtos as any,
          ativo: true,
          status: 'rascunho',
          unidade_id: targetUnidadeId,
          unidade_origem_id: unidadeOrigemId,
          tenant_id: user.tenant_id || '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar rascunho:', error);
        throw error;
      }

      console.log('✅ Rascunho criado:', data.id);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras-todos'] });
      setCurrentDraftId(data.id);
      toast({
        title: "Rascunho salvo",
        description: "Seu rascunho foi salvo com sucesso.",
      });
    },
    onError: (error: any) => {
      console.error('❌ Erro ao salvar rascunho:', error);
      if (error.message === 'STOCK_ERROR') return;
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o rascunho. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Atualizar rascunho existente
  const updateDraftMutation = useMutation({
    mutationFn: async ({ id, nome_rascunho, dados_produtos, status, entregue_por_id, data_entrega, unidade_id }: any) => {
      if (!user?.id) {
        throw new Error('Usuário não logado');
      }
      
      // Allow updates for users with either permission
      if (!canManageDrafts && !canAccessReports) {
        throw new Error('Usuário sem permissão para gerenciar rascunhos');
      }

      console.log('✏️ Atualizando rascunho:', id);

      // A unidade de origem SEMPRE será a unidade atual do usuário que está gerenciando/autorizando
      // se ele tiver acesso global, pois é de lá que o estoque será deduzido.
      const originId = (user as any).unidade_id;

      if (!originId) {
        throw new Error('Unidade atual do usuário não identificada.');
      }

      // Validar estoque na unidade atual do usuário (origem)
      await validateStockAvailability(dados_produtos, originId);

      const updateData: any = { 
        dados_produtos: dados_produtos as any,
        unidade_origem_id: originId // Atualiza para a unidade atual do usuário
      };
      if (nome_rascunho) {
        updateData.nome_rascunho = nome_rascunho;
      }
      if (unidade_id) {
        updateData.unidade_id = unidade_id;
      }

      // Verificar se o usuário pode editar este rascunho
      const draft = drafts.find(d => d.id === id);
      const canEdit = draft && (
        draft.usuario_id === user.id || 
        isManagement || 
        canAccessReports || 
        canManageDrafts
      );
      
      if (!canEdit) {
        throw new Error('Você não tem permissão para editar este rascunho');
      }

      const { data, error } = await supabase
        .from('rascunhos_compras')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar rascunho:', error);
        throw error;
      }

      console.log('✅ Rascunho atualizado:', data.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras-todos'] });
    },
    onError: (error: any) => {
      console.error('❌ Erro ao atualizar rascunho:', error);
      if (error.message === 'STOCK_ERROR') return;
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o rascunho.",
        variant: "destructive",
      });
    },
  });

  // Excluir rascunho
  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      if (!user?.id) {
        throw new Error('Usuário não logado');
      }
      if (!canManageDrafts) {
        throw new Error('Usuário sem permissão para gerenciar rascunhos');
      }

      console.log('🗑️ Excluindo rascunho:', draftId);

      // Verificar se o usuário pode excluir este rascunho
      const draft = drafts.find(d => d.id === draftId);
      const canDelete = draft && (draft.usuario_id === user.id || isManagement || canAccessReports);
      
      if (!canDelete) {
        throw new Error('Você não tem permissão para excluir este rascunho');
      }

      const { error } = await supabase
        .from('rascunhos_compras')
        .update({ ativo: false })
        .eq('id', draftId);

      if (error) {
        console.error('❌ Erro ao excluir rascunho:', error);
        throw error;
      }

      console.log('✅ Rascunho excluído:', draftId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras-todos'] });
      setCurrentDraftId(null);
      toast({
        title: "Rascunho excluído",
        description: "O rascunho foi excluído com sucesso.",
      });
    },
    onError: (error) => {
      console.error('❌ Erro ao excluir rascunho:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o rascunho.",
        variant: "destructive",
      });
    },
  });

  const autoSave = async (items: PurchaseDraftItem[]) => {
    if (!user?.id || isAutoSaving) return;
    
    // Allow auto-save for all users with report access
    if (!canManageDrafts && !canAccessReports) return;

    try {
      setIsAutoSaving(true);
      console.log('💾 Auto-salvando rascunho...');

      // SÓ auto-salva se já houver um rascunho selecionado (evita sobreposição)
      if (currentDraftId) {
        await updateDraftMutation.mutateAsync({
          id: currentDraftId,
          dados_produtos: items
        });
        console.log('✅ Auto-save concluído');
      } else {
        console.log('ℹ️ Auto-save ignorado: nenhum rascunho ativo (novo pedido)');
      }
    } catch (error) {
      console.error('❌ Erro no auto-save:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const saveDraft = (nome: string, items: PurchaseDraftItem[], unidade_id?: string) => {
    // Permitir salvar para ambos os tipos de usuários
    if (!canManageDrafts && !canAccessReports) {
      console.error('Usuário sem permissão para gerenciar rascunhos');
      return;
    }
    
    if (currentDraftId) {
      // Se já temos um ID, estamos editando um rascunho existente
      // Garantir que não sobrescrevemos a unidade_id se ela for passada (caso de edição global)
      const updatePayload: any = {
        id: currentDraftId,
        nome_rascunho: nome,
        dados_produtos: items
      };

      if (unidade_id) {
        updatePayload.unidade_id = unidade_id;
      }

      updateDraftMutation.mutate(updatePayload);
    } else {
      // Se o ID é nulo, é um NOVO rascunho (mesmo que baseado em outro)
      if (canManageDrafts) {
        createDraftMutation.mutate({
          nome_rascunho: nome,
          dados_produtos: items,
          unidade_id: unidade_id
        } as any);
      }
    }
  };

  const authorizeDraft = useMutation({
    mutationFn: async (draftId: string) => {
      console.log('🛡️ Tentando autorizar rascunho:', draftId);
      if (!user?.id || !hasPermission('acesso_global_pedidos')) {
        console.error('❌ Permissão negada para autorizar');
        throw new Error('Sem permissão para autorizar pedidos');
      }

      const { data, error } = await supabase
        .from('rascunhos_compras')
        .update({ 
          status: 'autorizado',
          autorizado_por_id: user.id,
          data_autorizacao: new Date().toISOString(),
          unidade_origem_id: (user as any).unidade_id // Registra a unidade que autorizou
        })
        .eq('id', draftId)
        .select();
      
      if (error) {
        console.error('❌ Erro Supabase ao autorizar:', error);
        throw error;
      }
      console.log('✅ Autorização concluída com sucesso:', data);
    },
    onSuccess: () => {
      toast({ title: "Pedido Autorizado!", description: "A unidade já pode retirar os produtos." });
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras-todos'] });
    },
    onError: (err: any) => {
      console.error('❌ Erro na mutation authorizeDraft:', err);
      toast({ title: "Erro ao autorizar", description: err.message, variant: "destructive" });
    }
  });

  const confirmDelivery = useMutation({
    mutationFn: async (draft: RascunhoCompra) => {
      if (!user?.id || !hasPermission('acesso_global_pedidos')) {
        throw new Error('Sem permissão para confirmar entrega');
      }

      // A unidade de origem SEMPRE será a unidade atual do usuário que está entregando,
      // pois é de lá que o estoque será deduzido fisicamente no momento da entrega.
      const unidadeOrigemId = (user as any).unidade_id;
      
      if (!unidadeOrigemId) {
        throw new Error('Sua unidade atual não foi identificada.');
      }

      console.log('📦 Validando estoque na sua unidade atual:', unidadeOrigemId);

      // Validar estoque
      await validateStockAvailability(draft.dados_produtos, unidadeOrigemId);

      console.log('✅ Estoque validado. Confirmando entrega via Trigger...');

      // A atualização de estoque agora é feita via TRIGGER no banco de dados (processar_entrega_pedido)
      const { error } = await supabase
        .from('rascunhos_compras')
        .update({ 
          status: 'entregue',
          entregue_por_id: user.id,
          data_entrega: new Date().toISOString(),
          unidade_origem_id: unidadeOrigemId // Garante que a origem no banco seja a unidade atual de quem entregou
        })
        .eq('id', draft.id);
      
      if (error) {
        console.error('❌ Erro ao atualizar status do rascunho:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Entrega Confirmada!", description: "O estoque da unidade foi atualizado automaticamente." });
      
      // Invalidar caches para refletir as mudanças em todo o sistema
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras-todos'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-products'] });
      
      // Invalida estatísticas do dashboard e históricos
      queryClient.invalidateQueries({ queryKey: ['produto-stats'] });
      queryClient.invalidateQueries({ queryKey: ['entradas-mes'] });
      queryClient.invalidateQueries({ queryKey: ['dispensacoes-mes'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-recentes'] });
      queryClient.invalidateQueries({ queryKey: ['historico-entradas'] });
      queryClient.invalidateQueries({ queryKey: ['historico-dispensacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-vencendo'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-baixo-estoque'] });
    },
    onError: (err: any) => {
      if (err.message === 'STOCK_ERROR') return;
      toast({ title: "Erro ao confirmar entrega", description: err.message, variant: "destructive" });
    }
  });

  const loadDraft = (draft: RascunhoCompra): PurchaseDraftItem[] => {
    setCurrentDraftId(draft.id);
    return Array.isArray(draft.dados_produtos) ? draft.dados_produtos : [];
  };

  const createNewDraft = () => {
    setCurrentDraftId(null);
  };

  const deleteDraft = (draftId: string) => {
    if (!canManageDrafts) {
      console.error('Usuário sem permissão para gerenciar rascunhos');
      return;
    }
    
    // Verificar permissão antes de executar: APENAS usuários com Acesso Global podem excluir pedidos
    if (!hasGlobalAccess) {
      toast({
        title: "Sem permissão",
        description: "Apenas usuários com 'Acesso Global a Pedidos' podem excluir pedidos.",
        variant: "destructive",
      });
      return;
    }
    
    deleteDraftMutation.mutate(draftId);
  };

  const getCurrentDraft = () => {
    if (!currentDraftId) return undefined;
    return drafts.find(d => d.id === currentDraftId);
  };

  // Função para verificar se pode editar um rascunho
  const canEditDraft = (draft: RascunhoCompra): boolean => {
    return draft.usuario_id === user?.id || isManagement || canAccessReports;
  };

  // Função para verificar se pode excluir um rascunho
  const canDeleteDraft = (draft: RascunhoCompra): boolean => {
    return hasGlobalAccess;
  };

  return {
    drafts,
    isLoading,
    currentDraftId,
    isAutoSaving,
    canManageDrafts,
    canEditDraft,
    canDeleteDraft,
    saveDraft,
    loadDraft,
    deleteDraft,
    autoSave,
    createNewDraft,
    getCurrentDraft,
    authorizeDraft,
    confirmDelivery,
    stockError,
    clearStockError: () => setStockError(null),
    isSaving: createDraftMutation.isPending || updateDraftMutation.isPending || deleteDraftMutation.isPending || authorizeDraft.isPending || confirmDelivery.isPending
  };
}