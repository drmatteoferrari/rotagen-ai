

# Supabase Backend Persistence for RotaGen

## Field Audit Results

After reading all 8 pages, here are the fields found:

**DepartmentStep1 (per shift card):** name, startTime, endTime, durationHours, applicableDays {mon-sun}, isOncall, isNonRes, staffing {min, max}, badges {night, long, ooh, weekend, oncall, nonres}, badgeOverrides {same 6 keys → boolean|undefined}, oncallManuallySet

**DepartmentStep2:** globalOncallPct (number 0-100), per-shift oncallOverrides and nonOncallOverrides (target percentages)

**RotaPeriodStep1:** startDate, endDate (Date), startTime, endTime (HH:MM), calculated durationDays and durationWeeks

**RotaPeriodStep2:** bankHolidays array [{date, name}], auto-detected flag implicit (auto-populated vs manually added)

**WtrStep1:** maxAvgWeekly (default 48), maxIn7Days (default 72)

**WtrStep2:** maxConsecDays (7), maxConsecLong (7), maxConsecNights (4)

**WtrStep3:** restPostNights (46), restPostBlock (48), restAfter7 (48), weekendFreq (3)

**WtrStep4:** Read-only locked cards — no user-editable fields. The on-call rules are fixed constants. The schema stores their default values but they are never edited by the user.

---

## Implementation Plan

### 1. Database Migration — 4 tables

Create all tables via a single migration:

**rota_configs**: id, created_at, updated_at, department_name (text, default ''), trust_name (text, default ''), contact_email (text, default ''), rota_start_date (date), rota_end_date (date), rota_duration_days (integer), rota_duration_weeks (numeric 5,1), rota_start_time (time default '08:00'), rota_end_time (time default '08:00'), global_oncall_pct (numeric 5,2 default 50), global_non_oncall_pct (numeric 5,2 default 50), status (text default 'draft')

**shift_types**: All columns as specified in the prompt — id, rota_config_id (FK CASCADE), shift_key, name, start_time, end_time, duration_hours, is_oncall, is_non_res_oncall, applicable_mon-sun, badge_night/long/ooh/weekend/oncall/nonres, badge_*_manual_override (nullable boolean), oncall_manually_set (boolean default false), min_doctors, max_doctors, target_percentage, sort_order

**bank_holidays**: id, rota_config_id (FK CASCADE), date, name, is_auto_added, created_at, updated_at

**wtr_settings**: id, rota_config_id (FK CASCADE, UNIQUE), all WTR fields from steps 1-4 as listed in the prompt, created_at, updated_at

RLS: All tables get policies allowing authenticated users full CRUD (since this is a coordinator tool, all authenticated users can manage configs). No public access.

### 2. Rota Context (`src/contexts/RotaContext.tsx`)

New context providing:
- `currentRotaConfigId: string | null`
- `setCurrentRotaConfigId: (id: string | null) => void`

On mount, calls `getCurrentRotaConfig()` to restore the most recent draft/complete config ID. Wrap at app root in `App.tsx`.

### 3. Save Logic — 3 save points

**DepartmentStep2 save button**: Upsert rota_configs (global_oncall_pct, global_non_oncall_pct), DELETE + INSERT all shift_types. Toast on success/error.

**RotaPeriodStep2 save button**: Upsert rota_configs (dates, times, duration), DELETE + INSERT all bank_holidays. Toast on success/error.

**WtrStep4 save button**: Upsert rota_configs, upsert wtr_settings. Check completion status → set status='complete' if shifts exist + dates set + wtr exists. Toast on success/error.

All saves use the existing `sonner` toast (already in the project via `<Sonner />`).

### 4. Retrieval (`src/lib/rotaConfig.ts`)

- `getRotaConfig(id)` — fetches all 4 tables, assembles typed RotaConfig object
- `getCurrentRotaConfig()` — finds most recent draft/complete, calls getRotaConfig
- `useRotaConfig()` hook — loading/error/refresh pattern

### 5. Algorithm Input Builders (`src/lib/rotaGenInput.ts`)

- `buildPreRotaInput(configId)` — transforms RotaConfig into PreRotaInput
- `buildFinalRotaInput(configId, doctors)` — wraps PreRotaInput + doctor preferences with hard/soft constraint arrays
- Export all types: PreRotaInput, FinalRotaInput, DoctorPreference

### Files Created/Modified

| File | Action |
|---|---|
| Migration SQL | Create 4 tables + RLS policies |
| `src/contexts/RotaContext.tsx` | New — config ID context |
| `src/App.tsx` | Add RotaProvider wrapper |
| `src/lib/rotaConfig.ts` | New — getRotaConfig, getCurrentRotaConfig, useRotaConfig |
| `src/lib/rotaGenInput.ts` | New — buildPreRotaInput, buildFinalRotaInput, types |
| `src/pages/admin/DepartmentStep2.tsx` | Add save logic to existing button |
| `src/pages/admin/RotaPeriodStep2.tsx` | Add save logic to existing button |
| `src/pages/admin/WtrStep4.tsx` | Add save logic to existing button |

No UI changes. No styling changes. Toast uses existing sonner.

