

## Plan: Add AddShiftModal and DaySlotModal to DepartmentStep2.tsx

**File**: `src/pages/admin/DepartmentStep2.tsx` (only file modified)

### Change

Insert ~280 lines of new code between line 206 (end of `SlotRowEditor`) and line 208 (start of `getShiftErrors`). Two new components:

1. **AddShiftModal** — 3-page wizard dialog (identity, days, defaults) that builds a complete `ShiftType` with pre-populated `daySlots` on confirm
2. **DaySlotModal** — Single-cell editor for one shift x day combination with doctors stepper, slot editors, copy-to-days picker, and remove-from-day action

No existing code is modified or deleted. The `ShiftTemplate` type alias on line 63 is kept since `AddShiftDialog` still references it.

