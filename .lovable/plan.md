
## Plan

### What I found
There are two concrete issues to fix:

1. `src/hooks/useAdminQueries.ts`  
   `usePreRotaResultQuery` still:
   - reads doctor names/grades from the stored `pre_rota_results` JSON snapshot
   - only fetches a single `updated_at` row from `doctors`, which is too weak for stale detection

2. `src/pages/Login.tsx` / `src/components/brand/RotaGenIcon.tsx`  
   The build is currently blocked because `Login.tsx` passes `className` to `RotaGenIcon`, but `RotaGenIconProps` does not include it.

### Implementation plan

#### 1) Add read-time hydration in `usePreRotaResultQuery`
Update the doctors fetch inside the existing `Promise.all` to load all live doctors for the current rota config:

```ts
.select("id, first_name, last_name, grade, updated_at")
```

Remove the current `.order(...).limit(1)` from the doctors query.

#### 2) Strengthen staleness detection
Replace the current single-row `latestDoctorUpdate` logic with:
- compute the max `updated_at` across all fetched doctors
- keep the existing latest survey lookup
- preserve `result.isStale` so it becomes true if either:
  - any doctor was updated after pre-rota generation, or
  - any survey was updated after pre-rota generation

#### 3) Hydrate snapshot doctor data before returning
Before `return result`:
- build a `Map` keyed by live doctor `id`
- create a small `hydrateDoctor` helper that checks both `doc.id` and `doc.doctorId`
- update:
  - `result.calendarData.doctors`
  - `result.targetsData.doctors`
- overwrite:
  - `doctorName` with `Dr ${first_name} ${last_name}`
  - `grade` with the live doctor grade when available

This keeps the existing stored JSON shape intact while ensuring the UI/export layer always reflects current doctor identity data.

#### 4) Fix the current TypeScript build blocker
Update `RotaGenIcon` to accept an optional `className` prop and pass it through to the root `<svg>`.

This is the lowest-risk fix because:
- `Login.tsx` already expects `className` support
- it preserves the current visual behavior
- it avoids touching branding markup in the login page

### Files to update
- `src/hooks/useAdminQueries.ts`
- `src/components/brand/RotaGenIcon.tsx`

### Expected outcome
After implementation:
- Pre-Rota calendar and targets screens will show live doctor names/grades even when `pre_rota_results` contains stale snapshots
- `isStale` will remain accurate using the latest doctor update across the whole config
- exports that consume hydrated query data will also reflect current names/grades
- the current Login build error will be resolved

### Technical notes
- No database/schema changes are needed
- No auth/RLS changes are needed
- This is a read-layer fix only, aligned with your request to avoid refactoring stored JSON blobs
