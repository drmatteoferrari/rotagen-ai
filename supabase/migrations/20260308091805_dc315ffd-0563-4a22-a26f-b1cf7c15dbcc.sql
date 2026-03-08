ALTER TABLE public.rota_configs ADD COLUMN IF NOT EXISTS bh_same_as_weekend boolean DEFAULT NULL;
ALTER TABLE public.rota_configs ADD COLUMN IF NOT EXISTS bh_custom_rules text DEFAULT NULL;