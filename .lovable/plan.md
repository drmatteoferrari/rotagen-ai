

# Phase 1: App Shell, Routing & Layouts

## Overview
Convert 20 uploaded HTML design mockups into React components, set up routing with `react-router-dom`, and create two layout wrappers: `AdminLayout` (sidebar + content) and `DoctorLayout` (simulated mobile phone frame).

## Route Map

| Route | Page Component | Layout |
|---|---|---|
| `/admin/dashboard` | AdminDashboard | AdminLayout |
| `/admin/roster` | AdminRoster | AdminLayout |
| `/admin/rota-period/step-1` | RotaPeriodStep1 | AdminLayout |
| `/admin/rota-period/step-2` | RotaPeriodStep2 | AdminLayout |
| `/admin/department/step-1` | DepartmentStep1 | AdminLayout |
| `/admin/department/step-2` | DepartmentStep2 | AdminLayout |
| `/admin/department/step-3` | DepartmentStep3 | AdminLayout |
| `/admin/wtr/step-1` | WtrStep1 | AdminLayout |
| `/admin/wtr/step-2` | WtrStep2 | AdminLayout |
| `/admin/wtr/step-3` | WtrStep3 | AdminLayout |
| `/admin/wtr/step-4` | WtrStep4 | AdminLayout |
| `/doctor/survey/1` | SurveyStep1 | DoctorLayout |
| `/doctor/survey/2` | SurveyStep2 | DoctorLayout |
| `/doctor/survey/3` | SurveyStep3 | DoctorLayout |
| `/doctor/survey/4` | SurveyStep4 | DoctorLayout |
| `/doctor/survey/5` | SurveyStep5 | DoctorLayout |
| `/doctor/survey/6` | SurveyStep6 | DoctorLayout |

## Layouts

### AdminLayout (refactor existing)
The existing `AdminLayout` already has sidebar + content area. It will be updated to:
- Add navigation links for all admin sections (Dashboard, Department Setup, WTR Setup, Rota Period, Roster)
- Keep the collapsible sidebar behavior
- Content area renders children with `overflow-y-auto`

### DoctorLayout (new)
A wrapper that simulates a mobile phone floating in the center of the screen:
- Gray/slate background fills the viewport
- A phone-shaped container (max-w-md, rounded corners, shadow, border) centered on screen
- Internal content area scrolls independently (`overflow-y-auto`)
- Gives the admin a preview of what doctors see on mobile

## Navigation Wiring

Each page's "Next", "Back", "Continue", and "arrow_back" buttons will be wired to `useNavigate()` calls:

**Rota Period flow:**
- Step 1 "Continue to Holidays" -> `/admin/rota-period/step-2`
- Step 2 "Save Rota Period" -> `/admin/dashboard`
- Step 2 back arrow -> `/admin/rota-period/step-1`

**Department Setup flow:**
- Step 1 "Add New Shift Type" stays on page; next navigates to `/admin/department/step-2`
- Step 2 "Next Shift" -> `/admin/department/step-3`
- Step 3 "Save Department Configuration" -> `/admin/dashboard`
- Back arrows go to previous step

**WTR flow:**
- Step 1 "Continue to Step 2" -> `/admin/wtr/step-2`
- Step 2 "Continue to Step 3" -> `/admin/wtr/step-3`
- Step 3 "Continue" -> `/admin/wtr/step-4`
- Step 4 "Save WTR Configuration" -> `/admin/dashboard`
- Back arrows and Skip buttons navigate accordingly

**Doctor Survey flow:**
- Steps 1-5 "Next Step" -> `/doctor/survey/{n+1}`
- Steps 2-6 "Back" -> `/doctor/survey/{n-1}`
- Step 6 "Submit Preferences" -> shows success (stays on page or navigates to a thank-you)

## Technical Approach

### File Structure
```text
src/
  components/
    AdminLayout.tsx        (update existing - add new nav items)
    DoctorLayout.tsx       (new - phone simulator wrapper)
  pages/
    admin/
      Dashboard.tsx        (rewrite from HTML mockup)
      Roster.tsx           (rewrite from HTML mockup)
      RotaPeriodStep1.tsx  (new - from rota_period_bank_holidays_setup_1)
      RotaPeriodStep2.tsx  (new - from rota_period_bank_holidays_setup_2)
      DepartmentStep1.tsx  (new - from wizard_step_1_shift_overview)
      DepartmentStep2.tsx  (new - from wizard_step_2_shifts_staffing)
      DepartmentStep3.tsx  (new - from wizard_step_2_shifts_staffing-2 / distribution)
      WtrStep1.tsx         (new - from wtr_step_1_hours_breaks)
      WtrStep2.tsx         (new - from wtr_step_2_consecutive_shifts)
      WtrStep3.tsx         (new - from wtr_step_3_rest_weekends)
      WtrStep4.tsx         (new - from wtr_step_4_on_call_rules)
    doctor/
      SurveyStep1.tsx      (new - personal details)
      SurveyStep2.tsx      (new - competencies)
      SurveyStep3.tsx      (new - hours & LTFT)
      SurveyStep4.tsx      (new - leave dates)
      SurveyStep5.tsx      (new - medical details)
      SurveyStep6.tsx      (new - specialty & submit)
  App.tsx                  (update routes)
```

### Conversion approach
Each HTML mockup will be converted to a React/TSX component:
- Replace Material Symbols with `lucide-react` icons where possible
- Use Tailwind classes directly (the mockups already use Tailwind)
- Replace `<a href>` and `<button>` navigation with `useNavigate()` from react-router-dom
- No complex state management yet -- just static UI with navigation
- Keep form inputs as uncontrolled for now (no state wiring)

### Color Theming
The uploaded mockups use different accent colors per section:
- **Admin Dashboard/Roster**: Teal (`#12b5a2`)
- **Rota Period**: Amber/Orange (`#F59E0B`)
- **Department Setup**: Blue (`#2563EB`)
- **WTR Setup**: Red (`#ec1313`)
- **Doctor Survey**: Teal (`#14b8a6`)

These will be applied via inline Tailwind classes per page (not changing the global theme), keeping each wizard visually distinct.

### DoctorLayout Component
```text
+--------------------------------------------------+
|           Gray background (full viewport)         |
|                                                   |
|     +--------------------------------------+      |
|     | Phone frame (max-w-md, h-[844px])    |      |
|     | rounded-[2.5rem], shadow, border     |      |
|     |                                      |      |
|     |   [children scroll here]             |      |
|     |                                      |      |
|     +--------------------------------------+      |
|                                                   |
+--------------------------------------------------+
```

## Implementation Order

1. Create `DoctorLayout.tsx`
2. Update `AdminLayout.tsx` with new nav items for department, WTR, rota-period sub-routes
3. Create all 17 page components (converted from HTML mockups)
4. Update `App.tsx` with the full route map
5. Update `Index.tsx` redirect to `/admin/dashboard`
6. Remove old `Setup.tsx` and `RotaPeriod.tsx` (replaced by new step-based pages)

