

## Plan: Five targeted improvements across five files

### Changes

**1. `src/lib/calendarOverrides.ts` — UTC fix for `rangeInclusive`**
- Replace lines 54-63: use `Date.UTC` parsing and `setUTCDate`/`getUTCDate` instead of local time methods, matching the fix already applied to `preRotaCalendar.ts`

**2. `src/components/calendar/EventDetailPanel.tsx` — Full rewrite**
- Replace entire file with new compact design:
  - New prop: `onGoToDate: () => void`
  - Row-based action buttons instead of inline flex chips
  - New icons: `Plus`, `RotateCcw`, `ArrowRight` (replacing `Minus`)
  - Deleted events show "Restore event" (green) instead of "Remove this override"
  - "Go to day view" button always visible
  - UTC-safe date formatting with `timeZone: 'UTC'`
  - `row()` helper replaces `btn()` helper

**3. `src/pages/admin/DoctorCalendarPage.tsx` — Five sub-changes:**
- **3.1** Add `onGoToDate` prop to EventDetailPanel call (navigates to day view for selected date, closes panel)
- **3.2** Add `lastTapRef` after `modalInitialDate` state (line ~204)
- **3.3** Replace `handleCellTap` with double-tap detection (≤350ms → day view navigation)
- **3.4** Replace DayView "+ Override" button with "+ Add event" that opens AddEventModal directly
- **3.5** Make day view event cards clickable via `handleCellTap`

**4. `src/pages/admin/PreRotaCalendarPage.tsx` — Three sub-changes:**
- **4.1** Add `onGoToDate` prop to EventDetailPanel call (navigates to doctor's calendar page)
- **4.2** Add `lastTapRef` after `modalInitialDate` state (line ~409)
- **4.3** Replace `handleCellTap` with double-tap detection (≤350ms → navigate to doctor calendar)

**5. `src/pages/admin/PreRotaPage.tsx` — Coordinator Changes audit panel:**
- Add `RotateCcw` to lucide imports
- Add state: `changesPanelOpen`, `overrides`, `doctorNames`, `overridesLoading`, `revertingId`, `revertAllConfirm`, `revertOneConfirm`
- Add `loadOverrides` (fetches overrides + doctor names), `handleRevertOne` (deletes single override), `handleRevertAll` (deletes all for rota config)
- Add `useEffect` to lazy-load overrides when panel opens
- Add collapsible "Coordinator Changes (N changes)" panel in JSX after the Data Validation panel (line ~289), with:
  - Colour-coded action badges (green=add, blue=modify, grey=delete)
  - Per-row revert with two-step confirm
  - "Revert all" with two-step confirm
  - Empty state message

### Technical notes
- The `rangeInclusive` UTC fix prevents override date ranges from shifting by ±1 day near DST boundaries
- Double-tap uses a ref to track last tap time+target — no timer cleanup needed
- EventDetailPanel's new `onGoToDate` prop enables navigation from both pages with different behavior (day view vs doctor calendar)
- PreRotaPage audit panel lazy-loads data only when opened, fetches doctor names for display
- All revert operations use hard delete on `coordinator_calendar_overrides` rows

### Files touched
| File | Action |
|------|--------|
| `src/lib/calendarOverrides.ts` | Edit rangeInclusive |
| `src/components/calendar/EventDetailPanel.tsx` | Full rewrite |
| `src/pages/admin/DoctorCalendarPage.tsx` | Add onGoToDate, double-tap, day view tweaks |
| `src/pages/admin/PreRotaCalendarPage.tsx` | Add onGoToDate, double-tap |
| `src/pages/admin/PreRotaPage.tsx` | Add coordinator changes audit panel |

