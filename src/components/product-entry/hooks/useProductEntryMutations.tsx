
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useProductEntryMutations() {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();

  const createEntryMutation = useMutation({
    mutationFn: async (entryData: any) => {
      if (!hasPermission('entrada_produtos')) throw new Error('Sem permissão para registrar entradas');
      
      const { error } = await supabase
        .from('entradas_produtos')
        .insert([{
          produto_id: entryData.produto_id,
          quantidade: parseInt(entryData.quantidade),
          lote: entryData.lote,
          vencimento: entryData.vencimento,
          data_entrada: entryData.data_entrada,
          usuario_id: user!.id,
          tenant_id: user?.tenant_id || '00000000-0000-0000-0000-000000000000',
          unidade_id: user?.unidade_id
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Entrada registrada!",
        description: "A entrada do produto foi registrada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['entradas-produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao registrar entrada",
        description: "Não foi possível registrar a entrada do produto.",
        variant: "destructive",
      });
      console.error('Erro:', error);
    }
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      if (!hasPermission('entrada_produtos')) throw new Error('Sem permissão para atualizar entradas');
      
      // Atualizar entrada
      // O gatilho no banco de dados cuidará do ajuste de estoque se necessário
      // (Se o gatilho estiver configurado para UPDATE, senão precisaremos ajustar aqui)
      const { error: updateError } = await supabase
        .from('entradas_produtos')
        .update({
          quantidade: data.quantidade,
          lote: data.lote,
          vencimento: data.vencimento,
          data_entrada: data.data_entrada
        })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Entrada atualizada!",
        description: "A entrada foi atualizada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['entradas-produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar entrada",
        description: "Não foi possível atualizar a entrada.",
        variant: "destructive",
      });
      console.error('Erro:', error);
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission('pode_excluir')) throw new Error('Sem permissão para excluir registros');
      
      // Excluir entrada
      // O gatilho no banco de dados cuidará da reversão do estoque
      const { error: deleteError } = await supabase
        .from('entradas_produtos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast({
        title: "Entrada excluída!",
        description: "A entrada foi excluída e o estoque foi ajustado.",
      });
      queryClient.invalidateQueries({ queryKey: ['entradas-produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir entrada",
        description: error instanceof Error ? error.message : "Não foi possível excluir a entrada.",
        variant: "destructive",
      });
      console.error('Erro:', error);
    }
  });

  const handleSubmit = (
    e: React.FormEvent,
    formData: {
      selectedProduct: string;
      quantidade: string;
      lote: string;
      vencimento: string;
      dataEntrada: string;
    },
    resetForm: () => void
  ) => {
    e.preventDefault();
    
    console.log('[ProductEntry] Submetendo formulário:', formData);

    if (!formData.selectedProduct) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, selecione um produto.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.quantidade || parseInt(formData.quantidade) <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "A quantidade deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.lote) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe o lote.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.vencimento) {
      toast({
        title: "Vencimento inválido",
        description: "Por favor, informe uma data de vencimento válida (dd/mm/aaaa).",
        variant: "destructive",
      });
      return;
    }

    if (!formData.dataEntrada) {
      toast({
        title: "Data de entrada inválida",
        description: "Por favor, informe uma data de entrada válida (dd/mm/aaaa).",
        variant: "destructive",
      });
      return;
    }

    createEntryMutation.mutate({
      produto_id: formData.selectedProduct,
      quantidade: formData.quantidade,
      lote: formData.lote,
      vencimento: formData.vencimento,
      data_entrada: formData.dataEntrada
    }, {
      onSuccess: () => {
        resetForm();
      }
    });
  };

  return {
    createEntryMutation,
    updateEntryMutation,
    deleteEntryMutation,
    handleSubmit
  };
}
