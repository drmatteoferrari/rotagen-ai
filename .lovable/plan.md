I’ll fix the 1-hour logout issue by ensuring the backend auth settings and client restoration flow both support a 7-day session.

What I found:
- The client is already configured correctly with persisted sessions and automatic token refresh.
- `supabase/config.toml` already contains the intended auth settings:
  - `jwt_expiry = 604800`
  - `enable_refresh_token_rotation = true`
  - `refresh_token_reuse_interval = 10`
- The app’s `AuthContext` already listens for `INITIAL_SESSION`, which is the correct client-side mechanism for restoring a persisted session on browser reopen.
- If users are still seeing 3600-second access tokens, the remaining issue is likely that the backend auth configuration has not actually been applied to the running Lovable Cloud auth service, or the setting needs to be enforced through the managed auth configuration rather than only being present in the local config file.

Implementation plan:

1. Confirm backend auth runtime settings
   - Check the current auth configuration available through Lovable Cloud tooling.
   - Verify whether the running access-token lifetime is still 3600 seconds or has been updated to 604800 seconds.

2. Apply the 7-day auth session setting at the backend level
   - Configure the Lovable Cloud auth JWT expiry to 604800 seconds.
   - Keep refresh token rotation enabled with a 10-second reuse interval if supported by the configuration tool.
   - Avoid modifying reserved auth tables or schemas.

3. Keep client session handling unchanged unless runtime testing shows a client-side issue
   - The generated client already uses `persistSession: true` and `autoRefreshToken: true`.
   - `AuthContext` already handles `INITIAL_SESSION` for page refresh/browser reopen restoration.
   - I will not edit `src/integrations/supabase/client.ts` because it is auto-generated.

4. Optional verification after applying settings
   - Sign in and inspect the new access token expiry.
   - Confirm the JWT `exp - iat` duration is approximately 604800 seconds.
   - Confirm closing/reopening or refreshing the browser restores the coordinator session without requiring login.

Expected outcome:
- Freshly issued coordinator access tokens last 7 days.
- Refresh tokens remain persisted in localStorage.
- Closing and reopening the browser within 7 days restores the coordinator automatically.
- No UI changes are required.