## Supersession note

This document supersedes `STAGE_3g_3a_DESIGN_v1.md` following the audit pass on 2026-04-25. Seven substantive edits applied (A1, A2, B1, B2, B3, B4, nits C1–C5).

**Implementation landed 2026-04-25.** The driver in `src/lib/finalRotaConstruction.ts` matches §3 commit-loop semantics, §2 phase sequencing, and the Deltas applied in implementation: D1 (defensive sort by `(doctorId, shiftStartMs)` in commit helpers), D2 (`IterationResult.lieuStaged` rename — was `lieuDays`), D3 (same-day duplicate guards on the three `consecutive*Dates` reset branches), and D4 (the §3 wording fix below). Implementation also folded in a wording correction: §2's two occurrences of "descending" scarcity-score sort are corrected to "ascending" — lower score = more constrained = processed first, per `finalRotaNightBlocks.ts:571` (`scoreWeekendScarcity`) and `finalRotaNightBlocks.ts:1366` (`scoreWeekScarcity`). v2's "descending" was a wording slip; the intent ("most constrained first" / spec §8 "hardest-to-fill weeks first") matches ascending order. No structural design change.

---

# Stage 3g.3a Construction Driver — Design Document (v2)

## 1. Scope and Deliverables

**In scope for Stage 3g.3a:**
- `runSingleIteration(input, matrix, floors, shuffleOrder): IterationResult` in [src/lib/finalRotaConstruction.ts](src/lib/finalRotaConstruction.ts) — currently a 20-line placeholder.
- Full wiring of night sub-passes: Phase 1 (weekend on-call nights), Phase 2 (weekday on-call nights), Phase 5 (weekend non-on-call nights), Phase 6 (weekday non-on-call nights).
- State-application contract: atomic commit of sub-pass results into a `Map<string, DoctorState>` (Tiling Engine Rule 23 — no mutation inside sub-passes).
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

- **Weekend sub-passes (Phase 1, 5):** Iterate `getWeekendSaturdays(periodStart, periodEnd)` ordered by **ascending** `scoreWeekendScarcity(saturdayIso, ...)` so the most constrained weekends commit first. One call to `placeWeekendNightsForWeekend` per Saturday, per night shift key (see per-key iteration below). *Lower score = more constrained = processed first, per `finalRotaNightBlocks.ts:571` (`scoreWeekendScarcity`) and `finalRotaNightBlocks.ts:1366` (`scoreWeekScarcity`).*
- **Weekday sub-passes (Phase 2, 6):** Iterate `getWeekdayMondays(periodStart, periodEnd)` ordered so **orphaned-Sunday weeks go first** (spec §8), then by **ascending** `scoreWeekScarcity`. Compute `residualDemand` via `computeWeeklyResidualDemand(...)` using current committed `state.assignments` after Phase 1.
- **Critical:** Phase 1 must commit before Phase 2 reads — `computeWeeklyResidualDemand` inspects committed `state.assignments` to subtract Fri/Sun nights already placed by the weekend pass. Violating this sequence yields double-counting.

**`nightShiftKey` discovery (per-key, B1):** The driver resolves the canonical night shift keys from `input.preRotaInput.shiftSlots` by filtering entries whose `badges` include `'night'`:

```
const nightShiftKeys: readonly string[] = discoverNightShiftKeys(input);
```

When more than one key exists (e.g. a department with `N_oncall` + `N_long_night`, or distinct on-call vs non-on-call night types within a phase), the driver iterates per-key within each phase. Per Q1 resolution (option (a)), the sub-pass API is preserved unchanged: each per-key call passes a single `nightShiftKey` argument and the matching average duration. The driver accumulates results across keys into the iteration accumulator.

**`avgHoursByKey` precomputation (B1):** Driver computes once per iteration:

```
const avgHoursByKey: Record<string, number> = {};
for (const k of nightShiftKeys) {
  const slots = input.preRotaInput.shiftSlots.filter(
    s => s.shiftKey === k && s.badges.includes('night'),
  );
  avgHoursByKey[k] = mean(slots.map(s => s.durationHours));
}
```

For each per-key sub-pass call inside Phase 1/2/5/6, the driver passes `avgHoursByKey[k]` as the seventh argument (`avgNightShiftHours`) to `placeWeekendNightsForWeekend` / `placeWeekdayNightsForWeek`. A single global mean is **not** correct — different night shift types within the same input may have different durations, and sub-passes use this value for deficit normalisation in their candidate ranking.

---

## 3. State Application Contract

Throughout the driver, the working state container is `Map<string, DoctorState>` keyed by doctorId — this matches the Tiling Engine's public function signatures (`placeWeekendNightsForWeekend` and `placeWeekdayNightsForWeek` both accept `state: Map<string, DoctorState>`, lines 842 and 1452 of `finalRotaNightBlocks.ts`). The `IterationResult.doctorStates: DoctorState[]` field in the returned value is produced by projecting the Map to an array at the end of `runSingleIteration` via `Array.from(stateMap.values())`. No array-of-state exists mid-iteration.

**Invariant:** Sub-passes (`placeWeekendNightsForWeekend`, `placeWeekdayNightsForWeek`) return commit intent only — they **do not mutate** the state map, `AvailabilityMatrix`, or `input`. The driver applies results atomically after each sub-pass call.

**Result shapes consumed (A1 — locked contract from Tiling Engine):**

The exact `export interface` blocks from `src/lib/finalRotaNightBlocks.ts`. Field types and unions are authoritative; the driver must not widen, narrow, or coerce them.

```typescript
// finalRotaNightBlocks.ts:138–144
export type WeekendPathTaken =
  | 'UNIFIED_3N'
  | 'UNIFIED_2N_SATSUN_BACKWARD'
  | 'UNIFIED_2N_FRISAT_FORWARD'
  | 'RELAXATION_2N_SATSUN'
  | 'RELAXATION_2N_FRISAT'
  | 'UNFILLED';

// finalRotaNightBlocks.ts:146–158
export interface WeekendPlacementResult {
  assignments: readonly InternalDayAssignment[];
  lieuStaged: ReadonlyArray<LieuStagedEntry>;
  restStampsByDoctor: Readonly<Record<string, number>>;
  unfilledSlots: readonly UnfilledSlot[];
  penaltyApplied: number;                // unified score: dictPenalty + 1000×orphans
  pathTaken: WeekendPathTaken;
  orphanConsumed: boolean | null;        // true=consumed; false=relaxed; null=no orphan scenario
}
```
*Do not widen or relax these types in the driver — they are the locked contract from the Tiling Engine.*

```typescript
// finalRotaNightBlocks.ts:1103–1114
export type WeekdayPathTaken =
  | 'UNIFIED_4N_MON_THU'
  | 'UNIFIED_TIER15_PAIR'
  | 'UNIFIED_3N_MON_WED'
  | 'UNIFIED_3N_MON_WED_THU_ORPHAN'
  | 'UNIFIED_3N_WED_FRI'
  | 'UNIFIED_3N_WED_FRI_WITH_BACKWARD'
  | 'UNIFIED_2N_SINGLE'
  | 'UNIFIED_TIER4'
  | 'RELAXATION_PARTIAL'
  | 'SKIP_NO_RESIDUAL'
  | 'UNFILLED';

// finalRotaNightBlocks.ts:1116–1126
export interface WeekdayPlacementResult {
  assignments: readonly InternalDayAssignment[];
  lieuStaged: ReadonlyArray<LieuStagedEntry>;
  restStampsByDoctor: Readonly<Record<string, number>>;
  unfilledSlots: readonly UnfilledSlot[];
  penaltyApplied: number;                // unified score: dict + 1000×orphans
  pathTaken: WeekdayPathTaken;
  residualBefore: readonly string[];     // ISO dates of demand before this call
  residualAfter: readonly string[];      // empty iff fully placed
  pairPartnerDoctorId: string | null;    // non-null for TIER15_PAIR / WITH_BACKWARD
}
```
*Do not widen or relax these types in the driver — they are the locked contract from the Tiling Engine.*

The unified scoring model is the only score signal. `penaltyApplied` is a **number** computed as `dictPenalty + 1000 × orphans`; there is no separate boolean "penalty happened" flag in the result and the driver must not synthesise one. Counts and aggregates surfaced by the driver derive from this number plus the `pathTaken` and `orphanConsumed` enums (see §4 for the result fields).

**Driver per-assignment commit loop (per sub-pass return):**

```
for each a in result.assignments:
    ds = stateMap.get(a.doctorId)
    ds.assignments.push(a)
    ds.actualHoursByShiftType[a.shiftKey] += a.durationHours
    for each wDate in getOverlappedWeekendDates(a.shiftStartMs, a.shiftEndMs):
        if wDate not in ds.weekendDatesWorked: ds.weekendDatesWorked.push(wDate)

    // ── Semantic-A consecutive-streak updates (B2) ────────────
    D = assignmentCalendarDate(a)

    // consecutiveShiftDates: any commit advances or resets the all-shifts run.
    if ds.consecutiveShiftDates.length === 0
       or last(ds.consecutiveShiftDates) === addDaysUtc(D, -1):
        ds.consecutiveShiftDates.push(D)
    else:
        ds.consecutiveShiftDates = [D]

    // consecutiveNightDates: nights extend or reset; non-nights break the run.
    if a.isNightShift:
        if ds.consecutiveNightDates.length === 0
           or last(ds.consecutiveNightDates) === addDaysUtc(D, -1):
            ds.consecutiveNightDates.push(D)
        else:
            ds.consecutiveNightDates = [D]
    else:
        ds.consecutiveNightDates = []

    // consecutiveLongDates: same pattern, gated on the 'long' badge.
    if a.badges.includes('long'):
        if ds.consecutiveLongDates.length === 0
           or last(ds.consecutiveLongDates) === addDaysUtc(D, -1):
            ds.consecutiveLongDates.push(D)
        else:
            ds.consecutiveLongDates = [D]
    else:
        ds.consecutiveLongDates = []

    if a.isOncall:
        if D not in ds.oncallDatesLast7: push (with 7-day prune relative to D)

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
accumulator.totalPenaltyScore += result.penaltyApplied
if result.orphanConsumed === true:  accumulator.orphansConsumedCount += 1
if result.orphanConsumed === false: accumulator.orphansRelaxedCount += 1
```

**Semantic-A reset rationale (B2 — verified against `finalRotaWtr.ts`):**

The three `consecutive*Dates` arrays use Semantic A — running streak. Each array represents only the immediately-preceding consecutive run ending at the most recent committed assignment of the relevant type; the engine reads `array.length` directly without sorting or contiguity checks:

- `consecutiveLongDates.length` — read at `finalRotaWtr.ts:313` (CSA A5).
- `consecutiveShiftDates.length` — read at `finalRotaWtr.ts:330` (CSA A7) and `finalRotaWtr.ts:512` (CSB A7).
- `consecutiveNightDates.length` — read at `finalRotaWtr.ts:481` (CSB A4).

CSB then sums `prior + block + subsequent`, where the subsequent count is recomputed by walking `state.assignments` forward via `countSubsequentConsecutive` (`finalRotaWtr.ts:183–201`). The asymmetry confirms the writer is responsible for the prior-streak invariant. The engine never resets — that is the driver's contract, made explicit in the A5 comment block (`finalRotaWtr.ts:304–310`): *"Stage 3g commit logic must only push badge.long shifts onto DoctorState.consecutiveLongDates so this gate and the counter stay aligned."*

The reset triggers above (calendar gap, or non-matching shift type) are the writer's mechanism to keep the array equal to the currently-running streak. Rest-window boundaries (`restStampsByDoctor` / `shiftStartMs`) are not directly consulted for the reset — the calendar gap implied by a REST window manifests at the next commit, where `lastEntry !== D − 1` triggers the reset organically.

**Known conservatism:** Because the engine reads BEFORE the next commit, reads taken across a calendar gap with no intervening commit may see stale (over-counting) data. The worst case is a conservative false-fail, never a false-pass. This is acceptable for v2.9; Stage 3g.4 will assess whether tighter read semantics are needed for cascade backfill; the writer-side contract is final for 3g.3a.

**Night-block history commit (A2):**

After processing all assignments from a sub-pass result, the driver groups the sub-pass's new night assignments by `blockId` and pushes one inner array per block onto each owning doctor's `nightBlockHistory`. Day-shift assignments (`blockId === null`) are never pushed; only `isNightShift === true && blockId !== null` participates.

```
// Per-sub-pass: after the per-assignment commit loop completes.
groupsByDoctor: Map<doctorId, Map<blockId, string[]>> = empty
for each a in result.assignments:
    if a.isNightShift is false:                continue
    if a.blockId is null:                      continue
    perDoctor = groupsByDoctor[a.doctorId] or new Map
    bucket   = perDoctor[a.blockId] or empty array
    bucket.push(assignmentCalendarDate(a))
    perDoctor[a.blockId] = bucket
    groupsByDoctor[a.doctorId] = perDoctor

for each (doctorId, perDoctor) in groupsByDoctor:
    ds = stateMap.get(doctorId)
    for each (_blockId, dates) in perDoctor:
        sortedDates = sort dates ascending          // ISO strings sort chronologically
        ds.nightBlockHistory.push(sortedDates)      // one inner array per block
```

A single sub-pass call may emit assignments belonging to more than one distinct block (different doctors, or — though not currently produced by the Tiling Engine — multiple blocks for the same doctor in one call). The grouping by `blockId` handles all cases uniformly: each distinct `blockId` becomes one inner array. Sort within each group is chronological so the inner array reads as the block's nights in order.

**Gaps vs the existing reference loop in [scripts/testAlgorithm.ts:2246](scripts/testAlgorithm.ts:2246):**
The reference loop in the current test harness **only** updates `ds.assignments`, `ds.actualHoursByShiftType`, and `ds.weekendDatesWorked`. The driver must additionally:
1. Apply `restUntilMs` from `restStampsByDoctor` (otherwise B/C/F rest rules degrade).
2. Push to `lieuDatesStaged` (required for Phase 9 to find obligations).
3. Maintain `consecutiveNightDates`, `consecutiveShiftDates`, `consecutiveLongDates` per the Semantic-A reset rules above (required for cross-block A4/A5/A7/C32 checks on subsequent phases).
4. Update `weeklyHoursUsed` and `bucketHoursUsed` (required for E48 / F49 ceiling checks).
5. Update `oncallDatesLast7` (required for E45/E46 oncall spacing).
6. Push grouped-by-`blockId` arrays into `nightBlockHistory` per the commit step above.

Stage 3g.3a must close these gaps. The reference test loop is a historical simplification — not the contract.

**Optional dev-only phase-sequencing assertion (C3):**
Under `process.env.NODE_ENV !== 'production'`, Phase 2's `computeWeeklyResidualDemand` call may be preceded by an assertion that, for any week whose Fri/Sun demand dates are populated, `alreadyAssignedDates` is non-empty whenever the Phase 1 result for the matching weekend committed any assignments. Catches phase-sequencing regressions early; zero production cost.

**`DoctorState` field ownership matrix (driver vs future stages):**

| Field                              | Written by driver (3g.3a) | Written by later stage      |
|------------------------------------|---------------------------|-----------------------------|
| `assignments`                      | ✅                         |                             |
| `restUntilMs`                      | ✅ (max of new + existing) |                             |
| `weeklyHoursUsed`                  | ✅                         |                             |
| `consecutive*Dates`                | ✅ (Semantic-A reset rules — see commit loop) |       |
| `weekendDatesWorked`               | ✅                         |                             |
| `nightBlockHistory`                | ✅ (driver groups committed assignments by `blockId`, one inner array per block, at commit time) | |
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

**`IterationResult` shape (B3):**

The existing minimal type in [src/lib/finalRotaTypes.ts:118](src/lib/finalRotaTypes.ts:118) is extended for 3g.3a, with spec §4.1 fields stubbed as empty arrays now and populated by later stages:

```typescript
export interface IterationResult {
  assignments: Record<string, InternalDayAssignment[]>;
  doctorStates: DoctorState[];
  unfilledSlots: UnfilledSlot[];

  // Stage 3g.3a additions:
  pathsTaken: Record<string, WeekendPathTaken | WeekdayPathTaken>;
  totalPenaltyScore: number;        // sum of numeric penaltyApplied across sub-passes
  orphansConsumedCount: number;     // count where orphanConsumed === true
  orphansRelaxedCount: number;      // count where orphanConsumed === false (CRITICAL UNFILLED orphan)

  // Spec §4.1 fields — empty-array stubs now, populated by later stages:
  restBlocks: RestBlock[];          // Stage 3g.4 cascade
  lieuDays: LieuStagedEntry[];      // Stage 3g.5 lieu phase
  // returnedLeave intentionally omitted until a consumer exists.
}
```

**Why three orphan counters, not two:** `WeekendPlacementResult.orphanConsumed` is tri-state (`true | false | null`). `null` means no orphan scenario existed (e.g. a clean `UNIFIED_3N` placement, or full `UNFILLED` with no Fri/Sun coverage attempted) — it is not counted. `true` and `false` have distinct operational meaning: **consumed** is success (a Fri-orphan or Sun-orphan was absorbed by a backward/forward partner block); **relaxed** is the deliberate critical-unfilled path where the engine accepted a 2-night placement and explicitly left the orphan as `CRITICAL UNFILLED`. Collapsing them would hide the difference between "the engine reached the relaxation path" and "no orphan was ever in play".

**Why `restBlocks` and `lieuDays` are declared empty now:** Stage 3g.4 will populate `restBlocks` (at cascade-time post-block REST stamping) and Stage 3g.5 will populate `lieuDays` (Phase 9 G60 escalation). Declaring the shape now freezes the `IterationResult` contract and avoids a retrofit when those stages land. The field type for `lieuDays` is `LieuStagedEntry[]` — the construction-phase staging shape exported by `finalRotaNightBlocks.ts`. Spec §4.1 defines a richer `LieuDay` type with `originType` and `originDate`; that projection is Stage 3g.5's responsibility and may either replace this field's type or sit alongside it. Flagged in §9.

**Why `returnedLeave` is omitted:** Spec §4.1 declares `returnedLeave: ReturnedLeave[]`, but no near-term stage consumes it. Add when a stage needs it; do not stub a phantom array that bloats the contract for no reader.

Scoring fields (`tier1`, `tier2`, `tier3`, `totalScore`) are **not** added here — they belong to Stage 3i, which wraps this shape.

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
5. Derive deterministic `shuffleOrder` = doctor IDs sorted alphabetically.  // Deterministic for inspection. Stage 3i seeds differently per Monte Carlo trial.
6. `result = runSingleIteration(input, matrix, floors, shuffleOrder)`.
7. Print:
   - Total assignments count.
   - Unfilled slot count (split critical vs non-critical).
   - Night-block paths taken per weekend / week.
   - Per-doctor bucket hours used vs floor.
   - Penalty score and orphan-consumed / orphan-relaxed counts.

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

`EMPTY_DAY_RESULT` is constructed as a runtime-frozen object literal:

```typescript
const EMPTY_DAY_RESULT = Object.freeze({
  assignments: [],
  unfilledSlots: [],
  // ... other shape fields, all empty / zero
} as const);
```

`Object.freeze({...} as const)` provides both compile-time `readonly` typing and a runtime mutation guard — accidental writes from a stub-replacement gone wrong throw rather than silently corrupting the singleton.

**Why explicit stubs, not skipping:** When Stage 3g.3b lands, adding day-shift behavior requires replacing stub bodies only — no restructure of the phase loop. This matches build-guide Rule 23's "driver orchestrates" intent.

---

## 7. Test Strategy

**New file: `scripts/testConstruction.ts`** — unit tests for `runSingleIteration`, night-only fixtures.

Test cases (minimum):

1. **`minimalInputWeekendNights`** — single weekend, on-call only. Assert: exactly the expected slot filled; `pathsTaken` contains one entry; `unfilledSlots` empty.
2. **`minimalInputWeekdayNights`** — orphaned Sunday week. Assert: `residualAfter` is `[]` after the relevant week's call; path chosen is one of `UNIFIED_3N_*` or `UNIFIED_4N_MON_THU`; `oncallDatesLast7` updated.
3. **`minimalInputWeekdayMaxConsec3`** — LTFT doctor blocked by consecutive-3 cap. Assert: unfilled slot emitted; LTFT doctor not assigned beyond cap.
4. **`minimalInputFullNights`** — weekend + weekday, all night phases. Assert: Phase 1 commits before Phase 2 reads (sentinel: if Phase 2 tries to re-fill a Friday that Phase 1 already filled, no duplicate assignment appears).
5. **`minimalInputWeekendNightsAllLtft`** — every doctor has an LTFT constraint. Assert: at least one sub-pass returns `penaltyApplied > 0` OR a deliberate unfilled slot (relaxation path exercised).
6. **Determinism** — run twice with identical `shuffleOrder`; `assert.deepStrictEqual(resultA, resultB)`.
7. **State isolation** — `clonedBefore = structuredClone(input)` before the run; after the run, `assert.deepStrictEqual(clonedBefore, input)`. Deep-equality, not `readonly` reliance.
8. **Rest advancement** — assert `doctorState.restUntilMs` is non-regressive (never decreases across sub-pass commits).

**What is NOT tested in 3g.3a:**
- Day-shift phases (stubs return empty).
- Cascade debt accounting.
- Lieu G60 resolution.
- Monte Carlo scoring.
- Full rota run with all shift types.

**Test infrastructure:**
- Reuse `freshState(doctorId)` helper from [scripts/testAlgorithm.ts:211](scripts/testAlgorithm.ts:211) — or extract to a shared test util if duplication grows.
- Use `assert.deepStrictEqual` / fixture-snapshot pattern already established in `testAlgorithm.ts`.

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
- `applyWeekendResult(stateMap, result, accumulator): void`
- `applyWeekdayResult(stateMap, result, accumulator): void`
- `commitNightBlockHistory(stateMap, result): void`  // groups by blockId per A2
- `buildDoctorStateMap(input): Map<string, DoctorState>`  // fresh states via freshState()
- `projectStateMapToArray(stateMap: Map<string, DoctorState>): DoctorState[]`  // boundary projection at end of runSingleIteration
- `discoverNightShiftKeys(input): readonly string[]`
- `computeAvgHoursByKey(input, keys): Record<string, number>`
- `runNightPhase(kind: 'weekend' | 'weekday', onCallOnly: boolean, stateMap, ...)` — reduces duplication between Phase 1/2/5/6; iterates per-key per B1.
- `runCascadeCheckpoint(...)` — stub.
- `runLieuPhase9(...)` — stub.

`finalRotaTypes.ts` additions:
- `IterationResult.pathsTaken` (typed as `Record<string, WeekendPathTaken | WeekdayPathTaken>`).
- `IterationResult.totalPenaltyScore`, `orphansConsumedCount`, `orphansRelaxedCount`.
- `IterationResult.restBlocks: RestBlock[]` and `lieuDays: LieuStagedEntry[]` empty-array stubs.
- Possibly `DayPlacementResult` type for stub signatures (even if the Stage 3g.3b shape isn't finalised, a placeholder keeps stubs strongly typed).

---

## 9. Open Questions

**Q1. Multiple night shift keys.** ✅ **RESOLVED** — option (a). Driver iterates `placeWeekendNightsForWeekend` / `placeWeekdayNightsForWeek` per key within each phase, accumulating results across keys into one iteration accumulator. Sub-pass API stays unchanged (single `nightShiftKey` argument). Per-key `avgNightShiftHours` is precomputed by the driver via `computeAvgHoursByKey(input, keys)` (see §2 "`avgHoursByKey` precomputation").

**Q2. Spec phase numbering vs prompt Section 2.** Resolved in v1 — follow spec; four day-shift phases (3, 4, 7, 8) are stubbed.

**Q3. `restUntilMs` advancement semantics.** ✅ **RESOLVED** — `max` of existing and incoming. Rest windows extend, never shorten mid-iteration. Encoded in §3 commit loop.

**Q4. `IterationResult` shape extension vs replacement.** ✅ **RESOLVED** — extend per §4. Existing `assignments` / `doctorStates` / `unfilledSlots` preserved; new fields `pathsTaken`, `totalPenaltyScore`, `orphansConsumedCount`, `orphansRelaxedCount`, plus spec §4.1 stubs `restBlocks` and `lieuDays`. Scoring stays in Stage 3i.

**Q5. `applyWeekendResult` vs in-line mutation.** ✅ **RESOLVED** — named helpers (`applyWeekendResult`, `applyWeekdayResult`, `commitNightBlockHistory`). Unit-testable, and Stage 3g.3b day-shift commit logic will reuse the same primitives. Listed in §8 function surface.

**Q6. `nightBlockHistory` granularity.** ✅ **RESOLVED** — driver groups assignments by `blockId` at commit time and pushes one inner array per distinct block onto `ds.nightBlockHistory`. Mechanism specified in §3 "Night-block history commit" subsection.

**Q7. Fixture for orphan-consumed assertion.** Open. None of the existing fixtures cleanly exercises orphan consumption with a clear pass/fail boundary. Either add a new fixture in 3g.3a that sets up exactly one orphan-consumable doctor, or defer the assertion to 3g.3b once day-shift phases provide the needed setup. Not critical for night-wiring correctness; will not block 3g.3a landing.

**Q8 (new from audit). `IterationResult.lieuDays` field type.** Spec §4.1 defines `LieuDay` with `originType: 'REST_ON_LTFT' | 'REST_ON_AL' | 'REST_ON_SL' | 'BH_WORKED' | 'BH_ON_LEAVE'` and `originDate: string`. The Tiling Engine emits `LieuStagedEntry` with only `{doctorId, date, source: 'AL' | 'SL' | 'LTFT'}`. v2 declares the field as `LieuStagedEntry[]` (construction-phase shape). When Stage 3g.5 lands, the field may either: (a) be replaced by `LieuDay[]` to match the spec (with a projection at Phase 9), or (b) keep `LieuStagedEntry[]` and add a separate `committedLieuDays: LieuDay[]` field for the post-Phase-9 view. Decision deferred to 3g.5; not a blocker for 3g.3a.

**Q9 (new from audit). `RestBlock` shape spec drift.** `finalRotaTypes.ts:57–60` defines `RestBlock = {startIso: string; endUntilMs: number}` — a slim "rest-until" shape used by the writer for restUntilMs arithmetic. Spec §4.1 defines `RestBlock = {doctorId, startDatetime, endDatetime, hours, reason, blockId}` — a richer audit/projection shape. v2 uses the `finalRotaTypes.ts` definition since that's the symbol currently exported and consumed by sub-passes via `restStampsByDoctor`. Stage 3g.4 cascade may need to widen `RestBlock` to match spec; flagged for that stage.

---

## 10. Session Split Estimate

Stage 3g.3a is one coherent session, but the work splits naturally into four commits:

| Commit                                    | LoC (rough) | Risk  |
|-------------------------------------------|-------------|-------|
| 1. Types: extend `IterationResult`        | ~15         | low   |
| 2. Driver skeleton + state-map helpers + per-key night-key discovery | ~140 | low |
| 3. Night phases (1, 2, 5, 6) + commit loop incl. Semantic-A resets and `nightBlockHistory` grouping | ~280 | med |
| 4. `runAlgorithm.ts` + `testConstruction.ts` | ~300      | low   |

**Expected driver file size:** ~430 LoC, well within maintainability targets.

**Anticipated friction:**
- Closing the six state-application gaps (§3) against existing reference tests may require either updating `testAlgorithm.ts`'s loop or accepting that the two harnesses diverge intentionally.
- Per-key night-shift iteration (B1) means each Phase 1/2/5/6 body is a doubly-nested loop (per Saturday/Monday × per night-shift-key); spot-check fixtures cover the single-key case but a multi-key test fixture is a nice-to-have for 3g.3a.
- The Semantic-A reset rules require a tight relationship between commit ordering and state correctness — the dev-only assertion in §3 (C3) is recommended as the first line of defence against regressions.

---

Stage 3g.3a design document v2 complete — awaiting user approval before implementation.
