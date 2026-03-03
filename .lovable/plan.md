

# Department Setup Overhaul

## Summary
Rebuild `/admin/department/` from 3 steps to 2 steps: Step 1 becomes a collapsible card editor with inline badge logic, staffing, and day toggles. Step 2 (old step 3) gets draggable bar sliders for distribution. Step 2 (old) is deleted.

---

## Files Changed

| File | Action |
|---|---|
| `src/contexts/DepartmentSetupContext.tsx` | Expand ShiftType with badge overrides, oncall manual flag, globalOncallPct; add badge auto-detection helpers |
| `src/pages/admin/DepartmentStep1.tsx` | Full rewrite — collapsible card UI with inline editing, badge logic, day toggles, staffing |
| `src/pages/admin/DepartmentStep2.tsx` | Delete old step-2 content, replace with distribution page (was step-3) using draggable bar sliders |
| `src/pages/admin/DepartmentStep3.tsx` | Delete file entirely |
| `src/App.tsx` | Remove step-3 route, update step-2 route to new distribution page |

---

## Technical Design

### Context Changes (`DepartmentSetupContext`)

Extend `ShiftType`:
- `badges`: add `oncall` and `nonres` booleans (6 total)
- `badgeOverrides`: `Record<string, boolean | undefined>` — tracks manual overrides per badge key
- `oncallManuallySet`: boolean — tracks if user manually touched the on-call radio
- `staffing.max`: number | null (with checkbox to enable)

Add to context:
- `globalOncallPct` (default 50) + setter
- `shiftTargetOverrides`: `Record<string, number | undefined>` — manual % overrides per shift
- Badge auto-detection function: given a shift's times and days, compute all 6 badge values
- `expandedShiftId` state (only one card expanded at a time)

### Badge Auto-Detection Logic (pure function)

```
detectBadges(startTime, endTime, days, isOncall, isNonRes) → badges
```

- **NIGHT**: Calculate overlap of shift with 23:00–06:00 window (handling midnight crossing). ≥180 min → true
- **LONG**: durationHours > 10
- **OOH**: any minutes in 19:00–07:00, or Sat/Sun selected
- **WEEKEND**: Sat or Sun selected
- **ON-CALL**: mirrors isOncall
- **NON-RES**: mirrors isNonRes

### Step 1 — Collapsible Cards

Each card renders collapsed by default showing name, time range, duration, badge row (read-only), edit/remove buttons.

Expanding a card (click card or edit button) shows the full form. Collapsing any other expanded card first.

Fields in expanded state:
- Inline name input
- Start/end time pickers + read-only duration
- 7 day toggle buttons (M T W T F S S) — any combo, min 1
- Resident on-call / Non-res on-call radios
- Min doctors (0–50), optional max doctors (checkbox-gated)
- Badge row with toggle behavior (auto ⚡ vs manual ✏️)
- Save/Cancel buttons

On every change to times/days: recalculate badges, auto-set on-call if not manually touched.

### Step 2 — Distribution (replaces old step-3)

**Global split bar**: A draggable horizontal bar showing on-call % vs non-on-call %. Controlled by both drag and number input.

**Per-shift bars**: Two sections (on-call shifts, non-on-call shifts). Each shift gets a horizontal bar. Auto-calculated as equal share by default. Dragging overrides. Non-overridden shifts redistribute proportionally. Reset button per shift and per section.

Total validation: each group must sum to 100% (±0.5).

### Validation on Save (Step 2)
- ≥1 shift exists
- Every shift has name, start, end (start ≠ end), ≥1 day selected
- On-call group totals 100% if any on-call shifts exist
- Non-on-call group totals 100% if any non-on-call shifts exist

### Routing Changes (App.tsx)
- Remove `/admin/department/step-3` route and `DepartmentStep3` import
- Keep `/admin/department/step-2` route pointing to the new distribution component (rewritten DepartmentStep2)

