
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductEntry, Dispensation } from '@/types';

interface UseHistoryDataProps {
  filtroDataInicial: string;
  filtroDataFinal: string;
  filtroProduto: string;
  filtroPaciente: string;
}

export function useHistoryData({
  filtroDataInicial,
  filtroDataFinal,
  filtroProduto,
  filtroPaciente
}: UseHistoryDataProps) {
  // Buscar entradas
  const { data: entradas, isLoading: isLoadingEntradas } = useQuery({
    queryKey: ['historico-entradas', filtroDataInicial, filtroDataFinal, filtroProduto],
    queryFn: async () => {
      // 1. Obter a unidade atual do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('unidade_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let query = supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          ),
          tenant:tenant_id (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (profile?.unidade_id) {
        query = query.eq('unidade_id', profile.unidade_id);
      }

      if (filtroDataInicial) {
        query = query.gte('data_entrada', filtroDataInicial);
      }
      if (filtroDataFinal) {
        query = query.lte('data_entrada', filtroDataFinal);
      }
      if (filtroProduto && filtroProduto !== 'all') {
        query = query.eq('produto_id', filtroProduto);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductEntry[];
    }
  });

  // Buscar dispensações
  const { data: dispensacoes, isLoading: isLoadingDispensacoes } = useQuery({
    queryKey: ['historico-dispensacoes', filtroDataInicial, filtroDataFinal, filtroProduto, filtroPaciente],
    queryFn: async () => {
      // 1. Obter a unidade atual do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('unidade_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

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
        .order('created_at', { ascending: false });

      if (profile?.unidade_id) {
        query = query.eq('unidade_id', profile.unidade_id);
      }

      if (filtroDataInicial) {
        query = query.gte('data_dispensa', filtroDataInicial);
      }
      if (filtroDataFinal) {
        query = query.lte('data_dispensa', filtroDataFinal);
      }
      if (filtroProduto && filtroProduto !== 'all') {
        query = query.eq('produto_id', filtroProduto);
      }
      if (filtroPaciente && filtroPaciente !== 'all') {
        query = query.eq('paciente_id', filtroPaciente);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data as Dispensation[];
    }
  });

  // Buscar produtos para filtro
  const { data: produtos } = useQuery({
    queryKey: ['produtos-filtro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, descricao, codigo')
        .order('descricao');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar pacientes para filtro
  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-filtro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, sus_cpf')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar logs do sistema
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['logs-sistema'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs_sistema')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  return {
    entradas,
    dispensacoes,
    produtos,
    pacientes,
    logs,
    isLoadingEntradas,
    isLoadingDispensacoes,
    isLoadingLogs
  };
}
