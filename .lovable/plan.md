

# Unique Doctor Survey Links, Submission, Storage, Admin Editing & Algorithm Integration

## Overview
Transform the existing static/demo survey into a fully functional system: each doctor gets a unique token-based URL, responses are stored in Supabase, auto-saved as drafts, submitted with validation, viewable/editable by admin in a slide-over panel, and fed into the rota generation algorithm.

---

## Section 1 — Database Migration

**Migration SQL** creates:
- Three new columns on `doctors`: `survey_token` (uuid, unique, default `gen_random_uuid()`), `survey_submitted_at` (timestamptz), update existing `survey_status` default to `'not_started'`
- Backfill existing rows with `gen_random_uuid()` where null
- New `doctor_survey_responses` table with all columns from the prompt (personal details, competencies, working pattern, leave, exemptions, preferences, metadata)
- Unique constraint on `(doctor_id, rota_config_id)`, indexes on `doctor_id` and `rota_config_id`
- Public RLS policy (matching existing pattern)

---

## Section 2 — Survey Link Utility & Roster Integration

**New file: `src/lib/surveyLinks.ts`**
- `buildSurveyLink(surveyToken: string): string` — constructs `/doctor/survey?token={token}`
- `getSurveyLinkForDoctor(doctorId: string): Promise<string>` — queries doctor's token, returns link

**Roster changes (`src/pages/admin/Roster.tsx`)**:
- Update `Doctor` interface to include `survey_token`
- Update `buildSurveyLink` to use token instead of doctor ID
- Add link icon (🔗) that opens survey URL in new tab
- Existing copy icon already works — update to use token-based URL
- Email send uses `doctor.survey_token` for link construction

---

## Section 3 — Token Resolution & Survey Context

**New route**: `/doctor/survey` (single route with `?token=` query param, replaces the 6 individual `/doctor/survey/1..6` routes)

**New file: `src/contexts/SurveyContext.tsx`** — replaces `SurveyModeContext` for doctor-facing survey:
- Stores resolved doctor, rota config, current step, all form data
- Provides `setField()`, `nextStep()`, `prevStep()`, `submit()` functions
- Token resolution logic on mount:
  1. No token → error screen
  2. Query `doctors` joined with `rota_configs` by token
  3. No match → expired/invalid error screen
  4. `survey_status = 'submitted'` → confirmation screen (Section 6)
  5. Valid → load existing draft from `doctor_survey_responses` if any, pre-populate form

**New wrapper page: `src/pages/doctor/Survey.tsx`**
- Reads `?token=` from URL
- Wraps steps in `SurveyContext`
- Renders current step component based on context state
- Shows error/confirmation screens as needed
- Shows rota period banner at top

**Existing step components** (SurveyStep1–6) updated:
- Read/write form data via `useSurveyContext()` instead of local state
- Navigation uses context `nextStep()`/`prevStep()` instead of router navigate
- Step 1 fields (name, email) are read-only (pre-populated from doctor record)

---

## Section 4 — Auto-Save

In `SurveyContext`:
- Debounced auto-save (1.5s after last change) using `setTimeout`/`clearTimeout`
- Also triggered on `nextStep()`
- Upserts to `doctor_survey_responses` with `onConflict: 'doctor_id, rota_config_id'`
- Sets `status = 'in_progress'`, `last_saved_at = now()`
- Updates `doctors.survey_status` to `'in_progress'` if was `'not_started'`
- Shows subtle "Draft saved" text in header, fades after 2s

---

## Section 5 — Final Submission

On Step 6 submit button:
1. Validate: full_name, nhs_email (format), grade, confirmation checkbox
2. Upsert `doctor_survey_responses` with `status = 'submitted'`, `submitted_at = now()`
3. Update `doctors` set `survey_status = 'submitted'`, `survey_submitted_at = now()`
4. On success → show confirmation screen
5. On error → inline red error below submit button

---

## Section 6 — Confirmation Screen

**New component: `src/components/SurveyConfirmation.tsx`**
- Stethoscope icon, "Survey submitted successfully", doctor name, submitted timestamp, rota period, department/hospital, deadline
- Message about coordinator generating rota and contact instructions
- Shown after submission and when returning to an already-submitted survey

---

## Section 7 — Roster Status Column Update

Update `statusBadge()` in Roster to use new statuses:
- `not_started` → `○ Not started` (grey)
- `in_progress` → `✏️ In progress` (amber)
- `submitted` → `✅ Submitted` (green) with timestamp tooltip

Update summary cards to show: `X submitted / Y in progress / Z not started out of N doctors`

---

## Section 8 — Admin Edit Slide-Over Panel

**New component: `src/components/SurveyResponsePanel.tsx`**
- Sheet/drawer from right side, min 560px wide
- Header: doctor name, grade, WTE, status
- Body: all 6 sections with editable fields matching survey structure
- Loads data from `doctor_survey_responses` on open
- Save: upserts edited values, preserves existing status, updates `last_saved_at`
- Cancel: discards changes, closes panel
- Success/error toasts

**Roster integration**: Edit button opens this panel instead of navigating to survey-override route

---

## Section 9 — Email Send Uses Real Token URL

Update `sendInvite()` in Roster to use `buildSurveyLink(doctor.survey_token)` from the new utility. Remove old `buildSurveyLink` that used doctor ID.

---

## Section 10 — Algorithm Integration

Update `src/lib/rotaGenInput.ts`:
- Change `buildFinalRotaInput(configId, doctors)` → `buildFinalRotaInput(configId)` (async, fetches doctors internally)
- New `getSurveyResponsesForConfig(configId)` fetches all responses joined with doctors
- Maps `doctor_survey_responses` rows to `DoctorPreference` shape
- Only `status = 'submitted'` responses used for generation input
- Export `DoctorSurveyResponse` type

---

## Files Changed

| File | Action |
|---|---|
| Migration SQL | Create `doctor_survey_responses` table, alter `doctors` table |
| `src/lib/surveyLinks.ts` | New — link utilities |
| `src/contexts/SurveyContext.tsx` | New — survey state, auto-save, submission |
| `src/pages/doctor/Survey.tsx` | New — wrapper page with token resolution |
| `src/components/SurveyConfirmation.tsx` | New — post-submission screen |
| `src/components/SurveyResponsePanel.tsx` | New — admin edit slide-over |
| `src/pages/doctor/SurveyStep1-6.tsx` | Update to use SurveyContext |
| `src/pages/admin/Roster.tsx` | Token-based links, new statuses, edit panel, summary |
| `src/lib/rotaGenInput.ts` | Fetch responses from DB, new signature |
| `src/App.tsx` | Add `/doctor/survey` route, remove old `/doctor/survey/1..6` routes |
| `src/contexts/SurveyModeContext.tsx` | Keep for admin override; doctor survey uses new SurveyContext |

