export interface User {
  id: string;
  nome: string;
  email: string;
  tipo: 'SUPER_ADMIN' | 'ADMIN' | 'COMUM';
  permissoes: UserPermissions;
  ativo: boolean;
  created_at: string;
  tenant_id?: string;
  unidade_id?: string;
  unidade_nome?: string;
  usar_tipo_dispensacao?: boolean;
  subscription_blocked?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  document?: string;
  slug: string;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  max_users: number;
  max_products?: number;
  max_patients?: number;
  features: string[];
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  plan?: Plan;
}

export interface UserProfile {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user' | 'viewer';
  permissions: UserPermissions;
  created_at: string;
}

export interface UserPermissions {
  cadastro_pacientes: boolean;
  cadastro_produtos: boolean;
  entrada_produtos: boolean;
  dispensacao: boolean;
  historicos: boolean;
  relatorio_compras: boolean;
  gestao_usuarios?: boolean;
  gerenciar_rascunhos_compras: boolean;
  pode_excluir?: boolean;
  acesso_global_pedidos?: boolean;
  usar_tipo_dispensacao?: boolean;
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
  unidade_medida: string; // Agora é string que referencia unidades_medida.codigo
  estoque_atual: number;
  created_at: string;
}

// Tipo removido - agora usamos apenas a tabela unidades_medida

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
