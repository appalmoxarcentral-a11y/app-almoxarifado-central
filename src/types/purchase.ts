
export interface PurchaseItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade_medida: string; // Agora é string que referencia unidades_medida.codigo
  estoque_atual: number;
  quantidade_reposicao?: number;
}

export interface PurchaseReportData {
  items: PurchaseItem[];
  totalItems: number;
  dataGeracao: string;
  responsavel: string;
}

export interface PurchaseFilters {
  searchTerm: string;
  estoqueMinimo?: number;
  comReposicao: boolean;
}
