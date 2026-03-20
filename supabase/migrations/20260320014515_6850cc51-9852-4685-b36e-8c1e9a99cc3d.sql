ALTER TABLE public.wtr_settings
  ADD COLUMN IF NOT EXISTS max_shift_length_h numeric(4,1) DEFAULT 13,
  ADD COLUMN IF NOT EXISTS min_inter_shift_rest_h numeric(4,1) DEFAULT 11,
  ADD COLUMN IF NOT EXISTS max_long_evening_consec integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS rest_after_long_evening_h numeric(4,1) DEFAULT 48;