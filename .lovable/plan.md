

## Plan: Create resolved_availability table and population logic

### 1. Database Migration
Create `resolved_availability` table with columns: `id`, `rota_config_id` (FK → rota_configs), `doctor_id` (FK → doctors), `date`, `status`, `source` (CHECK: 'survey' | 'coordinator_override'), `override_id` (FK → coordinator_calendar_overrides, ON DELETE SET NULL), `rebuilt_at`. UNIQUE constraint on (rota_config_id, doctor_id, date). RLS enabled with permissive public policy.

### 2. Types Update (`src/integrations/supabase/types.ts`)
Add `resolved_availability` table type definition (Row/Insert/Update/Relationships) to the Database type, following existing patterns.

### 3. New File: `src/lib/resolvedAvailability.ts`
Three exported functions:
- **`rebuildResolvedAvailability(rotaConfigId, calendarData)`** — Full rebuild: fetches all coordinator overrides, merges with base availability per doctor, deletes all existing rows, batch-inserts new ones (500/batch). Status = `cell.primary` always. Source = 'coordinator_override' when overrideId is non-null.
- **`refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId)`** — Single-doctor upsert from DB. Loads calendar_data from pre_rota_results, fetches doctor's overrides, merges, upserts on unique constraint. Silent no-op if no pre-rota exists.
- **`rebuildResolvedAvailabilityFromDB(rotaConfigId)`** — Full rebuild reading calendar_data from pre_rota_results. Used by revert-all.

### 4. Update `src/lib/preRotaGenerator.ts`
- Import `rebuildResolvedAvailability`
- Add step 14 after the DB upsert (step 13), before the return: call `rebuildResolvedAvailability(rotaConfigId, calendarData)` wrapped in try/catch (non-fatal)
- Blocked path (step 11) is NOT touched

### 5. Update `src/pages/admin/PreRotaCalendarPage.tsx`
- Import `refreshResolvedAvailabilityForDoctor`
- **handleSaveOverride** (line 606): Capture `const doctorId = selectedCell.doctorId` at top before state clearing. After `await reloadOverrides()` and state clears, fire `refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId).catch(...)` 
- **handleDeleteOverride** (line 641): Capture `const doctorId = selectedCell.doctorId` at top. Fire refresh after reloadOverrides + state clears.
- **handleRemoveSurveyEvent** (line 654): Capture `const doctorId = selectedCell.doctorId` at top. Fire refresh after reloadOverrides + state clears (only reached when insert happened, guard unchanged).

### 6. Update `src/pages/admin/DoctorCalendarPage.tsx`
- Import `refreshResolvedAvailabilityForDoctor`
- `doctorId` from `useParams()` is stable — no capture needed
- **handleSaveOverride** (line 357): Add refresh call after `await reloadOverrides()` inside try block
- **handleDeleteOverride** (line 391): Add refresh call after `await reloadOverrides()` inside try block
- **handleRemoveSurveyEvent** (line 403): Add refresh call after `await reloadOverrides()` inside try block

### 7. Update `src/pages/admin/PreRotaPage.tsx`
- Import `refreshResolvedAvailabilityForDoctor` and `rebuildResolvedAvailabilityFromDB`
- **handleRevertOne** (line 148): Capture `affectedDoctorId` from overrides array before delete. After `loadOverrides()`, fire targeted refresh if doctorId found.
- **handleRevertAll** (line 156): After delete + setOverrides([]), fire `rebuildResolvedAvailabilityFromDB(currentRotaConfigId).catch(...)`

### Files modified
- New migration SQL
- `src/integrations/supabase/types.ts` — add resolved_availability types
- `src/lib/resolvedAvailability.ts` — new file
- `src/lib/preRotaGenerator.ts` — add step 14
- `src/pages/admin/PreRotaCalendarPage.tsx` — 3 handler updates
- `src/pages/admin/DoctorCalendarPage.tsx` — 3 handler updates
- `src/pages/admin/PreRotaPage.tsx` — 2 handler updates

