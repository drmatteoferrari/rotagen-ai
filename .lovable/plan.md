

## Plan: Refactor PreRotaCalendarPage with unified nav, view toggle, and targeted fixes

### Overview
Major refactor of the render section in `PreRotaCalendarPage.tsx` to unify mobile/desktop into a single view-toggle system (day/week/month), add swipe + keyboard via `navRef`, update cell backgrounds, and add doctor calendar links. Only this one file is touched.

### Changes (10 sections)

**Section 1 — Add import**
- Add `import { getTodayISO } from "@/lib/calendarOverrides"` to existing imports

**Section 2 — Add state**
- After `const isMobile = useIsMobile()`, add `todayISO` and `viewMode` state

**Section 3 — Mobile default**
- Add `useEffect` to set `viewMode('day')` when `isMobile` resolves true

**Section 4 — Init navigation on data load**
- Inside the data load `useEffect`, after `setCalendarData(mergedCd)`, compute `initialDate` (today if in rota, else rota start), find matching week/day indices, set both

**Section 5 — Swipe refs and handlers**
- Add `touchStartX`, `touchStartY`, `navRef` refs alongside `dateInputRef`
- Add `handleTouchStart` and `handleTouchEnd` functions after `handleDownload`

**Section 6 — Replace keyboard effect**
- Remove the existing keyboard `useEffect` (lines 385-406) that has `isMobile` branching
- Replace with a simple version using `navRef.current.goPrev/goNext` with empty deps

**Section 7 — Update cell background functions**
- `getCellBackground`: remove BH/weekend tints from data cells (only ROT/PL/LTFT keep colour)
- `getColumnBg`: always return `#ffffff`

**Section 8 — Add ViewToggle component**
- New function component above the default export, renders day/week/month pill buttons

**Section 9 — Replace main render block**
- Remove the `if (isMobile)` branch and the desktop-only branch
- Replace with a single unified render that:
  - Computes nav labels, prev/next disabled states, goPrev/goNext functions
  - Updates `navRef.current` every render
  - Top bar (back + download) only when `!embedded`
  - Unified nav bar with ViewToggle, prev/next, label, date picker
  - Week view: same table structure but with `todayISO` blue headers, doctor names as blue `→` links to `/admin/doctor-calendar/:doctorId`, `overflowX: 'auto'`
  - Day view: same doctor list but with clickable doctor names, `handleDateChange` for date picker, pre-computed `isBHDay`/`isWkndDay`/`totalAvailable`/`nocOnlyCount`
  - Month placeholder
  - `CalendarLegend` always at bottom
- Removes: old "Jump to week" select, old standalone prev/next row, old mobile-only top bar

**Section 10 — Update CalendarLegend**
- Add today swatch (`#dbeafe` / `#bfdbfe`)
- Change BH text to "Bank Holiday (header)"
- Change Weekend text to "Weekend (header)"

### Technical notes
- `navRef` pattern eliminates stale closures in keyboard/swipe handlers
- `handleDateChange` syncs both `currentWeekIndex` (via `startDate <= iso <= endDate` range) and `currentDayIndex` (via `indexOf`)
- Week view uses `currentWeek.dates` which may have <7 entries for partial weeks
- No changes to data loading, helper functions, or any other file

### Files touched
| File | Action |
|------|--------|
| `src/pages/admin/PreRotaCalendarPage.tsx` | Edit (10 targeted sections) |

