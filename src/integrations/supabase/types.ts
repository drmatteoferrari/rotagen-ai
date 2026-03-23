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
          owned_by?: string
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
          is_active: boolean
          is_auto_added: boolean | null
          name: string
          rota_config_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_active?: boolean
          is_auto_added?: boolean | null
          name: string
          rota_config_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_active?: boolean
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
      coordinator_accounts: {
        Row: {
          created_at: string | null
          department: string | null
          display_name: string
          email: string
          hospital: string | null
          id: string
          job_title: string | null
          must_change_password: boolean
          phone: string | null
          status: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          display_name: string
          email: string
          hospital?: string | null
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          phone?: string | null
          status?: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          display_name?: string
          email?: string
          hospital?: string | null
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          phone?: string | null
          status?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      coordinator_calendar_overrides: {
        Row: {
          action: string
          created_at: string
          created_by: string
          doctor_id: string
          end_date: string
          event_type: string
          id: string
          note: string | null
          original_end_date: string | null
          original_event_type: string | null
          original_start_date: string | null
          recurrence: string
          recurrence_dates: string[] | null
          rota_config_id: string
          start_date: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          doctor_id: string
          end_date: string
          event_type: string
          id?: string
          note?: string | null
          original_end_date?: string | null
          original_event_type?: string | null
          original_start_date?: string | null
          recurrence?: string
          recurrence_dates?: string[] | null
          rota_config_id: string
          start_date: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          doctor_id?: string
          end_date?: string
          event_type?: string
          id?: string
          note?: string | null
          original_end_date?: string | null
          original_event_type?: string | null
          original_start_date?: string | null
          recurrence?: string
          recurrence_dates?: string[] | null
          rota_config_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_calendar_overrides_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_calendar_overrides_rota_config_id_fkey"
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
          confirm_algorithm_understood: boolean | null
          confirm_exemptions_understood: boolean | null
          confirm_fairness_understood: boolean | null
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
          iac_achieved: boolean | null
          iac_remote: boolean | null
          iac_working: boolean | null
          iaoc_achieved: boolean | null
          iaoc_remote: boolean | null
          iaoc_working: boolean | null
          icu_achieved: boolean | null
          icu_remote: boolean | null
          icu_working: boolean | null
          id: string
          last_saved_at: string | null
          ltft_days_off: string[] | null
          ltft_night_flexibility: Json | null
          nhs_email: string | null
          noc_dates: Json | null
          other_interests: Json | null
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
          signature_date: string | null
          signature_name: string | null
          signoff_needs: string | null
          signoff_requirements: string | null
          special_sessions: string[] | null
          specialties_requested: Json | null
          specialty: string | null
          specific_days_off: string[] | null
          status: string | null
          study_leave: Json | null
          submitted_at: string | null
          transfer_achieved: boolean | null
          transfer_remote: boolean | null
          transfer_working: boolean | null
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
          confirm_algorithm_understood?: boolean | null
          confirm_exemptions_understood?: boolean | null
          confirm_fairness_understood?: boolean | null
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
          iac_achieved?: boolean | null
          iac_remote?: boolean | null
          iac_working?: boolean | null
          iaoc_achieved?: boolean | null
          iaoc_remote?: boolean | null
          iaoc_working?: boolean | null
          icu_achieved?: boolean | null
          icu_remote?: boolean | null
          icu_working?: boolean | null
          id?: string
          last_saved_at?: string | null
          ltft_days_off?: string[] | null
          ltft_night_flexibility?: Json | null
          nhs_email?: string | null
          noc_dates?: Json | null
          other_interests?: Json | null
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
          signature_date?: string | null
          signature_name?: string | null
          signoff_needs?: string | null
          signoff_requirements?: string | null
          special_sessions?: string[] | null
          specialties_requested?: Json | null
          specialty?: string | null
          specific_days_off?: string[] | null
          status?: string | null
          study_leave?: Json | null
          submitted_at?: string | null
          transfer_achieved?: boolean | null
          transfer_remote?: boolean | null
          transfer_working?: boolean | null
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
          confirm_algorithm_understood?: boolean | null
          confirm_exemptions_understood?: boolean | null
          confirm_fairness_understood?: boolean | null
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
          iac_achieved?: boolean | null
          iac_remote?: boolean | null
          iac_working?: boolean | null
          iaoc_achieved?: boolean | null
          iaoc_remote?: boolean | null
          iaoc_working?: boolean | null
          icu_achieved?: boolean | null
          icu_remote?: boolean | null
          icu_working?: boolean | null
          id?: string
          last_saved_at?: string | null
          ltft_days_off?: string[] | null
          ltft_night_flexibility?: Json | null
          nhs_email?: string | null
          noc_dates?: Json | null
          other_interests?: Json | null
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
          signature_date?: string | null
          signature_name?: string | null
          signoff_needs?: string | null
          signoff_requirements?: string | null
          special_sessions?: string[] | null
          specialties_requested?: Json | null
          specialty?: string | null
          specific_days_off?: string[] | null
          status?: string | null
          study_leave?: Json | null
          submitted_at?: string | null
          transfer_achieved?: boolean | null
          transfer_remote?: boolean | null
          transfer_working?: boolean | null
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
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
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
      dual_specialties: {
        Row: {
          created_at: string | null
          doctor_id: string
          id: string
          rota_config_id: string
          specialty_name: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          id?: string
          rota_config_id: string
          specialty_name: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          id?: string
          rota_config_id?: string
          specialty_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "dual_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dual_specialties_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      ltft_patterns: {
        Row: {
          can_end_nights: boolean | null
          can_start_nights: boolean | null
          day: Database["public"]["Enums"]["day_of_week"]
          doctor_id: string
          id: string
          is_day_off: boolean
          rota_config_id: string
        }
        Insert: {
          can_end_nights?: boolean | null
          can_start_nights?: boolean | null
          day: Database["public"]["Enums"]["day_of_week"]
          doctor_id: string
          id?: string
          is_day_off?: boolean
          rota_config_id: string
        }
        Update: {
          can_end_nights?: boolean | null
          can_start_nights?: boolean | null
          day?: Database["public"]["Enums"]["day_of_week"]
          doctor_id?: string
          id?: string
          is_day_off?: boolean
          rota_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltft_patterns_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltft_patterns_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_rota_results: {
        Row: {
          calendar_data: Json
          created_at: string | null
          generated_at: string
          generated_by: string
          id: string
          rota_config_id: string
          status: string
          targets_data: Json
          validation_issues: Json
        }
        Insert: {
          calendar_data?: Json
          created_at?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          rota_config_id: string
          status: string
          targets_data?: Json
          validation_issues?: Json
        }
        Update: {
          calendar_data?: Json
          created_at?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          rota_config_id?: string
          status?: string
          targets_data?: Json
          validation_issues?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pre_rota_results_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: true
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
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          rota_credits: number | null
          stripe_customer_id: string | null
          subscription_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          rota_credits?: number | null
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          rota_credits?: number | null
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          approval_token: string
          approved_at: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          heard_from: string | null
          hospital: string | null
          id: string
          job_title: string | null
          phone: string | null
          status: string
        }
        Insert: {
          approval_token?: string
          approved_at?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          heard_from?: string | null
          hospital?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          status?: string
        }
        Update: {
          approval_token?: string
          approved_at?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          heard_from?: string | null
          hospital?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      rota_configs: {
        Row: {
          bh_same_as_weekend: boolean | null
          bh_shift_rules: Json | null
          contact_email: string | null
          created_at: string | null
          department_name: string | null
          global_non_oncall_pct: number | null
          global_oncall_pct: number | null
          id: string
          is_archived: boolean
          owned_by: string
          rota_duration_days: number | null
          rota_duration_weeks: number | null
          rota_end_date: string | null
          rota_start_date: string | null
          status: string | null
          survey_deadline: string | null
          trust_name: string | null
          updated_at: string | null
        }
        Insert: {
          bh_same_as_weekend?: boolean | null
          bh_shift_rules?: Json | null
          contact_email?: string | null
          created_at?: string | null
          department_name?: string | null
          global_non_oncall_pct?: number | null
          global_oncall_pct?: number | null
          id?: string
          is_archived?: boolean
          owned_by?: string
          rota_duration_days?: number | null
          rota_duration_weeks?: number | null
          rota_end_date?: string | null
          rota_start_date?: string | null
          status?: string | null
          survey_deadline?: string | null
          trust_name?: string | null
          updated_at?: string | null
        }
        Update: {
          bh_same_as_weekend?: boolean | null
          bh_shift_rules?: Json | null
          contact_email?: string | null
          created_at?: string | null
          department_name?: string | null
          global_non_oncall_pct?: number | null
          global_oncall_pct?: number | null
          id?: string
          is_archived?: boolean
          owned_by?: string
          rota_duration_days?: number | null
          rota_duration_weeks?: number | null
          rota_end_date?: string | null
          rota_start_date?: string | null
          status?: string | null
          survey_deadline?: string | null
          trust_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_types: {
        Row: {
          abbreviation: string | null
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
          req_transfer: number
          rota_config_id: string
          shift_key: string
          sort_order: number | null
          start_time: string
          target_doctors: number | null
          target_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          abbreviation?: string | null
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
          req_transfer?: number
          rota_config_id: string
          shift_key: string
          sort_order?: number | null
          start_time: string
          target_doctors?: number | null
          target_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string | null
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
          req_transfer?: number
          rota_config_id?: string
          shift_key?: string
          sort_order?: number | null
          start_time?: string
          target_doctors?: number | null
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
      training_requests: {
        Row: {
          category: Database["public"]["Enums"]["request_category"]
          created_at: string | null
          doctor_id: string
          id: string
          name: string
          notes: string | null
          rota_config_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["request_category"]
          created_at?: string | null
          doctor_id: string
          id?: string
          name: string
          notes?: string | null
          rota_config_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["request_category"]
          created_at?: string | null
          doctor_id?: string
          id?: string
          name?: string
          notes?: string | null
          rota_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requests_rota_config_id_fkey"
            columns: ["rota_config_id"]
            isOneToOne: false
            referencedRelation: "rota_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      unavailability_blocks: {
        Row: {
          created_at: string | null
          doctor_id: string
          end_date: string
          id: string
          location: string | null
          notes: string | null
          reason: Database["public"]["Enums"]["unavailability_reason"]
          rota_config_id: string
          start_date: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          end_date: string
          id?: string
          location?: string | null
          notes?: string | null
          reason: Database["public"]["Enums"]["unavailability_reason"]
          rota_config_id: string
          start_date: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          end_date?: string
          id?: string
          location?: string | null
          notes?: string | null
          reason?: Database["public"]["Enums"]["unavailability_reason"]
          rota_config_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "unavailability_blocks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unavailability_blocks_rota_config_id_fkey"
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
          max_long_evening_consec: number | null
          max_shift_length_h: number | null
          min_inter_shift_rest_h: number | null
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
          rest_after_long_evening_h: number | null
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
          max_long_evening_consec?: number | null
          max_shift_length_h?: number | null
          min_inter_shift_rest_h?: number | null
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
          rest_after_long_evening_h?: number | null
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
          max_long_evening_consec?: number | null
          max_shift_length_h?: number | null
          min_inter_shift_rest_h?: number | null
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
          rest_after_long_evening_h?: number | null
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
      handle_survey_normalization: {
        Args: {
          p_doctor_id: string
          p_rota_config_id: string
          p_signature_date?: string
          p_signature_name?: string
        }
        Returns: undefined
      }
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
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      request_category: "specialty" | "session" | "interest"
      unavailability_reason:
        | "annual"
        | "study"
        | "noc"
        | "rotation"
        | "parental"
        | "other"
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
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      request_category: ["specialty", "session", "interest"],
      unavailability_reason: [
        "annual",
        "study",
        "noc",
        "rotation",
        "parental",
        "other",
      ],
    },
  },
} as const
