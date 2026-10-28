export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      anotacoes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          rdo_id: string
          texto: string
          tipo: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          rdo_id: string
          texto: string
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          rdo_id?: string
          texto?: string
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anotacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotacoes_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotacoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string
          created_by: string
          descricao: string
          frente_id: string
          id: string
          rdo_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          descricao: string
          frente_id: string
          id?: string
          rdo_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string
          frente_id?: string
          id?: string
          rdo_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_frente_id_fkey"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          copiado: boolean
          copiado_por: string | null
          created_at: string
          created_by: string
          descricao: string
          id: string
          quantidade: number
          rdo_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          copiado?: boolean
          copiado_por?: string | null
          created_at?: string
          created_by?: string
          descricao: string
          id?: string
          quantidade?: number
          rdo_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          copiado?: boolean
          copiado_por?: string | null
          created_at?: string
          created_by?: string
          descricao?: string
          id?: string
          quantidade?: number
          rdo_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_copiado_por_fkey"
            columns: ["copiado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos: {
        Row: {
          created_at: string
          created_by: string
          id: string
          legenda: string | null
          ordem: number
          rdo_id: string
          storage_path: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          legenda?: string | null
          ordem?: number
          rdo_id: string
          storage_path: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          legenda?: string | null
          ordem?: number
          rdo_id?: string
          storage_path?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fotos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      frentes: {
        Row: {
          ativa: boolean
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativa?: boolean
          id?: string
          nome: string
          ordem: number
        }
        Update: {
          ativa?: boolean
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      historico: {
        Row: {
          acao: string
          antes: Json | null
          depois: Json | null
          em: string
          id: number
          rdo_id: string | null
          registro_id: string | null
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          depois?: Json | null
          em?: string
          id?: never
          rdo_id?: string | null
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          depois?: Json | null
          em?: string
          id?: never
          rdo_id?: string | null
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      mao_obra: {
        Row: {
          categoria: string
          copiado: boolean
          copiado_por: string | null
          created_at: string
          created_by: string
          funcao: string
          id: string
          quantidade: number
          rdo_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          categoria: string
          copiado?: boolean
          copiado_por?: string | null
          created_at?: string
          created_by?: string
          funcao: string
          id?: string
          quantidade?: number
          rdo_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          categoria?: string
          copiado?: boolean
          copiado_por?: string | null
          created_at?: string
          created_by?: string
          funcao?: string
          id?: string
          quantidade?: number
          rdo_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mao_obra_copiado_por_fkey"
            columns: ["copiado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mao_obra_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mao_obra_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mao_obra_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      obra: {
        Row: {
          art: string | null
          atualizado_em: string | null
          atualizado_por: string | null
          cliente: string | null
          contrato: string | null
          data_inicio: string | null
          endereco: string | null
          id: boolean
          nome: string
          prazo_previsto: string | null
          ref_data: string
          ref_numero: number
          responsavel_tecnico: string | null
        }
        Insert: {
          art?: string | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente?: string | null
          contrato?: string | null
          data_inicio?: string | null
          endereco?: string | null
          id?: boolean
          nome?: string
          prazo_previsto?: string | null
          ref_data?: string
          ref_numero?: number
          responsavel_tecnico?: string | null
        }
        Update: {
          art?: string | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente?: string | null
          contrato?: string | null
          data_inicio?: string | null
          endereco?: string | null
          id?: boolean
          nome?: string
          prazo_previsto?: string | null
          ref_data?: string
          ref_numero?: number
          responsavel_tecnico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alterar_numero_data: boolean
          ativo: boolean
          criado_em: string
          editar_de_outros: boolean
          editar_obra: boolean
          exportar_pdf: boolean
          fechar_reabrir: boolean
          id: string
          lancar_atividades: boolean
          lancar_clima: boolean
          lancar_equipamentos: boolean
          lancar_mao_obra: boolean
          nome: string
          role: string
          ver_todos_rdos: boolean
        }
        Insert: {
          alterar_numero_data?: boolean
          ativo?: boolean
          criado_em?: string
          editar_de_outros?: boolean
          editar_obra?: boolean
          exportar_pdf?: boolean
          fechar_reabrir?: boolean
          id: string
          lancar_atividades?: boolean
          lancar_clima?: boolean
          lancar_equipamentos?: boolean
          lancar_mao_obra?: boolean
          nome: string
          role?: string
          ver_todos_rdos?: boolean
        }
        Update: {
          alterar_numero_data?: boolean
          ativo?: boolean
          criado_em?: string
          editar_de_outros?: boolean
          editar_obra?: boolean
          exportar_pdf?: boolean
          fechar_reabrir?: boolean
          id?: string
          lancar_atividades?: boolean
          lancar_clima?: boolean
          lancar_equipamentos?: boolean
          lancar_mao_obra?: boolean
          nome?: string
          role?: string
          ver_todos_rdos?: boolean
        }
        Relationships: []
      }
      rdos: {
        Row: {
          assinante_fiscalizacao: string | null
          assinante_obra: string | null
          clima_atualizado_em: string | null
          clima_atualizado_por: string | null
          clima_manha: string | null
          clima_noite: string | null
          clima_tarde: string | null
          criado_em: string
          criado_por: string | null
          data: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          mare_max_hora: string | null
          mare_max_nivel: number | null
          numero: number
          pluv_07h: number | null
          pluv_12h: number | null
          pluv_17h: number | null
          status: string
        }
        Insert: {
          assinante_fiscalizacao?: string | null
          assinante_obra?: string | null
          clima_atualizado_em?: string | null
          clima_atualizado_por?: string | null
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          criado_em?: string
          criado_por?: string | null
          data: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mare_max_hora?: string | null
          mare_max_nivel?: number | null
          numero: number
          pluv_07h?: number | null
          pluv_12h?: number | null
          pluv_17h?: number | null
          status?: string
        }
        Update: {
          assinante_fiscalizacao?: string | null
          assinante_obra?: string | null
          clima_atualizado_em?: string | null
          clima_atualizado_por?: string | null
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mare_max_hora?: string | null
          mare_max_nivel?: number | null
          numero?: number
          pluv_07h?: number | null
          pluv_12h?: number | null
          pluv_17h?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdos_clima_atualizado_por_fkey"
            columns: ["clima_atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_rdo: { Args: { p_rdo: string }; Returns: boolean }
      copiar_dia_anterior: { Args: { p_rdo: string }; Returns: Json }
      has_perm: { Args: { p: string }; Returns: boolean }
      hoje_local: { Args: never; Returns: string }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      rdo_editavel: { Args: { p_rdo: string }; Returns: boolean }
      sugestoes_atividades: {
        Args: { p_busca?: string; p_frente: string; p_limite?: number }
        Returns: {
          descricao: string
          ultima_vez: string
        }[]
      }
      user_launched_in: { Args: { p_rdo: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
