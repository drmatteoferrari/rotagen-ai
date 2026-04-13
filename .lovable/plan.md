

## Plan: Add DaySlot support to DepartmentSetupContext

**File**: `src/contexts/DepartmentSetupContext.tsx` (only file modified)

### Changes

1. **Add two exported interfaces** (`SlotRequirement`, `DaySlot`) after `ShiftStaffing`, before `ShiftType`

2. **Add `daySlots: DaySlot[]`** as final field of `ShiftType` interface

3. **Update `makeShift` factory** to return `daySlots: []`

4. **Replace `loadFromDb` function body** to fetch `shift_types`, `shift_day_slots`, and `shift_slot_requirements` in parallel via `Promise.all`, build lookup maps, compute `isCustomised` per day slot, and attach `daySlots` to each restored `ShiftType`

No other callbacks, interfaces, exports, or files are touched.

