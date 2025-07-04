
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseItem } from '@/types/purchase';

export function usePurchaseData() {
  const { data: produtos, isLoading, error } = useQuery({
    queryKey: ['purchase-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');

      if (error) throw error;

      return data.map(produto => ({
        id: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        unidade_medida: produto.unidade_medida,
        estoque_atual: produto.estoque_atual,
        quantidade_reposicao: undefined
      })) as PurchaseItem[];
    }
  });

  return {
    produtos: produtos || [],
    isLoading,
    error
  };
}
