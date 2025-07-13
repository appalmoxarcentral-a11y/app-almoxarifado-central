import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { PurchaseReportDraft, CreateDraftRequest, UpdateDraftRequest, PurchaseDraftItem } from '@/types/purchase-draft';

export function usePurchaseDraftPersistence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Garantir que o contexto do usuário esteja definido na sessão
  useEffect(() => {
    if (user?.id) {
      supabase.rpc('set_current_user_id', { user_id_param: user.id })
        .then(({ error }) => {
          if (error) console.error('Erro ao definir contexto do usuário:', error);
        });
    }
  }, [user?.id]);

  // Buscar rascunhos do usuário
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['purchase-drafts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('relatorios_compras_rascunho')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('finalizado', false)
        .order('data_atualizacao', { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        items: item.items as unknown as PurchaseDraftItem[]
      })) as PurchaseReportDraft[];
    },
    enabled: !!user?.id
  });

  // Criar novo rascunho
  const createDraftMutation = useMutation({
    mutationFn: async (data: CreateDraftRequest) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('relatorios_compras_rascunho')
        .insert({
          usuario_id: user.id,
          nome_rascunho: data.nome_rascunho,
          items: data.items as any
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...result,
        items: result.items as unknown as PurchaseDraftItem[]
      } as PurchaseReportDraft;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      setCurrentDraftId(data.id);
      toast({
        title: "Rascunho salvo",
        description: `Rascunho "${data.nome_rascunho}" criado com sucesso.`
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível criar o rascunho.",
        variant: "destructive"
      });
      console.error('Error creating draft:', error);
    }
  });

  // Atualizar rascunho existente
  const updateDraftMutation = useMutation({
    mutationFn: async (data: UpdateDraftRequest) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('relatorios_compras_rascunho')
        .update({
          nome_rascunho: data.nome_rascunho,
          items: data.items as any
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...result,
        items: result.items as unknown as PurchaseDraftItem[]
      } as PurchaseReportDraft;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      toast({
        title: "Rascunho atualizado",
        description: `Rascunho "${data.nome_rascunho}" salvo com sucesso.`
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar o rascunho.",
        variant: "destructive"
      });
      console.error('Error updating draft:', error);
    }
  });

  // Excluir rascunho
  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('relatorios_compras_rascunho')
        .delete()
        .eq('id', draftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-drafts'] });
      setCurrentDraftId(null);
      toast({
        title: "Rascunho excluído",
        description: "Rascunho removido com sucesso."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível remover o rascunho.",
        variant: "destructive"
      });
      console.error('Error deleting draft:', error);
    }
  });

  // Auto-save
  const autoSave = useCallback(async (items: PurchaseDraftItem[]) => {
    if (!currentDraftId || isAutoSaving) return;

    setIsAutoSaving(true);
    try {
      const currentDraft = drafts.find(d => d.id === currentDraftId);
      if (currentDraft) {
        await updateDraftMutation.mutateAsync({
          id: currentDraftId,
          items: items
        });
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [currentDraftId, isAutoSaving, drafts, updateDraftMutation]);

  const saveDraft = useCallback((nome: string, items: PurchaseDraftItem[]) => {
    if (currentDraftId) {
      updateDraftMutation.mutate({
        id: currentDraftId,
        nome_rascunho: nome,
        items: items
      });
    } else {
      createDraftMutation.mutate({
        nome_rascunho: nome,
        items: items
      });
    }
  }, [currentDraftId, createDraftMutation, updateDraftMutation]);

  const loadDraft = useCallback((draft: PurchaseReportDraft) => {
    setCurrentDraftId(draft.id);
    return draft.items;
  }, []);

  const createNewDraft = useCallback(() => {
    setCurrentDraftId(null);
  }, []);

  const deleteDraft = useCallback((draftId: string) => {
    deleteDraftMutation.mutate(draftId);
  }, [deleteDraftMutation]);

  const getCurrentDraft = useCallback(() => {
    return drafts.find(d => d.id === currentDraftId);
  }, [drafts, currentDraftId]);

  return {
    drafts,
    isLoading,
    currentDraftId,
    isAutoSaving,
    saveDraft,
    loadDraft,
    deleteDraft,
    autoSave,
    createNewDraft,
    getCurrentDraft,
    isSaving: createDraftMutation.isPending || updateDraftMutation.isPending
  };
}