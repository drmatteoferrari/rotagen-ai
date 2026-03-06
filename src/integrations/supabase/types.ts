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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_settings: {
        Row: {
          created_at: string | null
          department_name: string | null
          id: string
          owned_by: string
          trust_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_name?: string | null
          id?: string
          owned_by: string
          trust_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_name?: string | null
          id?: string
          owned_by?: string
          trust_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bank_holidays: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_auto_added: boolean | null
          name: string
          rota_config_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_auto_added?: boolean | null
          name: string
          rota_config_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_auto_added?: boolean | null
          name?: string
          rota_config_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_holidays_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_survey_responses: {
        Row: {
          additional_notes: string | null
          additional_restrictions: string | null
          al_entitlement: number | null
          annual_leave: Json | null
          comp_icu: boolean | null
          comp_icu_here: boolean | null
          comp_ip_anaesthesia: boolean | null
          comp_ip_anaesthesia_here: boolean | null
          comp_obstetric: boolean | null
          comp_obstetric_here: boolean | null
          competencies_json: Json | null
          confirmed_accurate: boolean | null
          created_at: string | null
          dates_to_avoid: string[] | null
          doctor_id: string
          dual_specialty: boolean | null
          dual_specialty_types: string[] | null
          exempt_from_nights: boolean | null
          exempt_from_oncall: boolean | null
          exempt_from_weekends: boolean | null
          exemption_details: string | null
          full_name: string | null
          grade: string | null
          id: string
          last_saved_at: string | null
          ltft_days_off: string[] | null
          ltft_night_flexibility: Json | null
          nhs_email: string | null
          noc_dates: Json | null
          other_requests: string | null
          other_restrictions: string | null
          other_unavailability: Json | null
          pain_session_notes: string | null
          parental_leave_end: string | null
          parental_leave_expected: boolean | null
          parental_leave_notes: string | null
          parental_leave_start: string | null
          personal_email: string | null
          phone_number: string | null
          preferred_days_off: string[] | null
          preferred_shift_types: string[] | null
          rota_config_id: string
          signoff_needs: string | null
          signoff_requirements: string | null
          special_sessions: string[] | null
          specialties_requested: Json | null
          specialty: string | null
          specific_days_off: string[] | null
          status: string | null
          study_leave: Json | null
          submitted_at: string | null
          updated_at: string | null
          want_pain_sessions: boolean | null
          want_preop: boolean | null
          wte_other_value: number | null
          wte_percent: number | null
        }
        Insert: {
          additional_notes?: string | null
          additional_restrictions?: string | null
          al_entitlement?: number | null
          annual_leave?: Json | null
          comp_icu?: boolean | null
          comp_icu_here?: boolean | null
          comp_ip_anaesthesia?: boolean | null
          comp_ip_anaesthesia_here?: boolean | null
          comp_obstetric?: boolean | null
          comp_obstetric_here?: boolean | null
          competencies_json?: Json | null
          confirmed_accurate?: boolean | null
          created_at?: string | null
          dates_to_avoid?: string[] | null
          doctor_id: string
          dual_specialty?: boolean | null
          dual_specialty_types?: string[] | null
          exempt_from_nights?: boolean | null
          exempt_from_oncall?: boolean | null
          exempt_from_weekends?: boolean | null
          exemption_details?: string | null
          full_name?: string | null
          grade?: string | null
          id?: string
          last_saved_at?: string | null
          ltft_days_off?: string[] | null
          ltft_night_flexibility?: Json | null
          nhs_email?: string | null
          noc_dates?: Json | null
          other_requests?: string | null
          other_restrictions?: string | null
          other_unavailability?: Json | null
          pain_session_notes?: string | null
          parental_leave_end?: string | null
          parental_leave_expected?: boolean | null
          parental_leave_notes?: string | null
          parental_leave_start?: string | null
          personal_email?: string | null
          phone_number?: string | null
          preferred_days_off?: string[] | null
          preferred_shift_types?: string[] | null
          rota_config_id: string
          signoff_needs?: string | null
          signoff_requirements?: string | null
          special_sessions?: string[] | null
          specialties_requested?: Json | null
          specialty?: string | null
          specific_days_off?: string[] | null
          status?: string | null
          study_leave?: Json | null
          submitted_at?: string | null
          updated_at?: string | null
          want_pain_sessions?: boolean | null
          want_preop?: boolean | null
          wte_other_value?: number | null
          wte_percent?: number | null
        }
        Update: {
          additional_notes?: string | null
          additional_restrictions?: string | null
          al_entitlement?: number | null
          annual_leave?: Json | null
          comp_icu?: boolean | null
          comp_icu_here?: boolean | null
          comp_ip_anaesthesia?: boolean | null
          comp_ip_anaesthesia_here?: boolean | null
          comp_obstetric?: boolean | null
          comp_obstetric_here?: boolean | null
          competencies_json?: Json | null
          confirmed_accurate?: boolean | null
          created_at?: string | null
          dates_to_avoid?: string[] | null
          doctor_id?: string
          dual_specialty?: boolean | null
          dual_specialty_types?: string[] | null
          exempt_from_nights?: boolean | null
          exempt_from_oncall?: boolean | null
          exempt_from_weekends?: boolean | null
          exemption_details?: string | null
          full_name?: string | null
          grade?: string | null
          id?: string
          last_saved_at?: string | null
          ltft_days_off?: string[] | null
          ltft_night_flexibility?: Json | null
          nhs_email?: string | null
          noc_dates?: Json | null
          other_requests?: string | null
          other_restrictions?: string | null
          other_unavailability?: Json | null
          pain_session_notes?: string | null
          parental_leave_end?: string | null
          parental_leave_expected?: boolean | null
          parental_leave_notes?: string | null
          parental_leave_start?: string | null
          personal_email?: string | null
          phone_number?: string | null
          preferred_days_off?: string[] | null
          preferred_shift_types?: string[] | null
          rota_config_id?: string
          signoff_needs?: string | null
          signoff_requirements?: string | null
          special_sessions?: string[] | null
          specialties_requested?: Json | null
          specialty?: string | null
          specific_days_off?: string[] | null
          status?: string | null
          study_leave?: Json | null
          submitted_at?: string | null
          updated_at?: string | null
          want_pain_sessions?: boolean | null
          want_preop?: boolean | null
          wte_other_value?: number | null
          wte_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_survey_responses_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_survey_responses_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string
          grade: string | null
          id: string
          last_name: string
          rota_config_id: string
          survey_invite_count: number | null
          survey_invite_sent_at: string | null
          survey_status: string | null
          survey_submitted_at: string | null
          survey_token: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name: string
          grade?: string | null
          id?: string
          last_name: string
          rota_config_id: string
          survey_invite_count?: number | null
          survey_invite_sent_at?: string | null
          survey_status?: string | null
          survey_submitted_at?: string | null
          survey_token?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string
          grade?: string | null
          id?: string
          last_name?: string
          rota_config_id?: string
          survey_invite_count?: number | null
          survey_invite_sent_at?: string | null
          survey_status?: string | null
          survey_submitted_at?: string | null
          survey_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      rota_configs: {
        Row: {
          contact_email: string | null
          created_at: string | null
          department_name: string | null
          global_non_oncall_pct: number | null
          global_oncall_pct: number | null
          id: string
          owned_by: string
          rota_duration_days: number | null
          rota_duration_weeks: number | null
          rota_end_date: string | null
          rota_end_time: string | null
          rota_start_date: string | null
          rota_start_time: string | null
          status: string | null
          survey_deadline: string | null
          trust_name: string | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string | null
          department_name?: string | null
          global_non_oncall_pct?: number | null
          global_oncall_pct?: number | null
          id?: string
          owned_by?: string
          rota_duration_days?: number | null
          rota_duration_weeks?: number | null
          rota_end_date?: string | null
          rota_end_time?: string | null
          rota_start_date?: string | null
          rota_start_time?: string | null
          status?: string | null
          survey_deadline?: string | null
          trust_name?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string | null
          department_name?: string | null
          global_non_oncall_pct?: number | null
          global_oncall_pct?: number | null
          id?: string
          owned_by?: string
          rota_duration_days?: number | null
          rota_duration_weeks?: number | null
          rota_end_date?: string | null
          rota_end_time?: string | null
          rota_start_date?: string | null
          rota_start_time?: string | null
          status?: string | null
          survey_deadline?: string | null
          trust_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_types: {
        Row: {
          applicable_fri: boolean | null
          applicable_mon: boolean | null
          applicable_sat: boolean | null
          applicable_sun: boolean | null
          applicable_thu: boolean | null
          applicable_tue: boolean | null
          applicable_wed: boolean | null
          badge_long: boolean | null
          badge_long_manual_override: boolean | null
          badge_night: boolean | null
          badge_night_manual_override: boolean | null
          badge_nonres: boolean | null
          badge_nonres_manual_override: boolean | null
          badge_oncall: boolean | null
          badge_oncall_manual_override: boolean | null
          badge_ooh: boolean | null
          badge_ooh_manual_override: boolean | null
          badge_weekend: boolean | null
          badge_weekend_manual_override: boolean | null
          created_at: string | null
          duration_hours: number
          end_time: string
          id: string
          is_non_res_oncall: boolean | null
          is_oncall: boolean | null
          max_doctors: number | null
          min_doctors: number | null
          name: string
          oncall_manually_set: boolean | null
          req_iac: number
          req_iaoc: number
          req_icu: number
          req_min_grade: string | null
          rota_config_id: string
          shift_key: string
          sort_order: number | null
          start_time: string
          target_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          applicable_fri?: boolean | null
          applicable_mon?: boolean | null
          applicable_sat?: boolean | null
          applicable_sun?: boolean | null
          applicable_thu?: boolean | null
          applicable_tue?: boolean | null
          applicable_wed?: boolean | null
          badge_long?: boolean | null
          badge_long_manual_override?: boolean | null
          badge_night?: boolean | null
          badge_night_manual_override?: boolean | null
          badge_nonres?: boolean | null
          badge_nonres_manual_override?: boolean | null
          badge_oncall?: boolean | null
          badge_oncall_manual_override?: boolean | null
          badge_ooh?: boolean | null
          badge_ooh_manual_override?: boolean | null
          badge_weekend?: boolean | null
          badge_weekend_manual_override?: boolean | null
          created_at?: string | null
          duration_hours: number
          end_time: string
          id?: string
          is_non_res_oncall?: boolean | null
          is_oncall?: boolean | null
          max_doctors?: number | null
          min_doctors?: number | null
          name: string
          oncall_manually_set?: boolean | null
          req_iac?: number
          req_iaoc?: number
          req_icu?: number
          req_min_grade?: string | null
          rota_config_id: string
          shift_key: string
          sort_order?: number | null
          start_time: string
          target_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          applicable_fri?: boolean | null
          applicable_mon?: boolean | null
          applicable_sat?: boolean | null
          applicable_sun?: boolean | null
          applicable_thu?: boolean | null
          applicable_tue?: boolean | null
          applicable_wed?: boolean | null
          badge_long?: boolean | null
          badge_long_manual_override?: boolean | null
          badge_night?: boolean | null
          badge_night_manual_override?: boolean | null
          badge_nonres?: boolean | null
          badge_nonres_manual_override?: boolean | null
          badge_oncall?: boolean | null
          badge_oncall_manual_override?: boolean | null
          badge_ooh?: boolean | null
          badge_ooh_manual_override?: boolean | null
          badge_weekend?: boolean | null
          badge_weekend_manual_override?: boolean | null
          created_at?: string | null
          duration_hours?: number
          end_time?: string
          id?: string
          is_non_res_oncall?: boolean | null
          is_oncall?: boolean | null
          max_doctors?: number | null
          min_doctors?: number | null
          name?: string
          oncall_manually_set?: boolean | null
          req_iac?: number
          req_iaoc?: number
          req_icu?: number
          req_min_grade?: string | null
          rota_config_id?: string
          shift_key?: string
          sort_order?: number | null
          start_time?: string
          target_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_types_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wtr_settings: {
        Row: {
          created_at: string | null
          id: string
          max_consec_long: number | null
          max_consec_nights: number | null
          max_consec_standard: number | null
          max_hours_per_168h: number | null
          max_hours_per_week: number | null
          oncall_break_fine_threshold_pct: number | null
          oncall_break_reference_weeks: number | null
          oncall_clinical_exception_allowed: boolean | null
          oncall_continuous_rest_end: string | null
          oncall_continuous_rest_hours: number | null
          oncall_continuous_rest_start: string | null
          oncall_day_after_last_consec_max_h: number | null
          oncall_day_after_max_hours: number | null
          oncall_if_rest_not_met_max_hours: number | null
          oncall_local_agreement_max_consec: number | null
          oncall_max_per_7_days: number | null
          oncall_no_consec_except_wknd: boolean | null
          oncall_no_simultaneous_shift: boolean | null
          oncall_rest_per_24h: number | null
          oncall_saturday_sunday_paired: boolean | null
          rest_after_long_h: number | null
          rest_after_nights_h: number | null
          rest_after_standard_h: number | null
          rota_config_id: string
          updated_at: string | null
          weekend_frequency: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_consec_long?: number | null
          max_consec_nights?: number | null
          max_consec_standard?: number | null
          max_hours_per_168h?: number | null
          max_hours_per_week?: number | null
          oncall_break_fine_threshold_pct?: number | null
          oncall_break_reference_weeks?: number | null
          oncall_clinical_exception_allowed?: boolean | null
          oncall_continuous_rest_end?: string | null
          oncall_continuous_rest_hours?: number | null
          oncall_continuous_rest_start?: string | null
          oncall_day_after_last_consec_max_h?: number | null
          oncall_day_after_max_hours?: number | null
          oncall_if_rest_not_met_max_hours?: number | null
          oncall_local_agreement_max_consec?: number | null
          oncall_max_per_7_days?: number | null
          oncall_no_consec_except_wknd?: boolean | null
          oncall_no_simultaneous_shift?: boolean | null
          oncall_rest_per_24h?: number | null
          oncall_saturday_sunday_paired?: boolean | null
          rest_after_long_h?: number | null
          rest_after_nights_h?: number | null
          rest_after_standard_h?: number | null
          rota_config_id: string
          updated_at?: string | null
          weekend_frequency?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_consec_long?: number | null
          max_consec_nights?: number | null
          max_consec_standard?: number | null
          max_hours_per_168h?: number | null
          max_hours_per_week?: number | null
          oncall_break_fine_threshold_pct?: number | null
          oncall_break_reference_weeks?: number | null
          oncall_clinical_exception_allowed?: boolean | null
          oncall_continuous_rest_end?: string | null
          oncall_continuous_rest_hours?: number | null
          oncall_continuous_rest_start?: string | null
          oncall_day_after_last_consec_max_h?: number | null
          oncall_day_after_max_hours?: number | null
          oncall_if_rest_not_met_max_hours?: number | null
          oncall_local_agreement_max_consec?: number | null
          oncall_max_per_7_days?: number | null
          oncall_no_consec_except_wknd?: boolean | null
          oncall_no_simultaneous_shift?: boolean | null
          oncall_rest_per_24h?: number | null
          oncall_saturday_sunday_paired?: boolean | null
          rest_after_long_h?: number | null
          rest_after_nights_h?: number | null
          rest_after_standard_h?: number | null
          rota_config_id?: string
          updated_at?: string | null
          weekend_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wtr_settings_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: true
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "doctor"
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
      app_role: ["admin", "doctor"],
    },
  },
} as const
