
import React from 'react';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { useHistoryData, useHistoryFilters, HistoryStats, HistoryFilters, HistoryTabs } from './history';

export function HistoryView() {
  const filters = useHistoryFilters();
  
  const {
    entradas,
    dispensacoes,
    produtos,
    pacientes,
    logs,
    isLoadingEntradas,
    isLoadingDispensacoes,
    isLoadingLogs
  } = useHistoryData({
    filtroDataInicial: filters.filtroDataInicial,
    filtroDataFinal: filters.filtroDataFinal,
    filtroProduto: filters.filtroProduto,
    filtroPaciente: filters.filtroPaciente
  });

  // Estatísticas (Apenas dispensações TOTAIS afetam o estoque)
  const totalEntradas = entradas?.reduce((sum, entrada) => sum + entrada.quantidade, 0) || 0;
  const totalDispensacoes = dispensacoes
    ?.filter(d => !d.is_parcial)
    .reduce((sum, dispensacao) => sum + dispensacao.quantidade, 0) || 0;

  // Movimentações combinadas (apenas para visualização "Todas")
  const movimentacoes = [
    ...(entradas?.map(entrada => ({
      ...entrada,
      tipo: 'entrada' as const,
      data: entrada.data_entrada,
      descricao_produto: entrada.produto?.descricao || '',
      paciente: null,
      tenant_name: entrada.tenant?.name || 'Unidade Desconhecida'
    })) || []),
    ...(dispensacoes?.map(dispensacao => ({
      ...dispensacao,
      tipo: 'dispensacao' as const,
      data: dispensacao.data_dispensa,
      descricao_produto: dispensacao.produto?.descricao || '',
      paciente: dispensacao.paciente?.nome || '',
      tenant_name: dispensacao.tenant?.name || 'Unidade Desconhecida',
      is_parcial: dispensacao.is_parcial
    })) || [])
  ].sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

  // Função para calcular movimentações de hoje
  const getMovimentacoesHoje = () => {
    const hoje = format(new Date(), 'yyyy-MM-dd');
    return movimentacoes.filter(mov => 
      format(new Date(mov.data), 'yyyy-MM-dd') === hoje
    ).length;
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Históricos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Controle de movimentações</p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <HistoryStats
        totalEntradas={totalEntradas}
        totalDispensacoes={totalDispensacoes}
        totalProdutos={produtos?.length || 0}
        movimentacoesHoje={getMovimentacoesHoje()}
      />

      {/* Filtros */}
      <HistoryFilters
        {...filters}
        produtos={produtos}
        pacientes={pacientes}
      />

      {/* Tabs de Histórico */}
      <HistoryTabs
        filtroTipo={filters.filtroTipo}
        buscaDinamica={filters.buscaDinamica}
        filtroDataInicial={filters.filtroDataInicial}
        filtroDataFinal={filters.filtroDataFinal}
        filtroProduto={filters.filtroProduto}
        movimentacoes={movimentacoes}
        logs={logs}
      />
    </div>
  );
}
