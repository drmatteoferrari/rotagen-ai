

## Plan: Doctor Calendar Page + Route + Migration

### Overview
Build a new individual doctor calendar page (`/admin/doctor-calendar/:doctorId`) with day/week/month views, wire its route, create a DB migration for coordinator calendar overrides, and add supporting types.

### Changes

**1. Database Migration**
- Create `supabase/migrations/20250324000000_coordinator_calendar_overrides.sql`
- Table with RLS policy scoped to coordinator ownership via `rota_configs`

**2. Update `src/integrations/supabase/types.ts`**
- Add `coordinator_calendar_overrides` entry (Row/Insert/Update/Relationships) inside the `Tables` object, after `coordinator_accounts`

**3. New file: `src/lib/calendarOverrides.ts`**
- `CalendarOverride` interface, `getTodayISO()` helper, `mapOverrideRow()` mapper

**4. New file: `src/pages/admin/DoctorCalendarPage.tsx`**
- Full page component with:
  - Data loading from `pre_rota_results` + doctor lookup from `calendarData`
  - Three views: MonthView (grid with week numbers, today highlight, BH/weekend styling, click-to-day), WeekView (column per day), DayView (event cards)
  - Responsive: defaults to month on desktop, day on mobile
  - Navigation: prev/next buttons, date picker, swipe gestures, keyboard arrows
  - Error states for missing pre-rota, blocked status, unknown doctor
  - Back button to `/admin/pre-rota-calendar`

**5. Wire route in `src/App.tsx`**
- Import `DoctorCalendarPage`
- Add `<Route path="/admin/doctor-calendar/:doctorId" element={<DoctorCalendarPage />} />` after the pre-rota-calendar route

### Technical Details

- `MonthView` uses `getMonthWeekRows()` for proper Mon-Sun grid (not `calendarData.weeks`)
- Bank holidays sourced from `calendarData.bankHolidays` (no separate DB fetch)
- `doctor.wte` displayed as-is with `%` suffix (not multiplied)
- Navigation state (`currentDateISO`, `currentMonthKey`, `currentWeekIndex`) synced atomically via `navigateToDate()`
- Keyboard/swipe handlers use `useRef` to avoid stale closures
- Chips skip `AVAILABLE` and `BH` codes; colours defined in `CHIP_COLOURS` map
- Week index lookup uses `w.startDate <= date <= w.endDate` range check

### Files touched
| File | Action |
|------|--------|
| `supabase/migrations/20250324000000_coordinator_calendar_overrides.sql` | Create |
| `src/integrations/supabase/types.ts` | Add table type |
| `src/lib/calendarOverrides.ts` | Create |
| `src/pages/admin/DoctorCalendarPage.tsx` | Create |
| `src/App.tsx` | Add import + route |

