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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      consultants: {
        Row: {
          availability_date: string | null
          bench_status: Database["public"]["Enums"]["bench_status"]
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          last_client_type: string | null
          last_project_duration: string | null
          last_project_title: string | null
          phone: string | null
          resume_url: string | null
          tech_stack: string[]
          updated_at: string
          work_authorization: string | null
          workspace_id: string
          years_experience: number | null
        }
        Insert: {
          availability_date?: string | null
          bench_status?: Database["public"]["Enums"]["bench_status"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_client_type?: string | null
          last_project_duration?: string | null
          last_project_title?: string | null
          phone?: string | null
          resume_url?: string | null
          tech_stack?: string[]
          updated_at?: string
          work_authorization?: string | null
          workspace_id: string
          years_experience?: number | null
        }
        Update: {
          availability_date?: string | null
          bench_status?: Database["public"]["Enums"]["bench_status"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_client_type?: string | null
          last_project_duration?: string | null
          last_project_title?: string | null
          phone?: string | null
          resume_url?: string | null
          tech_stack?: string[]
          updated_at?: string
          work_authorization?: string | null
          workspace_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          last_sync_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          last_sync_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          last_sync_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_rates: {
        Row: {
          created_at: string
          id: string
          rate_max: number
          rate_min: number
          stack: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rate_max: number
          rate_min: number
          stack: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rate_max?: number
          rate_min?: number
          stack?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          am_email: string | null
          am_name: string | null
          am_phone: string | null
          client_masked: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          ghost_reasons: string[]
          id: string
          is_ghost: boolean
          jd_text: string | null
          location_city: string | null
          location_state: string | null
          origin_channel: Database["public"]["Enums"]["origin_channel"]
          posted_date: string | null
          rate_max: number | null
          rate_min: number | null
          req_score: number
          sheet_sync_status: Database["public"]["Enums"]["sync_status"]
          source_type: Database["public"]["Enums"]["source_type"]
          status: Database["public"]["Enums"]["req_status"]
          tech_stack: string[]
          title: string
          updated_at: string
          vendor_name: string | null
          workspace_id: string
        }
        Insert: {
          am_email?: string | null
          am_name?: string | null
          am_phone?: string | null
          client_masked?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          ghost_reasons?: string[]
          id?: string
          is_ghost?: boolean
          jd_text?: string | null
          location_city?: string | null
          location_state?: string | null
          origin_channel?: Database["public"]["Enums"]["origin_channel"]
          posted_date?: string | null
          rate_max?: number | null
          rate_min?: number | null
          req_score?: number
          sheet_sync_status?: Database["public"]["Enums"]["sync_status"]
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: Database["public"]["Enums"]["req_status"]
          tech_stack?: string[]
          title: string
          updated_at?: string
          vendor_name?: string | null
          workspace_id: string
        }
        Update: {
          am_email?: string | null
          am_name?: string | null
          am_phone?: string | null
          client_masked?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          ghost_reasons?: string[]
          id?: string
          is_ghost?: boolean
          jd_text?: string | null
          location_city?: string | null
          location_state?: string | null
          origin_channel?: Database["public"]["Enums"]["origin_channel"]
          posted_date?: string | null
          rate_max?: number | null
          rate_min?: number | null
          req_score?: number
          sheet_sync_status?: Database["public"]["Enums"]["sync_status"]
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: Database["public"]["Enums"]["req_status"]
          tech_stack?: string[]
          title?: string
          updated_at?: string
          vendor_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          am_feedback: string | null
          am_summary: string | null
          consultant_id: string
          created_at: string
          created_by: string | null
          id: string
          requirement_id: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          am_feedback?: string | null
          am_summary?: string | null
          consultant_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          requirement_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_date?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          am_feedback?: string | null
          am_summary?: string | null
          consultant_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          requirement_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          error_message: string | null
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          records_added: number
          records_processed: number
          run_at: string
          status: Database["public"]["Enums"]["sync_log_status"]
          workspace_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          records_added?: number
          records_processed?: number
          run_at?: string
          status?: Database["public"]["Enums"]["sync_log_status"]
          workspace_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          records_added?: number
          records_processed?: number
          run_at?: string
          status?: Database["public"]["Enums"]["sync_log_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspace_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "viewer"
      bench_status: "available" | "in_interview" | "placed"
      integration_type: "google_sheets" | "dice" | "gmail"
      origin_channel: "dice" | "gmail" | "manual" | "sheets"
      req_status: "new" | "reviewing" | "submitted" | "interview" | "closed"
      source_type: "direct" | "tier1" | "jobboard"
      submission_status:
        | "submitted"
        | "in_review"
        | "interview_scheduled"
        | "rejected"
        | "placed"
      sync_log_status: "success" | "partial" | "failed"
      sync_status: "synced" | "pending" | "failed"
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
      app_role: ["admin", "recruiter", "viewer"],
      bench_status: ["available", "in_interview", "placed"],
      integration_type: ["google_sheets", "dice", "gmail"],
      origin_channel: ["dice", "gmail", "manual", "sheets"],
      req_status: ["new", "reviewing", "submitted", "interview", "closed"],
      source_type: ["direct", "tier1", "jobboard"],
      submission_status: [
        "submitted",
        "in_review",
        "interview_scheduled",
        "rejected",
        "placed",
      ],
      sync_log_status: ["success", "partial", "failed"],
      sync_status: ["synced", "pending", "failed"],
    },
  },
} as const
