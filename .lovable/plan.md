

# Plan: Google Sign-In via Standard Supabase Auth

Two files modified. No new files. No Lovable-specific modules. Uses `supabase.auth.signInWithOAuth` from the existing client.

## File 1: `src/contexts/AuthContext.tsx`

**Add `useEffect` to imports** (line 1).

**Add `googleLogin` to `AuthContextType`** interface (line 27):
```ts
googleLogin: () => Promise<void>;
```

**Add `onAuthStateChange` listener** inside `AuthProvider`, before the `login` callback. Handles `SIGNED_IN` (allowlist check against `['matteferro31@gmail.com']`, maps email to username, loads settings, restores config) and `SIGNED_OUT` (clears state only for non-developer1 users). Returns cleanup unsubscribe.

**Add `googleLogin` callback** using `supabase.auth.signInWithOAuth` with provider `'google'`, `redirectTo: window.location.origin`, and `queryParams: { prompt: 'select_account', access_type: 'online' }`.

**Add `googleLogin` to Provider value** prop.

**Update `logout`** to also call `supabase.auth.signOut()` when the current user is not `developer1`.

All existing code (hardcoded login, account settings, loadAccountSettings export) remains untouched.

## File 2: `src/pages/Login.tsx`

**Destructure `googleLogin`** from `useAuth()` alongside existing destructured values.

**Add `googleLoading` state** (`useState(false)`).

**Add Google button** between the "Forgot password" link and the existing "or" divider. Wrapped in its own "or" divider section:
- Outline button with inline Google "G" SVG icon
- Shows "Redirecting to Google…" when `googleLoading` is true
- On click: sets `googleLoading(true)`, calls `googleLogin()`, catches errors with toast

No other files touched. No migrations. No new modules.

