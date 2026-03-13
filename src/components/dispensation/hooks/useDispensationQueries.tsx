
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Patient, Dispensation } from '@/types';

interface LoteInfo {
  lote: string;
  vencimento: string;
  created_at: string;
}

export function useDispensationQueries(selectedProduct: string) {
  // Buscar pacientes
  const pacientesQuery = useQuery({
    queryKey: ['pacientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .order('nome')
        .limit(10000); // Aumentado para suportar bases maiores e garantir busca completa no client-side
      
      if (error) throw error;
      return data as Patient[];
    }
  });

  // Buscar produtos com estoque
  const produtosQuery = useQuery({
    queryKey: ['produtos-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .gt('estoque_atual', 0)
        .order('descricao');
      
      if (error) throw error;
      return data as Product[];
    }
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
