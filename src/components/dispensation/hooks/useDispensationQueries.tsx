
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Patient, Dispensation } from '@/types';

interface LoteInfo {
  lote: string;
  vencimento: string;
  created_at: string;
}

export function useDispensationQueries(selectedProduct: string, patientSearch: string = '', productSearch: string = '') {
  // Buscar pacientes
  const pacientesQuery = useQuery({
    queryKey: ['pacientes-global', patientSearch],
    queryFn: async () => {
      console.log('[Queries] Buscando pacientes com termo:', patientSearch);
      let query = supabase
        .from('pacientes')
        .select('*')
        .order('nome');
      
      if (patientSearch) {
        query = query.or(`nome.ilike.%${patientSearch}%,sus_cpf.ilike.%${patientSearch}%`);
      }

      const { data, error } = await query.limit(50); // Limite menor para busca dinâmica
      
      if (error) throw error;
      return data as Patient[];
    },
    staleTime: 0,
  });

  // Buscar produtos com estoque
  const produtosQuery = useQuery({
    queryKey: ['produtos-estoque-global', productSearch],
    queryFn: async () => {
      // 1. Obter a unidade atual do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('unidade_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const unidadeId = profile?.unidade_id;

      // 2. Buscar produtos
      let query = supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (productSearch) {
        query = query.or(`descricao.ilike.%${productSearch}%,codigo.ilike.%${productSearch}%`);
      }

      const { data: produtosData, error } = await query.limit(50);
      if (error) throw error;

      // 3. Se tivermos unidadeId, buscar o estoque real desta unidade para cada produto
      if (unidadeId && produtosData) {
        const produtosComEstoqueReal = await Promise.all(produtosData.map(async (produto) => {
          // Buscar soma de entradas nesta unidade
          const { data: entradas } = await supabase
            .from('entradas_produtos')
            .select('quantidade')
            .eq('produto_id', produto.id)
            .eq('unidade_id', unidadeId);
          
          const totalEntradas = entradas?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;

          // Buscar soma de saídas nesta unidade
          const { data: dispensacoes } = await supabase
            .from('dispensacoes')
            .select('quantidade')
            .eq('produto_id', produto.id)
            .eq('unidade_id', unidadeId);
          
          const totalSaidas = dispensacoes?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;

          return {
            ...produto,
            estoque_atual: totalEntradas - totalSaidas
          };
        }));
        return produtosComEstoqueReal as Product[];
      }

      return produtosData as Product[];
    },
    staleTime: 0,
  });

  // Buscar lotes do produto selecionado
  const lotesQuery = useQuery({
    queryKey: ['lotes-produto', selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select('lote, vencimento, created_at')
        .eq('produto_id', selectedProduct)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
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
    queryKey: ['dispensacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
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
