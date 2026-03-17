
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Patient, Dispensation } from '@/types';

interface LoteInfo {
  lote: string;
  vencimento: string;
  created_at: string;
}

export function useDispensationQueries(
  selectedProduct: string, 
  patientSearch: string = '', 
  productSearch: string = '',
  unidadeId?: string,
  tenantId?: string
) {
  // Buscar pacientes
  const pacientesQuery = useQuery({
    queryKey: ['pacientes-global', patientSearch, tenantId],
    queryFn: async () => {
      console.log('[Queries] Buscando pacientes com termo:', patientSearch);
      let query = supabase
        .from('pacientes')
        .select('*')
        .order('nome');
      
      if (patientSearch) {
        query = query.or(`nome.ilike.%${patientSearch}%,sus_cpf.ilike.%${patientSearch}%`);
      }

      // Se tiver tenantId, garantir que filtra por ele (embora RLS deva cuidar disso)
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      return data as Patient[];
    },
    staleTime: 0,
  });

  // Buscar produtos com estoque
  const produtosQuery = useQuery({
    queryKey: ['produtos-estoque-global', productSearch, unidadeId],
    queryFn: async () => {
      console.log(`[Queries] Buscando produtos para unidade: ${unidadeId || 'não informada'}`);

      // 1. Buscar produtos
      let query = supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (productSearch) {
        query = query.or(`descricao.ilike.%${productSearch}%,codigo.ilike.%${productSearch}%`);
      }

      const { data: produtosData, error: prodError } = await query.limit(50);
      if (prodError) throw prodError;

      // 2. Se tivermos unidadeId, buscar o estoque real desta unidade em lote (Batch)
      if (unidadeId && produtosData && produtosData.length > 0) {
        const productIds = produtosData.map(p => p.id);

        // Buscar todas as entradas e saídas destes produtos para esta unidade de uma vez
        const [entradasRes, saidasRes] = await Promise.all([
          supabase
            .from('entradas_produtos')
            .select('produto_id, quantidade')
            .in('produto_id', productIds)
            .eq('unidade_id', unidadeId),
          supabase
            .from('dispensacoes')
            .select('produto_id, quantidade')
            .in('produto_id', productIds)
            .eq('unidade_id', unidadeId)
        ]);

        const estoqueMap = new Map<string, number>();

        // Somar entradas
        entradasRes.data?.forEach(e => {
          const atual = estoqueMap.get(e.produto_id) || 0;
          estoqueMap.set(e.produto_id, atual + (e.quantidade || 0));
        });

        // Subtrair saídas
        saidasRes.data?.forEach(s => {
          const atual = estoqueMap.get(s.produto_id) || 0;
          estoqueMap.set(s.produto_id, atual - (s.quantidade || 0));
        });

        // Montar a lista final com estoque calculado
        return produtosData.map(produto => ({
          ...produto,
          estoque_atual: estoqueMap.get(produto.id) || 0
        })) as Product[];
      }

      return produtosData as Product[];
    },
    staleTime: 0,
  });

  // Buscar lotes do produto selecionado
  const lotesQuery = useQuery({
    queryKey: ['lotes-produto', selectedProduct, unidadeId],
    enabled: !!selectedProduct,
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      console.log(`[Queries] Buscando lotes para produto: ${selectedProduct} na unidade: ${unidadeId}`);
      
      let query = supabase
        .from('entradas_produtos')
        .select('lote, vencimento, created_at')
        .eq('produto_id', selectedProduct)
        .order('created_at', { ascending: true });

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
    queryKey: ['dispensacoes', unidadeId],
    queryFn: async () => {
      let query = supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:paciente_id (
            nome,
            sus_cpf
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
    produtos: produtosQuery.data,
    lotes: lotesQuery.data,
    dispensacoes: dispensacoesQuery.data,
    isLoadingDispensacoes: dispensacoesQuery.isLoading
  };
}
