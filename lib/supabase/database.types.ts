export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      aceites: {
        Row: {
          cliente_cpf: string | null;
          cliente_nome: string;
          codigo_comprovante: string;
          comentario: string | null;
          criado_em: string;
          hash_documento: string;
          id: string;
          ip: unknown;
          otp_verificado_em: string;
          pdf_path: string | null;
          resultado: Database["public"]["Enums"]["aceite_resultado"];
          texto_consentimento: string;
          user_agent: string | null;
          versao_id: string;
        };
        ComputedFields: never;
        Insert: {
          cliente_cpf?: string | null;
          cliente_nome: string;
          codigo_comprovante?: string;
          comentario?: string | null;
          criado_em?: string;
          hash_documento: string;
          id?: string;
          ip?: unknown;
          otp_verificado_em: string;
          pdf_path?: string | null;
          resultado: Database["public"]["Enums"]["aceite_resultado"];
          texto_consentimento: string;
          user_agent?: string | null;
          versao_id: string;
        };
        Update: {
          cliente_cpf?: string | null;
          cliente_nome?: string;
          codigo_comprovante?: string;
          comentario?: string | null;
          criado_em?: string;
          hash_documento?: string;
          id?: string;
          ip?: unknown;
          otp_verificado_em?: string;
          pdf_path?: string | null;
          resultado?: Database["public"]["Enums"]["aceite_resultado"];
          texto_consentimento?: string;
          user_agent?: string | null;
          versao_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aceites_versao_id_fkey";
            columns: ["versao_id"];
            isOneToOne: false;
            referencedRelation: "proposta_versoes";
            referencedColumns: ["id"];
          },
        ];
      };
      auditoria_eventos: {
        Row: {
          criado_em: string;
          id: string;
          ip: unknown;
          metadados: NonNullable<Json>;
          proposta_id: string;
          tipo: Database["public"]["Enums"]["evento_tipo"];
          user_agent: string | null;
          versao_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          id?: string;
          ip?: unknown;
          metadados?: NonNullable<Json>;
          proposta_id: string;
          tipo: Database["public"]["Enums"]["evento_tipo"];
          user_agent?: string | null;
          versao_id?: string | null;
        };
        Update: {
          criado_em?: string;
          id?: string;
          ip?: unknown;
          metadados?: NonNullable<Json>;
          proposta_id?: string;
          tipo?: Database["public"]["Enums"]["evento_tipo"];
          user_agent?: string | null;
          versao_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auditoria_eventos_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auditoria_eventos_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas_situacao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auditoria_eventos_versao_id_fkey";
            columns: ["versao_id"];
            isOneToOne: false;
            referencedRelation: "proposta_versoes";
            referencedColumns: ["id"];
          },
        ];
      };
      otp_codigos: {
        Row: {
          codigo_hash: string;
          criado_em: string;
          email: string;
          expira_em: string;
          id: string;
          proposta_id: string;
          tentativas: number;
          usado_em: string | null;
        };
        ComputedFields: never;
        Insert: {
          codigo_hash: string;
          criado_em?: string;
          email: string;
          expira_em: string;
          id?: string;
          proposta_id: string;
          tentativas?: number;
          usado_em?: string | null;
        };
        Update: {
          codigo_hash?: string;
          criado_em?: string;
          email?: string;
          expira_em?: string;
          id?: string;
          proposta_id?: string;
          tentativas?: number;
          usado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "otp_codigos_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "otp_codigos_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas_situacao";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ativo: boolean;
          criado_em: string;
          email: string;
          empresa_nome: string | null;
          id: string;
          nome: string;
          role: Database["public"]["Enums"]["papel"];
          telefone: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          criado_em?: string;
          email: string;
          empresa_nome?: string | null;
          id: string;
          nome: string;
          role?: Database["public"]["Enums"]["papel"];
          telefone?: string | null;
        };
        Update: {
          ativo?: boolean;
          criado_em?: string;
          email?: string;
          empresa_nome?: string | null;
          id?: string;
          nome?: string;
          role?: Database["public"]["Enums"]["papel"];
          telefone?: string | null;
        };
        Relationships: [];
      };
      proposta_versoes: {
        Row: {
          conteudo: NonNullable<Json>;
          criado_em: string;
          enviada_em: string | null;
          hash_sha256: string | null;
          id: string;
          numero: number;
          proposta_id: string;
        };
        ComputedFields: never;
        Insert: {
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          enviada_em?: string | null;
          hash_sha256?: string | null;
          id?: string;
          numero: number;
          proposta_id: string;
        };
        Update: {
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          enviada_em?: string | null;
          hash_sha256?: string | null;
          id?: string;
          numero?: number;
          proposta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposta_versoes_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposta_versoes_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas_situacao";
            referencedColumns: ["id"];
          },
        ];
      };
      propostas: {
        Row: {
          atualizado_em: string;
          cliente_email: string;
          cliente_nome: string;
          cliente_telefone: string | null;
          criado_em: string;
          id: string;
          prestador_id: string;
          proposta_pai_id: string | null;
          status: Database["public"]["Enums"]["proposta_status"];
          tipo: Database["public"]["Enums"]["proposta_tipo"];
          titulo: string;
          token_hash: string | null;
          validade_em: string | null;
          versao_atual: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          cliente_email: string;
          cliente_nome: string;
          cliente_telefone?: string | null;
          criado_em?: string;
          id?: string;
          prestador_id: string;
          proposta_pai_id?: string | null;
          status?: Database["public"]["Enums"]["proposta_status"];
          tipo?: Database["public"]["Enums"]["proposta_tipo"];
          titulo: string;
          token_hash?: string | null;
          validade_em?: string | null;
          versao_atual?: number;
        };
        Update: {
          atualizado_em?: string;
          cliente_email?: string;
          cliente_nome?: string;
          cliente_telefone?: string | null;
          criado_em?: string;
          id?: string;
          prestador_id?: string;
          proposta_pai_id?: string | null;
          status?: Database["public"]["Enums"]["proposta_status"];
          tipo?: Database["public"]["Enums"]["proposta_tipo"];
          titulo?: string;
          token_hash?: string | null;
          validade_em?: string | null;
          versao_atual?: number;
        };
        Relationships: [
          {
            foreignKeyName: "propostas_prestador_id_fkey";
            columns: ["prestador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_proposta_pai_id_fkey";
            columns: ["proposta_pai_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_proposta_pai_id_fkey";
            columns: ["proposta_pai_id"];
            isOneToOne: false;
            referencedRelation: "propostas_situacao";
            referencedColumns: ["id"];
          },
        ];
      };
      templates: {
        Row: {
          ativo: boolean;
          conteudo: NonNullable<Json>;
          criado_em: string;
          dono_id: string | null;
          id: string;
          nicho: Database["public"]["Enums"]["nicho"];
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          conteudo: NonNullable<Json>;
          criado_em?: string;
          dono_id?: string | null;
          id?: string;
          nicho: Database["public"]["Enums"]["nicho"];
          titulo: string;
        };
        Update: {
          ativo?: boolean;
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          dono_id?: string | null;
          id?: string;
          nicho?: Database["public"]["Enums"]["nicho"];
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "templates_dono_id_fkey";
            columns: ["dono_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      propostas_situacao: {
        Row: {
          atualizado_em: string;
          cliente_email: string;
          cliente_nome: string;
          cliente_telefone: string | null;
          criado_em: string;
          id: string;
          prestador_id: string;
          proposta_pai_id: string | null;
          status: Database["public"]["Enums"]["proposta_status"];
          status_efetivo: Database["public"]["Enums"]["proposta_status"] | null;
          tipo: Database["public"]["Enums"]["proposta_tipo"];
          titulo: string;
          token_hash: string | null;
          validade_em: string | null;
          valor_total_centavos: number | null;
          versao_atual: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string | null;
          cliente_email?: string | null;
          cliente_nome?: string | null;
          cliente_telefone?: string | null;
          criado_em?: string | null;
          id?: string | null;
          prestador_id?: string | null;
          proposta_pai_id?: string | null;
          status?: Database["public"]["Enums"]["proposta_status"] | null;
          status_efetivo?: never;
          tipo?: Database["public"]["Enums"]["proposta_tipo"] | null;
          titulo?: string | null;
          token_hash?: string | null;
          validade_em?: string | null;
          valor_total_centavos?: never;
          versao_atual?: number | null;
        };
        Update: {
          atualizado_em?: string | null;
          cliente_email?: string | null;
          cliente_nome?: string | null;
          cliente_telefone?: string | null;
          criado_em?: string | null;
          id?: string | null;
          prestador_id?: string | null;
          proposta_pai_id?: string | null;
          status?: Database["public"]["Enums"]["proposta_status"] | null;
          status_efetivo?: never;
          tipo?: Database["public"]["Enums"]["proposta_tipo"] | null;
          titulo?: string | null;
          token_hash?: string | null;
          validade_em?: string | null;
          valor_total_centavos?: never;
          versao_atual?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "propostas_prestador_id_fkey";
            columns: ["prestador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_proposta_pai_id_fkey";
            columns: ["proposta_pai_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_proposta_pai_id_fkey";
            columns: ["proposta_pai_id"];
            isOneToOne: false;
            referencedRelation: "propostas_situacao";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_resumo_prestadores: {
        Args: Record<PropertyKey, never>;
        Returns: {
          ativo: boolean;
          criado_em: string;
          email: string;
          empresa_nome: string;
          id: string;
          nome: string;
          total_aceites: number;
          total_propostas: number;
        }[];
      };
      enviar_versao: {
        Args: {
          p_documento: Json;
          p_hash: string;
          p_ip?: unknown;
          p_proposta_id: string;
          p_token_hash: string;
          p_user_agent?: string;
        };
        Returns: {
          r_enviada_em: string;
          r_numero: number;
          r_validade_em: string;
          r_versao_id: string;
        }[];
      };
      gerar_codigo_comprovante: { Args: Record<PropertyKey, never>; Returns: string };
      regenerar_link: {
        Args: {
          p_ip?: unknown;
          p_proposta_id: string;
          p_token_hash: string;
          p_user_agent?: string;
        };
        Returns: {
          r_numero: number;
          r_validade_em: string;
          r_versao_id: string;
        }[];
      };
      resumo_painel: {
        Args: Record<PropertyKey, never>;
        Returns: {
          aceitas_mes: number;
          aguardando: number;
          valor_aceito_mes_centavos: number;
        }[];
      };
    };
    Enums: {
      aceite_resultado: "aceito" | "recusado" | "ajuste";
      evento_tipo:
        | "enviada"
        | "link_regenerado"
        | "aberta"
        | "otp_enviado"
        | "otp_verificado"
        | "otp_falhou"
        | "aceita"
        | "recusada"
        | "ajuste_solicitado"
        | "pdf_gerado"
        | "email_enviado";
      nicho: "reforma" | "assistencia_tecnica" | "design" | "agencia" | "instalacao";
      papel: "admin" | "prestador";
      proposta_status:
        | "rascunho"
        | "enviada"
        | "visualizada"
        | "aceita"
        | "recusada"
        | "ajuste_solicitado"
        | "expirada";
      proposta_tipo: "proposta" | "aditivo" | "entrega";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      aceite_resultado: ["aceito", "recusado", "ajuste"],
      evento_tipo: [
        "enviada",
        "link_regenerado",
        "aberta",
        "otp_enviado",
        "otp_verificado",
        "otp_falhou",
        "aceita",
        "recusada",
        "ajuste_solicitado",
        "pdf_gerado",
        "email_enviado",
      ],
      nicho: ["reforma", "assistencia_tecnica", "design", "agencia", "instalacao"],
      papel: ["admin", "prestador"],
      proposta_status: [
        "rascunho",
        "enviada",
        "visualizada",
        "aceita",
        "recusada",
        "ajuste_solicitado",
        "expirada",
      ],
      proposta_tipo: ["proposta", "aditivo", "entrega"],
    },
  },
} as const;
