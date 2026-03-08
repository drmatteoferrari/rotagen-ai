# RotaGen — Application Audit

## CHANGELOG

| Date | Sections Updated | Summary of Changes |
|------|-----------------|-------------------|
| 2026-03-08 | Sections 1–3, 10–11 | Audit v3: re-verified v1+v2 fixes; WTR UI checked; new audit of rota_configs persistence, bank_holidays storage, account_settings independence, survey token flow, downstream consumers, accent colour consistency, TypeScript safety, navigation |
| 2026-03-05 | All | Initial audit generated |

---

## 1. DATABASE SCHEMA

### Table: `account_settings`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| owned_by | text | No | — | |
| department_name | text | Yes | — | |
| trust_name | text | Yes | — | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:** None

**Unique Constraints:** None explicit (upsert uses `owned_by` as conflict target in code)

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

### Table: `bank_holidays`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| rota_config_id | uuid | No | — | FK → rota_configs.id |
| date | date | No | — | |
| name | text | No | — | |
| is_auto_added | boolean | Yes | `true` | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:**
- `bank_holidays.rota_config_id` → `public.rota_configs.id`

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

### Table: `doctor_survey_responses`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| doctor_id | uuid | No | — | FK → doctors.id |
| rota_config_id | uuid | No | — | FK → rota_configs.id |
| full_name | text | Yes | — | |
| nhs_email | text | Yes | — | |
| grade | text | Yes | — | |
| specialty | text | Yes | — | |
| comp_ip_anaesthesia | boolean | Yes | `false` | |
| comp_ip_anaesthesia_here | boolean | Yes | `false` | |
| comp_obstetric | boolean | Yes | `false` | |
| comp_obstetric_here | boolean | Yes | `false` | |
| comp_icu | boolean | Yes | `false` | |
| comp_icu_here | boolean | Yes | `false` | |
| competencies_json | jsonb | Yes | `'{}'::jsonb` | |
| wte_percent | numeric | Yes | `100` | |
| wte_other_value | numeric | Yes | — | |
| ltft_days_off | text[] | Yes | — | |
| ltft_night_flexibility | jsonb | Yes | `'[]'::jsonb` | |
| annual_leave | jsonb | Yes | `'[]'::jsonb` | |
| study_leave | jsonb | Yes | `'[]'::jsonb` | |
| noc_dates | jsonb | Yes | `'[]'::jsonb` | |
| other_unavailability | jsonb | Yes | `'[]'::jsonb` | |
| exempt_from_nights | boolean | Yes | `false` | |
| exempt_from_weekends | boolean | Yes | `false` | |
| exempt_from_oncall | boolean | Yes | `false` | |
| specific_days_off | text[] | Yes | — | |
| exemption_details | text | Yes | — | |
| additional_restrictions | text | Yes | — | |
| preferred_shift_types | text[] | Yes | — | |
| preferred_days_off | text[] | Yes | — | |
| dates_to_avoid | text[] | Yes | — | |
| other_requests | text | Yes | — | |
| specialties_requested | jsonb | Yes | `'[]'::jsonb` | |
| want_pain_sessions | boolean | Yes | `false` | |
| pain_session_notes | text | Yes | — | |
| want_preop | boolean | Yes | `false` | |
| signoff_requirements | text | Yes | — | |
| confirmed_accurate | boolean | Yes | `false` | |
| additional_notes | text | Yes | — | |
| status | text | Yes | `'not_started'` | |
| submitted_at | timestamptz | Yes | — | |
| last_saved_at | timestamptz | Yes | `now()` | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:**
- `doctor_survey_responses.doctor_id` → `public.doctors.id`
- `doctor_survey_responses.rota_config_id` → `public.rota_configs.id`

**Unique Constraints:** `(doctor_id, rota_config_id)` — used as upsert conflict target

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

### Table: `doctors`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| rota_config_id | uuid | No | — | FK → rota_configs.id |
| first_name | text | No | — | |
| last_name | text | No | — | |
| email | text | Yes | — | |
| grade | text | Yes | `'—'` | |
| survey_status | text | Yes | `'not_started'` | |
| survey_token | uuid | Yes | `gen_random_uuid()` | |
| survey_invite_sent_at | timestamptz | Yes | — | |
| survey_invite_count | integer | Yes | `0` | |
| survey_submitted_at | timestamptz | Yes | — | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:**
- `doctors.rota_config_id` → `public.rota_configs.id`

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

### Table: `profiles`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | — | PRIMARY KEY |
| email | text | No | — | |
| full_name | text | Yes | — | |
| created_at | timestamptz | Yes | `now()` | |

**Foreign Keys:** None (id maps to auth.users.id via trigger)

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Users can read own profile | SELECT | No | `id = auth.uid()` | — |
| Admins can read all profiles | SELECT | No | `has_role(auth.uid(), 'admin')` | — |
| Users can insert own profile | INSERT | No | — | `id = auth.uid()` |
| Users can update own profile | UPDATE | No | `id = auth.uid()` | — |

**Note:** DELETE is not permitted. This table is not actively used by the application (which uses mock auth).

---

### Table: `rota_configs`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| owned_by | text | No | `'developer1'` | |
| status | text | Yes | `'draft'` | |
| department_name | text | Yes | `''` | |
| trust_name | text | Yes | `''` | |
| contact_email | text | Yes | `''` | |
| rota_start_date | date | Yes | — | |
| rota_end_date | date | Yes | — | |
| rota_duration_days | integer | Yes | — | |
| rota_duration_weeks | numeric | Yes | — | |
| rota_start_time | time | Yes | `'08:00:00'` | |
| rota_end_time | time | Yes | `'08:00:00'` | |
| survey_deadline | date | Yes | — | |
| global_oncall_pct | numeric | Yes | `50` | |
| global_non_oncall_pct | numeric | Yes | `50` | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:** None

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

### Table: `shift_types`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| rota_config_id | uuid | No | — | FK → rota_configs.id |
| name | text | No | — | |
| shift_key | text | No | — | |
| start_time | time | No | — | |
| end_time | time | No | — | |
| duration_hours | numeric | No | — | |
| is_oncall | boolean | Yes | `false` | |
| is_non_res_oncall | boolean | Yes | `false` | |
| oncall_manually_set | boolean | Yes | `false` | |
| min_doctors | integer | Yes | `1` | |
| max_doctors | integer | Yes | — | |
| target_percentage | numeric | Yes | — | |
| sort_order | integer | Yes | `0` | |
| applicable_mon | boolean | Yes | `false` | |
| applicable_tue | boolean | Yes | `false` | |
| applicable_wed | boolean | Yes | `false` | |
| applicable_thu | boolean | Yes | `false` | |
| applicable_fri | boolean | Yes | `false` | |
| applicable_sat | boolean | Yes | `false` | |
| applicable_sun | boolean | Yes | `false` | |
| badge_night | boolean | Yes | `false` | |
| badge_long | boolean | Yes | `false` | |
| badge_ooh | boolean | Yes | `false` | |
| badge_weekend | boolean | Yes | `false` | |
| badge_oncall | boolean | Yes | `false` | |
| badge_nonres | boolean | Yes | `false` | |
| badge_night_manual_override | boolean | Yes | — | |
| badge_long_manual_override | boolean | Yes | — | |
| badge_ooh_manual_override | boolean | Yes | — | |
| badge_weekend_manual_override | boolean | Yes | — | |
| badge_oncall_manual_override | boolean | Yes | — | |
| badge_nonres_manual_override | boolean | Yes | — | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:**
- `shift_types.rota_config_id` → `public.rota_configs.id`

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

### Table: `user_roles`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| user_id | uuid | No | — | |
| role | app_role (enum) | No | — | |

**Unique Constraints:** `(user_id, role)`

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Users can read own roles | SELECT | No | `user_id = auth.uid()` | — |
| Admins can read all roles | SELECT | No | `has_role(auth.uid(), 'admin')` | — |
| Admins can manage roles | ALL | No | `has_role(auth.uid(), 'admin')` | — |

---

### Table: `wtr_settings`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| rota_config_id | uuid | No | — | FK → rota_configs.id (one-to-one) |
| max_hours_per_week | numeric | Yes | `48` | |
| max_hours_per_168h | numeric | Yes | `72` | |
| max_consec_standard | integer | Yes | `7` | |
| max_consec_long | integer | Yes | `7` | |
| max_consec_nights | integer | Yes | `4` | |
| rest_after_standard_h | numeric | Yes | `48` | |
| rest_after_long_h | numeric | Yes | `48` | |
| rest_after_nights_h | numeric | Yes | `46` | |
| weekend_frequency | integer | Yes | `3` | |
| oncall_no_consec_except_wknd | boolean | Yes | `true` | |
| oncall_max_per_7_days | integer | Yes | `3` | |
| oncall_local_agreement_max_consec | integer | Yes | `7` | |
| oncall_day_after_max_hours | numeric | Yes | `10` | |
| oncall_day_after_last_consec_max_h | numeric | Yes | `10` | |
| oncall_rest_per_24h | numeric | Yes | `8` | |
| oncall_continuous_rest_hours | numeric | Yes | `5` | |
| oncall_continuous_rest_start | time | Yes | `'22:00:00'` | |
| oncall_continuous_rest_end | time | Yes | `'07:00:00'` | |
| oncall_if_rest_not_met_max_hours | numeric | Yes | `5` | |
| oncall_no_simultaneous_shift | boolean | Yes | `true` | |
| oncall_saturday_sunday_paired | boolean | Yes | `true` | |
| oncall_clinical_exception_allowed | boolean | Yes | `true` | |
| oncall_break_reference_weeks | integer | Yes | `4` | |
| oncall_break_fine_threshold_pct | integer | Yes | `25` | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:**
- `wtr_settings.rota_config_id` → `public.rota_configs.id` (one-to-one)

**RLS Policies:**

| Policy Name | Command | Permissive | Using | With Check |
|-------------|---------|------------|-------|------------|
| Allow public access | ALL | No | `true` | `true` |

---

## 2. DATABASE FUNCTIONS & TRIGGERS

### Functions

#### `has_role(_user_id uuid, _role app_role) → boolean`

- **Parameters:** `_user_id` (uuid), `_role` (app_role enum)
- **Return type:** boolean
- **Security:** SECURITY DEFINER
- **Description:** Checks if a given user has the specified role by querying `user_roles`. Used in RLS policies to grant admin access.

#### `handle_new_user() → trigger`

- **Parameters:** None (trigger function)
- **Return type:** trigger
- **Security:** SECURITY DEFINER
- **Description:** Inserts a new row into `profiles` when a user signs up via Supabase Auth, extracting `full_name` from `raw_user_meta_data`.

### Triggers

No triggers are currently registered in the database.

**Note:** `handle_new_user()` is defined as a trigger function but no trigger attachment to `auth.users` is visible in the current configuration. This may indicate the trigger was created directly on the `auth.users` table (a Supabase-reserved schema).

---

## 3. ROUTES & PAGES

| URL Path | Component | Auth Required | Role | Data Fetched on Load |
|----------|-----------|---------------|------|---------------------|
| `/login` | `Login` | No | Any | None |
| `/` | `Index` | Yes | Coordinator | Redirects to `/admin/dashboard` |
| `/admin/dashboard` | `Dashboard` | Yes | Coordinator | Account settings (via `loadAccountSettings`), survey counts from `doctors` table, existing `pre_rota_results` |
| `/admin/rota-period/step-1` | `RotaPeriodStep1` | Yes | Coordinator | None (reads from AdminSetupContext) |
| `/admin/rota-period/step-2` | `RotaPeriodStep2` | Yes | Coordinator | UK bank holidays (hardcoded), existing config via context, BH rules from `rota_configs` |
| `/admin/department/step-1` | `DepartmentStep1` | Yes | Coordinator | `account_settings` for department/trust name |
| `/admin/department/step-2` | `DepartmentStep2` | Yes | Coordinator | Shift types from DB (via DepartmentSetupContext) |
| `/admin/department/step-3` | `DepartmentStep3` | Yes | Coordinator | Shifts from DepartmentSetupContext, global split |
| `/admin/wtr/step-1` | `WtrStep1` | Yes | Coordinator | None (reads from AdminSetupContext) |
| `/admin/wtr/step-2` | `WtrStep2` | Yes | Coordinator | None (reads from AdminSetupContext) |
| `/admin/wtr/step-3` | `WtrStep3` | Yes | Coordinator | None (reads from AdminSetupContext) |
| `/admin/wtr/step-4` | `WtrStep4` | Yes | Coordinator | None (reads from AdminSetupContext), saves to `wtr_settings` |
| `/admin/roster` | `Roster` | Yes | Coordinator | `doctors` table, `rota_configs.survey_deadline` |
| `/admin/pre-rota-calendar` | `PreRotaCalendarPage` | Yes | Coordinator | `pre_rota_results`, `shift_types`, `bank_holidays`, `doctor_survey_responses`, `account_settings` |
| `/admin/pre-rota-targets` | `PreRotaTargetsPage` | Yes | Coordinator | `pre_rota_results`, `rota_configs`, `account_settings` |
| `/admin/survey-override/:doctorId/:step` | `SurveyOverride` | Yes | Coordinator | Via SurveyProvider token resolution |
| `/doctor/survey` | `Survey` | No | Doctor | Resolves `?token=` param → `doctors` + `rota_configs` + `doctor_survey_responses` + `account_settings` |
| `/audit` | `Audit` | No | Any | Renders `src/docs/app-audit.md` |
| `*` | `NotFound` | No | Any | None |

---

## 4. COMPONENTS

### Layout Components

| File | Description | Hooks/Queries | Imports |
|------|------------|---------------|---------|
| `src/components/AdminLayout.tsx` | Admin page shell with sidebar nav (desktop) and bottom nav (mobile), logout button | `useAuth`, `useIsMobile`, `useLocation`, `useNavigate` | `NavLink`, lucide icons |
| `src/components/DoctorLayout.tsx` | Mobile phone frame wrapper for doctor-facing survey pages | None | None |
| `src/components/NavLink.tsx` | Wrapper around React Router's `NavLink` with active class support | None | `react-router-dom` |

### Feature Components

| File | Description | Hooks/Queries | Imports |
|------|------------|---------------|---------|
| `src/components/SurveyConfirmation.tsx` | Post-submission confirmation screen showing doctor name, rota dates, submission time | None | `date-fns`, `SurveyDoctorInfo`/`SurveyRotaInfo` types |
| `src/components/SurveyResponsePanel.tsx` | Admin slide-over panel for viewing/editing a doctor's survey responses | `useState`, `useEffect`, supabase client | Sheet, Input, Textarea, Switch, Badge |

### Page Components

| File | Description | Hooks/Queries | Imports |
|------|------------|---------------|---------|
| `src/pages/Index.tsx` | Redirects to `/admin/dashboard` | None | `Navigate` |
| `src/pages/Login.tsx` | Login form with username/password fields and dev quick login | `useAuth`, `useNavigate` | Input, Button, Card |
| `src/pages/NotFound.tsx` | 404 page | `useLocation` | None |
| `src/pages/admin/Dashboard.tsx` | Main dashboard with department/hospital settings, setup progress tracker, generation buttons | `useAdminSetup`, `useRotaContext`, `useAuth`, `loadAccountSettings`, supabase queries | AdminLayout, Input, Button, Skeleton, Tooltip, lucide icons |
| `src/pages/admin/DepartmentStep1.tsx` | Shift type editor with expandable cards for each shift | `useDepartmentSetup`, `useNavigate` | AdminLayout, Input, Label, Checkbox, lucide icons |
| `src/pages/admin/DepartmentStep2.tsx` | Distribution target editor with draggable percentage bars and global on-call split | `useAdminSetup`, `useDepartmentSetup`, `useRotaContext`, `useAuth`, supabase client | AdminLayout, Input, Label, Button, lucide icons |
| `src/pages/admin/Roster.tsx` | Doctor roster management: add/remove doctors, send survey invites, view responses | `useRotaContext`, `useAuth`, `useNavigate`, supabase client, supabase functions | AdminLayout, Input, Button, Card, Table, Badge, Calendar, Popover, Tooltip, SurveyResponsePanel |
| `src/pages/admin/RotaPeriodStep1.tsx` | Date picker for rota start/end dates and times | `useAdminSetup`, `useNavigate` | AdminLayout, Calendar, Popover, Input, Card |
| `src/pages/admin/RotaPeriodStep2.tsx` | Bank holidays manager (auto-populated UK holidays + custom) | `useAdminSetup`, `useRotaContext`, `useAuth`, supabase client | AdminLayout, Calendar, Popover, Card, Input |
| `src/pages/admin/WtrStep1.tsx` | WTR hours & limits config (max avg weekly, max in 7 days) | `useAdminSetup`, `useNavigate` | AdminLayout, Input, Label |
| `src/pages/admin/WtrStep2.tsx` | Consecutive shift limits config | `useAdminSetup`, `useNavigate` | AdminLayout, Button |
| `src/pages/admin/WtrStep3.tsx` | Rest periods & weekend frequency config | `useAdminSetup`, `useNavigate` | AdminLayout, Input, Label |
| `src/pages/admin/WtrStep4.tsx` | On-call rules display (read-only) + final WTR save | `useAdminSetup`, `useRotaContext`, `useAuth`, supabase client | AdminLayout, Button |
| `src/pages/admin/SurveyOverride.tsx` | Admin override wrapper for doctor survey steps | `useParams` | SurveyModeProvider, SurveyStep1-6 |
| `src/pages/doctor/Survey.tsx` | Doctor survey wrapper with token resolution and step routing | `useSearchParams` | DoctorLayout, SurveyProvider, SurveyConfirmation, SurveyStep1-6 |
| `src/pages/doctor/SurveyStep1.tsx` | Personal details step (name, email, grade, specialty) | `useSurveyContext`, `useSurveyMode` | DoctorLayout, Input |
| `src/pages/doctor/SurveyStep2.tsx` | Competencies step (IAC, Obstetric, ICU, Transfers) | `useSurveyContext`, `useSurveyMode` | DoctorLayout, Switch |
| `src/pages/doctor/SurveyStep3.tsx` | Working hours & LTFT step (WTE selection, preferred non-working days) | `useSurveyContext`, `useSurveyMode` | DoctorLayout |
| `src/pages/doctor/SurveyStep4.tsx` | Leave & availability step (annual leave, study leave, NOC dates) | `useSurveyContext`, `useSurveyMode` | DoctorLayout |
| `src/pages/doctor/SurveyStep5.tsx` | Medical details step (restrictions, pregnancy) | `useSurveyContext`, `useSurveyMode` | DoctorLayout |
| `src/pages/doctor/SurveyStep6.tsx` | Final step (specialties, interests, confirmation checkbox, submit) | `useSurveyContext`, `useSurveyMode`, `useNavigate` | DoctorLayout, Checkbox |

### UI Components (shadcn/ui)

All located in `src/components/ui/`:

`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`

---

## 5. HOOKS & QUERIES

| Hook | File | Description | Tables Queried | Parameters | Returns |
|------|------|------------|----------------|------------|---------|
| `useIsMobile` | `src/hooks/use-mobile.tsx` | Detects viewport < 768px | None | None | `boolean` |
| `useRotaConfig` | `src/lib/rotaConfig.ts` | Fetches the current user's rota config | `rota_configs`, `shift_types`, `bank_holidays`, `wtr_settings` | None (uses `useAuth` internally) | `{ config, loading, error, refresh }` |
| `use-toast` | `src/hooks/use-toast.ts` | Toast notification state manager | None | None | Toast API |

### Standalone Async Functions (not hooks, but used as queries)

| Function | File | Description | Tables |
|----------|------|------------|--------|
| `getRotaConfig(id)` | `src/lib/rotaConfig.ts` | Fetches full config by ID (config + shifts + holidays + WTR) | `rota_configs`, `shift_types`, `bank_holidays`, `wtr_settings` |
| `getCurrentRotaConfig(username)` | `src/lib/rotaConfig.ts` | Finds the most recent config for a user | `rota_configs` → then `getRotaConfig` |
| `loadAccountSettings(username)` | `src/contexts/AuthContext.tsx` | Fetches department/trust name for a user | `account_settings` |
| `buildPreRotaInput(configId)` | `src/lib/rotaGenInput.ts` | Builds structured input for pre-rota generation | via `getRotaConfig` |
| `buildFinalRotaInput(configId)` | `src/lib/rotaGenInput.ts` | Builds structured input for final rota generation including doctor preferences | via `getRotaConfig` + `doctor_survey_responses` |
| `getSurveyResponsesForConfig(configId)` | `src/lib/rotaGenInput.ts` | Fetches all survey responses for a config | `doctor_survey_responses` |
| `buildSurveyLink(token)` | `src/lib/surveyLinks.ts` | Constructs survey URL from token | None |
| `getSurveyLinkForDoctor(doctorId)` | `src/lib/surveyLinks.ts` | Fetches token and builds link | `doctors` |

---

## 6. CONTEXT & STATE

### `RotaContext` — `src/contexts/RotaContext.tsx`

**Data held:**
- `currentRotaConfigId: string | null` — Active rota config ID (persisted to sessionStorage)
- `restoredConfig: RotaConfig | null` — Full deserialized config from DB

**Provider:** `RotaProvider` (wraps entire app in `App.tsx`)

**Consumers:** `AuthContext`, `AdminSetupContext`, `DepartmentSetupContext`, `Dashboard`, `DepartmentStep2`, `RotaPeriodStep2`, `WtrStep4`, `Roster`

---

### `AuthContext` — `src/contexts/AuthContext.tsx`

**Data held:**
- `user: AuthUser | null` — Logged-in user (username, email, role, displayName)
- `accountSettings: AccountSettings` — Department name, trust name
- `login()`, `logout()` functions

**Provider:** `AuthProvider` (wraps routes in `App.tsx`)

**Consumers:** `Login`, `AdminLayout`, `Dashboard`, `DepartmentStep2`, `RotaPeriodStep2`, `WtrStep4`, `Roster`

**Note:** Uses hardcoded credentials (`developer1` / `developer1`). Does not use Supabase Auth.

---

### `AdminSetupContext` — `src/contexts/AdminSetupContext.tsx`

**Data held:**
- Setup completion flags: `isDepartmentComplete`, `isWtrComplete`, `isPeriodComplete`, `areSurveysDone`
- Rota dates: `rotaStartDate`, `rotaEndDate`
- WTR values: `maxAvgWeekly`, `maxIn7Days`, `maxConsecDays`, `maxConsecLong`, `maxConsecNights`, `restPostNights`, `restPostBlock`, `restAfter7`, `weekendFreq`
- `restoredFromDb` flag

**Provider:** `AdminSetupProvider` (wraps routes in `App.tsx`)

**Consumers:** `Dashboard`, `DepartmentStep2`, `RotaPeriodStep1`, `RotaPeriodStep2`, `WtrStep1-4`

---

### `DepartmentSetupContext` — `src/contexts/DepartmentSetupContext.tsx`

**Data held:**
- `shifts: ShiftType[]` — Shift type definitions
- `expandedShiftId: string | null` — Currently expanded shift card
- `globalOncallPct: number` — Global on-call percentage
- `shiftTargetOverrides: Record<string, number | undefined>` — Per-shift target overrides

**Provider:** `DepartmentSetupProvider` (wraps routes in `App.tsx`)

**Consumers:** `DepartmentStep1`, `DepartmentStep2`

---

### `SurveyContext` — `src/contexts/SurveyContext.tsx`

**Data held:**
- `loadState`, `errorMessage` — Token resolution state
- `doctor: SurveyDoctorInfo | null`, `rotaInfo: SurveyRotaInfo | null`
- `formData: SurveyFormData` — All survey responses (25+ fields)
- `currentStep: number` — Current wizard step (1-6)
- `submitting`, `submitError`, `draftSavedAt`, `submittedAt`
- Auto-save logic (debounced 1.5s)

**Provider:** `SurveyProvider` (wraps `SurveyInner` in `Survey.tsx`)

**Consumers:** `SurveyStep1-6`, `SurveyInner`

---

### `SurveyModeContext` — `src/contexts/SurveyModeContext.tsx`

**Data held:**
- `isAdminMode: boolean`
- `doctorId`, `doctorName`, `doctorEmail`

**Provider:** `SurveyModeProvider` (wraps survey steps in `SurveyOverride.tsx`)

**Consumers:** `SurveyStep1-6`

---

## 7. API INTEGRATIONS

### Resend (Email Service)

- **Service:** Resend
- **Configuration:** `RESEND_API_KEY` stored as a Supabase Edge Function secret
- **Called by:** `send-survey-invite` Edge Function
- **Purpose:** Sends survey invitation emails to doctors with a link to complete their preference survey
- **Sender:** `onboarding@resend.dev` (Resend default sandbox sender)

---

## 8. EDGE FUNCTIONS

### `send-survey-invite`

- **Path:** `supabase/functions/send-survey-invite/index.ts`
- **HTTP Method:** POST
- **Description:** Receives doctor details, rota period info, department/hospital names, deadline, and survey link. Constructs an HTML email using Resend and sends it to the doctor's email address.
- **Request body:**
  ```json
  {
    "to": "doctor@nhs.net",
    "doctorName": "Dr. Jane Smith",
    "rotaPeriod": { "startDate": "01 Apr 2026", "endDate": "30 Jun 2026", "durationWeeks": 13 },
    "departmentName": "Anaesthetics",
    "hospitalName": "Manchester University NHS FT",
    "surveyDeadline": "Friday, 20 March 2026",
    "surveyLink": "https://rotagen-ai.lovable.app/doctor/survey?token=abc-123"
  }
  ```
- **Returns:** `{ "success": true }` or `{ "success": false, "error": "..." }`
- **CORS:** Enabled for all origins

---

## 9. STORAGE

No storage buckets configured.

---

## 10. ENUMS & TYPES

### Database Enums

#### `app_role`
- **Values:** `'admin'`, `'doctor'`
- **Used in:** `user_roles.role` column, `has_role()` function

### TypeScript Types & Interfaces

#### `RotaConfig` — `src/lib/rotaConfig.ts`
Full deserialized rota configuration including department info, rota period, shifts, distribution targets, and WTR settings. Used throughout the admin setup flow.

#### `RotaConfigShift` — `src/lib/rotaConfig.ts`
Single shift definition with timing, badges, staffing, and badge overrides. Used within `RotaConfig.shifts`.

#### `ShiftType` — `src/contexts/DepartmentSetupContext.tsx`
In-memory shift type used during department setup editing. Includes `applicableDays`, `badges`, `badgeOverrides`, `staffing`, `oncallManuallySet`.

#### `ShiftBadges` — `src/contexts/DepartmentSetupContext.tsx`
Badge flags: `night`, `long`, `ooh`, `weekend`, `oncall`, `nonres`.

#### `BadgeKey` — `src/contexts/DepartmentSetupContext.tsx`
`keyof ShiftBadges` — union of badge names.

#### `ShiftStaffing` — `src/contexts/DepartmentSetupContext.tsx`
`{ min: number; max: number | null }`

#### `ApplicableDays` — `src/lib/shiftUtils.ts`
`{ mon: boolean; tue: boolean; ... sun: boolean }`

#### `DaysPreset` — `src/lib/shiftUtils.ts`
`'weekday' | 'weekend' | 'ext_weekend' | 'any' | 'custom'`

#### `SurveyFormData` — `src/contexts/SurveyContext.tsx`
Comprehensive 35+ field interface covering all 6 survey steps. Maps directly to `doctor_survey_responses` columns.

#### `SurveyDoctorInfo` — `src/contexts/SurveyContext.tsx`
`{ id, firstName, lastName, email, grade, rotaConfigId }`

#### `SurveyRotaInfo` — `src/contexts/SurveyContext.tsx`
`{ startDate, endDate, durationWeeks, departmentName, trustName, surveyDeadline }`

#### `AuthUser` — `src/contexts/AuthContext.tsx`
`{ username, email, role, displayName }`

#### `AccountSettings` — `src/contexts/AuthContext.tsx`
`{ departmentName: string | null; trustName: string | null }`

#### `PreRotaInput` — `src/lib/rotaGenInput.ts`
Structured input for pre-rota data generation. Contains period, shift slots with targets, WTR constraints, and distribution targets.

#### `FinalRotaInput` — `src/lib/rotaGenInput.ts`
Extends `PreRotaInput` with per-doctor constraints (leave, exemptions, fairness targets) and hard/soft constraint lists.

#### `DoctorPreference` — `src/lib/rotaGenInput.ts`
Per-doctor preference data derived from survey responses.

#### `DoctorSurveyResponse` — `src/lib/rotaGenInput.ts`
Maps to `doctor_survey_responses` table row.

#### `Doctor` — `src/pages/admin/Roster.tsx`
Local interface matching `doctors` table row.

---

## 11. NAVIGATION & LAYOUT

### Coordinator View (AdminLayout)

**Sidebar nav (desktop) / Bottom nav (mobile):**

| Item | URL | Icon |
|------|-----|------|
| Dashboard | `/admin/dashboard` | `LayoutDashboard` |
| Rota Period | `/admin/rota-period/step-1` | `CalendarDays` |
| Department | `/admin/department/step-1` | `Settings` |
| WTR | `/admin/wtr/step-1` | `Stethoscope` |
| Roster | `/admin/roster` | `Users` |

**Header:** Shows page title, subtitle, username, and "Sign out" button.

### Doctor View (DoctorLayout)

No navigation. The layout renders a centered mobile phone frame (max-w-md, h-844px, rounded corners). Survey steps use step-internal back/next buttons.

### Role-Based Routing

The `ProtectedRoute` component in `App.tsx` checks `useAuth().isAuthenticated`. If not authenticated, redirects to `/login`.

The doctor survey route (`/doctor/survey`) is **not** protected — it uses token-based access via the `?token=` query parameter.

There is no role differentiation in the route guard — all authenticated users are treated as coordinators. The `role` field on `AuthUser` is set to `"coordinator"` but is not checked anywhere.

---

## 12. CURRENT STATE SUMMARY

### Counts

| Metric | Count |
|--------|-------|
| Database tables | 8 (`account_settings`, `bank_holidays`, `doctor_survey_responses`, `doctors`, `profiles`, `rota_configs`, `shift_types`, `user_roles`, `wtr_settings`) |
| Routes | 15 (including catch-all) |
| Page components | 19 |
| Layout components | 3 |
| Feature components | 2 |
| UI components (shadcn) | 48 |
| Custom hooks | 3 (`useIsMobile`, `useRotaConfig`, `use-toast`) |
| Contexts | 5 |
| Edge Functions | 1 |
| Library/utility files | 4 (`rotaConfig.ts`, `rotaGenInput.ts`, `shiftUtils.ts`, `surveyLinks.ts`) |

### Partially Built Features

1. **Phase 1 / Phase 2 generation buttons** on Dashboard — UI exists with "Generate Pre-Rota Data" and "Generate Final Rota" buttons, but `onClick` handlers are empty (`() => {}`). No generation logic is implemented.

2. **Survey Steps 2-5 (doctor-facing)** — UI is rendered with hardcoded/static data. Steps 2 (Competencies), 3 (Working Hours), 4 (Leave), and 5 (Medical) display placeholder content with uncontrolled inputs. Form state changes do not consistently flow back to `SurveyContext.formData`.

3. **SurveyOverride** — Uses a hardcoded `doctorLookup` with only 3 doctors (IDs "1", "2", "3"). Does not query the actual `doctors` table.

4. **`profiles` table** — Created via the `handle_new_user()` trigger function but never queried by the application. RLS policies reference `auth.uid()` but the app uses mock auth.

5. **`user_roles` table** — Schema exists with proper RLS policies referencing `has_role()`, but no application code reads or writes to this table.

### Gaps & Issues

1. **`handle_new_user` trigger** — The function exists but no trigger attachment is visible in the database metadata. May be attached to `auth.users` (reserved schema) or may be orphaned.

2. **No Supabase Auth integration** — The app uses hardcoded credentials (`developer1` / `developer1`) stored in source code. The `AuthContext` does not use Supabase Auth sessions. All database RLS policies are set to `true` (public access) to work around this.

3. **Survey form data binding** — Steps 2-5 use uncontrolled HTML inputs (`defaultChecked`, native `<input>` elements) rather than binding to `SurveyContext.setField()`. Data entered on these steps may not be saved to the database.

4. **Missing `VITE_APP_URL` environment variable** — `buildSurveyLink()` falls back to `window.location.origin`, which works in the preview but may not generate correct production URLs.

5. **Email sender** — Uses `onboarding@resend.dev` (Resend sandbox). Production deployment would need a custom sending domain.

6. **No test coverage** — `src/test/example.test.ts` exists but contains only a placeholder test. No component, integration, or E2E tests.

7. **`rota_configs.department_name` and `rota_configs.trust_name`** — These columns exist on `rota_configs` but the app uses the separate `account_settings` table for department/trust names. The `rota_configs` columns default to empty strings and are not updated from the setup flow.

8. **Unused shadcn components** — Many UI components are installed but not imported anywhere: `aspect-ratio`, `avatar`, `breadcrumb`, `carousel`, `chart`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `sidebar`, `slider`, `tabs`, `toggle`, `toggle-group`.
