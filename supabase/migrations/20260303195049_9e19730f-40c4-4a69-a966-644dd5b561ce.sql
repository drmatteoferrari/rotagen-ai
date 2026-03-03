
-- SECTION 1A — Add survey_token, survey_submitted_at to doctors table
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS survey_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS survey_submitted_at timestamptz;

-- Update survey_status default to 'not_started'
ALTER TABLE doctors ALTER COLUMN survey_status SET DEFAULT 'not_started';

-- Create unique index on survey_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_survey_token ON doctors(survey_token);

-- Backfill existing rows
UPDATE doctors SET survey_token = gen_random_uuid() WHERE survey_token IS NULL;
UPDATE doctors SET survey_status = 'not_started' WHERE survey_status = 'not_sent';

-- SECTION 1B — Create doctor_survey_responses table
CREATE TABLE IF NOT EXISTS doctor_survey_responses (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id             uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    rota_config_id        uuid NOT NULL REFERENCES rota_configs(id) ON DELETE CASCADE,
    UNIQUE(doctor_id, rota_config_id),

    -- STEP 1: Personal Details
    full_name             text,
    nhs_email             text,
    grade                 text,
    specialty             text,

    -- STEP 2: Competencies
    comp_ip_anaesthesia           boolean DEFAULT false,
    comp_ip_anaesthesia_here      boolean DEFAULT false,
    comp_obstetric                boolean DEFAULT false,
    comp_obstetric_here           boolean DEFAULT false,
    comp_icu                      boolean DEFAULT false,
    comp_icu_here                 boolean DEFAULT false,
    competencies_json             jsonb DEFAULT '{}',

    -- STEP 3: Working Pattern (LTFT)
    wte_percent                   numeric(5,2) DEFAULT 100,
    wte_other_value               numeric(5,2),
    ltft_days_off                 text[],
    ltft_night_flexibility        jsonb DEFAULT '[]',

    -- STEP 4: Leave & Unavailability
    annual_leave                  jsonb DEFAULT '[]',
    study_leave                   jsonb DEFAULT '[]',
    noc_dates                     jsonb DEFAULT '[]',
    other_unavailability          jsonb DEFAULT '[]',

    -- STEP 5: Medical Exemptions & Restrictions
    exempt_from_nights            boolean DEFAULT false,
    exempt_from_weekends          boolean DEFAULT false,
    exempt_from_oncall            boolean DEFAULT false,
    specific_days_off             text[],
    exemption_details             text,
    additional_restrictions       text,

    -- STEP 6: Shift Preferences & Training
    preferred_shift_types         text[],
    preferred_days_off            text[],
    dates_to_avoid                text[],
    other_requests                text,
    specialties_requested         jsonb DEFAULT '[]',
    want_pain_sessions            boolean DEFAULT false,
    pain_session_notes            text,
    want_preop                    boolean DEFAULT false,
    signoff_requirements          text,

    -- CONFIRMATION
    confirmed_accurate            boolean DEFAULT false,
    additional_notes              text,

    -- METADATA
    submitted_at                  timestamptz,
    last_saved_at                 timestamptz DEFAULT now(),
    status                        text DEFAULT 'not_started',
    created_at                    timestamptz DEFAULT now(),
    updated_at                    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_doctor ON doctor_survey_responses(doctor_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_rota_config ON doctor_survey_responses(rota_config_id);

-- RLS policy matching existing pattern
ALTER TABLE doctor_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON doctor_survey_responses FOR ALL USING (true) WITH CHECK (true);
