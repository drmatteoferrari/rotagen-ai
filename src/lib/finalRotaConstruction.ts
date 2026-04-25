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

import type { FinalRotaInput, ShiftSlotEntry } from './rotaGenInput';
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
import {
  addDaysUtc,
  getDayKeyUtc,
  getWeekendSaturdays,
  getWeekdayMondays,
  placeWeekendNightsForWeekend,
  placeWeekdayNightsForWeek,
  scoreWeekendScarcity,
  scoreWeekScarcity,
  computeWeeklyResidualDemand,
} from './finalRotaNightBlocks';
import { getOverlappedWeekendDates, getWeekKey } from './finalRotaWtr';

const MS_PER_DAY = 86_400_000;

// ─── Local UTC date helpers ───────────────────────────────────
// Internal copies of common UTC arithmetic primitives used by the
// per-assignment commit loop. Kept private to avoid widening the
// public surface of finalRotaWtr.ts / finalRotaNightBlocks.ts; the
// behaviour matches their internal copies bit-for-bit.

function isoDateToUtcMidnightMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

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

// ─── keyMatchesOnCallStatus ───────────────────────────────────
// Returns true iff this nightShiftKey has any slot whose isOncall
// flag matches the current phase. Used to filter per-key iteration
// so on-call phases skip non-on-call keys and vice versa.

function keyMatchesOnCallStatus(
  input: FinalRotaInput,
  key: string,
  onCallOnly: boolean,
): boolean {
  for (const slot of input.preRotaInput.shiftSlots) {
    if (slot.shiftKey !== key) continue;
    if (slot.badges.includes('night') && slot.isOncall === onCallOnly) return true;
  }
  return false;
}

// ─── slotsByDate builders ─────────────────────────────────────
// scoreWeekendScarcity / scoreWeekScarcity expect a date→slot map
// that the driver assembles from the night ShiftSlotEntry pool for
// a given key. Out-of-period dates are skipped.

function buildSlotsByDateForWeekend(
  input: FinalRotaInput,
  saturdayIso: string,
  nightShiftKey: string,
): Record<string, ShiftSlotEntry> {
  const slots: Record<string, ShiftSlotEntry> = {};
  const startIso = input.preRotaInput.period.startDate;
  const endIso = input.preRotaInput.period.endDate;
  // Cover Fri (offset −1) through Tue (offset +3): all dates a Tier 1–4
  // weekend pattern may touch.
  for (let offset = -1; offset <= 3; offset += 1) {
    const date = addDaysUtc(saturdayIso, offset);
    if (date < startIso || date > endIso) continue;
    const dk = getDayKeyUtc(date);
    const slot = input.preRotaInput.shiftSlots.find(
      (s) => s.shiftKey === nightShiftKey && s.dayKey === dk,
    );
    if (slot) slots[date] = slot;
  }
  return slots;
}

function buildSlotsByDateForWeek(
  input: FinalRotaInput,
  weekStartIso: string,
  nightShiftKey: string,
): Record<string, ShiftSlotEntry> {
  const slots: Record<string, ShiftSlotEntry> = {};
  const startIso = input.preRotaInput.period.startDate;
  const endIso = input.preRotaInput.period.endDate;
  for (let offset = 0; offset < 5; offset += 1) {
    const date = addDaysUtc(weekStartIso, offset);
    if (date < startIso || date > endIso) continue;
    const dk = getDayKeyUtc(date);
    const slot = input.preRotaInput.shiftSlots.find(
      (s) => s.shiftKey === nightShiftKey && s.dayKey === dk,
    );
    if (slot) slots[date] = slot;
  }
  return slots;
}

// ─── isOrphanedSundayWeek ─────────────────────────────────────
// Spec §8: "Orphaned-Sunday weeks processed FIRST" in Phase 2/6.
// A week is orphaned if its preceding Sunday was left CRITICAL
// UNFILLED for the same nightShiftKey (typically because Phase 1's
// weekend pass took the RELAXATION_2N_FRISAT path — Fri/Sat covered,
// Sunday escalated). The accumulator carries unfilled slots cumulatively
// across phases, so by the time Phase 2/6 runs the relevant entries are
// in place.

function isOrphanedSundayWeek(
  mondayIso: string,
  nightShiftKey: string,
  accumulator: IterationAccumulator,
): boolean {
  const sundayBefore = addDaysUtc(mondayIso, -1);
  return accumulator.unfilledSlots.some(
    (u) =>
      u.date === sundayBefore &&
      u.shiftKey === nightShiftKey &&
      u.isCritical,
  );
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

// ─── Per-assignment commit loop (design v2 §3 + Delta 3) ──────
// Applies a single InternalDayAssignment to the owning DoctorState.
// Implements Semantic-A reset rules for the three consecutive*Dates
// arrays (verified against finalRotaWtr.ts:313/330/481/512), plus
// hours, weekend-day, oncall-window, weekly-hours, and bucket
// updates. The consecutiveX branches each carry a same-day no-op
// guard (Delta 3) to defend against hypothetical Tiling Engine
// changes that emit two assignments on the same calendar date for
// the same doctor — not currently produced, but cheap to guard.

function applySingleAssignment(
  stateMap: Map<string, DoctorState>,
  a: InternalDayAssignment,
): void {
  const ds = stateMap.get(a.doctorId);
  if (!ds) return;

  ds.assignments.push(a);
  ds.actualHoursByShiftType[a.shiftKey] =
    (ds.actualHoursByShiftType[a.shiftKey] ?? 0) + a.durationHours;

  for (const w of getOverlappedWeekendDates(a.shiftStartMs, a.shiftEndMs)) {
    if (!ds.weekendDatesWorked.includes(w)) ds.weekendDatesWorked.push(w);
  }

  const D = msToIsoDate(a.shiftStartMs);

  // ── consecutiveShiftDates (Semantic A + Delta 3 guard) ────
  const lastShift = ds.consecutiveShiftDates[ds.consecutiveShiftDates.length - 1];
  if (lastShift === D) {
    // Same-day duplicate guard — defensive against future Tiling
    // Engine changes that might emit two same-date assignments
    // per doctor.
  } else if (
    ds.consecutiveShiftDates.length === 0 ||
    lastShift === addDaysUtc(D, -1)
  ) {
    ds.consecutiveShiftDates.push(D);
  } else {
    ds.consecutiveShiftDates = [D];
  }

  // ── consecutiveNightDates (Semantic A + Delta 3 guard) ────
  if (a.isNightShift) {
    const lastNight = ds.consecutiveNightDates[ds.consecutiveNightDates.length - 1];
    if (lastNight === D) {
      // Same-day duplicate guard — defensive against future Tiling
      // Engine changes that might emit two same-date assignments
      // per doctor.
    } else if (
      ds.consecutiveNightDates.length === 0 ||
      lastNight === addDaysUtc(D, -1)
    ) {
      ds.consecutiveNightDates.push(D);
    } else {
      ds.consecutiveNightDates = [D];
    }
  } else {
    ds.consecutiveNightDates = [];
  }

  // ── consecutiveLongDates (Semantic A + Delta 3 guard) ─────
  if (a.badges.includes('long')) {
    const lastLong = ds.consecutiveLongDates[ds.consecutiveLongDates.length - 1];
    if (lastLong === D) {
      // Same-day duplicate guard — defensive against future Tiling
      // Engine changes that might emit two same-date assignments
      // per doctor.
    } else if (
      ds.consecutiveLongDates.length === 0 ||
      lastLong === addDaysUtc(D, -1)
    ) {
      ds.consecutiveLongDates.push(D);
    } else {
      ds.consecutiveLongDates = [D];
    }
  } else {
    ds.consecutiveLongDates = [];
  }

  // ── oncallDatesLast7 with 7-day prune relative to D ────────
  if (a.isOncall) {
    if (!ds.oncallDatesLast7.includes(D)) ds.oncallDatesLast7.push(D);
    const cutoffMs = isoDateToUtcMidnightMs(D) - 7 * MS_PER_DAY;
    ds.oncallDatesLast7 = ds.oncallDatesLast7.filter(
      (d) => isoDateToUtcMidnightMs(d) >= cutoffMs,
    );
  }

  // ── weeklyHoursUsed ───────────────────────────────────────
  const weekKey = getWeekKey(D);
  ds.weeklyHoursUsed[weekKey] =
    (ds.weeklyHoursUsed[weekKey] ?? 0) + a.durationHours;

  // ── bucketHoursUsed ───────────────────────────────────────
  if (a.isOncall) ds.bucketHoursUsed.oncall += a.durationHours;
  else ds.bucketHoursUsed.nonOncall += a.durationHours;
}

// ─── applyWeekendResult (design v2 §3 + Delta 1) ──────────────
// Applies a WeekendPlacementResult to state map + accumulator.
// Delta 1: defensive sort of `result.assignments` by (doctorId,
// shiftStartMs) ascending before per-assignment iteration. This
// keeps Semantic-A streak invariants correct even if a future
// Tiling Engine change emits assignments in non-chronological
// order. `commitNightBlockHistory` performs its own per-blockId
// sort and is not affected.

function applyWeekendResult(
  stateMap: Map<string, DoctorState>,
  result: WeekendPlacementResult,
  accumulator: IterationAccumulator,
  pathKey: string,
): void {
  // Delta 1: defensive sort. result.assignments is `readonly`, so
  // spread before sort to avoid mutating Tiling Engine output.
  const sortedAssignments = [...result.assignments].sort((a, b) => {
    if (a.doctorId !== b.doctorId) return a.doctorId.localeCompare(b.doctorId);
    return a.shiftStartMs - b.shiftStartMs;
  });

  for (const a of sortedAssignments) applySingleAssignment(stateMap, a);

  for (const [doctorId, restMs] of Object.entries(result.restStampsByDoctor)) {
    const ds = stateMap.get(doctorId);
    if (!ds) continue;
    if (restMs > ds.restUntilMs) ds.restUntilMs = restMs;
  }

  for (const entry of result.lieuStaged) {
    const ds = stateMap.get(entry.doctorId);
    if (!ds) continue;
    if (!ds.lieuDatesStaged.includes(entry.date)) {
      ds.lieuDatesStaged.push(entry.date);
    }
  }

  for (const u of result.unfilledSlots) accumulator.unfilledSlots.push(u);
  accumulator.pathsTaken[pathKey] = result.pathTaken;
  accumulator.totalPenaltyScore += result.penaltyApplied;
  if (result.orphanConsumed === true) accumulator.orphansConsumedCount += 1;
  if (result.orphanConsumed === false) accumulator.orphansRelaxedCount += 1;
}

// ─── applyWeekdayResult (design v2 §3 + Delta 1) ──────────────
// Same shape as applyWeekendResult but for weekday sub-pass output.
// `residualBefore`/`residualAfter` and `pairPartnerDoctorId` carry
// diagnostic value for the CLI / tests but no DoctorState write.

function applyWeekdayResult(
  stateMap: Map<string, DoctorState>,
  result: WeekdayPlacementResult,
  accumulator: IterationAccumulator,
  pathKey: string,
): void {
  // Delta 1: defensive sort.
  const sortedAssignments = [...result.assignments].sort((a, b) => {
    if (a.doctorId !== b.doctorId) return a.doctorId.localeCompare(b.doctorId);
    return a.shiftStartMs - b.shiftStartMs;
  });

  for (const a of sortedAssignments) applySingleAssignment(stateMap, a);

  for (const [doctorId, restMs] of Object.entries(result.restStampsByDoctor)) {
    const ds = stateMap.get(doctorId);
    if (!ds) continue;
    if (restMs > ds.restUntilMs) ds.restUntilMs = restMs;
  }

  for (const entry of result.lieuStaged) {
    const ds = stateMap.get(entry.doctorId);
    if (!ds) continue;
    if (!ds.lieuDatesStaged.includes(entry.date)) {
      ds.lieuDatesStaged.push(entry.date);
    }
  }

  for (const u of result.unfilledSlots) accumulator.unfilledSlots.push(u);
  accumulator.pathsTaken[pathKey] = result.pathTaken;
  accumulator.totalPenaltyScore += result.penaltyApplied;
  // WeekdayPlacementResult does not currently carry orphanConsumed
  // (the weekday pass does not have the orphan tri-state — it has
  // residualAfter as the "did we cover everything" signal). Counts
  // remain weekend-driven.
}

// ─── commitNightBlockHistory (design v2 §3) ───────────────────
// After per-assignment commits land, group this sub-pass's NEW
// night assignments by blockId. One inner array per (doctor,
// blockId) — sorted chronologically within the array. Day-shift
// assignments (blockId === null) are never pushed.

function commitNightBlockHistory(
  stateMap: Map<string, DoctorState>,
  result: WeekendPlacementResult | WeekdayPlacementResult,
): void {
  // Outer key: doctorId. Inner key: blockId. Value: list of dates.
  const groups = new Map<string, Map<string, string[]>>();

  for (const a of result.assignments) {
    if (!a.isNightShift) continue;
    if (a.blockId === null) continue;
    let perDoctor = groups.get(a.doctorId);
    if (!perDoctor) {
      perDoctor = new Map();
      groups.set(a.doctorId, perDoctor);
    }
    const date = msToIsoDate(a.shiftStartMs);
    const bucket = perDoctor.get(a.blockId) ?? [];
    bucket.push(date);
    perDoctor.set(a.blockId, bucket);
  }

  for (const [doctorId, perDoctor] of groups) {
    const ds = stateMap.get(doctorId);
    if (!ds) continue;
    // Iterate blocks in deterministic order: sort blockIds
    // lexicographically so the inner-array push order is stable
    // when a sub-pass emits multiple blocks per doctor (not
    // currently produced, but the API admits it).
    const blockIds = [...perDoctor.keys()].sort();
    for (const bid of blockIds) {
      const dates = perDoctor.get(bid);
      if (!dates || dates.length === 0) continue;
      const sorted = [...dates].sort();
      ds.nightBlockHistory.push(sorted);
    }
  }
}

// ─── runNightPhase ────────────────────────────────────────────
// Single phase body shared by Phase 1/2/5/6. Per design v2 §2:
// - Weekend phases (kind === 'weekend'): iterate Saturdays in
//   ASCENDING scarcity order (lower score = more constrained =
//   process first per finalRotaNightBlocks.ts:571 and 1366).
// - Weekday phases (kind === 'weekday'): iterate Mondays orphaned-
//   Sunday-first, then ascending scarcity, then ISO ascending.
// Per-key iteration nests inside each anchor (Q1 option (a)) so
// multi-key inputs handle each key's blocks at the same anchor
// before moving on. Per-anchor sorting uses the FIRST eligible
// nightShiftKey as scoring key — a deterministic approximation
// for the rare multi-key case; single-key fixtures are exact.

function runNightPhase(
  kind: 'weekend' | 'weekday',
  onCallOnly: boolean,
  input: FinalRotaInput,
  matrix: AvailabilityMatrix,
  stateMap: Map<string, DoctorState>,
  shuffleOrder: readonly string[],
  nightShiftKeys: readonly string[],
  avgHoursByKey: Record<string, number>,
  accumulator: IterationAccumulator,
): void {
  if (nightShiftKeys.length === 0) return;

  const periodStartIso = input.preRotaInput.period.startDate;
  const periodEndIso = input.preRotaInput.period.endDate;
  const wtr = input.preRotaInput.wtrConstraints;

  // Filter to keys that exist for this phase's on-call status. The
  // first surviving key drives scarcity scoring.
  const phaseKeys = nightShiftKeys.filter(
    (k) => keyMatchesOnCallStatus(input, k, onCallOnly) && avgHoursByKey[k] !== undefined,
  );
  if (phaseKeys.length === 0) return;
  const scoringKey = phaseKeys[0];

  if (kind === 'weekend') {
    const saturdays = getWeekendSaturdays(periodStartIso, periodEndIso);
    if (saturdays.length === 0) return;

    const scored = saturdays.map((sat) => {
      const slotsByDate = buildSlotsByDateForWeekend(input, sat, scoringKey);
      const score = scoreWeekendScarcity(
        sat,
        input.doctors,
        matrix,
        slotsByDate,
        periodEndIso,
      );
      return { sat, score };
    });
    // Ascending by scarcity score (most constrained first); tiebreaking
    // by Saturday ISO ascending for determinism.
    scored.sort((a, b) => a.score - b.score || a.sat.localeCompare(b.sat));

    for (const { sat } of scored) {
      for (const key of phaseKeys) {
        const avg = avgHoursByKey[key];
        if (avg === undefined) continue;
        const result = placeWeekendNightsForWeekend(
          sat,
          input,
          stateMap,
          matrix,
          shuffleOrder,
          key,
          avg,
          onCallOnly,
        );
        const pathKey = `${sat}#${key}`;
        applyWeekendResult(stateMap, result, accumulator, pathKey);
        commitNightBlockHistory(stateMap, result);
      }
    }
    return;
  }

  // ── weekday ─────────────────────────────────────────────
  const mondays = getWeekdayMondays(periodStartIso, periodEndIso);
  if (mondays.length === 0) return;

  const scored = mondays.map((mon) => {
    const residual = computeWeeklyResidualDemand(
      mon,
      input,
      stateMap,
      scoringKey,
      onCallOnly,
    );
    const slotsByDate = buildSlotsByDateForWeek(input, mon, scoringKey);
    const score = scoreWeekScarcity(
      mon,
      residual,
      input.doctors,
      matrix,
      slotsByDate,
      wtr,
      periodEndIso,
    );
    const orphan = isOrphanedSundayWeek(mon, scoringKey, accumulator);
    return { mon, score, orphan };
  });
  // Orphan-Sunday first (boolean true sorts ahead of false), then
  // ascending scarcity, then ISO ascending for determinism.
  scored.sort((a, b) => {
    if (a.orphan !== b.orphan) return a.orphan ? -1 : 1;
    if (a.score !== b.score) return a.score - b.score;
    return a.mon.localeCompare(b.mon);
  });

  for (const { mon } of scored) {
    for (const key of phaseKeys) {
      const avg = avgHoursByKey[key];
      if (avg === undefined) continue;
      const result = placeWeekdayNightsForWeek(
        mon,
        input,
        stateMap,
        matrix,
        shuffleOrder,
        key,
        avg,
        onCallOnly,
      );
      const pathKey = `${mon}#${key}`;
      applyWeekdayResult(stateMap, result, accumulator, pathKey);
      commitNightBlockHistory(stateMap, result);
    }
  }
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
      const date = msToIsoDate(a.shiftStartMs);
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
export type { IterationAccumulator };
