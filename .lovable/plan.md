

## Plan: Add new helpers and components to DepartmentStep2.tsx

**File**: `src/pages/admin/DepartmentStep2.tsx` (only file modified)

### Changes

1. **Replace import block (lines 1-38)** — Add `useEffect`, `Checkbox`, `ChevronDown`/`ChevronUp`/`Copy`, `DaySlot`/`SlotRequirement`/`ShiftStaffing` types, `GRADE_OPTIONS`/`GRADE_DISPLAY_LABELS` from gradeOptions

2. **Replace constants block (lines 40-60)** — Add `DAY_SHORT`/`DAY_FULL` as `const` arrays with `DAY_SHORT_LABELS`/`DAY_FULL_LABELS` aliases; update `BADGE_DEFS` typing; remove `ShiftTemplate` type (inferred from `SHIFT_TEMPLATES`)

3. **Insert new helper functions after BADGE_DEFS (after line 51, before line 62)** — `makeDefaultDaySlot`, `makeEmptySlot`, `slotHasRestrictions`, `computeIsCustomised`, `getShiftIdentityErrors`

4. **Insert GradePill component** — Grade restriction pill with popover checkbox list, placed after helpers before `getShiftErrors`

5. **Insert SlotRowEditor component** — Per-slot editor with label input, GradePill, and 4 competency checkboxes, placed after GradePill before `getShiftErrors`

All existing functions (`getShiftErrors`, `AddShiftDialog`, `ExpandedCard`, `CollapsedCard`, `DayColumn`, `DraggableShiftChip`, and the default export) remain untouched.

