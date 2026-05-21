import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RascunhoCompra, PurchaseDraftItem, CreateDraftRequest, UpdateDraftRequest } from "@/types/purchase-draft";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";

export function usePurchaseDraftPersistence() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Usar localStorage para persistir o rascunho atual entre sessões e atualizações
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(() => {
    return localStorage.getItem('lastWorkedDraftId');
  });

  const updateCurrentDraftId = (id: string | null) => {
    setCurrentDraftId(id);
    if (id) {
      localStorage.setItem('lastWorkedDraftId', id);
    } else {
      localStorage.removeItem('lastWorkedDraftId');
    }
  };

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
      console.log(`📦 Validando estoque real (BATCH) para ${itemsToDeliver.length} itens na unidade: ${originId}`);
      
      const faltantes: string[] = [];
      const codigos = [...new Set(itemsToDeliver.map(i => i.codigo))];

      // 1. Buscar todos os produtos de uma vez (Batch)
      const { data: produtosData, error: prodError } = await supabase
        .from('produtos')
        .select('id, codigo, descricao')
        .in('codigo', codigos);

      if (prodError || !produtosData) {
        console.error('❌ Erro ao buscar produtos para validação:', prodError);
        return;
      }

      const produtoIds = produtosData.map(p => p.id);
      const produtosMap = new Map(produtosData.map(p => [p.id, p.descricao]));
      const codigoToIdMap = new Map(produtosData.map(p => [p.codigo, p.id]));

      // 2. Buscar todo o estoque consolidado da unidade de uma vez (fallback para itens sem lote)
      const { data: estoqueData, error: estError } = await supabase
        .from('produtos_estoque')
        .select('produto_id, estoque_atual')
        .eq('unidade_id', originId)
        .in('produto_id', produtoIds);

      if (estError) {
        console.error('❌ Erro ao buscar estoque para validação:', estError);
        return;
      }

      const estoqueMap = new Map(estoqueData?.map(e => [e.produto_id, e.estoque_atual]) || []);

      // 3. Comparar quantidades
      // 3. Buscar saldos por lote para tratar cada lote como item independente.
      const { data: entradasData, error: entradasError } = await supabase
        .from('entradas_produtos')
        .select('produto_id, lote, vencimento, quantidade')
        .eq('unidade_id', originId)
        .in('produto_id', produtoIds);

      if (entradasError) {
        console.error('❌ Erro ao buscar entradas para validação por lote:', entradasError);
        return;
      }

      const { data: saidasData, error: saidasError } = await supabase
        .from('dispensacoes')
        .select('produto_id, lote, quantidade')
        .eq('unidade_id', originId)
        .in('produto_id', produtoIds);

      if (saidasError) {
        console.error('❌ Erro ao buscar saídas para validação por lote:', saidasError);
        return;
      }

      const saldoPorProdutoLote = new Map<string, number>();

      for (const entrada of entradasData || []) {
        const loteKey = `${entrada.produto_id}::${entrada.lote}`;
        saldoPorProdutoLote.set(loteKey, (saldoPorProdutoLote.get(loteKey) || 0) + entrada.quantidade);
      }

      for (const saida of saidasData || []) {
        const loteKey = `${saida.produto_id}::${saida.lote}`;
        saldoPorProdutoLote.set(loteKey, (saldoPorProdutoLote.get(loteKey) || 0) - saida.quantidade);
      }

      const necessidadePorProdutoLote = new Map<string, { descricao: string; lote: string; necessario: number }>();
      const itensSemLote: PurchaseDraftItem[] = [];

      for (const item of itemsToDeliver) {
        const produtoId = codigoToIdMap.get(item.codigo);
        if (!produtoId) continue;

        const descricao = produtosMap.get(produtoId) || item.descricao;
        const lotesSelecionados = item.lotes_multiplos?.filter(lote => lote.lote && lote.quantidade > 0)
          || (item.lote_selecionado && item.vencimento_selecionado && (item.quantidade_reposicao || 0) > 0
            ? [{
                lote: item.lote_selecionado,
                vencimento: item.vencimento_selecionado,
                quantidade: item.quantidade_reposicao || 0
              }]
            : []);

        if (lotesSelecionados.length === 0) {
          itensSemLote.push(item);
          continue;
        }

        for (const loteInfo of lotesSelecionados) {
          const loteKey = `${produtoId}::${loteInfo.lote}`;
          const existente = necessidadePorProdutoLote.get(loteKey);

          necessidadePorProdutoLote.set(loteKey, {
            descricao,
            lote: loteInfo.lote,
            necessario: (existente?.necessario || 0) + loteInfo.quantidade
          });
        }
      }

      for (const [loteKey, necessidade] of necessidadePorProdutoLote.entries()) {
        const saldoDisponivel = saldoPorProdutoLote.get(loteKey) || 0;

        if (saldoDisponivel < necessidade.necessario) {
          faltantes.push(
            `${necessidade.descricao} - Lote ${necessidade.lote} (Disponível: ${saldoDisponivel}, Necessário: ${necessidade.necessario})`
          );
        }
      }

      // 4. Fallback para itens ainda sem lote definido
      for (const item of itensSemLote) {
        const produtoId = codigoToIdMap.get(item.codigo);
        if (!produtoId) continue;

        const estoqueReal = estoqueMap.get(produtoId) || 0;
        const descricao = produtosMap.get(produtoId);

        if (estoqueReal < (item.quantidade_reposicao || 0)) {
          faltantes.push(`${descricao} (Disponível: ${estoqueReal}, Necessário: ${item.quantidade_reposicao})`);
        }
      }

      if (faltantes.length > 0) {
        const errorTitle = `Estoque insuficiente na sua unidade`;
        setStockError({ title: errorTitle, items: faltantes });
        throw new Error('STOCK_ERROR');
      }
      
      console.log('✅ Validação de estoque concluída com sucesso');
    }
  };

  // Buscar todos os rascunhos ativos (Pedidos)
  const { data: drafts = [], isLoading, refetch } = useQuery({
    queryKey: ['rascunhos-compras-todos'],
    refetchOnWindowFocus: false,
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
      // Determinar unidade de origem e destino
      const CENTRAL_ID = '9dce634a-7ee1-46b2-92e6-916f5789875c';
      const currentUserUnidadeId = (user as any).unidade_id;
      
      // Se quem está salvando não for a Central, a origem do pedido é a Central e o destino é a unidade do usuário.
      // Se for a Central salvando para outra unidade, a origem é a Central e o destino é targetUnidadeId.
      const isCentralUser = currentUserUnidadeId === CENTRAL_ID;
      const unidadeOrigemId = CENTRAL_ID; 
      const unidadeDestinoId = targetUnidadeId || currentUserUnidadeId;

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
          unidade_id: unidadeDestinoId,
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
      updateCurrentDraftId(data.id);
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

      const CENTRAL_ID = '9dce634a-7ee1-46b2-92e6-916f5789875c';
      const originId = CENTRAL_ID;

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
      updateCurrentDraftId(null);
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

  const saveDraft = useCallback((nome: string, items: PurchaseDraftItem[], unidade_id?: string, onSuccess?: (data: any) => void) => {
    // Permitir salvar para ambos os tipos de usuários
    if (!canManageDrafts && !canAccessReports) {
      console.error('Usuário sem permissão para gerenciar rascunhos');
      return;
    }

    const itemsWithQty = items.filter(item => (item.quantidade_reposicao || 0) > 0);
    console.log(`💾 Salvando rascunho: "${nome}". Total itens: ${items.length}. Itens com reposição: ${itemsWithQty.length}`);
    
    if (currentDraftId) {
      // Se já temos um ID, estamos editando um rascunho existente
      const updatePayload: any = {
        id: currentDraftId,
        nome_rascunho: nome,
        dados_produtos: items
      };

      if (unidade_id) {
        updatePayload.unidade_id = unidade_id;
      }

      updateDraftMutation.mutate(updatePayload, {
        onSuccess: (data) => {
          if (onSuccess) onSuccess(data);
        }
      });
    } else {
      // Se o ID é nulo, é um NOVO rascunho
      if (canManageDrafts) {
        createDraftMutation.mutate({
          nome_rascunho: nome,
          dados_produtos: items,
          unidade_id: unidade_id
        } as any, {
          onSuccess: (data) => {
            if (onSuccess) onSuccess(data);
          }
        });
      }
    }
  }, [canManageDrafts, canAccessReports, currentDraftId, createDraftMutation, updateDraftMutation]);

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
      if (!hasPermission('acesso_global_pedidos')) {
        throw new Error('Sem permissão para confirmar entrega');
      }

      if (draft.status === 'entregue') {
        throw new Error('Este pedido já foi entregue');
      }

      if (draft.status !== 'autorizado') {
        throw new Error('O pedido só pode ser finalizado ao confirmar uma entrega autorizada');
      }

      if (!draft.unidade_id) {
        throw new Error('Pedido sem unidade de destino definida');
      }

      const CENTRAL_ID = '9dce634a-7ee1-46b2-92e6-916f5789875c';
      const unidadeOrigemId = CENTRAL_ID;

      console.log('📦 Validando estoque na unidade de origem:', unidadeOrigemId);

      // Validar estoque (agora considerando lotes múltiplos se houver)
      await validateStockAvailability(draft.dados_produtos, unidadeOrigemId);

      console.log('✅ Estoque validado. Iniciando processamento de entrega...');

      // 1. Processar cada item do rascunho
      for (const item of draft.dados_produtos) {
        if ((item.quantidade_reposicao || 0) <= 0) continue;

        const { data: produto } = await supabase
          .from('produtos')
          .select('id, descricao')
          .eq('codigo', item.codigo)
          .single();

        if (!produto) continue;

        const lotesParaProcessar = item.lotes_multiplos || (item.lote_selecionado ? [{
          lote: item.lote_selecionado,
          vencimento: item.vencimento_selecionado!,
          quantidade: item.quantidade_reposicao!
        }] : []);

        for (const loteInfo of lotesParaProcessar) {
          // A. Registrar SAÍDA no Almoxarifado Central (Origem)
          const { error: errorSaida } = await supabase
            .from('dispensacoes')
            .insert({
              produto_id: produto.id,
              unidade_id: unidadeOrigemId,
              quantidade: loteInfo.quantidade,
              lote: loteInfo.lote,
              procedimento: `REPOSIÇÃO PARA ${draft.unidade_nome || 'UNIDADE'}`,
              data_dispensa: new Date().toISOString(),
              usuario_id: user.id,
              tenant_id: user.tenant_id
            });

          if (errorSaida) throw errorSaida;

          // B. Registrar ENTRADA na Unidade de Destino
          const { error: errorEntrada } = await supabase
            .from('entradas_produtos')
            .insert({
              produto_id: produto.id,
              unidade_id: draft.unidade_id,
              quantidade: loteInfo.quantidade,
              lote: `${loteInfo.lote} (Almoxarifado Central)`,
              vencimento: loteInfo.vencimento,
              data_entrada: new Date().toISOString(),
              usuario_id: user.id,
              tenant_id: user.tenant_id
            });

          if (errorEntrada) throw errorEntrada;
        }
      }

      // 2. Atualizar status do rascunho
      const { error: errorStatus } = await supabase
        .from('rascunhos_compras')
        .update({ 
          status: 'entregue',
          entregue_por_id: user.id,
          data_entrega: new Date().toISOString(),
          unidade_origem_id: unidadeOrigemId
        })
        .eq('id', draft.id);
      
      if (errorStatus) throw errorStatus;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rascunhos-compras-todos'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase-products'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase-lot-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['produto-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['entradas-mes'] }),
        queryClient.invalidateQueries({ queryKey: ['dispensacoes-mes'] }),
        queryClient.invalidateQueries({ queryKey: ['movimentacoes-recentes'] }),
        queryClient.invalidateQueries({ queryKey: ['historico-entradas'] }),
        queryClient.invalidateQueries({ queryKey: ['historico-dispensacoes'] }),
        queryClient.invalidateQueries({ queryKey: ['produtos-vencendo'] }),
        queryClient.invalidateQueries({ queryKey: ['produtos-baixo-estoque'] })
      ]);

      toast({ title: "Entrega Confirmada!", description: "Pedido finalizado e estoques atualizados na unidade de destino." });
    },
    onError: (err: any) => {
      if (err.message === 'STOCK_ERROR') return;
      toast({ title: "Erro ao confirmar entrega", description: err.message, variant: "destructive" });
    }
  });

  const loadDraft = (draft: RascunhoCompra): PurchaseDraftItem[] => {
    updateCurrentDraftId(draft.id);
    return Array.isArray(draft.dados_produtos) ? draft.dados_produtos : [];
  };

  const createNewDraft = () => {
    updateCurrentDraftId(null);
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
