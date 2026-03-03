

# Fix Department & Hospital Name Persistence

## Problem
Dashboard saves department/hospital to `rota_configs` using `currentRotaConfigId`, which may be null. These are account-level settings and need their own table.

## Plan

### Section 1 — Migration: `account_settings` table
Create table with `owned_by` (UNIQUE), `department_name`, `trust_name`, timestamps. Public RLS policy (matching existing pattern). Index on `owned_by`.

### Section 2 — Save handler on Dashboard
Replace current `saveDeptInfo` with upsert to `account_settings` using `user.username` from `useAuth()`. Trim fields, validate non-empty with inline errors. Remove the old `rota_configs` update logic for these fields.

### Section 3 — Load on Dashboard mount
`useEffect` fetches from `account_settings` where `owned_by = user.username`. Handle PGRST116 (no rows) gracefully. Show skeleton while loading.

### Section 4 — Account settings in AuthContext
Add `accountSettings` state (`{ departmentName, trustName }`) and `setAccountSettings` to `AuthContext`. Create `loadAccountSettings(username)` utility. Call it on login (before redirect) and store in context. Clear on logout.

### Section 5 — Roster reads from context
Replace `restoredConfig?.department?.departmentName` with `accountSettings.departmentName` from `useAuth()`. Block send with toast if either is empty.

### Section 6 — UI feedback on Dashboard
- Loading skeletons while fetching
- Inline field validation errors (clear on typing)
- Save button states: default → Saving… → ✓ Saved (3s) → reset
- Success/error messages below Save button

### Files Changed

| File | Change |
|---|---|
| Migration SQL | Create `account_settings` table |
| `src/contexts/AuthContext.tsx` | Add `accountSettings`, `setAccountSettings`, `loadAccountSettings` utility, update login/logout |
| `src/pages/admin/Dashboard.tsx` | Rewrite dept/hospital card: upsert to `account_settings`, load on mount, inline validation, loading skeletons, save states |
| `src/pages/admin/Roster.tsx` | Read dept/hospital from `useAuth().accountSettings` instead of `restoredConfig` |

