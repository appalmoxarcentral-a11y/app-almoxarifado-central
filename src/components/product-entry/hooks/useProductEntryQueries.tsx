
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductEntry } from '@/types';

export function useProductEntryQueries() {
  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (error) throw error;
      return data as Product[];
    }
  });

  const { data: entradas, isLoading: isLoadingEntradas } = useQuery({
    queryKey: ['entradas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as ProductEntry[];
    }
  });

  return {
    produtos,
    isLoadingProdutos,
    entradas,
    isLoadingEntradas
  };
}
