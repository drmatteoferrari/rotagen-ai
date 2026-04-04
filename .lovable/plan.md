

## Plan: PreRotaCalendarPage UI Polish — Sort, Legend, Summary Table, Names, and Popover

### Overview
Seven targeted changes to `src/pages/admin/PreRotaCalendarPage.tsx`. No other files. No DB changes.

### Changes

| # | Section | What changes |
|---|---------|-------------|
| 1 | **Imports** (line 11-28) | Add `ArrowUp`, `ArrowDown` to lucide import |
| 2a | **Sort reset effect** (after line 591) | Add `useEffect` that resets sort key to "name" and disables availability grouping when leaving day view |
| 2b | **Sort toolbar** (lines 1998-2014) | Replace combined `<select>` + `ArrowUpDown` icon with: a `<select>` showing only key (Name, conditionally Grade), plus a toggle `<button>` showing `ArrowUp`/`ArrowDown` |
| 3 | **Availability button** (lines 1983-1996) | Wrap with `{effectiveViewMode === "day" && ( ... )}` |
| 4 | **Legend override dot** (lines 269-275) | Remove `LeaveBadge type="SL"` from the coordinator override legend item, keep only `RotaOverrideDot` |
| 5 | **Summary table** (lines 1821-1822, 1825, 1845, 1883) | Remove horizontal scroll (`overflow-x-auto` → `overflow-hidden`), add `table-fixed`, remove `min-w-[600px]`, add `w-[18%]` to label columns |
| 6 | **Doctor names** | Week row (line 1589): `truncate` → `break-words min-w-0`, remove `shrink-0 max-w-[45%]`. Month header (line 2227): remove `truncate`. Month row (line 1681): `truncate` → `break-words whitespace-normal` |
| 7a | **Popover interface** (lines 411-421) | Add `onGoToDate` prop |
| 7b | **Popover body** (lines 504-515) | Insert "Go to date" button with `ArrowRight` icon before existing "View Doctor" button |
| 7c | **handleGoToDate** (after line 1274) | New `useCallback` that sets day view, finds correct week/day index, updates month key |
| 7d | **Popover call sites** (lines ~1561, ~1651, ~1760) | Add `onGoToDate={handleGoToDate}` to all three `<ActionButtonsPopover>` usages |

### Technical details

- **Sort reset effect** uses `effectiveViewMode` derivation logic inline: `const effectiveMode = isMobile && viewMode === "month" ? "day" : viewMode` to avoid dependency on the later-declared `effectiveViewMode` const.
- **handleGoToDate** uses `weeks` and `allDates` from existing memos in its dependency array.
- Grade option only renders when `effectiveViewMode === "day"` in the `<select>`.
- All changes are JSX/state-level only — no logic changes to data loading, saving, or navigation.

