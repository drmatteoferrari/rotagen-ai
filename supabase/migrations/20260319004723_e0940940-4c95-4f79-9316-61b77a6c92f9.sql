ALTER TABLE public.shift_types ADD COLUMN IF NOT EXISTS abbreviation text;
ALTER TABLE public.shift_types ADD COLUMN IF NOT EXISTS target_doctors integer;
ALTER TABLE public.shift_types ADD COLUMN IF NOT EXISTS req_transfer integer NOT NULL DEFAULT 0;