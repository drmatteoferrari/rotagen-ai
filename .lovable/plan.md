

## Plan: Isolate Inactive Doctors from Pre-Rota Pipeline

### Problem
Inactive (soft-deleted) doctors leak into generation, validation, staleness checks, and hydration — causing false blockers and corrupted output.

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/preRotaGenerator.ts` | Add `.eq('is_active', true)` to doctors fetch (~line 42) |
| 2 | `src/lib/rotaGenInput.ts` | Change `getSurveyResponsesForConfig` to use `doctors!inner(is_active)` join + `.eq("doctors.is_active", true)` filter |
| 3 | `src/hooks/useAdminQueries.ts` | Add `.eq("is_active", true)` to the `liveDoctors` query inside `usePreRotaResultQuery` |
| 4 | `src/pages/admin/PreRotaPage.tsx` | Add `.eq("is_active", true)` to the `latestDoctors` staleness query (~line 65) |

### Technical notes
- All four are single-line `.eq()` additions except `rotaGenInput.ts` which also changes the `.select()` to add the inner join
- No database/schema changes needed
- The `useDoctorsQuery` hook already filters `is_active: true`, so UI roster is unaffected

