
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  job_title text,
  hospital text,
  department text,
  heard_from text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for registration"
  ON public.registration_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read by token"
  ON public.registration_requests FOR SELECT USING (true);

CREATE POLICY "Allow public update for approval"
  ON public.registration_requests FOR UPDATE USING (true);

ALTER TABLE public.coordinator_accounts
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE POLICY "Allow public insert for approval"
  ON public.coordinator_accounts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for password change"
  ON public.coordinator_accounts FOR UPDATE USING (true);
