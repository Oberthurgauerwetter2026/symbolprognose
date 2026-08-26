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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      client_errors: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          memory_mb: number | null
          message: string
          route: string | null
          stack: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          memory_mb?: number | null
          message: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          memory_mb?: number | null
          message?: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          closed: number
          created: number
          detected: number
          job: string
          note: string | null
          notified: number
          ran_at: string
        }
        Insert: {
          closed?: number
          created?: number
          detected?: number
          job: string
          note?: string | null
          notified?: number
          ran_at?: string
        }
        Update: {
          closed?: number
          created?: number
          detected?: number
          job?: string
          note?: string | null
          notified?: number
          ran_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          region_ids: string[]
          updated_at: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          region_ids?: string[]
          updated_at?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          region_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      warning_regions: {
        Row: {
          region_id: string
          warning_id: string
        }
        Insert: {
          region_id: string
          warning_id: string
        }
        Update: {
          region_id?: string
          warning_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warning_regions_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      warnings: {
        Row: {
          active: boolean
          advisory: boolean
          auto_key: string | null
          created_at: string
          description: string
          hazard: string
          id: string
          impact: string
          level: number
          notified_at: string | null
          params: Json
          peak_phase: string | null
          source: string
          title: string | null
          updated_at: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          active?: boolean
          advisory?: boolean
          auto_key?: string | null
          created_at?: string
          description?: string
          hazard: string
          id?: string
          impact?: string
          level: number
          notified_at?: string | null
          params?: Json
          peak_phase?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          valid_from?: string
          valid_to: string
        }
        Update: {
          active?: boolean
          advisory?: boolean
          auto_key?: string | null
          created_at?: string
          description?: string
          hazard?: string
          id?: string
          impact?: string
          level?: number
          notified_at?: string | null
          params?: Json
          peak_phase?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
    }
    Views: {
      radar_cron_health: {
        Row: {
          duration_s: number | null
          end_time: string | null
          return_message: string | null
          start_time: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
