

## Plan: Coordinator Registration Approval & Onboarding Flow

This implements a 9-section change: a new `registration_requests` table, an approval page triggered by email links, a forced password-change flow for new accounts, and updates to the auth context and routing.

---

### Critical Issue: RLS Policies

The `coordinator_accounts` table currently only allows `SELECT`. The `/approve` page needs to `INSERT` new accounts from the browser using the anon client. The migration must add an INSERT policy on `coordinator_accounts` and UPDATE policies on `registration_requests`. The provided migration SQL already covers `registration_requests` policies. We need to add:

```sql
CREATE POLICY "Allow public insert for approval"
  ON public.coordinator_accounts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for password change"
  ON public.coordinator_accounts FOR UPDATE USING (true);
```

Without these, the approval page and password change page will silently fail.

---

### Section 1 — Database Migration

Create migration with:
- `registration_requests` table (id, approval_token, full_name, email, phone, job_title, hospital, department, heard_from, status, created_at, approved_at)
- RLS: public INSERT, SELECT, and UPDATE
- Add `must_change_password boolean NOT NULL DEFAULT false` to `coordinator_accounts`
- Set `must_change_password = false` for `developer1`
- Add INSERT and UPDATE RLS policies on `coordinator_accounts`

### Section 2 — Update `Register.tsx`

Change `handleSubmit` to:
1. Insert into `registration_requests` via anon client, retrieve `approval_token`
2. Then invoke `send-registration-request` edge function with form data + `approvalToken`
3. If DB insert fails → show error, skip edge function
4. If edge function fails → still show success (request is saved)

### Section 3 — Replace `send-registration-request` Edge Function

Update to accept `approvalToken` in body. Construct approval URL: `https://rotagen-ai.lovable.app/approve?token=[approvalToken]`. Add a styled "Approve Access" button in the HTML email. Email-only, no DB ops.

### Section 4 — Create `send-welcome-email` Edge Function

New edge function at `supabase/functions/send-welcome-email/index.ts`. Receives `to`, `fullName`, `username`. Sends welcome email with credentials and first-login instructions. Email-only.

### Section 5 — Create `/approve` page (`src/pages/Approve.tsx`)

Public page reading `?token=` query param. States: loading → invalid/already-approved → confirm → processing → success/error.

On confirm:
1. Generate username from email (`email.split('@')[0].toLowerCase().replace(...)`)
2. Insert into `coordinator_accounts` (status: active, must_change_password: true)
3. Update `registration_requests` (status: approved, approved_at: now)
4. Invoke `send-welcome-email` edge function
5. Show success message

Styled consistently with Login page (centred card, RotaGen branding).

### Section 6 — Create `/change-password` page (`src/pages/ChangePassword.tsx`)

Protected route, no AdminShell wrapper. Two fields: new password (min 8 chars), confirm password. On submit:
1. Validate match + length
2. Update `coordinator_accounts` set password + `must_change_password = false`
3. Call `refreshUser()` from AuthContext
4. Navigate to `/admin/dashboard`

### Section 7 — Update `AuthContext.tsx`

Three targeted changes:
- Add `mustChangePassword: boolean` to `AuthUser`
- In `login()`, populate `mustChangePassword: row.must_change_password ?? false`
- Add `refreshUser` callback that re-queries `coordinator_accounts` and updates user state
- Expose `refreshUser` in context type and provider value

### Section 8 — Update `App.tsx`

- Import `Approve` and `ChangePassword`
- Add public route `/approve`
- Add protected route `/change-password`
- Create `MustChangePasswordRoute` wrapper that redirects to `/change-password` when `user.mustChangePassword` is true
- Wrap the coordinator `AdminShell` route group with `MustChangePasswordRoute`

### Section 9 — Types Update

Since `types.ts` is auto-generated and we can't edit it directly, we'll use `as any` casting for `registration_requests` queries (same pattern already used for `coordinator_accounts`). The `must_change_password` field on `coordinator_accounts` will also be accessed via the existing `as any` pattern.

---

### Files Created
- `supabase/migrations/[timestamp]_registration_approval_flow.sql`
- `supabase/functions/send-welcome-email/index.ts`
- `src/pages/Approve.tsx`
- `src/pages/ChangePassword.tsx`

### Files Modified
- `src/pages/Register.tsx` — DB insert before edge function call
- `supabase/functions/send-registration-request/index.ts` — approval URL in email
- `src/contexts/AuthContext.tsx` — mustChangePassword + refreshUser
- `src/App.tsx` — new routes + MustChangePasswordRoute wrapper

