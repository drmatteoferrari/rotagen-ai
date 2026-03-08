-- SECTION 8 COMPLETE: unique constraint added
-- Add unique constraint to account_settings.owned_by
-- Required for upsert conflict target to work correctly
ALTER TABLE public.account_settings 
  ADD CONSTRAINT account_settings_owned_by_unique 
  UNIQUE (owned_by);