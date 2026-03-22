
# Database Normalization — COMPLETED

## What was done

1. **Database migration**: Created 3 ENUMs (`unavailability_reason`, `day_of_week`, `request_category`), 4 new tables (`unavailability_blocks`, `ltft_patterns`, `training_requests`, `dual_specialties`), 12 flat competency boolean columns on `doctor_survey_responses`, RLS policies, and validation trigger.

2. **Edge function `normalize-survey`**: Atomically normalizes JSONB → relational tables on survey submit. Called non-blocking from `submitSurvey()`.

3. **Pre-rota engine refactored**: `preRotaGenerator.ts` reads from relational tables with JSONB fallback for un-normalized data.

4. **Admin UI updated**: `DoctorProfile.tsx` fetches from all 4 relational tables. `Roster.tsx` reads flat competency bools with JSONB fallback.

5. **Data wipe executed**: All survey responses and relational data truncated, doctor statuses reset.

## Architecture

JSONB columns remain for auto-save drafts. On final submit, the `normalize-survey` edge function maps JSONB into relational tables. Pre-rota and admin code read relational tables first, falling back to JSONB for un-normalized data.
