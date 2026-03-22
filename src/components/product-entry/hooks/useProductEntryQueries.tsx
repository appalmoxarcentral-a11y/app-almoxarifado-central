
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductEntry } from '@/types';

const PAGE_SIZE = 50;

interface UseProductEntryQueriesParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  productSearch?: string;
}

export const useProductEntryQueries = (params: UseProductEntryQueriesParams = {}) => {
  const { page = 1, limit = 50, searchTerm = '', productSearch = '' } = params;

  const {
    data: produtosInfiniteData,
    isLoading: isLoadingProdutos,
    refetch: refetchProdutos,
    fetchNextPage: fetchNextPageProdutos,
    hasNextPage: hasNextPageProdutos,
    isFetchingNextPage: isFetchingNextPageProdutos
  } = useInfiniteQuery({
    queryKey: ['produtos-entrada', productSearch],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (productSearch) {
        query = query.or(`descricao.ilike.%${productSearch}%,codigo.ilike.%${productSearch}%`);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query.range(from, to);
      
      if (error) throw error;
      return data as Product[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 60000,
  });

  const produtos = produtosInfiniteData?.pages.flat() || [];

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
        query = query.or(`lote.ilike.%${searchTerm}%`);
      }

      // 1. Obter a unidade atual do usuário logado para garantir o filtro local
      const { data: profile } = await supabase
        .from('profiles')
        .select('unidade_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profile?.unidade_id) {
        query = query.eq('unidade_id', profile.unidade_id);
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('entradas_produtos')
        .select('*', { count: 'exact', head: true })
        .eq('unidade_id', profile?.unidade_id || '00000000-0000-0000-0000-000000000000'); // Garante a contagem correta

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
    produtosInfinite: {
      fetchNextPage: fetchNextPageProdutos,
      hasNextPage: hasNextPageProdutos,
      isFetchingNextPage: isFetchingNextPageProdutos,
      isLoading: isLoadingProdutos
    },
    isLoadingProdutos,
    refetchProdutos,
    entradas: entradasData?.entries || [],
    isLoadingEntradas,
    refetchEntradas,
    totalCount: entradasData?.totalCount || 0,
    totalPages: entradasData?.totalPages || 1
  };
};
