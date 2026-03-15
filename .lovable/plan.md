

## Plan: Replace Edge Function with Direct signUp

### Problem
The `create-coordinator-account` Edge Function fails because `SUPABASE_SERVICE_ROLE_KEY` is unavailable in Lovable Cloud. We need to use `supabase.auth.signUp()` directly from the client instead.

### Changes

**1. `src/pages/Approve.tsx` — Rewrite handleApprove (lines 56-69)**

Replace the `supabase.functions.invoke("create-coordinator-account", ...)` block with:

```typescript
const { error: signUpError } = await supabase.auth.signUp({
  email: request.email,
  password: tempPassword,
  options: {
    data: {
      full_name: request.full_name,
      must_change_password: true,
    },
  },
});

if (signUpError) throw new Error(signUpError.message);
```

Everything else in the function (temp password generation, marking request approved, sending welcome email, error handling) stays unchanged.

**2. `src/contexts/AuthContext.tsx` — No changes needed**

Already has the correct logic: master email bypass for `matteferro31@gmail.com`, dynamic approved-status check for all others.

**Note:** Since auto-confirm is already enabled for this project, `signUp()` will create and confirm the user immediately — no email verification step blocks the flow.

