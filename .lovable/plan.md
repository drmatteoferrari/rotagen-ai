

## Plan: Fix Double-Click/Double-Tap Navigation in PreRotaCalendarPage

### Problem
Double-clicking a calendar cell to navigate to a doctor's calendar is unreliable. There's no native `onDoubleClick` handler for desktop, and the tap-based detection can conflict with single-click panel logic.

### Changes (single file: `src/pages/admin/PreRotaCalendarPage.tsx`)

**1. Add a dedicated `handleDoubleTap` helper**

Create a new function that navigates immediately and clears state to prevent panel glitches:

```ts
const handleDoubleTap = (doctorId: string, date: string) => {
  lastTapRef.current = null;
  setPanelOpen(false);
  setSelectedCell(null);
  navigate(`/admin/doctor-calendar/${doctorId}?date=${date}&view=day`);
};
```

**2. Refactor `handleCellTap` to use a delayed single-click**

When a first tap is detected, use `setTimeout(200ms)` to delay the single-click panel logic. If a second tap arrives within 500ms, clear the timeout and call `handleDoubleTap` instead. This prevents the panel from opening/closing on double-tap. Store the timeout ID in a new ref (`singleTapTimerRef`).

```ts
const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleCellTap = (doctorId: string, date: string) => {
  const now = Date.now();
  const last = lastTapRef.current;

  if (last && last.doctorId === doctorId && last.date === date && now - last.time < 500) {
    // Double-tap detected
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    handleDoubleTap(doctorId, date);
    return;
  }

  lastTapRef.current = { doctorId, date, time: now };

  if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
  singleTapTimerRef.current = setTimeout(() => {
    // Single-tap logic (open/close panel)
    if (selectedCell?.doctorId === doctorId && selectedCell?.date === date && panelOpen) {
      setPanelOpen(false);
      setSelectedCell(null);
    } else {
      setSelectedCell({ doctorId, date });
      setPanelOpen(true);
      setModalOpen(false);
    }
  }, 200);
};
```

**3. Add `onDoubleClick` to all three view cells**

Add native `onDoubleClick` handler alongside existing `onClick` at each cell location:

- **Day view** (~line 1093): Add `onDoubleClick={() => handleDoubleTap(doctor.doctorId, currentDate)}` to the wrapper `<div>`.
- **Week view** (~line 1170): Add `onDoubleClick={() => handleDoubleTap(doctor.doctorId, date)}` to the `<td>`.
- **Month view** (~line 1217): Add `onDoubleClick={() => { if (inRota && inMonth) handleDoubleTap(doctor.doctorId, date); }}` to the `<td>`.

This gives desktop users native, 100% reliable double-click detection independent of the tap timer logic.

### Technical notes
- The 200ms single-tap delay is imperceptible but gives enough buffer to detect double-clicks before committing to panel state changes.
- The native `onDoubleClick` fires independently of `handleCellTap`, so desktop double-clicks work even if the timer logic has edge cases.
- `handleDoubleTap` clears panel state before navigating to prevent any flash of the detail panel.

