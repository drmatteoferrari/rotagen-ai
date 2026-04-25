# Stage 3g.3a Construction Driver — Design Document

## 1. Scope and Deliverables

**In scope for Stage 3g.3a:**
- `runSingleIteration(input, matrix, floors, shuffleOrder): IterationResult` in [src/lib/finalRotaConstruction.ts](src/lib/finalRotaConstruction.ts) — currently a 20-line placeholder.
- Full wiring of night sub-passes: Phase 1 (weekend on-call nights), Phase 2 (weekday on-call nights), Phase 5 (weekend non-on-call nights), Phase 6 (weekday non-on-call nights).
- State-application contract: atomic commit of sub-pass results into mutable `DoctorState[]` (Tiling Engine Rule 23 — no mutation inside sub-passes).
- `scripts/runAlgorithm.ts` thin CLI harness invoking a single iteration and printing metrics.
- Unit test `scripts/testConstruction.ts` covering night-only fixtures.

**Out of scope (no-op stubs in 3g.3a):**
- Phase 3/4 on-call day shifts → stub returns empty results.
- Phase 7/8 non-on-call day shifts → stub returns empty.
- D35 cascade checkpoints → no-op (`finalRotaCascade.ts`, Stage 3g.4).
- Phase 9 lieu G60 → no-op (`finalRotaLieu.ts`, Stage 3g.5).
- Monte Carlo wrapping (shuffle iteration, lexicographic scoring) → deferred to Stage 3i.

**Boundary rules (carried forward):**
- No imports from `@/types/finalRota` (Note 35 — internal module).
- No React / Supabase / browser / Node globals.
- UTC-only arithmetic; never `setDate`/`getDate`.
- Driver is the sole authoritative writer of `DoctorState` (per build-guide Rule 23).

---

## 2. Phase Sequencing

Per spec v2.9 §8 (Monte Carlo iteration phases). Stage 3g.3a implements Phases 0–10 with Phases 3, 4, 7, 8, 9, and cascade as no-ops:

```
Phase 0  │ Build matrix, bucket floors, V1 guard  │ delegated to finalRotaPhase0.ts
Phase 1  │ Weekend on-call nights                  │ placeWeekendNightsForWeekend (onCallOnly=true)
Phase 2  │ Weekday on-call nights                  │ placeWeekdayNightsForWeek   (onCallOnly=true)
         │ ─── D35 cascade (post on-call nights) ──│ STUB (Stage 3g.4)
Phase 3  │ Weekend on-call day shifts              │ STUB
Phase 4  │ Weekday on-call day shifts              │ STUB
         │ ─── D35 cascade (post on-call) ─────────│ STUB
Phase 5  │ Weekend non-on-call nights              │ placeWeekendNightsForWeekend (onCallOnly=false)
Phase 6  │ Weekday non-on-call nights              │ placeWeekdayNightsForWeek   (onCallOnly=false)
         │ ─── D35 cascade (post non-on-call nights)│ STUB
Phase 7  │ Weekend non-on-call day shifts          │ STUB
Phase 8  │ Weekday non-on-call day shifts          │ STUB
         │ ─── D35 final cascade ──────────────────│ STUB
Phase 9  │ Lieu G60 commit                         │ STUB (Stage 3g.5)
Phase 10 │ Iteration metrics                        │ count unfilled, compute fairness aggregates
```

**Within-phase ordering:**

- **Weekend sub-passes (Phase 1, 5):** Iterate `getWeekendSaturdays(periodStart, periodEnd)` ordered by descending `scoreWeekendScarcity(saturdayIso, ...)` so the most constrained weekends commit first. One call to `placeWeekendNightsForWeekend` per Saturday.
- **Weekday sub-passes (Phase 2, 6):** Iterate `getWeekdayMondays(periodStart, periodEnd)` ordered so **orphaned-Sunday weeks go first** (spec §8), then by descending `scoreWeekScarcity`. Compute `residualDemand` via `computeWeeklyResidualDemand(...)` using current committed `state.assignments` after Phase 1.
- **Critical:** Phase 1 must commit before Phase 2 reads — `computeWeeklyResidualDemand` inspects committed `state.assignments` to subtract Fri/Sun nights already placed by the weekend pass. Violating this sequence yields double-counting.

**`nightShiftKey` discovery:** The driver must resolve the canonical night shift key from `input.preRotaInput.shiftSlots` by filtering entries whose `badges` include `'night'`. **Open question (§9):** if multiple night shift keys exist (e.g. `N_oncall` + `N_nononcall`), the driver must iterate per-key within each phase. See §9.

**`avgNightShiftHours` precomputation:** Driver computes once per iteration from all night `ShiftSlotEntry`s (mean of `durationHours`) and passes as the 7th arg to each sub-pass call.

---

## 3. State Application Contract

**Invariant:** Sub-passes (`placeWeekendNightsForWeekend`, `placeWeekdayNightsForWeek`) return commit intent only — they **do not mutate** `DoctorState`, `AvailabilityMatrix`, or `input`. The driver applies results atomically after each sub-pass call.

**Result shapes consumed:**

```typescript
type WeekendPlacementResult = {
  assignments: InternalDayAssignment[];
  lieuStaged: LieuStagedEntry[];              // {doctorId, date, source: 'AL'|'SL'|'LTFT'}
  restStampsByDoctor: Record<string, number>; // doctorId → Unix ms rest-until
  unfilledSlots: UnfilledSlot[];
  penaltyApplied: boolean;
  pathTaken: string;                           // e.g. '4N_MON_THU'
  orphanConsumed: boolean;
};

type WeekdayPlacementResult = WeekendPlacementResult & {
  residualBefore: number;
  residualAfter: number;
  pairPartnerDoctorId: string | null;
};
```

**Driver commit loop (per sub-pass return):**

```
for each a in result.assignments:
    ds = stateMap.get(a.doctorId)
    ds.assignments.push(a)
    ds.actualHoursByShiftType[a.shiftKey] += a.durationHours
    for each wDate in getOverlappedWeekendDates(a.shiftStartMs, a.shiftEndMs):
        if wDate not in ds.weekendDatesWorked: ds.weekendDatesWorked.push(wDate)
    if a.isNightShift:
        if a.slotLabel (date) not in ds.consecutiveNightDates: push
    if a.slotLabel (date) not in ds.consecutiveShiftDates: push
    if a.isLong: if date not in ds.consecutiveLongDates: push
    if a.isOncall: if date not in ds.oncallDatesLast7: push (with 7-day prune)
    weekKey = getWeekKey(a.shiftStartMs)
    ds.weeklyHoursUsed[weekKey] = (ds.weeklyHoursUsed[weekKey] ?? 0) + a.durationHours
    ds.bucketHoursUsed[a.isOncall ? 'oncall' : 'nonOncall'] += a.durationHours

for each [doctorId, restMs] in result.restStampsByDoctor:
    ds = stateMap.get(doctorId)
    ds.restUntilMs = max(ds.restUntilMs, restMs)   // advance only, never regress

for each entry in result.lieuStaged:
    ds = stateMap.get(entry.doctorId)
    if entry.date not in ds.lieuDatesStaged: ds.lieuDatesStaged.push(entry.date)

accumulator.unfilledSlots.push(...result.unfilledSlots)
accumulator.pathsTaken[weekendOrWeekStartIso] = result.pathTaken
```

**Gaps vs the existing reference loop in [scripts/testAlgorithm.ts:2246](scripts/testAlgorithm.ts:2246):**
The reference loop in the current test harness **only** updates `ds.assignments`, `ds.actualHoursByShiftType`, and `ds.weekendDatesWorked`. The driver must additionally:
1. Apply `restUntilMs` from `restStampsByDoctor` (otherwise B/C/F rest rules degrade).
2. Push to `lieuDatesStaged` (required for Phase 9 to find obligations).
3. Update `consecutiveNightDates`, `consecutiveShiftDates`, `consecutiveLongDates` (required for cross-block A4/C32 checks on subsequent phases).
4. Update `weeklyHoursUsed` and `bucketHoursUsed` (required for A5/E48 / F49 ceiling checks).
5. Update `oncallDatesLast7` (required for E45/E46 oncall spacing).

Stage 3g.3a must close these gaps. The reference test loop is a historical simplification — not the contract.

**`DoctorState` field ownership matrix (driver vs future stages):**

| Field                              | Written by driver (3g.3a) | Written by later stage      |
|------------------------------------|---------------------------|-----------------------------|
| `assignments`                      | ✅                         |                             |
| `restUntilMs`                      | ✅                         |                             |
| `weeklyHoursUsed`                  | ✅                         |                             |
| `consecutive*Dates`                | ✅                         |                             |
| `weekendDatesWorked`               | ✅                         |                             |
| `nightBlockHistory`                | ✅ (per completed block)   |                             |
| `oncallDatesLast7`                 | ✅                         |                             |
| `bucketHoursUsed`                  | ✅                         |                             |
| `lieuDatesStaged`                  | ✅ (stage via sub-pass)    | Phase 9 commits + clears    |
| `actualHoursByShiftType`           | ✅ (convenience)           | 3g.4 cascade (authoritative)|
| `debtCarriedForwardByShiftType`    | —                         | 3g.4 cascade                |
| `unallocatedContractualHours`      | —                         | 3g.4 cascade (Rule 4)       |

---

## 4. Monte Carlo Iteration Boundary

Stage 3g.3a exports **exactly one** public entry point:

```typescript
export function runSingleIteration(
  input: FinalRotaInput,
  matrix: AvailabilityMatrix,
  floors: BucketFloors,
  shuffleOrder: readonly string[],          // doctor IDs in MC-tiebreak order
): IterationResult;
```

It is a pure function of its inputs: given the same `(input, matrix, floors, shuffleOrder)`, it produces the same `IterationResult`. No `Math.random()` may be called from inside `runSingleIteration` or any file it reaches — all non-determinism is funnelled through `shuffleOrder`, which Stage 3i will vary per MC iteration.

**What 3g.3a does NOT do:**
- Does not iterate Monte Carlo trials.
- Does not compute Tier 1/2/3 lexicographic scores.
- Does not pick a best iteration.
- Does not shuffle doctors — `shuffleOrder` is received pre-shuffled.
- Does not touch workers or postMessage — no runtime boundary crossings.

Stage 3i wrapping sketch (for reference — **do not implement in 3g.3a**):
```
for trial in 0..N:
    shuffle = deriveShuffleOrder(trial, input.doctorIds)
    result = runSingleIteration(input, matrix, floors, shuffle)
    score = scoreIteration(result)   // lexicographic Tier 1/2/3
    if score beats bestScore: best = result
project(best) → DayAssignment[]      // public shape
```

**`IterationResult` shape — reconciliation:**

The existing type in [src/lib/finalRotaTypes.ts:118](src/lib/finalRotaTypes.ts:118) is minimal:

```typescript
export interface IterationResult {
  assignments: Record<string, InternalDayAssignment[]>;  // date → assignments
  doctorStates: DoctorState[];
  unfilledSlots: UnfilledSlot[];
}
```

**Recommendation:** Extend — do not replace — this interface for 3g.3a. Additions required:

```typescript
export interface IterationResult {
  assignments: Record<string, InternalDayAssignment[]>;
  doctorStates: DoctorState[];
  unfilledSlots: UnfilledSlot[];
  pathsTaken: Record<string, string>;    // NEW: weekendIso|weekStartIso → pattern label
  penaltyCount: number;                   // NEW: sum of sub-passes where penaltyApplied=true
  orphansConsumed: number;                // NEW: sum of sub-passes where orphanConsumed=true
}
```

Scoring fields (`tier1`, `tier2`, `tier3`, `totalScore`) are **not** added here — they belong to Stage 3i, which wraps this shape. Keeping the shape lean preserves the construction/scoring split.

---

## 5. `scripts/runAlgorithm.ts` Specification

Thin CLI harness for manual inspection. **Not** a test file — no assertions, prints a report.

**Invocation:**
```
npx tsx scripts/runAlgorithm.ts [fixture-name]
```
Fixture defaults to `minimalInputFullNights` from [scripts/fixtures/minimalInput.ts](scripts/fixtures/minimalInput.ts).

**Flow:**
1. Resolve fixture by name → `FinalRotaInput`.
2. Call `buildAvailabilityMatrix(input)` → matrix.
3. Call `computeBucketFloors(input)` → floors.
4. `validateBucketFloors(input, floors)` — bail with `console.error` on V1 failure.
5. Derive deterministic `shuffleOrder` = doctor IDs sorted alphabetically (for reproducibility; Stage 3i will vary).
6. `result = runSingleIteration(input, matrix, floors, shuffleOrder)`.
7. Print:
   - Total assignments count.
   - Unfilled slot count (split critical vs non-critical).
   - Night-block paths taken per weekend / week.
   - Per-doctor bucket hours used vs floor.
   - Penalty and orphan counts.

**Exit codes:**
- `0` on success (even with unfilled slots).
- `1` on V1 guard failure or thrown exception.

---

## 6. Stubs (no-op implementations in 3g.3a)

All stubs live as private functions inside `finalRotaConstruction.ts` or minimal scaffolding files. They must be explicit no-ops — never silently skipped — so Phase sequencing is visible and can be traced.

```typescript
// Day shift stubs — Stage 3g.3b
function placeWeekendOncallDayShifts(...): DayPlacementResult { return EMPTY_DAY_RESULT; }
function placeWeekdayOncallDayShifts(...): DayPlacementResult { return EMPTY_DAY_RESULT; }
function placeWeekendNonOncallDayShifts(...): DayPlacementResult { return EMPTY_DAY_RESULT; }
function placeWeekdayNonOncallDayShifts(...): DayPlacementResult { return EMPTY_DAY_RESULT; }

// Cascade stub — Stage 3g.4
function runCascadeCheckpoint(checkpoint: 'post-oc-nights' | 'post-oc' | 'post-noc-nights' | 'final', ...): void { /* no-op */ }

// Lieu stub — Stage 3g.5
function runLieuPhase9(...): LieuCommitResult { return { commits: [], unresolved: [] }; }
```

`EMPTY_DAY_RESULT` is a frozen empty object, not a `null` — downstream accumulator logic should treat "no placements" uniformly.

**Why explicit stubs, not skipping:** When Stage 3g.3b lands, adding day-shift behavior requires replacing stub bodies only — no restructure of the phase loop. This matches build-guide Rule 23's "driver orchestrates" intent.

---

## 7. Test Strategy

**New file: `scripts/testConstruction.ts`** — unit tests for `runSingleIteration`, night-only fixtures.

Test cases (minimum):

1. **`minimalInputWeekendNights`** — single weekend, on-call only. Assert: exactly the expected slot filled; `pathsTaken` contains one entry; `unfilledSlots` empty.
2. **`minimalInputWeekdayNights`** — orphaned Sunday week. Assert: `residualAfter = 0` implied by fill; path chosen is `3N_FRI_SUN` or `4N_*`; `oncallDatesLast7` updated.
3. **`minimalInputWeekdayMaxConsec3`** — LTFT doctor blocked by consecutive-3 cap. Assert: unfilled slot emitted; LTFT doctor not assigned beyond cap.
4. **`minimalInputFullNights`** — weekend + weekday, all night phases. Assert: Phase 1 commits before Phase 2 reads (sentinel: if Phase 2 tries to re-fill a Friday that Phase 1 already filled, no duplicate assignment appears).
5. **`minimalInputWeekendNightsAllLtft`** — every doctor has an LTFT constraint. Assert: at least one `penaltyApplied=true` OR a deliberate unfilled slot (penalty escalation path exercised).
6. **Determinism** — run twice with identical `shuffleOrder`; assert byte-equal `IterationResult`.
7. **State isolation** — run twice with different `shuffleOrder`; assert original `input` is unchanged (deep equality on a pre-run clone).
8. **Rest advancement** — assert `doctorState.restUntilMs` is non-regressive (never decreases across sub-pass commits).

**What is NOT tested in 3g.3a:**
- Day-shift phases (stubs return empty).
- Cascade debt accounting.
- Lieu G60 resolution.
- Monte Carlo scoring.
- Full rota run with all shift types.

**Test infrastructure:**
- Reuse `freshState(doctorId)` helper from [scripts/testAlgorithm.ts:211](scripts/testAlgorithm.ts:211) — or extract to a shared test util if duplication grows.
- Use `deepEqual` / fixture-snapshot pattern already established in `testAlgorithm.ts`.

---

## 8. Function Surface

Exports from `finalRotaConstruction.ts` after Stage 3g.3a:

```typescript
export function runSingleIteration(
  input: FinalRotaInput,
  matrix: AvailabilityMatrix,
  floors: BucketFloors,
  shuffleOrder: readonly string[],
): IterationResult;
```

Internal (not exported):
- `applyWeekendResult(state, result, accumulator): void`
- `applyWeekdayResult(state, result, accumulator): void`
- `buildDoctorStateMap(input): Map<string, DoctorState>`  // fresh states via freshState()
- `discoverNightShiftKeys(input): readonly string[]`
- `computeAvgNightShiftHours(input, keys): number`
- `runNightPhase(kind: 'weekend' | 'weekday', onCallOnly: boolean, ...)` — reduces duplication between Phase 1/2/5/6.
- `runCascadeCheckpoint(...)` — stub.
- `runLieuPhase9(...)` — stub.

`finalRotaTypes.ts` additions:
- `IterationResult.pathsTaken`, `IterationResult.penaltyCount`, `IterationResult.orphansConsumed`.
- Possibly `DayPlacementResult` type for stub signatures (even if the Stage 3g.3b shape isn't finalised, a placeholder keeps stubs strongly typed).

---

## 9. Open Questions

Flagged — do not resolve silently. Each needs user confirmation before implementation.

**Q1. Multiple night shift keys.** `discoverNightShiftKeys(input)` could return more than one key (e.g. `N_oncall` + `N_long_night`). Sub-passes accept a single `nightShiftKey` arg. Options:
- **(a)** Iterate sub-pass per key within each phase, accumulating results.
- **(b)** Pass all keys via a new sub-pass signature (requires sub-pass refactor).
- **(c)** Assert exactly one night key per input and error otherwise.
**Recommendation:** (a) — keeps sub-pass API stable.
**Blocker:** mild — affects realistic multi-rota inputs but test fixtures are single-key.

**Q2. Spec phase numbering vs prompt Section 2.** Spec §8 defines four day-shift phases (3, 4, 7, 8). The original audit prompt collapses these into two. Stage 3g.3a stubs all four regardless; the question is only labelling in the design doc and Stage 3g.3b carve-up.
**Recommendation:** follow spec — four stubs.
**Blocker:** none for 3g.3a.

**Q3. `restUntilMs` advancement semantics.** The existing test reference loop (line 2246) does **not** apply `restStampsByDoctor`. Must the driver take the `max` of existing and new (never regress), or overwrite?
**Recommendation:** `max` — rest windows extend, never shorten mid-iteration.
**Blocker:** mild — affects any doctor whose Phase 1 weekend rest overlaps into a Phase 2 weekday block.

**Q4. `IterationResult` shape extension vs replacement.** Existing `IterationResult` is consumed by no downstream code today (driver is the first producer). Adding fields is safe. Confirm no future shape conflict with Stage 3i scoring struct.
**Recommendation:** extend with optional fields; keep scoring separate.
**Blocker:** none.

**Q5. `applyWeekendResult` vs in-line mutation.** Should state application live in a named helper (easier to unit-test) or inline inside `runSingleIteration`?
**Recommendation:** helper — unit-testable, and Stage 3g.3b day shifts will reuse the same mutation logic.
**Blocker:** none.

**Q6. `nightBlockHistory` granularity.** When is a "block" considered complete for history purposes — at end of sub-pass, or at end of iteration? Spec §7 implies per-block; current sub-pass already emits `blockId`.
**Recommendation:** driver groups assignments by `blockId` at commit time; `nightBlockHistory` grows by one inner array per distinct `blockId` committed.
**Blocker:** none.

**Q7. Fixture for orphan-consumed assertion.** None of the existing fixtures cleanly exercise orphan consumption. Either add a new fixture in 3g.3a or defer assertion to 3g.3b.
**Recommendation:** defer — not critical for night-wiring correctness.
**Blocker:** none.

---

## 10. Session Split Estimate

Stage 3g.3a is one coherent session, but the work splits naturally into four commits:

| Commit                                    | LoC (rough) | Risk  |
|-------------------------------------------|-------------|-------|
| 1. Types: extend `IterationResult`        | ~10         | low   |
| 2. Driver skeleton + state-map helpers    | ~120        | low   |
| 3. Night phases (1, 2, 5, 6) + commit loop| ~250        | med   |
| 4. `runAlgorithm.ts` + `testConstruction.ts` | ~300      | low   |

**Expected driver file size:** ~400 LoC, well within maintainability targets.

**Anticipated friction:**
- Closing the five state-application gaps (§3) against existing reference tests may require either updating `testAlgorithm.ts`'s loop or accepting that the two harnesses diverge intentionally.
- Discovering `nightShiftKey` from `shiftSlots.badges` assumes fixtures tag night shifts consistently — spot-check before starting.

---

Stage 3g.3a design document complete — awaiting user approval before implementation.
