

# 9 Admin Page Changes

## Overview
Implement 9 specific changes across the WTR wizard (steps 1-4), Rota Period wizard (steps 1-2), covering editable fields with WTR breach warnings, auto-calculations, UK bank holiday auto-population, and a complete step-4 rewrite.

---

## Change 1 -- RotaPeriodStep1: Auto-calculate rota duration

**File:** `src/pages/admin/RotaPeriodStep1.tsx`

Add a computed display below the date pickers:
- When both `startDate` and `endDate` are set, calculate `differenceInDays(endDate, startDate)` using date-fns
- If end < start, show red text: "End date must be after start date."
- Otherwise show an info box: "Rota duration: X days (Y weeks)" where weeks = (days / 7).toFixed(1)
- Render as a small rounded badge/box below the date grid, inside the CardContent

---

## Change 2 -- RotaPeriodStep2: Auto-populate UK bank holidays

**File:** `src/pages/admin/RotaPeriodStep2.tsx`

- Store the start/end dates from step 1 in a shared context or pass via URL params. Since there's no shared rota context yet, add `rotaStartDate` and `rotaEndDate` to `AdminSetupContext` with setters, and set them in Step 1 when navigating.
- Create a hardcoded list of UK England & Wales bank holidays for 2025-2027 (covers likely rota ranges): New Year's, Good Friday, Easter Monday, Early May, Spring, Summer, Christmas, Boxing Day.
- On mount in Step 2, filter holidays within the date range and initialize the `bankHolidays` state with those.
- Show a count badge at the top: "X bank holidays included in this rota period."
- Users can still delete auto-populated ones and add custom ones.

**File:** `src/contexts/AdminSetupContext.tsx` -- add `rotaStartDate`, `rotaEndDate` and their setters.

---

## Change 3 -- WtrStep1: Make Weekly Limits editable with warnings

**File:** `src/pages/admin/WtrStep1.tsx`

- Add `useState` for `maxAvgWeekly` (default 48) and `maxIn7Days` (default 72)
- Remove `disabled` and locked badges from both inputs; make them controlled inputs
- Remove the "Locked Legal Limit" badge
- Below each input, conditionally render:
  - Value < threshold: green note with checkmark
  - Value = threshold: nothing extra
  - Value > threshold: amber warning box with triangle icon

---

## Change 4 -- WtrStep1: Remove Shift Configuration section

**File:** `src/pages/admin/WtrStep1.tsx`

Delete lines 61-74 (the entire "Shift Configuration" card with the Max Shift Length input). Also remove the `Clock` import if no longer used.

---

## Change 5 -- WtrStep2: Make limits editable with warnings

**File:** `src/pages/admin/WtrStep2.tsx`

- Replace the static `limits` array with `useState` for three values: `maxConsecDays` (7), `maxConsecLong` (7), `maxConsecNights` (4)
- The +/- buttons should increment/decrement the values (min 1)
- Below each card, show conditional warning/green note based on WTR thresholds (7, 7, 4 respectively)
- Update subtitle for Long Shifts from "Requires approval if > 4" to just "Consecutive long shifts"

---

## Change 6 -- WtrStep2: Remove Local Agreement Extensions

**File:** `src/pages/admin/WtrStep2.tsx`

Delete lines 53-68 (the entire orange "Allow Local Agreement Extensions" section). Remove `Switch` and `AlertTriangle` imports if unused.

---

## Change 7 -- WtrStep3: Make Rest Requirements editable with warnings

**File:** `src/pages/admin/WtrStep3.tsx`

- Replace the static `restFields` array with three `useState` values:
  - `restPostNights` (46, WTR min 46)
  - `restPostBlock` (48, WTR min 48)
  - `restBetweenShifts` (48, WTR min 48) -- rename "Min Rest Between Shifts" to "Rest After 7 Standard Shifts"
- Make each input controlled
- Below each, conditionally render:
  - Value > min: green note
  - Value = min: nothing
  - Value < min: amber warning

---

## Change 8 -- WtrStep3: Replace Weekend Frequency control

**File:** `src/pages/admin/WtrStep3.tsx`

- Replace the radio button group with a single numeric input: "Maximum weekend frequency: 1 in [ ]"
- `useState` for `weekendFreq` (default 3)
- Validation:
  - Value = 1: red error "A frequency of 1 in 1 would mean working every weekend -- this is not permitted."
  - Value = 2: amber warning about authorisation required
  - Value >= 3: no extra message
  - Accepted range: 2-52

---

## Change 9 -- WtrStep4: Replace with read-only on-call rules

**File:** `src/pages/admin/WtrStep4.tsx`

Replace the entire card content with 4 read-only information cards. Keep the progress bar, header area, and bottom navigation (Back + Save buttons).

Each card has:
- Title, locked badge, two-column layout (Rule | Notes)
- Same border/card styling as other WTR pages

Cards are exactly as specified: Consecutive on-call periods, Day after on-call hours cap, Expected rest & shift conflict prohibition, Breaks & clinical exceptions.

---

## Technical Details

### Files Modified

| File | Changes |
|---|---|
| `src/contexts/AdminSetupContext.tsx` | Add `rotaStartDate`, `rotaEndDate` + setters |
| `src/pages/admin/RotaPeriodStep1.tsx` | Add duration calculation display, set dates in context |
| `src/pages/admin/RotaPeriodStep2.tsx` | Auto-populate UK bank holidays from context dates |
| `src/pages/admin/WtrStep1.tsx` | Editable limits with warnings, remove Shift Config section |
| `src/pages/admin/WtrStep2.tsx` | Editable +/- limits with warnings, remove Local Agreement |
| `src/pages/admin/WtrStep3.tsx` | Editable rest fields with warnings, numeric weekend freq input |
| `src/pages/admin/WtrStep4.tsx` | Complete rewrite to 4 read-only on-call rule cards |

### UK Bank Holidays Data
Hardcoded array covering 2025-2027 with name + date for each. Filtered at runtime against the rota date range. This avoids external API dependencies while covering realistic rota periods.

### Warning Component Pattern
A reusable inline pattern used across changes 3, 5, 7, 8:
- Green: `bg-green-50 border-green-200 text-green-700` with checkmark
- Amber: `bg-amber-50 border-amber-200 text-amber-700` with triangle icon
- Red: `bg-red-50 border-red-200 text-red-700` for errors

