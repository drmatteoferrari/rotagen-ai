

## Problem

Google OAuth works in the Lovable preview but fails on the published URL (`https://rotagen-ai.lovable.app`). This is because the Lovable auth-bridge that handles OAuth token exchange only works within the preview iframe environment. On the published site, the `lovable.auth.signInWithOAuth` call goes through the auth-bridge which redirects back to the preview URL instead of the published URL.

## Root Cause

The `lovable.auth.signInWithOAuth("google", ...)` function uses the Lovable auth-bridge, which intercepts the OAuth flow. On the published domain, this bridge redirects to an incorrect URL after Google authentication completes, breaking the flow.

## Fix — One change in `src/contexts/AuthContext.tsx`

Update `googleLogin()` to detect whether the app is running on the published domain vs the Lovable preview domain, and use a different OAuth strategy for each:

- **On `*.lovableproject.com`** (preview): Keep using `lovable.auth.signInWithOAuth` — the auth-bridge works correctly here.
- **On the published domain** (`rotagen-ai.lovable.app` or any non-preview host): Use `supabase.auth.signInWithOAuth` directly with `skipBrowserRedirect: true`, then manually redirect to the returned Google URL. This bypasses the auth-bridge entirely.

```typescript
const googleLogin = useCallback(async () => {
  const isPreview = window.location.hostname.includes("lovableproject.com");

  if (isPreview) {
    // Auth-bridge works in preview
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account", access_type: "online" },
    });
    if (error) {
      console.error("Google sign-in error:", error);
      toast.error("Failed to start Google sign-in.");
    }
  } else {
    // Published domain — bypass auth-bridge
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account", access_type: "online" },
      },
    });
    if (error) {
      console.error("Google sign-in error:", error);
      toast.error("Failed to start Google sign-in.");
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
    }
  }
}, []);
```

No other files need changes. The existing `onAuthStateChange` listener already handles the session after redirect, so it will work on both domains.

## Technical Details

- `skipBrowserRedirect: true` prevents the Supabase client from automatically navigating, giving us the raw Google OAuth URL to redirect to manually.
- `redirectTo` is set to `${window.location.origin}/login` so after Google auth, the user returns to the app where `onAuthStateChange` fires with `INITIAL_SESSION` and completes login.
- The `queryParams` option passes `prompt: select_account` through to Google directly (equivalent to `extraParams` in the Lovable wrapper).

