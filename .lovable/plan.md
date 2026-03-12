

## Plan: Supabase Auth Session Detection with Email Allowlist

### Section 1 — `src/contexts/AuthContext.tsx`

**Changes:**
1. Add `useEffect` import, add `useEffect` on mount for `supabase.auth.getSession()` + `onAuthStateChange` listener
2. Define `ALLOWED_EMAILS = ['matteferro31@gmail.com']`
3. Helper `mapSessionToUser(session)` → returns `AuthUser` from Supabase session (`username = email`, `role = "coordinator"`, `displayName = full_name ?? email`)
4. On `SIGNED_IN`: check email against allowlist → if not allowed, call `supabase.auth.signOut()`, `toast.error(...)`, return. Otherwise set user, load account settings, restore config.
5. On `SIGNED_OUT`: clear user, clear account settings, call `clearSession()`
6. Keep existing hardcoded `login()` unchanged
7. Update `logout()` to also call `supabase.auth.signOut()`
8. No new `googleLogin()` function needed — Login.tsx already calls `lovable.auth.signInWithOAuth` directly; the auth state change listener handles the rest

### Section 2 — `src/pages/Login.tsx`

**No changes needed.** The Google sign-in button already exists and uses `lovable.auth.signInWithOAuth("google")`. The `isAuthenticated` effect already redirects on login. The auth state change listener in AuthContext will handle setting the user after Google redirect.

### Key Design Decisions
- The `onAuthStateChange` listener is the single source of truth for Google auth — no separate `googleLogin()` function needed since the OAuth redirect flow triggers the listener automatically
- Allowlist check happens in the listener, so it works for any auth method that goes through Supabase
- Hardcoded dev login bypasses Supabase entirely (unchanged)

