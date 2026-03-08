

## Plan: Admin Edit via Doctor Survey UI

### Problem
The roster edit button opens a basic slide-over panel (`SurveyResponsePanel`) with raw JSON fields. The admin should instead be able to open the actual doctor survey interface (`/doctor/survey`) pre-filled with the doctor's responses, and edit directly — even after submission or past the deadline.

### Approach

**1. Route the edit button to the survey with admin query params**

In `Roster.tsx`, change the edit button (`Pencil`) to navigate to `/doctor/survey?token=<survey_token>&admin=true` instead of opening the `SurveyResponsePanel`. This reuses the exact same survey UI the doctor sees. Remove the `SurveyResponsePanel` import and state since it's no longer needed.

**2. Update `SurveyContext` to support admin mode**

- Accept an `adminMode` prop on `SurveyProvider`
- When `adminMode=true` and `survey_status === "submitted"`, skip redirecting to the confirmation screen — instead load the data and set `loadState = "ready"` so the form is editable
- Expose `isAdminMode` in the context value

**3. Update `Survey.tsx` to detect admin mode**

- Read `admin` query param from URL
- Pass `adminMode={admin === "true"}` to `SurveyProvider`
- In `SurveyInner`, show an admin banner (amber background with "Admin Edit Mode" + "Back to Roster" link) when `isAdminMode` is true
- Skip rendering `SurveyConfirmation` when in admin mode (already handled by context change)

**4. Update `SurveyStep7` submit behavior for admin**

- When in admin mode, after successful submission, navigate back to `/admin/roster` instead of showing the confirmation screen
- Show a toast confirming the save

### Files to modify
- `src/contexts/SurveyContext.tsx` — add `adminMode` prop, bypass submitted state
- `src/pages/doctor/Survey.tsx` — read `admin` param, render admin banner
- `src/pages/admin/Roster.tsx` — change edit button to navigate instead of opening panel
- `src/pages/doctor/SurveyStep7.tsx` — admin-mode redirect after submit

### Files potentially removable
- `src/components/SurveyResponsePanel.tsx` — no longer needed (can keep for now)
- `src/pages/admin/SurveyOverride.tsx` — redundant with new approach (can keep for now)

