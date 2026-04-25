-- Add LTFT night-flexibility flags to resolved_availability.
-- These are populated only when status = 'LTFT'. NULL for all other statuses.
-- The algorithm reads these directly from resolved_availability in Phase 0,
-- eliminating the need for a separate join against ltft_patterns.

ALTER TABLE public.resolved_availability
  ADD COLUMN IF NOT EXISTS can_start_nights boolean,
  ADD COLUMN IF NOT EXISTS can_end_nights   boolean;
