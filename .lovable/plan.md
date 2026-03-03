

# Fix: Saving Failed for All Surveys

## Root Cause

The database RLS policies are set `TO authenticated` only, but the app uses a mock login system (hardcoded "developer1" account) that does **not** create a real Supabase/database session. When the user accesses the app from the preview URL without a Supabase auth session, all writes (INSERT/UPDATE/DELETE) are rejected by RLS because the request arrives as the `anon` role, which doesn't match the `authenticated` requirement.

Additionally, WTR steps 1–3 store values in local component state only — when step 4 saves, it writes hardcoded defaults instead of the user's actual values (a secondary data correctness issue).

## Fix Plan

### 1. Update RLS policies to allow both anon and authenticated access

Create a migration that drops the 4 existing restrictive policies and re-creates them with `TO public` (which covers both `anon` and `authenticated` roles):

- `rota_configs` — `FOR ALL TO public USING (true) WITH CHECK (true)`
- `shift_types` — same
- `bank_holidays` — same
- `wtr_settings` — same

This ensures the mock auth flow doesn't block database access.

### 2. Add shared WTR context for steps 1–3 values

Add WTR state fields to `AdminSetupContext`:
- `maxAvgWeekly`, `maxIn7Days` (step 1)
- `maxConsecDays`, `maxConsecLong`, `maxConsecNights` (step 2)
- `restPostNights`, `restPostBlock`, `restAfter7`, `weekendFreq` (step 3)

Update WtrStep1, WtrStep2, WtrStep3 to read/write these context values instead of local `useState`. Update WtrStep4 save handler to read from context instead of hardcoded defaults.

### Files Changed

| File | Change |
|---|---|
| Migration SQL | Drop + re-create 4 RLS policies with `TO public` |
| `src/contexts/AdminSetupContext.tsx` | Add WTR state fields + setters |
| `src/pages/admin/WtrStep1.tsx` | Use context state instead of local state |
| `src/pages/admin/WtrStep2.tsx` | Use context state instead of local state |
| `src/pages/admin/WtrStep3.tsx` | Use context state instead of local state |
| `src/pages/admin/WtrStep4.tsx` | Read WTR values from context for save |

