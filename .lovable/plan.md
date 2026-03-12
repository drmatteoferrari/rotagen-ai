

## Plan: Add Google OAuth Sign-in

Two files to edit, no new files or migrations needed.

### Section 1 — `src/contexts/AuthContext.tsx`

1. Add `useEffect` to the React import on line 1
2. Add `googleLogin: () => Promise<void>` to `AuthContextType` (line 27)
3. Inside `AuthProvider`, after line 69 (`clearSession` destructure), add:
   - `useEffect` subscribing to `supabase.auth.onAuthStateChange` — handles `SIGNED_IN` (allowlist check, setUser, loadAccountSettings, restoreForUser) and `SIGNED_OUT` (clear only non-developer1 users). Cleanup returns unsubscribe.
   - `googleLogin` callback calling `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams } })`
4. Add `googleLogin` to Provider value on line 110
5. Append `// SECTION 1 COMPLETE`

### Section 2 — `src/pages/Login.tsx`

1. Destructure `googleLogin` from `useAuth()` on line 11
2. Add `googleLoading` state
3. After the "Forgot password" div (line 133), insert an "or" divider + "Sign in with Google" outline button
4. Move the existing "or" divider + "Create account" button below the Google button
5. Append `// SECTION 2 COMPLETE`

No database changes, no new dependencies, no new files.

