
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductEntry } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 50;

interface UseProductEntryQueriesParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  productSearch?: string;
}

export const useProductEntryQueries = (params: UseProductEntryQueriesParams = {}) => {
  const { page = 1, limit = 50, searchTerm = '', productSearch = '' } = params;
  const { user } = useAuth();

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
    placeholderData: keepPreviousData,
  });

  const produtos = produtosInfiniteData?.pages.flat() || [];

  const {
    data: entradasData,
    isLoading: isLoadingEntradas,
    refetch: refetchEntradas
  } = useQuery({
    queryKey: ['entradas-produtos', page, limit, searchTerm, user?.unidade_id],
    enabled: !!user?.unidade_id,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const unidadeId = user?.unidade_id || '00000000-0000-0000-0000-000000000000';
      
      console.log('[Queries] Buscando entradas. Unidade:', unidadeId, 'Termo:', searchTerm);

      // 1. Buscar IDs de produtos que coincidem com o termo de busca primeiro
      // Isso evita filtros OR complexos com JOIN que falham no PostgREST (erro 400)
      let productIds: string[] = [];
      if (searchTerm) {
        const { data: products } = await supabase
          .from('produtos')
          .select('id')
          .or(`descricao.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
          .limit(100);
        
        if (products && products.length > 0) {
          productIds = products.map(p => p.id);
        }
      }

      // 2. Construir a query principal
      let query = supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produtos(id, descricao, codigo, unidade_medida)
        `)
        .eq('unidade_id', unidadeId)
        .order('created_at', { ascending: false });

      // 3. Construir a query de contagem
      let countQuery = supabase
        .from('entradas_produtos')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId);

      // 4. Aplicar o filtro de busca se houver um termo
      if (searchTerm) {
        let orFilter = `lote.ilike.%${searchTerm}%`;
        if (productIds.length > 0) {
          orFilter += `,produto_id.in.(${productIds.join(',')})`;
        }
        query = query.or(orFilter);
        countQuery = countQuery.or(orFilter);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('[Queries] Erro na contagem de entradas:', countError);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      
      if (error) {
        console.error('[Queries] Erro ao buscar entradas:', error);
        throw error;
      }
      
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
