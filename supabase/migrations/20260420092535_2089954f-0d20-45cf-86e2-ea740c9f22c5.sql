ALTER TABLE public.shift_types
  ADD COLUMN IF NOT EXISTS badge_long_evening boolean DEFAULT false;