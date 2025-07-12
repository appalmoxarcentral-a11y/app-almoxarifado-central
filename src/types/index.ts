export interface User {
  id: string;
  nome: string;
  email: string;
  tipo: 'ADMIN' | 'COMUM';
  permissoes: UserPermissions;
  ativo: boolean;
  created_at: string;
}

export interface UserPermissions {
  cadastro_pacientes: boolean;
  cadastro_produtos: boolean;
  entrada_produtos: boolean;
  dispensacao: boolean;
  historicos: boolean;
  gestao_usuarios?: boolean;
}

export interface Patient {
  id: string;
  nome: string;
  sus_cpf: string;
  endereco: string;
  bairro: string;
  telefone: string;
  nascimento: string;
  idade: number;
  created_at: string;
}

export interface Product {
  id: string;
  descricao: string;
  codigo: string;
  unidade_medida: UnidadeMedida;
  estoque_atual: number;
  created_at: string;
}

export type UnidadeMedida = 'AM' | 'CP' | 'BG' | 'FR' | 'CPS' | 'ML' | 'MG' | 'G' | 'KG' | 'UN' | 'PCT' | 'CX';

export interface ProductEntry {
  id: string;
  produto_id: string;
  produto?: Product;
  quantidade: number;
  vencimento: string;
  lote: string;
  data_entrada: string;
  usuario_id: string;
  created_at: string;
}

export interface Dispensation {
  id: string;
  paciente_id: string;
  paciente?: Patient;
  produto_id: string;
  produto?: Product;
  lote: string;
  quantidade: number;
  data_dispensa: string;
  usuario_id: string;
  created_at: string;
}

export interface DashboardStats {
  total_produtos: number;
  produtos_vencendo: number;
  produtos_estoque_baixo: number;
  dispensacoes_mes: number;
  entradas_mes: number;
}

export interface UnidadeMedidaDB {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ExcelProductRow {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  quantidade?: number;
  lote?: string;
  vencimento?: string;
  data_entrada?: string;
}

export interface ProcessResult {
  success: boolean;
  errors: string[];
  processedCount: number;
  totalCount: number;
}
