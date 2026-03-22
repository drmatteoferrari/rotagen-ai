
-- Step 1: Create ENUMs
CREATE TYPE public.unavailability_reason AS ENUM ('annual', 'study', 'noc', 'rotation', 'parental', 'other');
CREATE TYPE public.day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE public.request_category AS ENUM ('specialty', 'session', 'interest');

-- Step 2: Add flat competency boolean columns to doctor_survey_responses
ALTER TABLE public.doctor_survey_responses
  ADD COLUMN IF NOT EXISTS iac_achieved BOOLEAN,
  ADD COLUMN IF NOT EXISTS iac_working BOOLEAN,
  ADD COLUMN IF NOT EXISTS iac_remote BOOLEAN,
  ADD COLUMN IF NOT EXISTS iaoc_achieved BOOLEAN,
  ADD COLUMN IF NOT EXISTS iaoc_working BOOLEAN,
  ADD COLUMN IF NOT EXISTS iaoc_remote BOOLEAN,
  ADD COLUMN IF NOT EXISTS icu_achieved BOOLEAN,
  ADD COLUMN IF NOT EXISTS icu_working BOOLEAN,
  ADD COLUMN IF NOT EXISTS icu_remote BOOLEAN,
  ADD COLUMN IF NOT EXISTS transfer_achieved BOOLEAN,
  ADD COLUMN IF NOT EXISTS transfer_working BOOLEAN,
  ADD COLUMN IF NOT EXISTS transfer_remote BOOLEAN;

-- Step 3: Create unavailability_blocks table
CREATE TABLE public.unavailability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  rota_config_id UUID NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  reason unavailability_reason NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Validation trigger for start_date <= end_date
CREATE OR REPLACE FUNCTION public.validate_unavailability_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.start_date > NEW.end_date THEN
    RAISE EXCEPTION 'start_date must be <= end_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_unavailability_dates
  BEFORE INSERT OR UPDATE ON public.unavailability_blocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_unavailability_dates();

-- Step 4: Create ltft_patterns table
CREATE TABLE public.ltft_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  rota_config_id UUID NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  day day_of_week NOT NULL,
  is_day_off BOOLEAN NOT NULL DEFAULT false,
  can_start_nights BOOLEAN,
  can_end_nights BOOLEAN,
  UNIQUE (doctor_id, rota_config_id, day)
);

-- Step 5: Create training_requests table
CREATE TABLE public.training_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  rota_config_id UUID NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  category request_category NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 6: Create dual_specialties table
CREATE TABLE public.dual_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  rota_config_id UUID NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  specialty_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 7: Enable RLS on all new tables
ALTER TABLE public.unavailability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ltft_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_specialties ENABLE ROW LEVEL SECURITY;

-- Step 8: RLS policies — matching doctor_survey_responses pattern

-- unavailability_blocks
CREATE POLICY "Public INSERT for survey submission" ON public.unavailability_blocks FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public UPDATE for survey submission" ON public.unavailability_blocks FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public SELECT for survey token access" ON public.unavailability_blocks FOR SELECT TO public USING (true);
CREATE POLICY "Public DELETE for survey normalization" ON public.unavailability_blocks FOR DELETE TO public USING (true);
CREATE POLICY "Coordinator owns their unavailability blocks" ON public.unavailability_blocks FOR ALL TO public
  USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = unavailability_blocks.rota_config_id AND rota_configs.owned_by = (auth.uid())::text))
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = unavailability_blocks.rota_config_id AND rota_configs.owned_by = (auth.uid())::text));

-- ltft_patterns
CREATE POLICY "Public INSERT for survey submission" ON public.ltft_patterns FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public UPDATE for survey submission" ON public.ltft_patterns FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public SELECT for survey token access" ON public.ltft_patterns FOR SELECT TO public USING (true);
CREATE POLICY "Public DELETE for survey normalization" ON public.ltft_patterns FOR DELETE TO public USING (true);
CREATE POLICY "Coordinator owns their ltft patterns" ON public.ltft_patterns FOR ALL TO public
  USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = ltft_patterns.rota_config_id AND rota_configs.owned_by = (auth.uid())::text))
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = ltft_patterns.rota_config_id AND rota_configs.owned_by = (auth.uid())::text));

-- training_requests
CREATE POLICY "Public INSERT for survey submission" ON public.training_requests FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public UPDATE for survey submission" ON public.training_requests FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public SELECT for survey token access" ON public.training_requests FOR SELECT TO public USING (true);
CREATE POLICY "Public DELETE for survey normalization" ON public.training_requests FOR DELETE TO public USING (true);
CREATE POLICY "Coordinator owns their training requests" ON public.training_requests FOR ALL TO public
  USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = training_requests.rota_config_id AND rota_configs.owned_by = (auth.uid())::text))
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = training_requests.rota_config_id AND rota_configs.owned_by = (auth.uid())::text));

-- dual_specialties
CREATE POLICY "Public INSERT for survey submission" ON public.dual_specialties FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public UPDATE for survey submission" ON public.dual_specialties FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public SELECT for survey token access" ON public.dual_specialties FOR SELECT TO public USING (true);
CREATE POLICY "Public DELETE for survey normalization" ON public.dual_specialties FOR DELETE TO public USING (true);
CREATE POLICY "Coordinator owns their dual specialties" ON public.dual_specialties FOR ALL TO public
  USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = dual_specialties.rota_config_id AND rota_configs.owned_by = (auth.uid())::text))
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rota_configs WHERE rota_configs.id = dual_specialties.rota_config_id AND rota_configs.owned_by = (auth.uid())::text));
