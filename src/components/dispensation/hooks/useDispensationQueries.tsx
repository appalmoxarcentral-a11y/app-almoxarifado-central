
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Patient, Dispensation } from '@/types';

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
  unidadeId?: string;
  tenantId?: string;
  isHealthWorker?: boolean;
}

export function useDispensationQueries({
  selectedProduct = '',
  patientSearch = '',
  productSearch = '',
  procedureSearch = '',
  sectorSearch = '',
  unidadeId,
  tenantId,
  isHealthWorker
}: UseDispensationQueriesProps = {}) {
  // Buscar pacientes
  const pacientesQuery = useQuery({
    queryKey: ['pacientes-global', patientSearch, tenantId, isHealthWorker],
    enabled: !!tenantId,
    queryFn: async () => {
      console.log('[Queries] Buscando pacientes com termo:', patientSearch, 'Filtro Receptor:', isHealthWorker);
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

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data as Patient[];
    },
    staleTime: 60000, // 1 minuto de cache para melhorar a performance
  });

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

  // Buscar produtos com estoque
  const produtosQuery = useQuery({
    queryKey: ['produtos-estoque-global', productSearch, unidadeId, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      console.log(`[Queries] Buscando produtos para unidade: ${unidadeId || 'não informada'}`);

      let productIds: string[] = [];

      // 1. Se tivermos unidadeId, buscar IDs de produtos que tiveram entrada nesta unidade
      if (unidadeId) {
        const { data: entradasIds } = await supabase
          .from('entradas_produtos')
          .select('produto_id')
          .eq('unidade_id', unidadeId)
          .eq('tenant_id', tenantId);
        
        if (entradasIds) {
          productIds = [...new Set(entradasIds.map(e => e.produto_id))];
        }
      }

      // 2. Buscar detalhes dos produtos
      let query = supabase
        .from('produtos')
        .select('*')
        .order('descricao')
        .eq('tenant_id', tenantId);
      
      if (productSearch) {
        query = query.or(`descricao.ilike.%${productSearch}%,codigo.ilike.%${productSearch}%`);
      } else if (productIds.length > 0) {
        // Se não houver busca, mostrar apenas produtos que já tiveram entrada na unidade
        query = query.in('id', productIds);
      }

      const { data: produtosData, error: prodError } = await query.limit(100);
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

        // Montar a lista final com estoque e filtrar apenas os que possuem estoque > 0
        return produtosData
          .map(produto => ({
            ...produto,
            estoque_atual: estoqueMap.get(produto.id) || 0
          }))
          .filter(produto => (produto.estoque_atual || 0) > 0) as Product[];
      }

      return (produtosData as Product[]).filter(p => (p.estoque_atual || 0) > 0);
    },
    staleTime: 60000,
  });

  // Buscar lotes do produto selecionado
  const lotesQuery = useQuery({
    queryKey: ['lotes-produto', selectedProduct, unidadeId, tenantId],
    enabled: !!selectedProduct && !!tenantId,
    queryFn: async () => {
      if (!selectedProduct || !tenantId) return [];
      
      console.log(`[Queries] Buscando lotes para produto: ${selectedProduct} na unidade: ${unidadeId}`);
      
      let query = supabase
        .from('entradas_produtos')
        .select('lote, vencimento, created_at')
        .eq('produto_id', selectedProduct)
        .eq('tenant_id', tenantId);
      
      query = query.order('created_at', { ascending: true });

      // Filtrar lotes por unidade para evitar mostrar lotes de outras unidades
      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }
      
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
    queryKey: ['dispensacoes', unidadeId, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];
      
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
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Dispensation[];
    }
  });

  return {
    pacientes: pacientesQuery.data,
    procedimentos: procedimentosQuery.data,
    setores: setoresQuery.data,
    produtos: produtosQuery.data,
    lotes: lotesQuery.data,
    dispensacoes: dispensacoesQuery.data,
    isLoadingDispensacoes: dispensacoesQuery.isLoading
  };
}
