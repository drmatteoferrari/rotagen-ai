

## Plan: Eight-section UI improvements

### Section 1 — Fix survey StepNav and layout
**Files:** `src/components/survey/StepNav.tsx`, `src/components/DoctorLayout.tsx`, `src/components/survey/SurveyShell.tsx`, `src/index.css`

- **StepNav.tsx** (line 15): Change outer div className to `"sticky bottom-0 bg-card border-t border-border px-4 py-3 z-20 w-full"`
- **DoctorLayout.tsx** (line 10): Remove `max-w-2xl` from inner wrapper → `"w-full flex-1 flex flex-col"`
- **SurveyShell.tsx** (line 45): Remove `px-4 sm:px-6` from header outer div, wrap inner content in `<div className="mx-auto max-w-2xl w-full px-4 sm:px-6">`. Same pattern for rota period banner (line 70)
- **index.css**: Change `body, #root` background to `#ffffff` and `min-height: 100dvh`

### Section 2 — Add new routes
**File:** `src/App.tsx`

- Import `DepartmentSummary` and `RotaPeriodSummary`
- Add 3 routes inside AdminShell: `/admin/department/summary`, `/admin/rota-period/summary`, `/admin/wtr/summary` (WtrStep5)

### Section 3 — Create DepartmentSummary page
**New file:** `src/pages/admin/DepartmentSummary.tsx`

- Dual-mode page: `?mode=pre-submit` shows review + "Confirm & Save"; otherwise shows post-submit view with Edit/Reset buttons
- Loads shifts from context or DB fallback
- Save function writes `global_oncall_pct` and `target_percentage` per shift, sets `departmentComplete`
- Reset function deletes shift_types, calls `resetDepartment`, navigates to step-1
- Shows department details, shift types list, and hour distribution cards (read-only)
- Uses `StepNavBar` for navigation with inline confirmation dialogs

### Section 4 — WtrStep5 post-submit mode
**File:** `src/pages/admin/WtrStep5.tsx`

- Add `useEffect`, `useSearchParams`, `format` imports
- Add `resetWtr` to destructuring from `useAdminSetup`
- Add `isPostSubmit`, `savedAt`, `showEditConfirm`, `showResetConfirm` state
- Add useEffect to load `updated_at` from `wtr_settings`
- Add success banner when post-submit
- Add inline Edit/Reset confirmation dialogs
- Replace StepNavBar with conditional: post-submit shows Edit+Reset, pre-submit shows Back+Save

### Section 5 — Create RotaPeriodSummary page
**New file:** `src/pages/admin/RotaPeriodSummary.tsx`

- Same dual-mode pattern as DepartmentSummary
- Shows rota dates, duration, bank holidays, BH treatment rules
- Save function mirrors RotaPeriodStep2's `handleSave` logic
- Reset clears dates, bank holidays, BH rules in both DB and context

### Section 6 — Wire pre-submit into step flows
**Files:** `src/pages/admin/DepartmentStep3.tsx`, `src/pages/admin/RotaPeriodStep2.tsx`

- DepartmentStep3: Change right button to navigate to `/admin/department/summary?mode=pre-submit` with label "Review & Save"
- RotaPeriodStep2: Change right button to navigate to `/admin/rota-period/summary?mode=pre-submit` with label "Review & Save"
- WtrStep4→Step5 unchanged (step-5 defaults to pre-submit)

### Section 7 — Wire post-submit into SetupPage
**File:** `src/pages/admin/SetupPage.tsx`

- Department row onClick: navigate to summary with `?mode=post-submit` when complete, else step-1
- WTR row onClick: navigate to `/admin/wtr/summary?mode=post-submit` when complete, else step-1
- Rota Period row onClick: navigate to summary with `?mode=post-submit` when complete, else step-1

### Section 8 — Setup page visual redesign
**File:** `src/pages/admin/SetupPage.tsx`

- Add `ChevronDown`, `ChevronUp` imports
- Add `collapsedSections` state with `toggleSection` and `isSectionCollapsed` helpers
- Add step numbers (1–4) before each row label
- Replace single card with two-column layout (`md:grid-cols-2`): "Department & Rules" left, "Dates & Preferences" right
- Completed rows start collapsed on mobile with chevron toggle; Doctor Surveys never collapses
- Remove old divider; Generate section remains full-width below

### Technical notes
- No DB migrations needed — all data reads/writes use existing tables (`rota_configs`, `shift_types`, `wtr_settings`, `bank_holidays`)
- `resetDepartment` and `resetWtr` already exist in their respective contexts
- `accountSettings` (departmentName, trustName) available from `useAuth()`
- `getRotaConfig` and `useInvalidateQuery` already imported in RotaPeriodStep2 — reuse same pattern in RotaPeriodSummary

### Files touched
| File | Action |
|------|--------|
| `src/components/survey/StepNav.tsx` | Edit className |
| `src/components/DoctorLayout.tsx` | Remove max-w-2xl |
| `src/components/survey/SurveyShell.tsx` | Add inner max-w-2xl wrappers |
| `src/index.css` | Change body bg + min-height |
| `src/App.tsx` | Add 3 routes + 2 imports |
| `src/pages/admin/DepartmentSummary.tsx` | **New file** |
| `src/pages/admin/RotaPeriodSummary.tsx` | **New file** |
| `src/pages/admin/WtrStep5.tsx` | Add post-submit mode |
| `src/pages/admin/DepartmentStep3.tsx` | Change right button |
| `src/pages/admin/RotaPeriodStep2.tsx` | Change right button |
| `src/pages/admin/SetupPage.tsx` | Redesign + post-submit routing |

