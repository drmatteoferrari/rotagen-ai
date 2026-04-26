ALTER TABLE public.resolved_availability
ADD COLUMN IF NOT EXISTS can_start_nights BOOLEAN,
ADD COLUMN IF NOT EXISTS can_end_nights BOOLEAN;