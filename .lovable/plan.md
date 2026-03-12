

# UI/UX Improvements Plan

## Section 1 — Remove "Welcome back" toast
Remove lines 98-100 in `src/contexts/AuthContext.tsx` (the `if (config)` block with `toast.info`). Config restoration continues silently.

## Section 2 — Collapsible Department & Hospital on Dashboard
Replace the current full card (lines 121-187 in Dashboard.tsx) with two-state logic:

- **STATE A** (not saved): `accountSettings.departmentName` and `accountSettings.trustName` are both null/empty after loading. Show full form as-is with helper text.
- **STATE B** (saved): Show a compact single-line bar: `Building2` icon, department · trust, `Pencil` edit icon. Add `editing` state — clicking pencil expands inline inputs with Save/Cancel. Save calls existing `handleSaveAccountSettings`, then collapses. Cancel resets local state and collapses.

Determine state from loaded values (after `loadingSettings` resolves). The compact line is the first element in the content area.

## Section 3 — Setup Progress redesign
- Add step numbers as circular badges (1-4)
- Rename: "Department", "Contract Rules (WTR)", "Rota Period", "Doctor Preferences"
- Add icons: `Building2`, `ClipboardList`, `CalendarDays`, `Users`
- Add `Pencil` edit icon at right of each row (always clickable)
- Doctor Preferences row: clickable, navigates to `/admin/roster`
- Fetch live survey counts from `doctors` table where `rota_config_id = currentRotaConfigId`. Show `X / Y responses received`. Remove hardcoded 10/16 and "Active" label.

## Section 4 — Pointer events on DepartmentStep2 drag bars
The drag bars already use pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) — lines 32-53 and 104-123. The fix needed is:
- Add `style={{ touchAction: 'none' }}` to the draggable bar `div` elements (lines 70-76 and 132-138)
- Ensure min height of 44px for touch targets (currently `h-5` = 20px on DragBar, `h-8` = 32px on GlobalSplitBar — increase both to `h-11` = 44px)

## Section 5 — Reset button visual states
- **"Reset all to auto" button**: Compare each shift's current value to `autoShare`. If any differ by >0.5pp, show red style; otherwise muted/ghost.
- **Per-shift reset icon**: Compare individual value to `autoShare`. If differs >0.5pp, show red with tooltip "Reset to auto (X%)"; otherwise grey/muted with tooltip "Percentage is at auto value".
- Add a one-time pulse animation class for the red "Reset all" button.

## Files Changed

| File | Changes |
|---|---|
| `src/contexts/AuthContext.tsx` | Remove toast.info on login |
| `src/pages/admin/Dashboard.tsx` | Two-state dept/hospital, redesigned setup progress with numbered badges/icons/edit icons, live survey count fetch |
| `src/pages/admin/DepartmentStep2.tsx` | Add `touchAction: 'none'`, increase drag target height to 44px, reset button visual states based on auto-value comparison |
| `src/index.css` | Add pulse-once keyframe animation for red reset button |

