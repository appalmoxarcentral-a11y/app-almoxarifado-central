
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useProductEntryMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createEntryMutation = useMutation({
    mutationFn: async (entryData: any) => {
      const { error } = await supabase
        .from('entradas_produtos')
        .insert([{
          produto_id: entryData.produto_id,
          quantidade: parseInt(entryData.quantidade),
          lote: entryData.lote,
          vencimento: entryData.vencimento,
          data_entrada: entryData.data_entrada,
          usuario_id: user!.id
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
      // Buscar dados atuais da entrada para calcular diferença no estoque
      const { data: currentEntry, error: fetchError } = await supabase
        .from('entradas_produtos')
        .select('quantidade, produto_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const quantidadeDiferenca = data.quantidade - currentEntry.quantidade;

      // Atualizar entrada
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

      // Ajustar estoque se houve mudança na quantidade
      if (quantidadeDiferenca !== 0) {
        const { error: stockError } = await supabase
          .from('produtos')
          .update({
            estoque_atual: supabase.raw(`estoque_atual + ${quantidadeDiferenca}`)
          })
          .eq('id', currentEntry.produto_id);

        if (stockError) throw stockError;
      }
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
      // Buscar dados da entrada para reverter estoque
      const { data: entry, error: fetchError } = await supabase
        .from('entradas_produtos')
        .select('quantidade, produto_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Verificar se há estoque suficiente para reverter
      const { data: product, error: productError } = await supabase
        .from('produtos')
        .select('estoque_atual')
        .eq('id', entry.produto_id)
        .single();

      if (productError) throw productError;

      if (product.estoque_atual < entry.quantidade) {
        throw new Error('Não é possível excluir esta entrada. Estoque insuficiente para reverter a operação.');
      }

      // Excluir entrada
      const { error: deleteError } = await supabase
        .from('entradas_produtos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Reverter estoque
      const { error: stockError } = await supabase
        .from('produtos')
        .update({
          estoque_atual: supabase.raw(`estoque_atual - ${entry.quantidade}`)
        })
        .eq('id', entry.produto_id);

      if (stockError) throw stockError;
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
    
    if (!formData.selectedProduct || !formData.quantidade || !formData.lote || !formData.vencimento) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
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
    });

    if (createEntryMutation.isSuccess) {
      resetForm();
    }
  };

  return {
    createEntryMutation,
    updateEntryMutation,
    deleteEntryMutation,
    handleSubmit
  };
}
