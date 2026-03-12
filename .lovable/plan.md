
Goal: fix the Google OAuth “Signing in…” stall by making auth state handling non-blocking and deterministic after redirect reload, while keeping developer fallback login intact.

1) Root-cause confirmed
- Backend auth logs show Google login succeeds (`/token` 200, `/user` 200), so failure is client-side post-redirect handling.
- `AuthContext` currently does async/await Supabase reads inside `onAuthStateChange`; this can block/deadlock auth event processing and leave UI stuck.
- `handledRef` can also suppress follow-up events when the first callback path hangs.

2) Changes in `src/contexts/AuthContext.tsx`
- Refactor auth listener so `onAuthStateChange` callback is NOT `async` and contains no awaited Supabase/database calls.
- Keep handling for `SIGNED_IN` + `INITIAL_SESSION` + `SIGNED_OUT`.
- On sign-in events:
  - Validate allowlist immediately.
  - If denied: fire-and-forget sign-out, clear local auth state, show `toast.error("Access denied. You are not authorised.")`, route to `/login`.
  - If allowed: map user to existing owner key:
    - `username: "developer1"`
    - `email: session.user.email`
    - `role: "coordinator"`
    - `displayName: full_name ?? email ?? "Coordinator"`
  - Set `user` synchronously.
  - Run `loadAccountSettings("developer1")` + `restoreForUser("developer1")` in fire-and-forget async task (`Promise.resolve().then(...)` or internal async function called with `void`), then navigate to `/admin/dashboard`.
- Add duplicate-event guard using refs keyed by session id/access token to avoid repeated hydration from both `INITIAL_SESSION` and `SIGNED_IN`.
- Keep hardcoded `login()` behavior exactly unchanged.
- Keep `googleLogin()` using Lovable Cloud OAuth with account picker every time (`prompt: "select_account"`, `access_type: "online"`).
- Update `logout()` to sign out backend session and clear local app state reliably (with `finally`-style clearing to avoid stale UI if sign-out errors).

3) Changes in `src/pages/Login.tsx`
- Keep existing form and dev login intact.
- Keep Google button wired to `googleLogin`.
- Make Google click handler resilient:
  - `setLoading(true)` before call
  - `try/catch/finally` so `loading` is reset if OAuth initiation fails before redirect
  - keep current UX text/buttons unchanged otherwise

4) Why this fixes the stuck loop
- Removes the auth-js deadlock pattern (awaiting Supabase work inside auth-state callback).
- Ensures post-redirect session restoration path (`INITIAL_SESSION`) can always set user and trigger hydration.
- Prevents event races/duplicates from causing blocked or inconsistent state.

5) Validation checklist after implementation
- `/login` renders normally.
- Clicking Google opens Google account picker every time.
- Allowlisted account returns to app and lands on `/admin/dashboard` with existing `developer1` data restored.
- Non-allowlisted account gets access denied toast and returns to `/login`.
- `developer1/developer1` login still works unchanged.
- Logout clears both app state and backend auth session; next Google click still shows account picker.
- Confirm no auth callback deadlock symptoms in console/network after redirect.
