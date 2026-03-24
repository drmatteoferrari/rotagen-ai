

## Plan: Add override loading and visual rendering to both calendar pages

### Overview
Load `coordinator_calendar_overrides` from the database and merge them into doctor availability for visual display on both the DoctorCalendarPage and PreRotaCalendarPage. Read-only — no interaction, no DB writes. Three files touched.

### Changes

**1. Append to `src/lib/calendarOverrides.ts`**
- Add `MergedCell` interface with override metadata fields (`overrideId`, `overrideAction`, `isDeleted`, `deletedCode`)
- Add `rangeInclusive` helper, `expandOverrideDates` function (handles none/weekly/monthly/custom recurrence)
- Add `mergeOverridesIntoAvailability` function that wraps raw availability into `MergedCell` records, then applies overrides oldest-first (add/modify/delete)

**2. Update `src/pages/admin/DoctorCalendarPage.tsx`**
- Add `useMemo` to React import
- Expand calendarOverrides import to include `mapOverrideRow`, `mergeOverridesIntoAvailability`, `CalendarOverride`, `MergedCell`
- Add `overrides` state, load from `coordinator_calendar_overrides` in data load effect (after `setCurrentWeekIndex`)
- Add `mergedAvailability` useMemo that merges doctor availability with overrides
- Add `OverrideDot` component (orange 6px circle) and `renderMergedChips` helper (handles deleted=grey strikethrough, add/modify=orange dot)
- MonthView: replace `cell` lookup with `mergedAvailability[date]`, use `renderMergedChips`
- WeekView: replace `cell` with `mergedCell` from `mergedAvailability`, use `renderMergedChips`
- DayView: replace `cell` with `mergedCell`, show "Removed by coordinator" card for deleted overrides, show "● Coordinator override" label for add/modify

**3. Update `src/pages/admin/PreRotaCalendarPage.tsx`**
- Expand calendarOverrides import
- Add `overrides` state, load all overrides for the rota in data load effect (after eligibility block)
- Add `mergedAvailabilityByDoctor` useMemo that builds per-doctor merged availability
- Add `RotaOverrideDot` and `getMergedCellBackground` helper functions outside component
- Week view: replace `cell`/`primary`/`bg` with merged versions; render deleted as grey strikethrough chip, add/modify badges with orange dot
- Day view: same merged cell logic for doctor list badges
- Update `totalAvailable` and `nocOnlyCount` to use merged data
- Add coordinator override legend entry in `CalendarLegend` (after LTFT, before Today swatch)

### Technical details
- Override expansion handles all recurrence types (none=date range, weekly=repeat every 7 days, monthly=repeat every month, custom=explicit dates)
- Merge is oldest-first so newest override wins on conflict
- Eligibility computation remains unchanged — still reads from base `doctor.availability` (intentional: eligibility reflects survey data, not coordinator overrides)
- `getMergedCellBackground` replaces `getCellBackground` calls in week/day views only
- No DB writes, no new migrations, no changes to any other file

### Files touched
| File | Action |
|------|--------|
| `src/lib/calendarOverrides.ts` | Append ~120 lines |
| `src/pages/admin/DoctorCalendarPage.tsx` | Edit imports, state, data load, views |
| `src/pages/admin/PreRotaCalendarPage.tsx` | Edit imports, state, data load, views, legend |

