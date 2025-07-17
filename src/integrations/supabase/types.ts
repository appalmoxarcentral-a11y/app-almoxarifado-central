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
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          tabela?: string
          usuario_id?: string | null
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
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao: string
          estoque_atual?: number
          id?: string
          unidade_medida: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao?: string
          estoque_atual?: number
          id?: string
          unidade_medida?: string
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
        }
        Insert: {
          ativo?: boolean
          dados_produtos?: Json
          data_atualizacao?: string
          data_criacao?: string
          id?: string
          nome_rascunho: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          dados_produtos?: Json
          data_atualizacao?: string
          data_criacao?: string
          id?: string
          nome_rascunho?: string
          usuario_id?: string
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
      relatorios_compras_rascunho: {
        Row: {
          created_at: string | null
          data_atualizacao: string
          data_criacao: string
          finalizado: boolean
          id: string
          items: Json
          nome_rascunho: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          data_atualizacao?: string
          data_criacao?: string
          finalizado?: boolean
          id?: string
          items?: Json
          nome_rascunho: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          data_atualizacao?: string
          data_criacao?: string
          finalizado?: boolean
          id?: string
          items?: Json
          nome_rascunho?: string
          usuario_id?: string
        }
        Relationships: []
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
        }
        Relationships: []
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
