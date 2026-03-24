

## Plan: Six targeted fixes across four files

### Changes

**1. `src/lib/preRotaCalendar.ts` — UTC date arithmetic fix**
- Replace `dateRange` function (lines 11-20) to use `Date.UTC` and `setUTCDate`/`getUTCDate` instead of local time methods
- Replace week-building block (lines 64-85) to use `Date.UTC`, `getUTCDay`, `setUTCDate` for Monday alignment and iteration

**2. `src/components/calendar/EventDetailPanel.tsx` — Remove `React.CSSProperties` type**
- Line 122: Change `function btn(...): React.CSSProperties {` to `function btn(...) {` (React is not imported in this file — this is likely causing the cascading build failure)

**3. `src/components/calendar/AddEventModal.tsx` — End date min constraint**
- Line 111: Change `min={rotaStartDate}` to `min={startDate || rotaStartDate}` on the end date input

**4. `src/pages/admin/PreRotaCalendarPage.tsx` — Four sub-changes:**
- **4.1** Add `panelRef` after `navRef` (line ~340), add scroll-into-view effect after keyboard effect (line ~488)
- **4.2** Wrap EventDetailPanel IIFE return in `<div ref={panelRef}>` instead of `<>` fragment (lines 1147/1186)
- **4.3** Add `currentMonthKey` state (after line 317), initialise it in data load (after line 443), update `goPrev`/`goNext`/`prevDisabled`/`nextDisabled`/`navLabel` to handle month mode
- **4.4** Add month grid helpers (`MONTH_DAY_ABBR`, `MONTH_EVENT_COLOURS`, `buildMonthGrid`) above `ViewToggle` (before line 268)
- **4.5** Replace month view placeholder (lines 1191-1199) with full month grid table (desktop/tablet) or "needs more space" message (mobile)

### Technical notes
- The `React.CSSProperties` fix on EventDetailPanel is the probable root cause of the build error — esbuild fails to parse/transform this reference, and the error cascades to make PreRotaCalendarPage appear broken at line 893
- Month view grid uses `buildMonthGrid` to create a Mon-aligned 7-column date array for any given `YYYY-MM` key
- Month grid supports cell tapping (reuses `handleCellTap`), doctor name links, override dots, deleted strikethroughs, and LTFT indicators
- UTC fix in preRotaCalendar.ts prevents timezone-dependent date shifts near DST boundaries

### Files touched
| File | Action |
|------|--------|
| `src/lib/preRotaCalendar.ts` | Edit dateRange + week builder |
| `src/components/calendar/EventDetailPanel.tsx` | Fix btn return type |
| `src/components/calendar/AddEventModal.tsx` | Fix end date min |
| `src/pages/admin/PreRotaCalendarPage.tsx` | Add panelRef, month state, month view, scroll effect |

