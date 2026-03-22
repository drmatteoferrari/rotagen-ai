# Database Normalization Plan — Doctor Survey System

## Architecture

```text
DRAFT (auto-save)                    SUBMIT
─────────────────                    ──────
doctor_survey_responses              Edge function: normalize-survey
  ├─ JSONB cols (unchanged)    ──►   ├─ unavailability_blocks
  ├─ flat competency bools (new)     ├─ ltft_patterns
  └─ scalar fields                   ├─ training_requests
                                     └─ dual_specialties
                                     + flatten competency bools

Pre-rota generator reads from ──► relational tables (not JSONB)
Admin views read from ──► relational tables (not JSONB)
```

**Key principle**: JSONB columns stay on `doctor_survey_responses` for auto-save. On final submit, an edge function atomically normalizes JSONB into relational tables using a Postgres transaction. Pre-rota and admin code read from relational tables only.

---

## Step 1 — Database Migration

**ENUMs**:

- `unavailability_reason`: annual, study, noc, rotation, parental, other
- `day_of_week`: monday–sunday
- `request_category`: specialty, session, interest

**New columns on `doctor_survey_responses**` (flat competency booleans replacing need to parse `competencies_json` downstream):

- `iac_achieved`, `iac_working`, `iac_remote` (BOOLEAN)
- `iaoc_achieved`, `iaoc_working`, `iaoc_remote` (BOOLEAN)
- `icu_achieved`, `icu_working`, `icu_remote` (BOOLEAN)
- `transfer_achieved`, `transfer_working`, `transfer_remote` (BOOLEAN)

**New tables** (all with `doctor_id` FK, `rota_config_id` FK, RLS matching the coordinator/public pattern):

1. `**unavailability_blocks**`: id, doctor_id, rota_config_id, reason (enum), start_date (DATE), end_date (DATE), notes, location. Validation trigger: start_date <= end_date.
2. `**ltft_patterns**`: id, doctor_id, rota_config_id, day (enum), is_day_off (BOOL), can_start_nights (BOOL), can_end_nights (BOOL). UNIQUE(doctor_id, rota_config_id, day).
3. `**training_requests**`: id, doctor_id, rota_config_id, category (enum), name (TEXT), notes (TEXT).
4. `**dual_specialties**`: id, doctor_id, rota_config_id, specialty_name (TEXT).

**RLS on all four tables**: Same pattern as `doctor_survey_responses` — public INSERT/UPDATE for survey submission + coordinator owns via rota_configs join.

**Do NOT drop existing JSONB columns** — they remain for auto-save draft storage.

---

## Step 2 — Edge Function: `normalize-survey`

Creates `supabase/functions/normalize-survey/index.ts`.

Called by `submitSurvey()` in SurveyContext after the main upsert succeeds. Receives `{ doctor_id, rota_config_id }`.

Logic (uses service role for transaction):

1. Read the `doctor_survey_responses` row
2. Delete existing rows in all 4 child tables for this doctor+config
3. Parse JSONB fields → insert into relational tables:
  - `annual_leave` → unavailability_blocks (reason='annual')
  - `study_leave` → unavailability_blocks (reason='study')
  - `noc_dates` → unavailability_blocks (reason='noc')
  - `other_unavailability` → unavailability_blocks (reason='rotation')
  - Parental leave → unavailability_blocks (reason='parental')
  - `ltft_days_off` + `ltft_night_flexibility` → ltft_patterns
  - `specialties_requested` → training_requests (category='specialty')
  - `special_sessions` → training_requests (category='session')
  - `other_interests` → training_requests (category='interest')
  - `dual_specialty_types` → dual_specialties
4. Flatten `competencies_json` → update flat boolean columns on the same row
5. All within a single Postgres transaction via `supabase.rpc` or raw SQL

---

## Step 3 — SurveyContext.tsx Changes

`**formDataToDbRow` and `dbRowToFormData**`: No changes — they continue writing/reading JSONB for auto-save.

`**submitSurvey()**`: After the existing upsert succeeds, add:

```typescript
await supabase.functions.invoke("normalize-survey", {
  body: { doctor_id: doc.id, rota_config_id: doc.rotaConfigId }
});
```

Non-blocking for the user — if normalization fails, the JSONB data is still saved and can be re-normalized later.

---

## Step 4 — Pre-Rota Generator Refactor

`**preRotaGenerator.ts**`: Replace step 6 (fetch survey responses → parse JSONB) with:

- Fetch `doctor_survey_responses` for scalar fields (wte_percent, grade, exemptions, flat competency bools)
- Fetch `unavailability_blocks` for all leave/NOC/rotation data
- Fetch `ltft_patterns` for LTFT days off and night flexibility
- Use joins: `.select('*, unavailability_blocks(*), ltft_patterns(*)')` on doctor_survey_responses

`**preRotaCalendar.ts**`: Update `CalendarBuilderInputs` to accept structured unavailability blocks instead of separate arrays. The `inAnyPeriod` helper becomes a filter on reason type.

`**preRotaValidation.ts**`: Update doctor survey shape to use flat competency bools and unavailability blocks.

---

## Step 5 — Admin UI Updates

**Roster.tsx expanded panel**: Query `unavailability_blocks` and `ltft_patterns` instead of JSONB fields. Calculate leave totals by summing block durations.

**DoctorProfile.tsx**: Update SurveyRow interface and select to use relational joins. Display leave from unavailability_blocks, competencies from flat bools.

**SurveyResponsePanel.tsx**: Read/write through JSONB (it's for draft editing). The normalize-on-submit flow handles relational sync.

---

## Step 6 — Data Wipe

Run a one-time data cleanup to ensure no stale JSONB-only data exists without corresponding relational rows:

```sql
TRUNCATE unavailability_blocks, ltft_patterns, training_requests, dual_specialties;
DELETE FROM doctor_survey_responses;
UPDATE doctors SET survey_status = 'not_started', survey_submitted_at = NULL;
```

---

## Files Modified


| File                                           | Change                                                       |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Migration SQL                                  | ENUMs, 4 new tables, 12 new columns, RLS, validation trigger |
| `supabase/functions/normalize-survey/index.ts` | **NEW** — atomic JSONB→relational normalization              |
| `src/contexts/SurveyContext.tsx`               | Call normalize-survey after submit                           |
| `src/lib/preRotaGenerator.ts`                  | Read from relational tables                                  |
| `src/lib/preRotaCalendar.ts`                   | Accept unavailability_blocks instead of JSONB arrays         |
| `src/lib/preRotaValidation.ts`                 | Update doctor survey interface                               |
| `src/lib/preRotaTypes.ts`                      | No change needed (output types, not input)                   |
| `src/hooks/useAdminQueries.ts`                 | Add queries for child tables                                 |
| `src/pages/admin/Roster.tsx`                   | Read from relational tables for expanded panel               |
| `src/pages/admin/DoctorProfile.tsx`            | Read from relational tables for full profile                 |
| `src/components/SurveyResponsePanel.tsx`       | Minimal — still reads/writes JSONB for admin overrides       |


## Risks & Mitigations

- **Auto-save unaffected**: JSONB columns stay, no change to draft flow
- **Partial submit failure**: If edge function fails, JSONB data is preserved; admin can re-trigger normalization
- **RLS complexity**: All 4 new tables need both public (for doctor survey token access) and coordinator policies — will mirror existing `doctor_survey_responses` pattern exactly