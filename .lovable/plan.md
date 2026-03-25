

## Plan: User Feedback Collection Feature

### Overview
Build a complete feedback collection system: database table, notification Edge Function, public feedback page, and entry points from the landing page and setup page.

### 1. Database Migration
Create `app_feedback` table with rating columns (smallint 1-5), comparison fields with CHECK constraints, optional text fields, `rota_creators text[]`, contact preferences, and RLS policy allowing public inserts only. Add corresponding type definitions to `types.ts`.

### 2. Edge Function — `send-feedback-notification`
Create `supabase/functions/send-feedback-notification/index.ts` following the `send-welcome-email` pattern: Resend import, CORS headers matching the project, HTML email with star ratings rendered as ★/☆, two-column table layout, sent to `matteferro31@gmail.com`. JWT disable comment at top.

### 3. Feedback Page — `src/pages/Feedback.tsx`
Public page using `supabasePublic` client. Accent color `#34E0A1` via inline styles. Contains:
- Sticky nav bar matching LandingPage style
- 6 form sections: star ratings, comparison questions with pill buttons, checkbox multi-select for rota creators, optional textareas, optional about-you inputs, contact preference
- Inline helper components: `StarRating`, `PillButton`, `CheckboxOption`
- Client-side validation for required fields (4 ratings, quickerThanBefore, previousMethod, moreAccurate)
- Submit handler: insert to DB via `supabasePublic`, fire-and-forget Edge Function call
- Success state replaces form with thank-you panel

### 4. Route Registration
Add `/feedback` as a public route in `App.tsx` alongside `/privacy`, `/terms`.

### 5. Landing Page Entry Points
- Nav bar: "Give feedback" link before "Sign in" button, `hidden md:block`
- Pricing card: bordered feedback button after "Full pricing details" link

### 6. Setup Page Entry Point
"Give feedback on RotaGen" underlined text link above the existing reset button.

### Technical Details
- **No `<form>` tags** — all interactions via onClick handlers (per project convention)
- **No `<ul>` tags** — per project convention
- Uses `supabasePublic` (session-free client) for DB insert and Edge Function invoke
- Edge Function uses `RESEND_API_KEY` secret (already configured)
- Stars: `text-4xl`, filled `#34E0A1`, empty `#d1d5db`
- Validation errors shown inline with `text-xs text-red-500`
- `formTopRef` scrolls to top on validation failure
- Bounce animation on success checkmark via `useState` + `setTimeout`

### Files Created
- `supabase/migrations/[auto].sql` (via migration tool)
- `supabase/functions/send-feedback-notification/index.ts`
- `src/pages/Feedback.tsx`

### Files Modified
- `src/integrations/supabase/types.ts` — add `app_feedback` table types
- `src/App.tsx` — add route
- `src/pages/LandingPage.tsx` — two entry points
- `src/pages/admin/SetupPage.tsx` — one entry point

