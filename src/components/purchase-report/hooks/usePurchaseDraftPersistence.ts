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

  // Check permissions
  const canManageDrafts = hasPermission('gerenciar_rascunhos_compras');

  // Buscar todos os rascunhos de compras (compartilhados)
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['rascunhos-compras-todos'],
    queryFn: async () => {
      if (!user?.id || !canManageDrafts) {
        console.log('⚠️ Usuário não autorizado para rascunhos');
        return [];
      }

      console.log('🔍 Buscando todos os rascunhos compartilhados');
      
      const { data, error } = await supabase
        .from('rascunhos_compras')
        .select(`
          *,
          usuarios!inner(nome, email)
        `)
        .eq('ativo', true)
        .order('data_atualizacao', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar rascunhos:', error);
        throw error;
      }

      console.log('✅ Rascunhos encontrados:', data?.length || 0);
      
      return (data || []).map(item => ({
        ...item,
        dados_produtos: Array.isArray(item.dados_produtos) ? (item.dados_produtos as unknown as PurchaseDraftItem[]) : [],
        criado_por: {
          nome: (item.usuarios as any)?.nome || 'Usuário desconhecido',
          email: (item.usuarios as any)?.email || ''
        }
      })) as RascunhoCompra[];
    },
    enabled: !!user?.id && canManageDrafts,
  });

  // Criar novo rascunho
  const createDraftMutation = useMutation({
    mutationFn: async ({ nome_rascunho, dados_produtos }: CreateDraftRequest) => {
      if (!user?.id) {
        throw new Error('Usuário não logado');
      }
      if (!canManageDrafts) {
        throw new Error('Usuário sem permissão para gerenciar rascunhos');
      }

      console.log('📝 Criando novo rascunho:', nome_rascunho);

      const { data, error } = await supabase
        .from('rascunhos_compras')
        .insert({
          usuario_id: user.id,
          nome_rascunho,
          dados_produtos: dados_produtos as any,
          ativo: true
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
    onError: (error) => {
      console.error('❌ Erro ao salvar rascunho:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o rascunho. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Atualizar rascunho existente
  const updateDraftMutation = useMutation({
    mutationFn: async ({ id, nome_rascunho, dados_produtos }: UpdateDraftRequest) => {
      if (!user?.id) {
        throw new Error('Usuário não logado');
      }
      if (!canManageDrafts) {
        throw new Error('Usuário sem permissão para gerenciar rascunhos');
      }

      console.log('✏️ Atualizando rascunho:', id);

      const updateData: any = { dados_produtos: dados_produtos as any };
      if (nome_rascunho) {
        updateData.nome_rascunho = nome_rascunho;
      }

      // Verificar se o usuário pode editar este rascunho
      const draft = drafts.find(d => d.id === id);
      const canEdit = draft && (draft.usuario_id === user.id || user.tipo === 'ADMIN');
      
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
    onError: (error) => {
      console.error('❌ Erro ao atualizar rascunho:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o rascunho.",
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
      const canDelete = draft && (draft.usuario_id === user.id || user.tipo === 'ADMIN');
      
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
    if (!user?.id || isAutoSaving || !canManageDrafts) return;

    try {
      setIsAutoSaving(true);
      console.log('💾 Auto-salvando rascunho...');

      if (currentDraftId) {
        // Atualizar rascunho existente
        await updateDraftMutation.mutateAsync({
          id: currentDraftId,
          dados_produtos: items
        });
      } else {
        // Criar novo rascunho automático
        const newDraft = await createDraftMutation.mutateAsync({
          nome_rascunho: `Auto-save ${new Date().toLocaleString()}`,
          dados_produtos: items
        });
        setCurrentDraftId(newDraft.id);
      }
      
      console.log('✅ Auto-save concluído');
    } catch (error) {
      console.error('❌ Erro no auto-save:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const saveDraft = (nome: string, items: PurchaseDraftItem[]) => {
    if (!canManageDrafts) {
      console.error('Usuário sem permissão para gerenciar rascunhos');
      return;
    }
    
    if (currentDraftId) {
      updateDraftMutation.mutate({
        id: currentDraftId,
        nome_rascunho: nome,
        dados_produtos: items
      });
    } else {
      createDraftMutation.mutate({
        nome_rascunho: nome,
        dados_produtos: items
      });
    }
  };

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
    
    // Verificar permissão antes de executar
    const draft = drafts.find(d => d.id === draftId);
    const canDelete = draft && (draft.usuario_id === user?.id || user?.tipo === 'ADMIN');
    
    if (!canDelete) {
      toast({
        title: "Sem permissão",
        description: "Você só pode excluir seus próprios rascunhos.",
        variant: "destructive",
      });
      return;
    }
    
    deleteDraftMutation.mutate(draftId);
  };

  const getCurrentDraft = (): RascunhoCompra | undefined => {
    return drafts.find(draft => draft.id === currentDraftId);
  };

  // Função para verificar se pode editar um rascunho
  const canEditDraft = (draft: RascunhoCompra): boolean => {
    return draft.usuario_id === user?.id || user?.tipo === 'ADMIN';
  };

  // Função para verificar se pode excluir um rascunho
  const canDeleteDraft = (draft: RascunhoCompra): boolean => {
    return draft.usuario_id === user?.id || user?.tipo === 'ADMIN';
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
    isSaving: createDraftMutation.isPending || updateDraftMutation.isPending || deleteDraftMutation.isPending
  };
}