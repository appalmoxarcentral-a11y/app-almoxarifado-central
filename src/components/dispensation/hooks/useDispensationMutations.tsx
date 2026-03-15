
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Product } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
}

export function useDispensationMutations(
  selectedPatient: string,
  dataDispensa: string,
  onSuccess: () => void
) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const createDispensationMutation = useMutation({
    mutationFn: async (items: CarrinhoItem[]) => {
      if (!selectedPatient || !user) {
        throw new Error('Paciente ou usuário não selecionado');
      }

      if (!hasPermission('dispensacao')) {
        throw new Error('Sem permissão para realizar dispensações');
      }
      const dispensationsToCreate = items.map(item => ({
        paciente_id: selectedPatient,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        lote: item.lote,
        data_dispensa: dataDispensa,
        usuario_id: user.id,
        tenant_id: user.tenant_id || '00000000-0000-0000-0000-000000000000'
      }));

      const { error } = await supabase
        .from('dispensacoes')
        .insert(dispensationsToCreate);
      
      if (error) throw error;
    },
    onSuccess: (_, items) => {
      toast({
        title: "Dispensações registradas!",
        description: `${items.length} produto(s) foram dispensados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['dispensacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.message?.includes('Estoque insuficiente')) {
        toast({
          title: "Estoque insuficiente",
          description: "Não há quantidade suficiente em estoque para algum produto.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao registrar dispensações",
          description: "Não foi possível registrar as dispensações.",
          variant: "destructive",
        });
      }
      console.error('Erro:', error);
    }
  });

  const deleteDispensationMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission('pode_excluir')) {
        throw new Error('Sem permissão para excluir dispensações');
      }

      const { error } = await supabase
        .from('dispensacoes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Dispensação excluída",
        description: "O registro foi removido e o estoque ajustado.",
      });
      queryClient.invalidateQueries({ queryKey: ['dispensacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque-global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir dispensação",
        description: error.message || "Não foi possível remover o registro.",
        variant: "destructive",
      });
    }
  });

  return {
    createDispensationMutation,
    deleteDispensationMutation
  };
}
