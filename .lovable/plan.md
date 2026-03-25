

## Plan: Logic Foundation — Leave-Aware Targets

Three files changed, no UI, no routes, no migrations.

### 1. `src/lib/preRotaTypes.ts`
- Insert `LeaveSummary` interface immediately before the existing `DoctorShiftTarget` interface (after the Targets section comment, line 53)
- Replace `DoctorTargets` to add `leaveSummary: LeaveSummary` between `totalMaxHours` and `shiftTargets`
- All other interfaces unchanged

### 2. `src/lib/preRotaCalendar.ts`
- Single line change: replace `CELL_PRIORITY` array (line 6) with corrected priority order `['AVAILABLE', 'LTFT', 'NOC', 'AL', 'SL', 'ROT', 'PL', 'BH']` and expanded comment explaining the priority semantics

### 3. `src/lib/preRotaTargets.ts`
- Full file replacement with new leave-aware targets engine:
  - Removes `computeShiftTargets` import, keeps only `computeWeekendCap`
  - Adds imports for `LeaveSummary` and `CalendarDoctor` from preRotaTypes
  - Exports `TargetsBuilderInputs` (now includes `calendarDoctors: CalendarDoctor[]`)
  - New helpers: `r1()` (float-safe rounding with EPSILON), `isWeekday()` (UTC-safe)
  - New `computeLeaveSummary()`: reads resolved `primary` CellCode per date, counts weekday AL/SL/BH days (Cat 2) and PL/ROT days (Cat 1), computes hour deductions
  - Rebuilt `buildTargetsData()`: computes WTE-scaled envelope, applies Cat 1 deduction proportionally to both buckets, Cat 2 to non-oncall only, distributes across shift types by targetPercentage
  - Guards: safeMaxHoursPerWeek defaults to 48, bucket percentages normalized to sum to 100, WTE clamped 0-1, all buckets floored at 0

