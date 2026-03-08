# RotaGen — Application Audit

## CHANGELOG

| Date | Sections Updated | Summary of Changes |
|------|-----------------|-------------------|
| 2026-03-08 | Sections 1, 10, 12 | Audit v4: fixed .single()→.maybeSingle() in preRotaGenerator; added missing fields to DoctorSurveyResponse interface; removed all `as any` casts on pre_rota_results queries; fixed competency validation to use competencies_json; updated remaining issues list |
| 2026-03-08 | Sections 1–3, 10–11 | Audit v3: re-verified v1+v2 fixes; WTR UI checked; new audit of rota_configs persistence, bank_holidays storage, account_settings independence, survey token flow, downstream consumers, accent colour consistency, TypeScript safety, navigation |
| 2026-03-05 | All | Initial audit generated |

---

## 1. DATABASE SCHEMA

### Table: `account_settings`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | No | `gen_random_uuid()` | PRIMARY KEY |
| owned_by | text | No | — | UNIQUE (added v4) |
| department_name | text | Yes | — | |
| trust_name | text | Yes | — | |
| created_at | timestamptz | Yes | `now()` | |
| updated_at | timestamptz | Yes | `now()` | |

**Foreign Keys:** None

**Unique Constraints:** `owned_by` (added Section 8 fix)

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
- `currentRotaConfigId: string | null` — Active rota config ID (persisted to localStorage, verified against DB on load)
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

[Unchanged since last audit — verified clean]

#### Additional types added since v2:

#### `PreRotaResult` — `src/lib/preRotaTypes.ts`
Full pre-rota generation result including status, validation issues, calendar data, targets data, and staleness flag.

#### `PreRotaStatus` — `src/lib/preRotaTypes.ts`
`'blocked' | 'complete_with_warnings' | 'complete'`

#### `ValidationIssue` — `src/lib/preRotaTypes.ts`
`{ severity, code, doctorId, doctorName, message, field? }`

#### `CalendarData`, `CalendarDoctor`, `CalendarCell`, `CellCode`, `CalendarWeek` — `src/lib/preRotaTypes.ts`
Calendar rendering types for the pre-rota availability calendar.

#### `TargetsData`, `DoctorTargets`, `DoctorShiftTarget`, `TeamSummaryRow` — `src/lib/preRotaTypes.ts`
Shift hour target types for the pre-rota targets table.

#### `EligibilityDoctor`, `ShiftRequirements` — `src/lib/shiftEligibility.ts`
Types for shift eligibility checking (competency and grade validation).

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

The `ProtectedRoute` component supports a `requiredRole` prop. All `/admin/*` routes require `requiredRole="coordinator"`. The doctor survey route uses token-based access.

---

## 12. CURRENT STATE SUMMARY

### Counts

| Metric | Count |
|--------|-------|
| Database tables | 9 (`account_settings`, `bank_holidays`, `doctor_survey_responses`, `doctors`, `pre_rota_results`, `profiles`, `rota_configs`, `shift_types`, `user_roles`, `wtr_settings`) |
| Routes | 18 (including catch-all) |
| Page components | 22 |
| Layout components | 3 |
| Feature components | 2 |
| UI components (shadcn) | 48 |
| Custom hooks | 3 (`useIsMobile`, `useRotaConfig`, `use-toast`) |
| Contexts | 5 |
| Edge Functions | 2 (`send-survey-invite`, `send-survey-confirmation`) |
| Library/utility files | 9 (`rotaConfig.ts`, `rotaGenInput.ts`, `shiftUtils.ts`, `surveyLinks.ts`, `preRotaGenerator.ts`, `preRotaCalendar.ts`, `preRotaTargets.ts`, `preRotaValidation.ts`, `shiftEligibility.ts`) |

### Resolved Since v2

1. **Pre-rota generation** — Fully implemented: validation engine, calendar builder, targets builder, DB persistence via `pre_rota_results` table.
2. **Doctor survey (all 7 steps)** — Fully controlled, auto-saving, teal-accented UI with debounced save and submission flow.
3. **Department setup** — Purple-accented 3-step wizard with shift type editor, competency/grade requirements, and distribution targets.
4. **Rota Period setup** — Amber-accented 2-step wizard with bank holiday management and BH rules.
5. **WTR setup** — Red-accented 4-step wizard with compliance warnings and locked on-call rules.
6. **Shift type re-hydration** — DB is single source of truth via guarded `useEffect` in `DepartmentSetupContext`.

### Remaining Issues

1. ~~**`preRotaGenerator.ts` line 46**~~ — **RESOLVED (v4):** Changed `.single()` to `.maybeSingle()`.

2. ~~**`DoctorSurveyResponse` interface**~~ — **RESOLVED (v4):** Added `parental_leave_*`, `competencies_json`, and `comp_*` fields. Removed all `as any` casts.

3. ~~**`pre_rota_results` Supabase type casting**~~ — **RESOLVED (v4):** Removed all `as any` casts; queries now use typed `.from('pre_rota_results')` and `.maybeSingle()`.

4. **No enforced max on WTR steppers** — Steppers warn but don't prevent exceeding WTR limits (e.g., `maxConsecLong` can be set above 4). May be intentional.

5. **No Supabase Auth integration** — Still uses hardcoded credentials (`developer1` / `developer1`). All RLS policies remain `true`.

6. **Email sender** — Still uses `onboarding@resend.dev` (Resend sandbox). Production deployment needs a custom domain.

7. **No test coverage** — Only placeholder test exists.

8. ~~**`rota_configs.department_name` and `rota_configs.trust_name`**~~ — **RESOLVED (Section 4):** Now synced from `account_settings` on save.
