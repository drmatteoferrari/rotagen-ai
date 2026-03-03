
-- TABLE: rota_configs
CREATE TABLE public.rota_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  department_name text DEFAULT '',
  trust_name text DEFAULT '',
  contact_email text DEFAULT '',
  rota_start_date date,
  rota_end_date date,
  rota_duration_days integer,
  rota_duration_weeks numeric(5,1),
  rota_start_time time DEFAULT '08:00',
  rota_end_time time DEFAULT '08:00',
  global_oncall_pct numeric(5,2) DEFAULT 50,
  global_non_oncall_pct numeric(5,2) DEFAULT 50,
  status text DEFAULT 'draft'
);

ALTER TABLE public.rota_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on rota_configs"
  ON public.rota_configs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- TABLE: shift_types
CREATE TABLE public.shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rota_config_id uuid NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  shift_key text NOT NULL,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_hours numeric(5,2) NOT NULL,
  is_oncall boolean DEFAULT false,
  is_non_res_oncall boolean DEFAULT false,
  applicable_mon boolean DEFAULT false,
  applicable_tue boolean DEFAULT false,
  applicable_wed boolean DEFAULT false,
  applicable_thu boolean DEFAULT false,
  applicable_fri boolean DEFAULT false,
  applicable_sat boolean DEFAULT false,
  applicable_sun boolean DEFAULT false,
  badge_night boolean DEFAULT false,
  badge_long boolean DEFAULT false,
  badge_ooh boolean DEFAULT false,
  badge_weekend boolean DEFAULT false,
  badge_oncall boolean DEFAULT false,
  badge_nonres boolean DEFAULT false,
  badge_night_manual_override boolean,
  badge_long_manual_override boolean,
  badge_ooh_manual_override boolean,
  badge_weekend_manual_override boolean,
  badge_oncall_manual_override boolean,
  badge_nonres_manual_override boolean,
  oncall_manually_set boolean DEFAULT false,
  min_doctors integer DEFAULT 1,
  max_doctors integer,
  target_percentage numeric(5,2),
  sort_order integer DEFAULT 0
);

ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on shift_types"
  ON public.shift_types FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- TABLE: bank_holidays
CREATE TABLE public.bank_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rota_config_id uuid NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  is_auto_added boolean DEFAULT true
);

ALTER TABLE public.bank_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on bank_holidays"
  ON public.bank_holidays FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- TABLE: wtr_settings
CREATE TABLE public.wtr_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rota_config_id uuid NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE UNIQUE,
  max_hours_per_week numeric(5,1) DEFAULT 48,
  max_hours_per_168h numeric(5,1) DEFAULT 72,
  max_consec_standard integer DEFAULT 7,
  max_consec_long integer DEFAULT 7,
  max_consec_nights integer DEFAULT 4,
  rest_after_nights_h numeric(5,1) DEFAULT 46,
  rest_after_long_h numeric(5,1) DEFAULT 48,
  rest_after_standard_h numeric(5,1) DEFAULT 48,
  weekend_frequency integer DEFAULT 3,
  oncall_no_consec_except_wknd boolean DEFAULT true,
  oncall_max_per_7_days integer DEFAULT 3,
  oncall_local_agreement_max_consec integer DEFAULT 7,
  oncall_day_after_max_hours numeric(5,1) DEFAULT 10,
  oncall_rest_per_24h numeric(5,1) DEFAULT 8,
  oncall_continuous_rest_hours numeric(5,1) DEFAULT 5,
  oncall_continuous_rest_start time DEFAULT '22:00',
  oncall_continuous_rest_end time DEFAULT '07:00',
  oncall_if_rest_not_met_max_hours numeric(5,1) DEFAULT 5,
  oncall_no_simultaneous_shift boolean DEFAULT true,
  oncall_break_fine_threshold_pct integer DEFAULT 25,
  oncall_break_reference_weeks integer DEFAULT 4,
  oncall_clinical_exception_allowed boolean DEFAULT true,
  oncall_saturday_sunday_paired boolean DEFAULT true,
  oncall_day_after_last_consec_max_h numeric(5,1) DEFAULT 10
);

ALTER TABLE public.wtr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on wtr_settings"
  ON public.wtr_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
