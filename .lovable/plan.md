

## Plan: Fix Navigation Boundary Layout

### Problem
Two issues cause content to hide behind navigation:
1. **Desktop `StepNavBar`** uses `fixed bottom-0` positioning, overlaying content instead of acting as a boundary. `AdminLayout` only applies `pb-6` on desktop (md+), insufficient to clear the ~52px bar.
2. **`AdminLayout`** uses a `pb-20` padding hack on mobile to try to clear the bottom nav, but since the shell already uses a proper flex layout with `shrink-0` bottom nav, this is redundant and inconsistent.

### Current Architecture (already correct)
- **AdminShell mobile/tablet**: `flex flex-col h-dvh` → header (`shrink-0`) + main (`flex-1 overflow-hidden`) + bottom nav (`shrink-0`) — correct boundary.
- **AdminShell desktop**: `flex h-dvh` → sidebar (fixed width) + content column (`flex-1 flex-col`) — correct boundary.
- **DoctorLayout**: `h-dvh flex flex-col overflow-hidden` — already correct.

### Changes

**1. `StepNavBar` — Remove `fixed` on desktop, use `shrink-0` universally**

Replace the desktop branch (currently `fixed bottom-0 left-0 right-0 z-40`) with the same `shrink-0` flex-sibling pattern used on mobile. This makes it a natural boundary in the flex column rather than an overlay.

Both mobile and desktop will render:
```tsx
<div className="shrink-0 w-full bg-card border-t border-border shadow-... px-4 py-3 flex items-center justify-between gap-3">
```

**2. `AdminLayout` — Remove `pb-20` padding hacks**

- Step pages: change `pb-20 md:pb-6` → `pb-6` (the StepNavBar is now a flex sibling, no clearance needed)
- Non-step pages: change `pb-20 md:pb-6` → `pb-6` (bottom nav is already a `shrink-0` sibling in AdminShell)

### Files changed
| File | Change |
|------|--------|
| `src/components/StepNavBar.tsx` | Remove mobile/desktop branching; single `shrink-0` layout for all sizes |
| `src/components/AdminLayout.tsx` | Remove `pb-20` hack, use consistent `pb-6` |

### Technical notes
- No changes to AdminShell or DoctorLayout — their flex structures are already correct boundaries.
- The `index.css` `body, #root` styles remain as-is (`min-height: 100dvh`).

