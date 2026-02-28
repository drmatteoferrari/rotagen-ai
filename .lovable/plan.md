

# Phase 2: Global State & Dashboard Logic

## Overview
Create a React context (`AdminSetupContext`) to track wizard completion status, rebuild the Dashboard page to match the uploaded mockup design, and wire the "Save" buttons on the final wizard steps to update the context.

## New File: `src/contexts/AdminSetupContext.tsx`

A context + provider that holds four booleans:
- `isDepartmentComplete` (default: `false`)
- `isWtrComplete` (default: `false`)
- `isPeriodComplete` (default: `false`)
- `areSurveysDone` (default: `false`)

Setter functions exposed: `setDepartmentComplete`, `setWtrComplete`, `setPeriodComplete`, `setSurveysDone`.

The provider will wrap the app inside `App.tsx`, sitting inside `BrowserRouter` so it's available to all pages.

## Updated File: `src/App.tsx`

Wrap `<Routes>` with `<AdminSetupProvider>`.

## Updated File: `src/pages/admin/Dashboard.tsx`

Rewrite the placeholder dashboard to match the uploaded mockup design:

**Setup Progress section** -- 4 checklist items, each reading from context:
- "Set up department" -- green checkmark if `isDepartmentComplete`, grey circle otherwise
- "Contract rules (WTR)" -- green checkmark if `isWtrComplete`, grey circle otherwise
- "Set up rota period" -- green checkmark if `isPeriodComplete`, grey circle otherwise
- "Doctor preferences" -- shows "ACTIVE" badge with "10/16 responses" (static for now since `areSurveysDone` isn't wired to real data yet)

Progress counter: shows "X/4 Completed" based on how many booleans are true.

**Phase 1: Pre-Rota Data section** -- a card with:
- "Generate Pre-Rota Data" button that is **disabled** unless all three admin setup booleans (`isDepartmentComplete`, `isWtrComplete`, `isPeriodComplete`) are true
- Placeholder status area for "Master Calendar" and "Targets" (static/mock for now)

**Phase 2: Final Allocation section** -- verification checklist (static checkboxes) and "Run Allocation Algorithm" button (disabled, placeholder).

## Updated File: `src/pages/admin/RotaPeriodStep2.tsx`

Change the "Save Rota Period" button's `onClick` to:
1. Call `setPeriodComplete(true)` from context
2. Navigate to `/admin/dashboard`

## Updated File: `src/pages/admin/WtrStep4.tsx`

Change the "Save WTR Configuration" button's `onClick` to:
1. Call `setWtrComplete(true)` from context
2. Navigate to `/admin/dashboard`

## Updated File: `src/pages/admin/DepartmentStep3.tsx`

Change the "Save Department Configuration" button's `onClick` to:
1. Call `setDepartmentComplete(true)` from context
2. Navigate to `/admin/dashboard`

## Technical Details

### Context shape
```text
interface AdminSetupContextType {
  isDepartmentComplete: boolean;
  isWtrComplete: boolean;
  isPeriodComplete: boolean;
  areSurveysDone: boolean;
  setDepartmentComplete: (v: boolean) => void;
  setWtrComplete: (v: boolean) => void;
  setPeriodComplete: (v: boolean) => void;
  setSurveysDone: (v: boolean) => void;
}
```

### State persistence
State lives in React memory only (resets on refresh). No localStorage or database wiring in this phase -- that can come later when Supabase is connected.

### Dashboard UI structure (matching the mockup)
```text
+------------------------------------------+
|  GENERATION COMMAND CENTER               |
+------------------------------------------+
|  SETUP PROGRESS          X/4 Completed   |
|  [x] Set up department         DONE      |
|  [x] Contract rules (WTR)     DONE      |
|  [x] Set up rota period       DONE      |
|  [ ] Doctor preferences       ACTIVE     |
+------------------------------------------+
|  Phase 1: Pre-Rota Data                  |
|  [Generate Pre-Rota Data] (disabled/     |
|   enabled based on 3 booleans)           |
+------------------------------------------+
|  Phase 2: Final Allocation               |
|  Verification checklist (static)         |
|  [Run Allocation Algorithm] (disabled)   |
+------------------------------------------+
```

## Files Changed Summary

| File | Action |
|---|---|
| `src/contexts/AdminSetupContext.tsx` | Create (new context + provider) |
| `src/App.tsx` | Update (wrap with provider) |
| `src/pages/admin/Dashboard.tsx` | Rewrite (full dashboard UI from mockup) |
| `src/pages/admin/RotaPeriodStep2.tsx` | Update (wire save button to context) |
| `src/pages/admin/WtrStep4.tsx` | Update (wire save button to context) |
| `src/pages/admin/DepartmentStep3.tsx` | Update (wire save button to context) |

