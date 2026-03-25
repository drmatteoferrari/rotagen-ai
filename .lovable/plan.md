

## Plan: Replace PreRotaTargetsPage.tsx

Single file replacement — `src/pages/admin/PreRotaTargetsPage.tsx`.

### What changes
- **Full rewrite** of the targets page with the exact code provided in the prompt
- **Mobile view**: Accordion cards per doctor (collapsed by default), team summary block
- **Desktop view**: Scrollable table with sticky doctor column, Notes popover for leave breakdown, Team Total/Average rows
- **Reference panel**: Collapsible panel using `computeShiftTargets` with custom WTE input
- **LeaveNotes component**: Popover (desktop) or inline block (mobile) showing leave deduction breakdown
- **Removed**: `useMemo`, `BarChart3`, `ComputeShiftTargetsResult` type, `displayContractedHours`, `loadError` state, `hardWeeklyCap` destructuring
- **Added**: `LeaveNotes`, `DoctorCard`, `ReferenceTargetsPanel` inline components
- **Navigation**: Back button points to `/admin/pre-rota`
- **AdminLayout**: `accentColor="green"` on all three usages
- **Safety**: All `leaveSummary` reads use optional chaining

### Files modified
- `src/pages/admin/PreRotaTargetsPage.tsx` — full replacement

### No other changes
No routes, no migrations, no other files touched.

