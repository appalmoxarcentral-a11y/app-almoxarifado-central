
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
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
    handleSubmit
  };
}
