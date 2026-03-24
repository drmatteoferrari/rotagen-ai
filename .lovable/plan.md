

## Plan: Add tap interaction, EventDetailPanel, AddEventModal, and DB writes

### Overview
Add cell tap interaction to both calendar pages, opening an EventDetailPanel for viewing override details and an AddEventModal for creating/editing/copying overrides. Two new components created, two existing pages updated.

### Files

**1. Create `src/components/calendar/EventDetailPanel.tsx`**
- Displays merged cell details: event label, doctor name, formatted date, source (coordinator override vs doctor survey)
- For coordinator overrides: Edit, Copy, Delete buttons; shows "Changed from X → Y" for modifications, note, created date
- For survey events: "Add override" and "Remove event" buttons
- For available cells: "Add event" button
- For deleted cells: "Remove this override" button
- Close button in header

**2. Create `src/components/calendar/AddEventModal.tsx`**
- Fixed bottom sheet modal (max-width 480px, backdrop click to close)
- Event type pill selector (AL/SL/NOC/ROT/PL)
- Start/end date inputs with validation (required, end ≥ start, within rota period)
- Optional note field
- Supports three modes via props: new add (dates pre-filled), edit (all pre-filled), copy (type pre-filled, dates blank)
- Saving state disables button, shows "Saving…"

**3. Update `src/pages/admin/DoctorCalendarPage.tsx`**
- Import EventDetailPanel and AddEventModal
- Add interaction state: selectedDate, panelOpen, modalOpen, modalSaving, modalPrefill, modalCopyFrom, modalInitialDate
- Add write helpers: `reloadOverrides`, `handleSaveOverride` (insert for add, delete+insert for edit), `handleDeleteOverride` (hard delete), `handleRemoveSurveyEvent` (insert action:'delete'), `handleCellTap` (toggle panel)
- Remove dead `cell` variable from MonthView (line 423)
- WeekView: add onClick + blue outline to data cells
- DayView: add "+ Override" button next to date heading
- Render panel and modal after view content, before closing div

**4. Update `src/pages/admin/PreRotaCalendarPage.tsx`**
- Import EventDetailPanel and AddEventModal
- Add interaction state: selectedCell (doctorId+date), panelOpen, modalOpen, modalSaving, modalPrefill, modalCopyFrom, modalInitialDate
- Add write helpers: same pattern as DoctorCalendarPage but with selectedCell.doctorId, rotaConfigId
- Week view: add onClick + blue outline to doctor data cells (line ~743)
- Day view: add onClick + blue outline/highlight to doctor rows (line ~926)
- Render panel and modal after day view block, before month placeholder

### Technical details
- All DB writes use `supabase.auth.getUser()` for `created_by`
- Edit = hard delete old row + insert new with action:'modify'
- Delete coordinator override = hard delete
- Remove survey event = insert action:'delete' (soft delete, preserves audit trail)
- `reloadOverrides()` called after every write to refresh merged availability
- Panel and modal close + selection clears after every successful write
- MonthView in DoctorCalendarPage still navigates to day view on tap (no panel)

### Files touched
| File | Action |
|------|--------|
| `src/components/calendar/EventDetailPanel.tsx` | Create |
| `src/components/calendar/AddEventModal.tsx` | Create |
| `src/pages/admin/DoctorCalendarPage.tsx` | Edit |
| `src/pages/admin/PreRotaCalendarPage.tsx` | Edit |

