
-- SECTION 6: Create doctors table
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_config_id uuid NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  grade text DEFAULT '—',
  survey_status text DEFAULT 'not_sent',
  survey_invite_sent_at timestamptz,
  survey_invite_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access" ON public.doctors
  FOR ALL TO public
  USING (true) WITH CHECK (true);

-- SECTION 8: Add survey_deadline to rota_configs
ALTER TABLE public.rota_configs ADD COLUMN IF NOT EXISTS survey_deadline date;
