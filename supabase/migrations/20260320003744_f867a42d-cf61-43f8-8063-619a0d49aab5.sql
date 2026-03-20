ALTER TABLE public.rota_configs
  DROP COLUMN IF EXISTS rota_start_time,
  DROP COLUMN IF EXISTS rota_end_time,
  DROP COLUMN IF EXISTS bh_custom_rules;