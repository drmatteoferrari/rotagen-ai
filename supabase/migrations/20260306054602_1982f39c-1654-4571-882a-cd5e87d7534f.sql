ALTER TABLE doctor_survey_responses
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS dual_specialty boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dual_specialty_types text[],
  ADD COLUMN IF NOT EXISTS al_entitlement integer,
  ADD COLUMN IF NOT EXISTS other_restrictions text,
  ADD COLUMN IF NOT EXISTS parental_leave_expected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parental_leave_start date,
  ADD COLUMN IF NOT EXISTS parental_leave_end date,
  ADD COLUMN IF NOT EXISTS parental_leave_notes text,
  ADD COLUMN IF NOT EXISTS special_sessions text[],
  ADD COLUMN IF NOT EXISTS signoff_needs text;