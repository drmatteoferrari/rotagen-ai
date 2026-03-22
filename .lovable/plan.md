# Replace Edge Function with Postgres RPC for Atomic Survey Normalization

## Why

The current Edge Function performs multiple operations without a transaction, risking "partial writes" where data is deleted but not replaced. Moving this to a Postgres RPC ensures **Atomicity** (all-or-nothing). Furthermore, we are making this a **blocking operation**: the survey is only "Submitted" if the relational data is successfully saved.

---

## Step 1 — Database Migration: Create `handle_survey_normalization` RPC

Create a `SECURITY DEFINER` Postgres function that executes the following inside a native transaction:

1. **Read and Parse**: Fetch the `draft_data` JSONB from `doctor_survey_responses` for the given `p_doctor_id` and `p_rota_config_id`.
2. **Clean Slate**: Delete existing rows in `unavailability_blocks`, `ltft_patterns`, `training_requests`, and `dual_specialties` for this specific doctor/rota.
3. **Relational Mapping**:
  - `annualLeave` → `unavailability_blocks` (reason: 'annual')
  - `studyLeave` → `unavailability_blocks` (reason: 'study')
  - `nocDates` → `unavailability_blocks` (reason: 'noc')
  - `rotations` → `unavailability_blocks` (reason: 'rotation', **mapping the** `location` **field**)
  - `parentalLeave` (if expected) → `unavailability_blocks` (reason: 'parental')
  - `ltftDaysOff` + `ltftNightFlexibility` → `ltft_patterns`
  - `specialtiesRequested`, `specialSessions`, `otherInterests` → `training_requests`
  - `dualSpecialtyTypes` → `dual_specialties`
4. **Scalar & Competency Update**: Update the main `doctor_survey_responses` row:
  - Set `status = 'submitted'` and `submitted_at = now()`.
  - Map `grade`, `wte_percent`, `dual_specialty`, and `parental_leave_expected`.
  - **Flatten Competencies**: Map the 12 UI fields (e.g., `iacAchieved`) to the 12 new boolean columns (e.g., `iac_achieved`).
  - **Capture Signature**: Explicitly save `signature_name` and `signature_date` from the payload.
  - **Other Restrictions**: Map the `otherSchedulingRestrictions` text field to the `other_restrictions` column.

---

## Step 2 — SurveyContext.tsx: Robust RPC Integration

Refactor the `submitSurvey()` function to ensure the operation is **blocking**:

1. **Call RPC**: Invoke `supabase.rpc('handle_survey_normalization', { ... })`.
2. **Error Handling**: If the RPC returns an error or fails to execute:
  - **Abort the process.**
  - Show a descriptive `toast.error` ("Critical: Could not finalize scheduling data. Please try again or contact support.").
  - **Do not** navigate the user to the confirmation/success page.
3. **Success**: Only upon successful RPC completion should the UI update the `loadState` to `'submitted'`.

---

## Step 3 — Cleanup

1. **Delete** the `supabase/functions/normalize-survey/` directory.
2. **Verify** that `src/lib/preRotaGenerator.ts` and Admin views are correctly using joins (e.g., `unavailability_blocks(*)`) to fetch this new data.

---

## Files Modified


|                     |                                                                  |
| ------------------- | ---------------------------------------------------------------- |
| **File**            | **Change**                                                       |
| **Migration SQL**   | Create the atomic `handle_survey_normalization` function.        |
| `SurveyContext.tsx` | Change `submitSurvey` to wait for RPC success before finalizing. |
| `normalize-survey/` | **DELETE** folder.                                               |
