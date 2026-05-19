
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Patient, Dispensation } from '@/types';
import { format, subDays } from 'date-fns';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';

const PAGE_SIZE = 50;

interface LoteInfo {
  lote: string;
  vencimento: string;
  created_at: string;
}

interface UseDispensationQueriesProps {
  selectedProduct?: string;
  patientSearch?: string;
  productSearch?: string;
  procedureSearch?: string;
  sectorSearch?: string;
  dispensacaoSearch?: string;
  unidadeId?: string;
  tenantId?: string;
  isHealthWorker?: boolean;
  page?: number;
  limit?: number;
}

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

const normalizeTerm = (term: string) =>
  term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const parseDispensationDateFilter = (rawTerm: string) => {
  const term = normalizeTerm(rawTerm);
  const today = new Date();

  if (term === '7 dias' || term === 'ultimos 7 dias' || term === 'ultimos7dias') {
    return {
      from: format(subDays(today, 6), 'yyyy-MM-dd'),
      to: format(today, 'yyyy-MM-dd')
    };
  }

  if (term === '15 dias' || term === 'ultimos 15 dias' || term === 'ultimos15dias') {
    return {
      from: format(subDays(today, 14), 'yyyy-MM-dd'),
      to: format(today, 'yyyy-MM-dd')
    };
  }

  const monthIndex = MONTH_ABBREVIATIONS[term];
  if (monthIndex !== undefined) {
    const monthDate = new Date(today.getFullYear(), monthIndex, 1);
    return {
      from: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      to: format(endOfMonth(monthDate), 'yyyy-MM-dd')
    };
  }

  return null;
};

const buildInFilter = (ids: string[]) => {
  if (ids.length === 0) return null;
  return `(${ids.map((id) => `"${id}"`).join(',')})`;
};

export function useDispensationQueries({
  selectedProduct = '',
  patientSearch = '',
  productSearch = '',
  procedureSearch = '',
  sectorSearch = '',
  dispensacaoSearch = '',
  unidadeId,
  tenantId,
  isHealthWorker,
  page = 1,
  limit = 10
}: UseDispensationQueriesProps = {}) {
  // Buscar pacientes com paginação infinita
  const pacientesInfiniteQuery = useInfiniteQuery({
    queryKey: ['pacientes-global', patientSearch, tenantId, isHealthWorker],
    enabled: !!tenantId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      console.log('[Queries] Buscando pacientes (Página:', pageParam, ') com termo:', patientSearch, 'Filtro Receptor:', isHealthWorker);
      
      let query = supabase
        .from('pacientes')
        .select('*')
        .order('nome')
        .eq('tenant_id', tenantId);
      
      if (patientSearch) {
        query = query.or(`nome.ilike.%${patientSearch}%,sus_cpf.ilike.%${patientSearch}%`);
      }

      if (isHealthWorker !== undefined) {
        query = query.eq('is_health_worker', isHealthWorker);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query.range(from, to);
      
      if (error) throw error;
      return data as Patient[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 60000,
  });

  // Transformar dados do InfiniteQuery em uma lista única
  const pacientes = pacientesInfiniteQuery.data?.pages.flat() || [];

  // Buscar procedimentos (Globais + Tenant)
  const procedimentosQuery = useQuery({
    queryKey: ['procedimentos', procedureSearch, tenantId],
    queryFn: async () => {
      console.log('[Queries] Buscando procedimentos. Tenant:', tenantId, 'Search:', procedureSearch);
      
      let query = supabase
        .from('procedimentos')
        .select('*')
        .order('nome');
      
      // Removemos o filtro de tenant para garantir que todos os procedimentos apareçam
      // O RLS já permite a leitura de todos por usuários autenticados
      
      if (procedureSearch) {
        query = query.ilike('nome', `%${procedureSearch}%`);
      }

      const { data, error } = await query.limit(200);
      
      if (error) {
        console.error('[Queries] Erro ao buscar procedimentos:', error);
        throw error;
      }

      console.log('[Queries] Procedimentos encontrados:', data?.length || 0);

      if (!data || data.length === 0) {
        return [];
      }

      // Garantir que a lista seja única por nome (case-insensitive)
      const uniqueProcedures = data.reduce((acc: any[], current) => {
        const x = acc.find(item => item.nome.toLowerCase() === current.nome.toLowerCase());
        if (!x) {
          acc.push(current);
        }
        return acc;
      }, []);

      return uniqueProcedures;
    },
    staleTime: 60000,
  });

  // Buscar setores
  const setoresQuery = useQuery({
    queryKey: ['setores', sectorSearch, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from('setores')
        .select('*')
        .order('nome')
        .eq('tenant_id', tenantId);
      
      if (sectorSearch) {
        query = query.ilike('nome', `%${sectorSearch}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      return data;
    },
    staleTime: 60000,
  });

  // Buscar produtos com estoque e paginação infinita
  const produtosInfiniteQuery = useInfiniteQuery({
    queryKey: ['produtos-estoque-global', productSearch, unidadeId, tenantId],
    enabled: !!unidadeId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      console.log(`[Queries] Buscando produtos (Página: ${pageParam}) para unidade: ${unidadeId || 'não informada'}`);

      let productIds: string[] = [];

      // 1. Se tivermos unidadeId, buscar IDs de produtos que tiveram entrada nesta unidade
      if (unidadeId) {
        const { data: entradasIds } = await supabase
          .from('entradas_produtos')
          .select('produto_id')
          .eq('unidade_id', unidadeId);
        
        if (entradasIds) {
          productIds = [...new Set(entradasIds.map(e => e.produto_id))];
        }
      }

      if (unidadeId && productIds.length === 0) {
        return [];
      }

      // 2. Buscar detalhes dos produtos
      let query = supabase
        .from('produtos')
        .select('*')
        .order('descricao');

      if (unidadeId && productIds.length > 0) {
        query = query.in('id', productIds);
      }
      
      if (productSearch) {
        query = query.or(`descricao.ilike.%${productSearch}%,codigo.ilike.%${productSearch}%`);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: produtosData, error: prodError } = await query.range(from, to);
      if (prodError) throw prodError;

      // 3. Se tivermos unidadeId, buscar o estoque real desta unidade na tabela consolidada
      if (unidadeId && produtosData && produtosData.length > 0) {
        const currentProductIds = produtosData.map(p => p.id);

        const { data: estoqueData } = await supabase
          .from('produtos_estoque')
          .select('produto_id, estoque_atual')
          .in('produto_id', currentProductIds)
          .eq('unidade_id', unidadeId);

        const estoqueMap = new Map<string, number>();
        estoqueData?.forEach(e => {
          estoqueMap.set(e.produto_id, e.estoque_atual);
        });

        return produtosData
          .map(produto => ({
            ...produto,
            estoque_atual: estoqueMap.get(produto.id) || 0
          }))
          .filter(produto => (produto.estoque_atual || 0) > 0) as Product[];
      }

      return (produtosData as Product[]).filter(p => (p.estoque_atual || 0) > 0);
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 60000,
  });

  const produtos = produtosInfiniteQuery.data?.pages.flat() || [];

  // Buscar lotes do produto selecionado
  const lotesQuery = useQuery({
    queryKey: ['lotes-produto', selectedProduct, unidadeId, tenantId],
    enabled: !!selectedProduct && !!unidadeId,
    queryFn: async () => {
      if (!selectedProduct || !unidadeId) return [];
      
      console.log(`[Queries] Buscando lotes para produto: ${selectedProduct} na unidade: ${unidadeId}`);
      
      let query = supabase
        .from('entradas_produtos')
        .select('lote, vencimento, created_at')
        .eq('produto_id', selectedProduct)
        .eq('unidade_id', unidadeId);
      
      query = query.order('created_at', { ascending: true });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log(`[Queries] Lotes encontrados: ${data?.length || 0}`);

      // Remover lotes duplicados mantendo o mais antigo
      const lotesUnicos = data.reduce((acc: LoteInfo[], current) => {
        const existingLote = acc.find(item => item.lote === current.lote);
        if (!existingLote) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      return lotesUnicos as LoteInfo[];
    }
  });

  // Buscar dispensações recentes
  const dispensacoesQuery = useQuery({
    queryKey: ['dispensacoes', unidadeId, tenantId, page, limit, dispensacaoSearch],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) {
        return {
          items: [] as Dispensation[],
          totalCount: 0,
          totalPages: 1
        };
      }

      const trimmedSearch = dispensacaoSearch.trim();
      const normalizedSearch = normalizeTerm(trimmedSearch);
      const dateFilter = parseDispensationDateFilter(trimmedSearch);
      const useTextSearch = trimmedSearch.length > 0 && !dateFilter;
      let matchingProductIds: string[] = [];
      let matchingPatientIds: string[] = [];

      if (useTextSearch) {
        const [productResult, patientResult] = await Promise.all([
          supabase
            .from('produtos')
            .select('id')
            .or(`descricao.ilike.%${trimmedSearch}%,codigo.ilike.%${trimmedSearch}%`)
            .limit(100),
          supabase
            .from('pacientes')
            .select('id')
            .eq('tenant_id', tenantId)
            .or(`nome.ilike.%${trimmedSearch}%,sus_cpf.ilike.%${trimmedSearch}%`)
            .limit(100)
        ]);

        if (productResult.error) throw productResult.error;
        if (patientResult.error) throw patientResult.error;

        matchingProductIds = productResult.data?.map((item) => item.id) || [];
        matchingPatientIds = patientResult.data?.map((item) => item.id) || [];
      }
      
      let query = supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:paciente_id (
            nome,
            sus_cpf,
            sector,
            is_health_worker
          ),
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          ),
          tenant:tenant_id (
            name
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }

      if (dateFilter) {
        query = query
          .gte('data_dispensa', dateFilter.from)
          .lte('data_dispensa', dateFilter.to);
      }

      if (useTextSearch) {
        const orFilters = [`lote.ilike.%${trimmedSearch}%`];
        const productInFilter = buildInFilter(matchingProductIds);
        const patientInFilter = buildInFilter(matchingPatientIds);

        if (productInFilter) {
          orFilters.push(`produto_id.in.${productInFilter}`);
        }

        if (patientInFilter) {
          orFilters.push(`paciente_id.in.${patientInFilter}`);
        }

        query = query.or(orFilters.join(','));
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      return {
        items: data as Dispensation[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };
    }
  });

  return {
    pacientes,
    pacientesInfinite: {
      fetchNextPage: pacientesInfiniteQuery.fetchNextPage,
      hasNextPage: pacientesInfiniteQuery.hasNextPage,
      isFetchingNextPage: pacientesInfiniteQuery.isFetchingNextPage,
      isLoading: pacientesInfiniteQuery.isLoading
    },
    procedimentos: procedimentosQuery.data,
    setores: setoresQuery.data,
    produtos,
    produtosInfinite: {
      fetchNextPage: produtosInfiniteQuery.fetchNextPage,
      hasNextPage: produtosInfiniteQuery.hasNextPage,
      isFetchingNextPage: produtosInfiniteQuery.isFetchingNextPage,
      isLoading: produtosInfiniteQuery.isLoading
    },
    lotes: lotesQuery.data,
    dispensacoes: dispensacoesQuery.data?.items || [],
    totalDispensacoes: dispensacoesQuery.data?.totalCount || 0,
    totalPagesDispensacoes: dispensacoesQuery.data?.totalPages || 1,
    isLoadingDispensacoes: dispensacoesQuery.isLoading
  };
}
