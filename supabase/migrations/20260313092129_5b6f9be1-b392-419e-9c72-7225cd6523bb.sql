CREATE TABLE IF NOT EXISTS public.coordinator_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  display_name text NOT NULL,
  email text NOT NULL,
  phone text,
  job_title text,
  hospital text,
  department text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.coordinator_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for login"
  ON public.coordinator_accounts
  FOR SELECT
  USING (true);