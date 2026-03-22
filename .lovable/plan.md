
# Database Normalization — COMPLETED (v2: Postgres RPC)

## What was done

1. **Database migration (v1)**: Created 3 ENUMs (`unavailability_reason`, `day_of_week`, `request_category`), 4 new tables (`unavailability_blocks`, `ltft_patterns`, `training_requests`, `dual_specialties`), 12 flat competency boolean columns on `doctor_survey_responses`, RLS policies, and validation trigger.

2. **Database migration (v2)**: Replaced Edge Function with `handle_survey_normalization` Postgres RPC (`SECURITY DEFINER`). This function runs inside a single Postgres transaction — all-or-nothing atomicity.

3. **SurveyContext.tsx**: `submitSurvey()` saves JSONB draft, then calls `supabase.rpc('handle_survey_normalization')` as a **blocking** operation. If the RPC fails, submission is aborted and the user sees a descriptive error.

4. **Pre-rota engine refactored**: `preRotaGenerator.ts` reads from relational tables with JSONB fallback for un-normalized data.

5. **Admin UI updated**: `DoctorProfile.tsx` fetches from all 4 relational tables. `Roster.tsx` reads flat competency bools with JSONB fallback.

6. **Edge Function deleted**: `supabase/functions/normalize-survey/` removed — replaced entirely by the Postgres RPC.

## Architecture

```text
DRAFT (auto-save)                    SUBMIT
─────────────────                    ──────
doctor_survey_responses              Postgres RPC: handle_survey_normalization
  ├─ JSONB cols (unchanged)    ──►   ├─ unavailability_blocks
  ├─ flat competency bools           ├─ ltft_patterns
  └─ scalar fields                   ├─ training_requests
                                     └─ dual_specialties
                                     + flatten competency bools
                                     + set status='submitted'
                                     + update doctors table

All within a single Postgres transaction (atomic).
```

JSONB columns remain for auto-save drafts. On final submit, the Postgres RPC atomically maps JSONB into relational tables. Pre-rota and admin code read relational tables first, falling back to JSONB for un-normalized data.
