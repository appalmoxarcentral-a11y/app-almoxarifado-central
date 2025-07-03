
import { useState } from 'react';

export function useHistoryFilters() {
  const [filtroDataInicial, setFiltroDataInicial] = useState('');
  const [filtroDataFinal, setFiltroDataFinal] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('all');
  const [filtroPaciente, setFiltroPaciente] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [buscaDinamica, setBuscaDinamica] = useState('');

  // Verificar se há filtros ativos
  const hasActiveFilters = filtroDataInicial || filtroDataFinal || filtroProduto !== 'all' || 
                          filtroPaciente !== 'all' || buscaDinamica || filtroTipo !== 'todos';

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltroDataInicial('');
    setFiltroDataFinal('');
    setFiltroProduto('all');
    setFiltroPaciente('all');
    setBuscaDinamica('');
    setFiltroTipo('todos');
  };

  // Função para obter placeholder da busca dinâmica
  const getSearchPlaceholder = () => {
    switch (filtroTipo) {
      case 'entradas':
        return 'Buscar por produto ou lote...';
      case 'dispensacoes-pacientes':
        return 'Buscar paciente por nome, SUS ou CPF...';
      case 'dispensacoes-produtos':
        return 'Buscar por produto ou lote...';
      default:
        return '';
    }
  };

  return {
    filtroDataInicial,
    setFiltroDataInicial,
    filtroDataFinal,
    setFiltroDataFinal,
    filtroProduto,
    setFiltroProduto,
    filtroPaciente,
    setFiltroPaciente,
    filtroTipo,
    setFiltroTipo,
    buscaDinamica,
    setBuscaDinamica,
    hasActiveFilters,
    limparFiltros,
    getSearchPlaceholder
  };
}
