

# Email Sending for Doctor Survey Invitations

## Current State

- **No `doctors` table exists** — the Roster page uses hardcoded local state with mock data
- **No `survey_deadline` column** on `rota_configs`
- **No RESEND_API_KEY** secret configured
- `rota_configs` already has `department_name` and `trust_name` columns but no UI to edit them on Dashboard
- Roster page has send icons but they only do local state changes (no actual email)

## Implementation Plan

### Section 1 — Edge Function + Resend Secret

- Request `RESEND_API_KEY` from the user via the `add_secret` tool
- Create `supabase/functions/send-survey-invite/index.ts` with CORS, Resend SDK (via npm specifier `npm:resend`), reading `RESEND_API_KEY` from `Deno.env`
- Add `[functions.send-survey-invite]` with `verify_jwt = false` to `supabase/config.toml`

### Section 2 — Survey Link Construction

Inside the edge function response and in the Roster frontend code, construct:
`${appBaseUrl}/survey/doctor?id=${doctorId}`
where `appBaseUrl` comes from `import.meta.env.VITE_APP_URL ?? window.location.origin`.

### Section 3 — Edge Function Email Content

The edge function accepts the POST body with `to`, `doctorName`, `doctorId`, `rotaPeriod`, `departmentName`, `hospitalName`, `surveyDeadline`, `surveyLink`. It sends an HTML email via Resend with the specified subject line, body structure, blue CTA button, grey info box, mobile-responsive layout.

### Section 4 — Survey Deadline Gating

In Roster, if no `surveyDeadline` is set, all send icons are disabled with a tooltip. The deadline value is formatted as "Friday, 14 March 2025" before being passed to the edge function.

### Section 5 — Send Icon Behaviour

Replace the existing mock send logic with:
- Confirmation popover (using Radix Popover) on each row's send icon
- Loading spinner during send
- Green ✓ for 3 seconds on success
- Red toast on error
- Call edge function via `supabase.functions.invoke("send-survey-invite", { body: {...} })`

### Section 6 — Database: `doctors` Table + Tracking Columns

**Migration:** Create a `doctors` table (since none exists) with columns: `id`, `rota_config_id`, `first_name`, `last_name`, `email`, `grade`, `survey_status`, `survey_invite_sent_at`, `survey_invite_count`, `created_at`, `updated_at`. RLS: `TO public USING (true) WITH CHECK (true)`.

Refactor Roster to use this table instead of local state. On successful send, update `survey_invite_sent_at` and increment `survey_invite_count`.

### Section 7 — Email Column Validation

Send icon disabled with tooltip if doctor has no email. Already covered by the `doctors` table having an `email` column.

### Section 8 — Survey Deadline Picker + `survey_deadline` Column

**Migration:** `ALTER TABLE rota_configs ADD COLUMN IF NOT EXISTS survey_deadline date;`

Add a date picker (Shadcn Calendar + Popover) at the top of Roster. Min date = today, max = `rotaStartDate - 1 day`. Auto-saves to `rota_configs.survey_deadline` on change. Restores from DB on page load.

### Section 9 — Dashboard Department/Hospital Fields

Add a card at the top of Dashboard with two text inputs (Department name, Hospital/Trust name) and a Save button that upserts to `rota_configs.department_name` and `rota_configs.trust_name`. Pre-populate from restored config. Show inline "✓ Saved" confirmation. At send time in Roster, validate these are non-empty before allowing send.

---

## Files Changed

| File | Action |
|---|---|
| Migration SQL | Create `doctors` table; add `survey_deadline` to `rota_configs` |
| `supabase/functions/send-survey-invite/index.ts` | New — edge function |
| `supabase/config.toml` | Add function config (verify_jwt = false) |
| `src/pages/admin/Roster.tsx` | Major rewrite — DB-backed doctors, deadline picker, send popover, edge function call, status tracking |
| `src/pages/admin/Dashboard.tsx` | Add department/hospital name fields at top |
| `src/lib/rotaConfig.ts` | Add `surveyDeadline` to `RotaConfig` type and `getRotaConfig` |

## Dependencies

- RESEND_API_KEY must be provided by user before emails can actually send
- No npm install needed — edge function uses `npm:resend` Deno specifier

