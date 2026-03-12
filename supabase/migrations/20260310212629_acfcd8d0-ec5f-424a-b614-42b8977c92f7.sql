
-- 1a. Archive flag on rota_configs
ALTER TABLE public.rota_configs
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- 1b. Active flag on doctors
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
