// src/lib/finalRotaConstruction.ts
// Stage 3g.3a — Construction driver. Owns spec v2.9 §8 Phase Sequence
// phases 1–10 orchestration. Day shifts (Phases 3/4/7/8), cascade
// checkpoints (D35), and Phase 9 lieu commit are no-op stubs in this
// stage — they land in 3g.3b, 3g.4, 3g.5 respectively.
//
// Public entry point: `runSingleIteration(input, matrix, floors,
// shuffleOrder): IterationResult`. Pure function: same inputs →
// same output. No Math.random anywhere on the call graph; all
// non-determinism is funnelled through `shuffleOrder` (Stage 3i
// will vary it per Monte Carlo trial).
//
// Boundary rules (carried forward from Stages 3b–3g.2):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No imports from React, Supabase, or browser/Node globals. Web
//     Worker / Node-runnable.
//   - UTC-only date arithmetic; never setDate / getDate.
//   - This file is the SOLE authoritative writer of DoctorState
//     fields per build-guide Rule 23. Sub-passes return commit
//     intent only; the driver applies it atomically (§3 of design).

import type { FinalRotaInput } from './rotaGenInput';
import type {
  AvailabilityMatrix,
  BucketFloors,
  DoctorState,
  InternalDayAssignment,
  IterationResult,
  UnfilledSlot,
} from './finalRotaTypes';
import type {
  WeekendPathTaken,
  WeekdayPathTaken,
  WeekendPlacementResult,
  WeekdayPlacementResult,
} from './finalRotaNightBlocks';

// ─── Empty result singletons (design v2 §6 + Nit C2) ──────────
// Object.freeze for runtime mutation guard; `as const` for compile-
// time readonly. Day-shift stubs return this; consumers must treat
// as an immutable empty placeholder.

interface DayPlacementResult {
  readonly assignments: readonly InternalDayAssignment[];
  readonly unfilledSlots: readonly UnfilledSlot[];
}

const EMPTY_DAY_RESULT: DayPlacementResult = Object.freeze({
  assignments: [] as readonly InternalDayAssignment[],
  unfilledSlots: [] as readonly UnfilledSlot[],
} as const);

interface LieuCommitResult {
  readonly commits: readonly string[];
  readonly unresolved: readonly string[];
}

const EMPTY_LIEU_RESULT: LieuCommitResult = Object.freeze({
  commits: [] as readonly string[],
  unresolved: [] as readonly string[],
} as const);

// ─── freshState — per-doctor working state initializer ────────
// Mirrors the structure used by the existing reference test harness
// (testAlgorithm.ts:211) so behaviour stays consistent.
// TODO (post-3g.3a): extract to a shared util `finalRotaState.ts` if
// a third caller materialises.

function freshState(doctorId: string): DoctorState {
  return {
    doctorId,
    assignments: [],
    restUntilMs: 0,
    weeklyHoursUsed: {},
    consecutiveShiftDates: [],
    consecutiveNightDates: [],
    consecutiveLongDates: [],
    weekendDatesWorked: [],
    nightBlockHistory: [],
    oncallDatesLast7: [],
    bucketHoursUsed: { oncall: 0, nonOncall: 0 },
    lieuDatesStaged: [],
    actualHoursByShiftType: {},
    debtCarriedForwardByShiftType: {},
    unallocatedContractualHours: 0,
  };
}

export function buildDoctorStateMap(
  input: FinalRotaInput,
): Map<string, DoctorState> {
  const m = new Map<string, DoctorState>();
  for (const d of input.doctors) m.set(d.doctorId, freshState(d.doctorId));
  return m;
}

export function projectStateMapToArray(
  stateMap: Map<string, DoctorState>,
): DoctorState[] {
  return Array.from(stateMap.values());
}

// ─── discoverNightShiftKeys ───────────────────────────────────
// Distinct shiftKeys of any ShiftSlotEntry carrying the 'night'
// badge. Order matches the input's natural order (deterministic
// given a deterministic input). De-duplicated.

export function discoverNightShiftKeys(
  input: FinalRotaInput,
): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of input.preRotaInput.shiftSlots) {
    if (!entry.badges.includes('night')) continue;
    if (seen.has(entry.shiftKey)) continue;
    seen.add(entry.shiftKey);
    out.push(entry.shiftKey);
  }
  return out;
}

// ─── computeAvgHoursByKey ─────────────────────────────────────
// Per-key mean of durationHours across all night-tagged slots for
// that key. Used as the seventh argument (`avgNightShiftHours`)
// when calling sub-passes; the Tiling Engine uses this for deficit
// normalisation in §11 Layer 2 ranking.
//
// A key with zero matching entries is omitted (sub-passes never
// see it); the driver's per-key iteration only iterates over keys
// present in this map.

export function computeAvgHoursByKey(
  input: FinalRotaInput,
  keys: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) {
    let sum = 0;
    let count = 0;
    for (const entry of input.preRotaInput.shiftSlots) {
      if (entry.shiftKey !== k) continue;
      if (!entry.badges.includes('night')) continue;
      sum += entry.durationHours;
      count += 1;
    }
    if (count > 0) out[k] = sum / count;
  }
  return out;
}

// ─── Driver-state accumulator ─────────────────────────────────
// Internal scratch that the per-phase commit helpers write into;
// projected to IterationResult at the end of runSingleIteration.

interface IterationAccumulator {
  unfilledSlots: UnfilledSlot[];
  pathsTaken: Record<string, WeekendPathTaken | WeekdayPathTaken>;
  totalPenaltyScore: number;
  orphansConsumedCount: number;
  orphansRelaxedCount: number;
}

function freshAccumulator(): IterationAccumulator {
  return {
    unfilledSlots: [],
    pathsTaken: {},
    totalPenaltyScore: 0,
    orphansConsumedCount: 0,
    orphansRelaxedCount: 0,
  };
}

// ─── Stub commit helpers (Commit 3 will populate) ─────────────

function applyWeekendResult(
  _stateMap: Map<string, DoctorState>,
  _result: WeekendPlacementResult,
  _accumulator: IterationAccumulator,
  _key: string,
): void {
  // Implemented in Commit 3 per design v2 §3 commit loop +
  // Deltas 1 (defensive sort) and 3 (same-day no-op guards).
}

function applyWeekdayResult(
  _stateMap: Map<string, DoctorState>,
  _result: WeekdayPlacementResult,
  _accumulator: IterationAccumulator,
  _key: string,
): void {
  // Implemented in Commit 3 per design v2 §3 commit loop +
  // Deltas 1 (defensive sort) and 3 (same-day no-op guards).
}

function commitNightBlockHistory(
  _stateMap: Map<string, DoctorState>,
  _result: WeekendPlacementResult | WeekdayPlacementResult,
): void {
  // Implemented in Commit 3 per design v2 §3 "Night-block history commit".
}

// ─── Phase entry points ───────────────────────────────────────
// Stage 3g.3a Commit 2: skeletons that return without doing work.
// Commit 3 fills the night-phase bodies.

function runNightPhase(
  _kind: 'weekend' | 'weekday',
  _onCallOnly: boolean,
  _input: FinalRotaInput,
  _matrix: AvailabilityMatrix,
  _stateMap: Map<string, DoctorState>,
  _shuffleOrder: readonly string[],
  _nightShiftKeys: readonly string[],
  _avgHoursByKey: Record<string, number>,
  _accumulator: IterationAccumulator,
): void {
  // Implemented in Commit 3.
}

// ─── Day-shift phase stubs (Stage 3g.3b will replace) ─────────

function placeWeekendOncallDayShifts(
  _input: FinalRotaInput,
  _matrix: AvailabilityMatrix,
  _stateMap: Map<string, DoctorState>,
  _shuffleOrder: readonly string[],
): DayPlacementResult {
  return EMPTY_DAY_RESULT;
}

function placeWeekdayOncallDayShifts(
  _input: FinalRotaInput,
  _matrix: AvailabilityMatrix,
  _stateMap: Map<string, DoctorState>,
  _shuffleOrder: readonly string[],
): DayPlacementResult {
  return EMPTY_DAY_RESULT;
}

function placeWeekendNonOncallDayShifts(
  _input: FinalRotaInput,
  _matrix: AvailabilityMatrix,
  _stateMap: Map<string, DoctorState>,
  _shuffleOrder: readonly string[],
): DayPlacementResult {
  return EMPTY_DAY_RESULT;
}

function placeWeekdayNonOncallDayShifts(
  _input: FinalRotaInput,
  _matrix: AvailabilityMatrix,
  _stateMap: Map<string, DoctorState>,
  _shuffleOrder: readonly string[],
): DayPlacementResult {
  return EMPTY_DAY_RESULT;
}

// ─── Cascade checkpoint stub (Stage 3g.4) ─────────────────────

type CascadeCheckpointKind =
  | 'post-oc-nights'
  | 'post-oc'
  | 'post-noc-nights'
  | 'final';

function runCascadeCheckpoint(
  _checkpoint: CascadeCheckpointKind,
  _stateMap: Map<string, DoctorState>,
  _input: FinalRotaInput,
): void {
  // Stage 3g.4 — D35 Rules 1–4. No-op for 3g.3a.
}

// ─── Lieu Phase 9 stub (Stage 3g.5) ───────────────────────────

function runLieuPhase9(
  _stateMap: Map<string, DoctorState>,
  _input: FinalRotaInput,
  _matrix: AvailabilityMatrix,
): LieuCommitResult {
  return EMPTY_LIEU_RESULT;
}

// ─── Phase 10 — IterationResult assembly ──────────────────────
// Pure projection. Groups assignments by ISO date for the public
// `assignments` shape; copies accumulator counters; emits empty
// stubs for `restBlocks` and `lieuStaged` (later stages populate).

function buildIterationResult(
  stateMap: Map<string, DoctorState>,
  accumulator: IterationAccumulator,
): IterationResult {
  const byDate: Record<string, InternalDayAssignment[]> = {};
  for (const ds of stateMap.values()) {
    for (const a of ds.assignments) {
      const date = new Date(a.shiftStartMs).toISOString().slice(0, 10);
      const bucket = byDate[date] ?? [];
      bucket.push(a);
      byDate[date] = bucket;
    }
  }

  return {
    assignments: byDate,
    doctorStates: projectStateMapToArray(stateMap),
    unfilledSlots: accumulator.unfilledSlots,
    pathsTaken: accumulator.pathsTaken,
    totalPenaltyScore: accumulator.totalPenaltyScore,
    orphansConsumedCount: accumulator.orphansConsumedCount,
    orphansRelaxedCount: accumulator.orphansRelaxedCount,
    restBlocks: [],   // Stage 3g.4 cascade populates.
    lieuStaged: [],   // Stage 3g.5 lieu phase populates.
  };
}

// ─── Public entry point ───────────────────────────────────────

export function runSingleIteration(
  input: FinalRotaInput,
  matrix: AvailabilityMatrix,
  floors: BucketFloors,
  shuffleOrder: readonly string[],
): IterationResult {
  // Phase 0 V1 guard is a caller responsibility (per design v2 §1
  // scope). The driver assumes inputs are valid; runAlgorithm.ts
  // and Stage 3i wrap with try/catch on validateBucketFloors.
  void floors;

  // ── Per-iteration setup ───────────────────────────────────
  const stateMap = buildDoctorStateMap(input);
  const accumulator = freshAccumulator();

  const nightShiftKeys = discoverNightShiftKeys(input);
  const avgHoursByKey = computeAvgHoursByKey(input, nightShiftKeys);

  // ── Phase sequence per spec §8 / design v2 §2 ────────────

  // Phase 1: Weekend on-call nights.
  runNightPhase(
    'weekend', /* onCallOnly */ true,
    input, matrix, stateMap, shuffleOrder,
    nightShiftKeys, avgHoursByKey, accumulator,
  );

  // Phase 2: Weekday on-call nights.
  runNightPhase(
    'weekday', /* onCallOnly */ true,
    input, matrix, stateMap, shuffleOrder,
    nightShiftKeys, avgHoursByKey, accumulator,
  );

  // ★ D35 cascade — post on-call nights (STUB until 3g.4)
  runCascadeCheckpoint('post-oc-nights', stateMap, input);

  // Phase 3 + 4: On-call day shifts (STUB until 3g.3b)
  void placeWeekendOncallDayShifts(input, matrix, stateMap, shuffleOrder);
  void placeWeekdayOncallDayShifts(input, matrix, stateMap, shuffleOrder);

  // ★ D35 cascade — post on-call (STUB until 3g.4)
  runCascadeCheckpoint('post-oc', stateMap, input);

  // Phase 5: Weekend non-on-call nights.
  runNightPhase(
    'weekend', /* onCallOnly */ false,
    input, matrix, stateMap, shuffleOrder,
    nightShiftKeys, avgHoursByKey, accumulator,
  );

  // Phase 6: Weekday non-on-call nights.
  runNightPhase(
    'weekday', /* onCallOnly */ false,
    input, matrix, stateMap, shuffleOrder,
    nightShiftKeys, avgHoursByKey, accumulator,
  );

  // ★ D35 cascade — post non-on-call nights (STUB until 3g.4)
  runCascadeCheckpoint('post-noc-nights', stateMap, input);

  // Phase 7 + 8: Non-on-call day shifts (STUB until 3g.3b)
  void placeWeekendNonOncallDayShifts(input, matrix, stateMap, shuffleOrder);
  void placeWeekdayNonOncallDayShifts(input, matrix, stateMap, shuffleOrder);

  // ★ D35 final cascade (STUB until 3g.4)
  runCascadeCheckpoint('final', stateMap, input);

  // Phase 9: Lieu G60 commit (STUB until 3g.5)
  void runLieuPhase9(stateMap, input, matrix);

  // Phase 10: Compose IterationResult.
  return buildIterationResult(stateMap, accumulator);
}

// Test-only re-exports for unit tests (Commit 4). Not part of the
// public API; module-internal helpers exposed so testConstruction.ts
// can exercise them in isolation.
export {
  applyWeekendResult,
  applyWeekdayResult,
  commitNightBlockHistory,
  runNightPhase,
  EMPTY_DAY_RESULT,
};
