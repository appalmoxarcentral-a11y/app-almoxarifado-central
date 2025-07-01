
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductEntry } from '@/types';

export const useProductEntryQueries = () => {
  const {
    data: produtos = [],
    isLoading: isLoadingProdutos,
    refetch: refetchProdutos
  } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (error) throw error;
      return data as Product[];
    },
  });

  const {
    data: entradas = [],
    isLoading: isLoadingEntradas,
    refetch: refetchEntradas
  } = useQuery({
    queryKey: ['entradas-produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produtos(*)
        `)
        .order('data_entrada', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as ProductEntry[];
    },
  });

  return {
    produtos,
    isLoadingProdutos,
    refetchProdutos,
    entradas,
    isLoadingEntradas,
    refetchEntradas
  };
};
