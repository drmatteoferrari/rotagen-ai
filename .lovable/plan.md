

# Fix: Data Persistence Across Login Sessions

## Summary
After saving surveys and logging out/in, data doesn't reload because: (1) `rota_configs` has no user identifier, (2) context resets on logout with no restoration on login. Fix by adding `owned_by` column, filtering queries by username, restoring config on login, persisting config ID in sessionStorage, and pre-populating all form contexts from restored data.

---

## Files Changed

| File | Action |
|---|---|
| Migration SQL | Add `owned_by` column + index to `rota_configs` |
| `src/lib/rotaConfig.ts` | `getCurrentRotaConfig(username)` filter by `owned_by` |
| `src/contexts/RotaContext.tsx` | Expand to store full `RotaConfig`, use sessionStorage for `configId`, accept username for restore |
| `src/contexts/AuthContext.tsx` | On login success, restore config from DB; on logout, clear sessionStorage + context |
| `src/pages/admin/DepartmentStep2.tsx` | Add `owned_by` to INSERT payload |
| `src/pages/admin/RotaPeriodStep2.tsx` | Add `owned_by` to INSERT payload |
| `src/pages/admin/WtrStep4.tsx` | Add `owned_by` to INSERT payload |
| `src/contexts/AdminSetupContext.tsx` | Add `restoreFromConfig(config)` to hydrate all WTR + rota period fields from a RotaConfig |
| `src/contexts/DepartmentSetupContext.tsx` | Add `restoreFromConfig(config)` to hydrate shifts + distribution from a RotaConfig |
| `src/pages/admin/Dashboard.tsx` | Derive ✅/○ status from restored RotaConfig instead of only volatile booleans |

---

## Technical Design

### Section 1 — `owned_by` column
Migration: `ALTER TABLE rota_configs ADD COLUMN IF NOT EXISTS owned_by text NOT NULL DEFAULT 'developer1'` + index.

### Section 2 — Write `owned_by` on INSERT
In DepartmentStep2, RotaPeriodStep2, WtrStep4: add `owned_by: user.username` to the `.insert()` call (not to `.update()`). Get `user` from `useAuth()`.

### Section 3 — Filter queries by user
`getCurrentRotaConfig(username)` adds `.eq("owned_by", username)`. `useRotaConfig()` reads username from `useAuth()`.

### Section 4 — Restore config on login
Expand `RotaContext` to hold `restoredConfig: RotaConfig | null`. Add `restoreForUser(username)` async method that calls `getCurrentRotaConfig(username)`, sets `currentRotaConfigId` + `restoredConfig`, and stores ID in sessionStorage. Call this from `AuthContext` login success handler (make login async). Show "Welcome back" toast if config found.

### Section 5 — Pre-populate forms
Add `restoreFromConfig(config: RotaConfig)` methods to both `AdminSetupContext` and `DepartmentSetupContext`. These set all state fields from the config object. Call them from `RotaContext` whenever `restoredConfig` changes. Each page already reads from these contexts, so forms auto-populate.

Specifically:
- **AdminSetupContext.restoreFromConfig**: sets `rotaStartDate`, `rotaEndDate`, all WTR fields (`maxAvgWeekly`, etc.), and completion flags (`isDepartmentComplete` = shifts.length > 0, etc.)
- **DepartmentSetupContext.restoreFromConfig**: rebuilds `shifts` array from `config.shifts`, sets `globalOncallPct`, `shiftTargetOverrides`
- **RotaPeriodStep1**: already reads `rotaStartDate`/`rotaEndDate` from context — will auto-populate
- **RotaPeriodStep2**: needs to check context for restored bank holidays instead of only auto-detecting — add `useEffect` that reads from `restoredConfig.rotaPeriod.bankHolidays` if available
- **WTR steps 1-3**: already read from `AdminSetupContext` — will auto-populate

### Section 6 — sessionStorage persistence
In `RotaContext`: on every `setCurrentRotaConfigId`, write to `sessionStorage`. On mount, read from sessionStorage and validate against DB. On logout (called from AuthContext), clear sessionStorage.

### Section 7 — Status indicators on Dashboard
Dashboard already shows ✅/○ based on `isDepartmentComplete`, `isWtrComplete`, `isPeriodComplete`. The `restoreFromConfig` call in Section 5 will set these flags based on actual DB data, so Dashboard automatically reflects saved status. Add "✅ Saved" badge text when the flag is set from a restored config vs "Done" when set from a fresh save in the same session.

