

## Plan: Add DEV TOOLS Banner to `/admin/roster`

### Overview
Add a development tools banner at the top of the Roster page with two buttons:
1. **Fill All Surveys** - Generates realistic fake survey data for all doctors
2. **Cancel All Surveys** - Clears all survey responses and resets doctor statuses

### File to Modify
`src/pages/admin/Roster.tsx`

---

### Section 1: DEV TOOLS Banner UI

Add at the very top of the component's return JSX (inside `<AdminLayout>`, before the deadline picker card):

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ⚙️ DEV TOOLS — not visible in production                           │
│ ┌────────────────────┐   ┌────────────────────┐                    │
│ │ 🧪 Fill All Surveys│   │ 🗑️ Cancel All Surveys│                   │
│ │    (amber)         │   │    (red/rose)       │                    │
│ └────────────────────┘   └────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

- Amber/yellow background (`bg-amber-50 border-amber-200`)
- Both buttons show `<Loader2>` spinner when their operation is running
- Disabled state during operation

---

### Section 2: State Variables

Add two loading states:
- `fillingAll: boolean` - true while Fill All Surveys is running
- `cancellingAll: boolean` - true while Cancel All Surveys is running

---

### Section 3: `handleFillAllSurveys()` Implementation

1. **Get config ID** from localStorage (`currentRotaConfigId` key - matching RotaContext storage key)
2. **Fetch rota_configs row** to get `rota_start_date` and `rota_end_date`
3. **Fetch all doctors** for this rota_config_id
4. **Generate payloads** using the exact grade-based logic provided in the task spec:
   - Grade mapping for junior/mid/senior determines competencies, exemptions, preferences
   - Random leave blocks within rota period
   - WTE distribution (88% full-time, 12% LTFT)
5. **Upsert to doctor_survey_responses** using `onConflict: 'doctor_id,rota_config_id'`
6. **Update doctors table** - set `survey_status = 'submitted'`, `survey_submitted_at = now()`
7. **Refresh UI** via existing `loadDoctors()` callback
8. **Toast** success or error

---

### Section 4: `handleCancelAllSurveys()` Implementation

1. **Get config ID** from localStorage
2. **Delete from doctor_survey_responses** where `rota_config_id` matches
3. **Update doctors** - set `survey_status = 'not_started'`, `survey_submitted_at = null`
4. **Refresh UI** via `loadDoctors()`
5. **Toast** success or error

---

### Technical Details

**Storage key correction**: Task says sessionStorage but the app uses localStorage with key `"currentRotaConfigId"` (see RotaContext line 26). Will use localStorage to match existing behavior.

**Helper functions** (defined inside component):
```typescript
const juniorGrades = ['CT1', 'CT2', 'ACCS CT1', 'ACCS CT2'];
const midGrades = ['CT3', 'ACCS CT3', 'ST4', 'ST5'];
const seniorGrades = ['ST6', 'ST7', 'ST8', 'ST9', 'SAS', 'Post-CCT Fellow', 'Consultant'];

const isJunior = (g: string) => juniorGrades.some(x => g.includes(x));
const isMid = (g: string) => midGrades.some(x => g.includes(x));
const isSenior = (g: string) => seniorGrades.some(x => g.includes(x));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomLeaveBlock = (rotaStart: string, rotaEnd: string, lengthDays: number) => { ... };
```

**Existing imports used**: `supabase`, `toast`, `Loader2`, `Button`

**No new dependencies required** - all logic is pure TypeScript

---

### Completion Checklist
- [ ] Banner renders at top with amber styling
- [ ] Fill button upserts realistic data per doctor
- [ ] status='submitted' and submitted_at set on all rows
- [ ] survey_status='submitted' set on doctors table
- [ ] Cancel button deletes all survey responses
- [ ] Reset survey_status='not_started' and survey_submitted_at=null
- [ ] UI refreshes after both operations
- [ ] Loading states and toasts functional
- [ ] No other files modified

