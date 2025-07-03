
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductEntry } from '@/types';

interface UseProductEntryQueriesParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
}

export const useProductEntryQueries = (params: UseProductEntryQueriesParams = {}) => {
  const { page = 1, limit = 50, searchTerm = '' } = params;

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
    data: entradasData,
    isLoading: isLoadingEntradas,
    refetch: refetchEntradas
  } = useQuery({
    queryKey: ['entradas-produtos', page, limit, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produtos(*)
        `)
        .order('created_at', { ascending: false });

      // Apply search filter if searchTerm is provided
      if (searchTerm) {
        query = query.or(`produto.descricao.ilike.%${searchTerm}%,lote.ilike.%${searchTerm}%`);
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('entradas_produtos')
        .select('*', { count: 'exact', head: true });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      
      if (error) throw error;
      
      return {
        entries: data as ProductEntry[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };
    },
  });

  return {
    produtos,
    isLoadingProdutos,
    refetchProdutos,
    entradas: entradasData?.entries || [],
    isLoadingEntradas,
    refetchEntradas,
    totalCount: entradasData?.totalCount || 0,
    totalPages: entradasData?.totalPages || 1
  };
};
