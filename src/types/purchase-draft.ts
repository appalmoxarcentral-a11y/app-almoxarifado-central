export interface PurchaseReportDraft {
  id: string;
  usuario_id: string;
  nome_rascunho: string;
  data_criacao: string;
  data_atualizacao: string;
  items: PurchaseDraftItem[];
  finalizado: boolean;
}

export interface PurchaseDraftItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  estoque_atual: number;
  quantidade_reposicao?: number;
}

export interface CreateDraftRequest {
  nome_rascunho: string;
  items: PurchaseDraftItem[];
}

export interface UpdateDraftRequest {
  id: string;
  nome_rascunho?: string;
  items: PurchaseDraftItem[];
}