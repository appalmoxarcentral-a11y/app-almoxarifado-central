export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      dispensacoes: {
        Row: {
          created_at: string | null
          data_dispensa: string
          id: string
          lote: string
          paciente_id: string
          produto_id: string
          quantidade: number
          usuario_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          data_dispensa?: string
          id?: string
          lote: string
          paciente_id: string
          produto_id: string
          quantidade: number
          usuario_id: string
          tenant_id?: string
        }
        Update: {
          created_at?: string | null
          data_dispensa?: string
          id?: string
          lote?: string
          paciente_id?: string
          produto_id?: string
          quantidade?: number
          usuario_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      entradas_produtos: {
        Row: {
          created_at: string | null
          data_entrada: string
          id: string
          lote: string
          produto_id: string
          quantidade: number
          usuario_id: string
          vencimento: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          data_entrada?: string
          id?: string
          lote: string
          produto_id: string
          quantidade: number
          usuario_id: string
          vencimento: string
          tenant_id?: string
        }
        Update: {
          created_at?: string | null
          data_entrada?: string
          id?: string
          lote?: string
          produto_id?: string
          quantidade?: number
          usuario_id?: string
          vencimento?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entradas_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_produtos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_sistema: {
        Row: {
          acao: string
          created_at: string | null
          detalhes: Json | null
          id: string
          tabela: string
          usuario_id: string | null
          tenant_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          tabela: string
          usuario_id?: string | null
          tenant_id?: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          tabela?: string
          usuario_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_sistema_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          bairro: string
          created_at: string | null
          endereco: string
          id: string
          idade: number
          nascimento: string
          nome: string
          sus_cpf: string
          telefone: string
          tenant_id: string
        }
        Insert: {
          bairro: string
          created_at?: string | null
          endereco: string
          id?: string
          idade?: number
          nascimento: string
          nome: string
          sus_cpf: string
          telefone: string
          tenant_id?: string
        }
        Update: {
          bairro?: string
          created_at?: string | null
          endereco?: string
          id?: string
          idade?: number
          nascimento?: string
          nome?: string
          sus_cpf?: string
          telefone?: string
          tenant_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          codigo: string
          created_at: string | null
          descricao: string
          estoque_atual: number
          id: string
          unidade_medida: string
          tenant_id: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao: string
          estoque_atual?: number
          id?: string
          unidade_medida: string
          tenant_id?: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao?: string
          estoque_atual?: number
          id?: string
          unidade_medida?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_produtos_unidade_medida"
            columns: ["unidade_medida"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["codigo"]
          },
        ]
      }
      rascunhos_compras: {
        Row: {
          ativo: boolean
          dados_produtos: Json
          data_atualizacao: string
          data_criacao: string
          id: string
          nome_rascunho: string
          usuario_id: string
          tenant_id: string
        }
        Insert: {
          ativo?: boolean
          dados_produtos?: Json
          data_atualizacao?: string
          data_criacao?: string
          id?: string
          nome_rascunho: string
          usuario_id: string
          tenant_id?: string
        }
        Update: {
          ativo?: boolean
          dados_produtos?: Json
          data_atualizacao?: string
          data_criacao?: string
          id?: string
          nome_rascunho?: string
          usuario_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_rascunhos_compras_usuario_id"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_medida: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          created_by: string | null
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_medida_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string | null
          email: string
          id: string
          nome: string
          permissoes: Json
          senha: string
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          tenant_id: string | null
          profile_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          email: string
          id?: string
          nome: string
          permissoes?: Json
          senha: string
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          tenant_id?: string | null
          profile_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          permissoes?: Json
          senha?: string
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          tenant_id?: string | null
          profile_id?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          name: string
          document: string | null
          slug: string
          created_at: string
          updated_at: string
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
        }
        Insert: {
          id?: string
          name: string
          document?: string | null
          slug: string
          created_at?: string
          updated_at?: string
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
        }
        Update: {
          id?: string
          name?: string
          document?: string | null
          slug?: string
          created_at?: string
          updated_at?: string
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string | null
          full_name: string | null
          email: string | null
          role: string | null
          permissions: Json | null
          created_at: string
          phone: string | null
        }
        Insert: {
          id: string
          tenant_id?: string | null
          full_name?: string | null
          email?: string | null
          role?: string | null
          permissions?: Json | null
          created_at?: string
          phone?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          full_name?: string | null
          email?: string | null
          role?: string | null
          permissions?: Json | null
          created_at?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          max_users: number
          max_products: number | null
          features: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          max_users: number
          max_products?: number | null
          features?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          max_users?: number
          max_products?: number | null
          features?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          tenant_id: string
          plan_id: string
          status: string
          current_period_start: string
          current_period_end: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          plan_id: string
          status?: string
          current_period_start: string
          current_period_end: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          plan_id?: string
          status?: string
          current_period_start?: string
          current_period_end?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          }
        ]
      }
      subscription_invoices: {
        Row: {
          id: string
          tenant_id: string
          subscription_id: string | null
          amount: number
          status: string
          pix_code: string | null
          pix_qr_code_url: string | null
          pix_id: string | null
          payment_date: string | null
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          subscription_id?: string | null
          amount: number
          status?: string
          pix_code?: string | null
          pix_qr_code_url?: string | null
          pix_id?: string | null
          payment_date?: string | null
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          subscription_id?: string | null
          amount?: number
          status?: string
          pix_code?: string | null
          pix_qr_code_url?: string | null
          pix_id?: string | null
          payment_date?: string | null
          due_date?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hash_senha: {
        Args: { senha_texto: string }
        Returns: string
      }
      verificar_senha: {
        Args: { usuario_email: string; senha_input: string }
        Returns: {
          id: string
          nome: string
          email: string
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          permissoes: Json
          ativo: boolean
        }[]
      }
    }
    Enums: {
      tipo_usuario: "ADMIN" | "COMUM"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      tipo_usuario: ["ADMIN", "COMUM"],
    },
  },
} as const
