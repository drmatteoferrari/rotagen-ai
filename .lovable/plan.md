# RLS Lockdown Migration for Coordinator-Only Tables

## What this does

Creates a single new migration file that tightens Row-Level Security on 9 backend tables. No frontend code is touched and no UI behavior changes.

**Doctor-facing tables left untouched** (the public survey still reads/writes these directly): `rota_configs`, `doctors`, `bank_holidays`, `account_settings`, `doctor_survey_responses`.

## File to create

`supabase/migrations/20260427000001_rls_coordinator_lockdown.sql` — verbatim SQL as provided in the request.

## Changes per table

| Table | Action |
|---|---|
| `shift_types` | Drop permissive policies, add coordinator-owns policy |
| `wtr_settings` | Drop permissive policies, add coordinator-owns policy |
| `pre_rota_results` | Drop permissive policy, add coordinator-owns policy |
| `shift_day_slots` | Enable RLS, drop permissive, add coordinator-owns |
| `shift_slot_requirements` | Enable RLS, drop permissive, add coordinator-owns |
| `unavailability_blocks` | Drop 4 redundant public policies (coordinator-owns already exists) |
| `ltft_patterns` | Drop 4 redundant public policies |
| `training_requests` | Drop 4 redundant public policies |
| `dual_specialties` | Drop 4 redundant public policies |

## Why this is safe for the doctor survey

`handle_survey_normalization` is a `SECURITY DEFINER` function — it bypasses RLS when writing to `unavailability_blocks`, `ltft_patterns`, `training_requests`, and `dual_specialties`. The public anon policies on those tables are redundant and dropping them does not break the survey submission flow.

## Outcome

All 9 tables end up scoped to the coordinator who owns the parent `rota_config`, closing cross-tenant read/write paths on backend configuration data.
