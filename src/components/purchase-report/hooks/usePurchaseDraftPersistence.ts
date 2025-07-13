import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RascunhoCompra, PurchaseDraftItem, CreateDraftRequest, UpdateDraftRequest } from "@/types/purchase-draft";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export function usePurchaseDraftPersistence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Debug: verificar se usuário está autenticado
  useEffect(() => {
    if (user?.id) {
      console.log('✅ Usuário autenticado:', user.id);
    } else {
      console.log('⚠️ Usuário não autenticado');
    }
  }, [user?.id]);

  // Buscar rascunhos de compras
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['rascunhos-compras', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('⚠️ Usuário não logado, não buscando rascunhos');
        return [];
      }

      console.log('🔍 Buscando rascunhos para usuário:', user.id);
      
      // Definir contexto do usuário antes da consulta
      const { error: contextError } = await supabase.rpc('set_current_user_id', { 
        user_id_param: user.id 
      });
      
      if (contextError) {
        console.error('❌ Erro ao definir contexto:', contextError);
        throw contextError;
      }

      const { data, error } = await supabase
        .from('rascunhos_compras')
        .select('*')
        .eq('ativo', true)
        .order('data_atualizacao', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar rascunhos:', error);
        throw error;
      }

      console.log('✅ Rascunhos encontrados:', data?.length || 0);
      
      return (data || []).map(item => ({
        ...item,
        dados_produtos: Array.isArray(item.dados_produtos) ? (item.dados_produtos as unknown as PurchaseDraftItem[]) : []
      })) as RascunhoCompra[];
    },
    enabled: !!user?.id,
  });

  // Criar novo rascunho
  const createDraftMutation = useMutation({
    mutationFn: async ({ nome_rascunho, dados_produtos }: CreateDraftRequest) => {
      if (!user?.id) {
        throw new Error('Usuário não logado');
      }

      console.log('📝 Criando novo rascunho:', nome_rascunho);

      // Definir contexto antes da inserção
      const { error: contextError } = await supabase.rpc('set_current_user_id', { 
        user_id_param: user.id 
      });
      
      if (contextError) {
        console.error('❌ Erro ao definir contexto:', contextError);
        throw contextError;
      }

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
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras'] });
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

      console.log('✏️ Atualizando rascunho:', id);

      // Definir contexto antes da atualização
      const { error: contextError } = await supabase.rpc('set_current_user_id', { 
        user_id_param: user.id 
      });
      
      if (contextError) {
        console.error('❌ Erro ao definir contexto:', contextError);
        throw contextError;
      }

      const updateData: any = { dados_produtos: dados_produtos as any };
      if (nome_rascunho) {
        updateData.nome_rascunho = nome_rascunho;
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
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras'] });
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

      console.log('🗑️ Excluindo rascunho:', draftId);

      // Definir contexto antes da exclusão
      const { error: contextError } = await supabase.rpc('set_current_user_id', { 
        user_id_param: user.id 
      });
      
      if (contextError) {
        console.error('❌ Erro ao definir contexto:', contextError);
        throw contextError;
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
      queryClient.invalidateQueries({ queryKey: ['rascunhos-compras'] });
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
    deleteDraftMutation.mutate(draftId);
  };

  const getCurrentDraft = (): RascunhoCompra | undefined => {
    return drafts.find(draft => draft.id === currentDraftId);
  };

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
    isSaving: createDraftMutation.isPending || updateDraftMutation.isPending || deleteDraftMutation.isPending
  };
}