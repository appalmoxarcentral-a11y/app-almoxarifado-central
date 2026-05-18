
export interface PurchaseItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade_medida: string; // Agora é string que referencia unidades_medida.codigo
  estoque_atual: number;
  estoque_origem?: number;
  quantidade_reposicao?: number;
  anotacao_reposicao?: string;
  prioridade?: number;
  unidade_destino_nome?: string;
  lote_selecionado?: string;
  vencimento_selecionado?: string;
  lotes_multiplos?: {
    lote: string;
    vencimento: string;
    quantidade: number;
  }[];
}

export interface PurchaseReportData {
  items: PurchaseItem[];
  totalItems: number;
  dataGeracao: string;
  responsavel: string;
}

export interface PurchaseFilters {
  searchTerm: string;
  searchType: 'todos' | 'codigo' | 'descricao' | 'unidade';
  estoqueMinimo?: number;
  tenantId?: string;
  sortColumn?: 'none' | 'unidade_medida' | 'estoque_origem' | 'estoque_atual' | 'quantidade_reposicao' | 'anotacoes';
  sortDirection?: 'asc' | 'desc';
}
