// src/lib/finalRotaNightBlocks.ts
// Stage 3g.2b.1 Session A — Unified deficit-driven weekend-night sub-pass.
//
// Owns spec v2.9:
//   §9.1 — block dictionary (extended to 12 patterns across 4 tiers; see
//          3g.2b.1 Section 2 product decision).
//   §7 F49 / F50 / F51 — LTFT night flexibility (generic function;
//          supersedes §9.3's tabular decision logic — the §9.3 table
//          contains typos and omissions).
//   §7 F52 — REST-on-LTFT lieu generation.
//   §7 F54 — multi-day LTFT composition (strictest wins).
//   §11 Layers 1–5 — candidate scoring (competency, night-target
//          deviation, total-hours deviation, shuffle tiebreak) — applied
//          through the deficit-driven unified loop.
//
// Unified weekend algorithm (replaces Session Pre-A's Pass 1 / Pass 2 /
// Relaxation structure). One deficit-driven loop per weekend:
//
//   1. Rank doctors by (normalised night-hour deficit DESC,
//      best-achievable-pattern-tier ASC, shuffle-position ASC).
//   2. For each doctor in ranked order, attempt patterns in preference
//      order:
//        a. 3N_FRI_SUN                  — commit on success.
//        b. 2N_SAT_SUN + 3N_WED_FRI     — backward orphan consumption.
//        c. 2N_FRI_SAT + 3N_SUN_TUE     — forward bridge consumption.
//      Each orphan-consumption attempt is speculative: primary intent is
//      discarded if the consumption doctor cannot be found.
//   3. If no doctor succeeds with any orphan-consuming pattern, enter
//      RELAXATION — accept 2N_SAT_SUN or 2N_FRI_SAT alone with the
//      uncovered night marked CRITICAL UNFILLED.
//   4. If even relaxation fails, emit all three weekend nights as
//      CRITICAL UNFILLED.
//
// Orphan consumption is symmetric: the Fri/Sat/Sun weekend anchors a
// bidirectional tiling. Backward (3N_WED_FRI) consumes the Wed/Thu
// weekday slots of the SAME ISO week. Forward (3N_SUN_TUE bridge)
// consumes the Mon/Tue of the following week. Both are Tier 2 dictionary
// patterns; their placement is gated by the same eligibility chain as
// any other block.
//
// Out of scope for this session (handled by later sub-sessions):
//   - Weekday sub-pass (4N_MON_THU, 3N_MON_WED, 2N_A / 2N_B, Tier-4
//     patterns outside weekend anchors) — Stage 3g.2b.2.
//   - Cascade backfill (D35 Rule 2) invoking this engine — Stage 3g.4.
//   - Lieu Phase 9 placement (G60 escalation) — Stage 3g.5.
//   - Construction driver orchestration (Phase iteration, shift-type
//     priority, multi-shift-type handling) — Stage 3g.3.
//
// No DoctorState mutation. This module returns commit intent
// (assignments, rest stamps, lieu-staging intent, unfilled slots). The
// construction driver applies state changes atomically after
// aggregating results across weekends + iterations.
//
// Boundary rules (carried forward from Stages 3b–3f):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No imports from React, Supabase, or browser/Node globals. Web
//     Worker at runtime.
//   - UTC-only date arithmetic; never setDate / getDate outside UTC.
//
// CSB is consumed as-is. Its current lack of effectiveCeiling
// consumption from cascade placeholders is acceptable for 3g.2b.1 —
// cascade placeholder fields are initialised empty/zero in 3g.1 and
// Stage 3g.4 will complete the cascade wiring. This module reads
// `state.actualHoursByShiftType` to compute deficits but never writes.

import type { FinalRotaInput, ShiftSlotEntry } from './rotaGenInput';
import type {
  AvailabilityMatrix,
  DoctorState,
  InternalDayAssignment,
  UnfilledSlot,
} from './finalRotaTypes';
import { canonicalGrade } from './gradeOptions';
import {
  checkSequenceB,
  getRestUntilMs,
  parseShiftTimes,
} from './finalRotaWtr';
import { isSlotEligible } from './finalRotaEligibility';

type Doctor = FinalRotaInput['doctors'][0];

// ─── Types ────────────────────────────────────────────────────

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BlockPatternId =
  | '4N_MON_THU' | '3N_FRI_SUN'
  | '3N_MON_WED' | '3N_WED_FRI' | '3N_SUN_TUE'
  | '2N_A_MON_TUE' | '2N_B_WED_THU' | '2N_FRI_SAT' | '2N_SAT_SUN'
  | '2N_TUE_WED' | '2N_THU_FRI' | '2N_SUN_MON';

export interface BlockPattern {
  readonly id: BlockPatternId;
  readonly nightDowOffsets: readonly number[];    // ISO 1..7 (Mon..Sun), one per night
  readonly startDow: number;                       // ISO 1..7 DOW of first night
  readonly length: number;                          // 2, 3, or 4
  readonly crossesWeekBoundary: boolean;
  readonly tier: 1 | 2 | 3 | 4;
  readonly basePenalty: number;
  readonly restDayOffsets: readonly number[];      // calendar-day offsets from last night
}

export type LtftDisposition =
  | 'OK' | 'REQUIRES_CAN_START' | 'REQUIRES_CAN_END'
  | 'REQUIRES_BOTH' | 'ALWAYS_BLOCKED' | 'OK_WITH_LIEU';

export interface LtftOverrideResult {
  disposition: LtftDisposition;
  allowed: boolean;
  requiresLieuOnDate: string | null;
  blockedReason?: string;
}

export interface WeekendDates {
  fri: string;
  sat: string;
  sun: string;
  nextMon: string;
  nextTue: string;
}

export type LieuSource = 'AL' | 'SL' | 'LTFT';

export interface LieuStagedEntry {
  doctorId: string;
  date: string;
  source: LieuSource;
}

// pathTaken values after Session A:
//   UNIFIED_3N                   — 3N_FRI_SUN placed, no orphan scenario.
//   UNIFIED_2N_SATSUN_BACKWARD   — 2N_SAT_SUN + 3N_WED_FRI for Fri orphan.
//   UNIFIED_2N_FRISAT_FORWARD    — 2N_FRI_SAT + 3N_SUN_TUE for Sun orphan.
//   RELAXATION_2N_SATSUN         — 2N_SAT_SUN alone; Fri CRITICAL UNFILLED.
//   RELAXATION_2N_FRISAT         — 2N_FRI_SAT alone; Sun CRITICAL UNFILLED.
//   UNFILLED                     — Fri/Sat/Sun all CRITICAL UNFILLED.
export type WeekendPathTaken =
  | 'UNIFIED_3N'
  | 'UNIFIED_2N_SATSUN_BACKWARD'
  | 'UNIFIED_2N_FRISAT_FORWARD'
  | 'RELAXATION_2N_SATSUN'
  | 'RELAXATION_2N_FRISAT'
  | 'UNFILLED';

export interface WeekendPlacementResult {
  assignments: readonly InternalDayAssignment[];
  lieuStaged: ReadonlyArray<LieuStagedEntry>;
  restStampsByDoctor: Readonly<Record<string, number>>;
  unfilledSlots: readonly UnfilledSlot[];
  penaltyApplied: number;
  pathTaken: WeekendPathTaken;
  // orphanConsumed reflects the orphan-coverage outcome:
  //   true  — backward or forward consumption succeeded.
  //   false — relaxation path used, orphan marked CRITICAL UNFILLED.
  //   null  — no orphan scenario (3N_FRI_SUN or full UNFILLED).
  orphanConsumed: boolean | null;
}

// ─── Constants ────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

// UTC getUTCDay indices 0..6 → day-key strings. Sun = 0 per ECMAScript.
const DAY_KEY_BY_DOW: readonly DayKey[] = [
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
];

// Input LTFT records may carry full day names ('monday') or short keys
// ('mon'). Accept both.
const LTFT_DAY_NAME_MAP: Readonly<Record<string, DayKey>> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu',
  fri: 'fri', sat: 'sat', sun: 'sun',
};

// Residency determination — exported helper `filterByI68Residency` is
// preserved for ancillary callers (construction-driver cascade ordering
// may still want it), but the unified weekend loop does NOT consult it
// — deficit + pattern-tier drive ranking.
const RESIDENT_GRADES: ReadonlySet<string> = new Set<string>([
  'CT1', 'CT2', 'CT3', 'ST4', 'ST5', 'ST6', 'ST7', 'ST8', 'ST9',
]);

// ─── Private: UTC date arithmetic ─────────────────────────────

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function isoToUtcMs(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return Date.UTC(y, m - 1, d);
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysUtc(iso: string, n: number): string {
  return msToIso(isoToUtcMs(iso) + n * MS_PER_DAY);
}

export function getDayKeyUtc(iso: string): DayKey {
  const dow = new Date(isoToUtcMs(iso)).getUTCDay();
  return DAY_KEY_BY_DOW[dow];
}

function normaliseDayName(raw: string): DayKey | null {
  return LTFT_DAY_NAME_MAP[raw.toLowerCase()] ?? null;
}

// ─── Block dictionary (spec §9.1 + 3g.2b.1 Section 2 extension) ─────

const BLOCK_PATTERNS: readonly BlockPattern[] = Object.freeze([
  // Tier 1 — ideal standard
  { id: '4N_MON_THU',   nightDowOffsets: [1, 2, 3, 4], startDow: 1, length: 4, crossesWeekBoundary: false, tier: 1, basePenalty: 0,  restDayOffsets: [1, 2] },
  { id: '3N_FRI_SUN',   nightDowOffsets: [5, 6, 7],    startDow: 5, length: 3, crossesWeekBoundary: false, tier: 1, basePenalty: 0,  restDayOffsets: [1, 2] },
  // Tier 2 — acceptable alternative / LTFT relief / orphan consumers
  { id: '3N_MON_WED',   nightDowOffsets: [1, 2, 3],    startDow: 1, length: 3, crossesWeekBoundary: false, tier: 2, basePenalty: 10, restDayOffsets: [1, 2] },
  { id: '3N_WED_FRI',   nightDowOffsets: [3, 4, 5],    startDow: 3, length: 3, crossesWeekBoundary: false, tier: 2, basePenalty: 10, restDayOffsets: [1, 2] },
  { id: '3N_SUN_TUE',   nightDowOffsets: [7, 1, 2],    startDow: 7, length: 3, crossesWeekBoundary: true,  tier: 2, basePenalty: 10, restDayOffsets: [1, 2] },
  // Tier 3 — sub-optimal / hard fragmentation
  { id: '2N_A_MON_TUE', nightDowOffsets: [1, 2],       startDow: 1, length: 2, crossesWeekBoundary: false, tier: 3, basePenalty: 25, restDayOffsets: [1, 2] },
  { id: '2N_B_WED_THU', nightDowOffsets: [3, 4],       startDow: 3, length: 2, crossesWeekBoundary: false, tier: 3, basePenalty: 25, restDayOffsets: [1, 2] },
  { id: '2N_FRI_SAT',   nightDowOffsets: [5, 6],       startDow: 5, length: 2, crossesWeekBoundary: false, tier: 3, basePenalty: 25, restDayOffsets: [1, 2] },
  { id: '2N_SAT_SUN',   nightDowOffsets: [6, 7],       startDow: 6, length: 2, crossesWeekBoundary: false, tier: 3, basePenalty: 25, restDayOffsets: [1, 2] },
  // Tier 4 — unusual gaps (3g.2b.1 Section 2 extension; not in §9.1)
  { id: '2N_TUE_WED',   nightDowOffsets: [2, 3],       startDow: 2, length: 2, crossesWeekBoundary: false, tier: 4, basePenalty: 40, restDayOffsets: [1, 2] },
  { id: '2N_THU_FRI',   nightDowOffsets: [4, 5],       startDow: 4, length: 2, crossesWeekBoundary: false, tier: 4, basePenalty: 40, restDayOffsets: [1, 2] },
  { id: '2N_SUN_MON',   nightDowOffsets: [7, 1],       startDow: 7, length: 2, crossesWeekBoundary: true,  tier: 4, basePenalty: 40, restDayOffsets: [1, 2] },
] as const);

const BLOCK_3N_FRI_SUN = BLOCK_PATTERNS.find(p => p.id === '3N_FRI_SUN')!;
const BLOCK_2N_SAT_SUN = BLOCK_PATTERNS.find(p => p.id === '2N_SAT_SUN')!;
const BLOCK_2N_FRI_SAT = BLOCK_PATTERNS.find(p => p.id === '2N_FRI_SAT')!;
const BLOCK_3N_WED_FRI = BLOCK_PATTERNS.find(p => p.id === '3N_WED_FRI')!;
const BLOCK_3N_SUN_TUE = BLOCK_PATTERNS.find(p => p.id === '3N_SUN_TUE')!;

export function buildBlockDictionary(): readonly BlockPattern[] {
  return BLOCK_PATTERNS;
}

export function isTier15AtomicPair(ids: readonly BlockPatternId[]): boolean {
  if (ids.length !== 2) return false;
  return ids.includes('2N_A_MON_TUE') && ids.includes('2N_B_WED_THU');
}

export function hasSplitWeekend(ids: readonly BlockPatternId[]): boolean {
  return ids.includes('2N_FRI_SAT') && ids.includes('2N_SAT_SUN');
}

// ─── LTFT helpers (Option A: internal canStart / canEnd) ──────

export function getLtftFlags(
  doctor: Doctor,
  dayKey: DayKey,
): { canStart: boolean; canEnd: boolean } {
  const flex = doctor.ltft?.nightFlexibility ?? [];
  for (const entry of flex) {
    const k = normaliseDayName(entry.day);
    if (k === dayKey) {
      return {
        canStart: entry.canStartNightsOnDay === true,
        canEnd: entry.canEndNightsOnDay === true,
      };
    }
  }
  return { canStart: false, canEnd: false };
}

export function getDoctorLtftDaysOff(doctor: Doctor): readonly DayKey[] {
  if (!doctor.ltft?.isLtft) return [];
  const out: DayKey[] = [];
  const seen = new Set<DayKey>();
  for (const raw of doctor.ltft.daysOff ?? []) {
    const k = normaliseDayName(raw);
    if (k && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  return out;
}

// Authoritative LTFT disposition per spec §7 F49/F50/F51 + F52/F54.
// Composition order (strictest wins): ALWAYS_BLOCKED > REQUIRES_BOTH >
// REQUIRES_CAN_START = REQUIRES_CAN_END > OK_WITH_LIEU > OK.
export function checkLtftDisposition(
  block: BlockPattern,
  blockNightDates: readonly string[],
  doctor: Doctor,
): LtftOverrideResult {
  const daysOff = getDoctorLtftDaysOff(doctor);
  if (daysOff.length === 0) {
    return { disposition: 'OK', allowed: true, requiresLieuOnDate: null };
  }
  if (blockNightDates.length !== block.length || blockNightDates.length === 0) {
    return { disposition: 'OK', allowed: true, requiresLieuOnDate: null };
  }

  const firstNightIso = blockNightDates[0];
  const lastNightIso = blockNightDates[blockNightDates.length - 1];
  const morningAfterIso = addDaysUtc(lastNightIso, 1);
  const restDay2 = addDaysUtc(lastNightIso, 2);

  const blockDateSet = new Set<string>(blockNightDates);
  const perDayDispositions: LtftDisposition[] = [];
  const perDayLieuDates: string[] = [];

  for (const dayKey of daysOff) {
    let cursor = firstNightIso;
    for (let guard = 0; guard < 10; guard += 1) {
      if (getDayKeyUtc(cursor) === dayKey) {
        let disposition: LtftDisposition;
        const flags = getLtftFlags(doctor, dayKey);

        if (
          blockDateSet.has(cursor)
          && cursor !== firstNightIso
          && cursor !== lastNightIso
        ) {
          // F51 — mid-block overlap
          disposition = 'ALWAYS_BLOCKED';
        } else if (cursor === firstNightIso) {
          // F49 — first-night overlap
          disposition = flags.canStart ? 'OK' : 'REQUIRES_CAN_START';
        } else if (cursor === lastNightIso) {
          // Last-night on LTFT day — strictly blocked.
          disposition = 'ALWAYS_BLOCKED';
        } else if (cursor === morningAfterIso) {
          // F50 — morning-after overlap
          disposition = flags.canEnd ? 'OK' : 'REQUIRES_CAN_END';
        } else if (cursor === restDay2) {
          // F52 — REST window day overlaps LTFT off-day → lieu generated
          disposition = 'OK_WITH_LIEU';
          perDayLieuDates.push(cursor);
        } else {
          disposition = 'OK';
        }

        perDayDispositions.push(disposition);
      }
      if (cursor === restDay2) break;
      cursor = addDaysUtc(cursor, 1);
    }
  }

  if (perDayDispositions.some(d => d === 'ALWAYS_BLOCKED')) {
    return {
      disposition: 'ALWAYS_BLOCKED',
      allowed: false,
      requiresLieuOnDate: null,
      blockedReason: 'mid-block or last-night on LTFT day',
    };
  }
  const hasRequiresStart = perDayDispositions.some(d => d === 'REQUIRES_CAN_START');
  const hasRequiresEnd = perDayDispositions.some(d => d === 'REQUIRES_CAN_END');
  if (hasRequiresStart && hasRequiresEnd) {
    return {
      disposition: 'REQUIRES_BOTH',
      allowed: false,
      requiresLieuOnDate: null,
      blockedReason: 'requires both canStart and canEnd, at least one missing',
    };
  }
  if (hasRequiresStart) {
    return {
      disposition: 'REQUIRES_CAN_START',
      allowed: false,
      requiresLieuOnDate: null,
      blockedReason: 'requires canStart on LTFT day',
    };
  }
  if (hasRequiresEnd) {
    return {
      disposition: 'REQUIRES_CAN_END',
      allowed: false,
      requiresLieuOnDate: null,
      blockedReason: 'requires canEnd on LTFT day',
    };
  }
  if (perDayLieuDates.length > 0) {
    return {
      disposition: 'OK_WITH_LIEU',
      allowed: true,
      requiresLieuOnDate: perDayLieuDates[0],
    };
  }
  return { disposition: 'OK', allowed: true, requiresLieuOnDate: null };
}

// ─── Weekend primitives ───────────────────────────────────────

export function getWeekendSaturdays(
  periodStartIso: string,
  periodEndIso: string,
): readonly string[] {
  const startMs = isoToUtcMs(periodStartIso);
  const endMs = isoToUtcMs(periodEndIso);
  if (endMs < startMs) return [];
  const startDow = new Date(startMs).getUTCDay();
  const offsetToSat = (6 - startDow + 7) % 7;
  const out: string[] = [];
  let curMs = startMs + offsetToSat * MS_PER_DAY;
  while (curMs <= endMs) {
    out.push(msToIso(curMs));
    curMs += 7 * MS_PER_DAY;
  }
  return out;
}

export function deriveWeekendDates(saturdayIso: string): WeekendDates {
  return {
    fri: addDaysUtc(saturdayIso, -1),
    sat: saturdayIso,
    sun: addDaysUtc(saturdayIso, 1),
    nextMon: addDaysUtc(saturdayIso, 2),
    nextTue: addDaysUtc(saturdayIso, 3),
  };
}

// Normalised night deficit per §11 Layer 2.
export function computeNormalisedNightDeficit(
  doctor: Doctor,
  state: DoctorState,
  avgNightShiftHours: number,
  nightShiftKey: string,
): number {
  const targetHours = doctor.fairnessTargets.targetNightShiftCount * avgNightShiftHours;
  if (targetHours <= 0) return 0;
  const actualHours = state.actualHoursByShiftType[nightShiftKey] ?? 0;
  return (targetHours - actualHours) / targetHours;
}

function computeTotalActualHours(state: DoctorState): number {
  let sum = 0;
  for (const v of Object.values(state.actualHoursByShiftType)) sum += v;
  return sum;
}

function competencyScoreForSlot(doctor: Doctor, slot: ShiftSlotEntry): number {
  const pos = slot.slots[0];
  if (!pos) return 0;
  let score = 0;
  if (pos.reqIac > 0 && doctor.hasIac) score += 1;
  if (pos.reqIaoc > 0 && doctor.hasIaoc) score += 1;
  if (pos.reqIcu > 0 && doctor.hasIcu) score += 1;
  if (pos.reqTransfer > 0 && doctor.hasTransfer) score += 1;
  return score;
}

// §11 lexicographic comparator for single-block ranking. Kept exported
// for callers outside the weekend sub-pass; the unified weekend loop
// uses a pattern-tier-aware comparator (`rankDoctorsForWeekend` below).
export function rankDoctorsForBlock(
  eligibleDoctorIds: readonly string[],
  block: BlockPattern,
  blockNightSlot: ShiftSlotEntry,
  state: Map<string, DoctorState>,
  doctors: readonly Doctor[],
  avgNightShiftHours: number,
  nightShiftKey: string,
  shuffleOrder: readonly string[],
): readonly string[] {
  void block;
  const doctorById = new Map<string, Doctor>();
  for (const d of doctors) doctorById.set(d.doctorId, d);
  const shufflePos = new Map<string, number>();
  for (let i = 0; i < shuffleOrder.length; i += 1) {
    shufflePos.set(shuffleOrder[i], i);
  }
  interface Ranked {
    id: string;
    deficit: number;
    compScore: number;
    totalDev: number;
    shufflePos: number;
  }
  const ranked: Ranked[] = [];
  for (const id of eligibleDoctorIds) {
    const d = doctorById.get(id);
    const s = state.get(id);
    if (!d || !s) continue;
    ranked.push({
      id,
      deficit: computeNormalisedNightDeficit(d, s, avgNightShiftHours, nightShiftKey),
      compScore: competencyScoreForSlot(d, blockNightSlot),
      totalDev: computeTotalActualHours(s) - d.fairnessTargets.targetTotalHours,
      shufflePos: shufflePos.get(id) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  ranked.sort((a, b) => {
    if (a.deficit !== b.deficit) return b.deficit - a.deficit;
    if (a.compScore !== b.compScore) return b.compScore - a.compScore;
    if (a.totalDev !== b.totalDev) return a.totalDev - b.totalDev;
    return a.shufflePos - b.shufflePos;
  });
  return ranked.map(r => r.id);
}

// §7 I68. Partitions doctor IDs into resident-first and non-resident
// fallback pools. The unified weekend loop does not consult this helper —
// it is preserved for the construction driver's shift-type sequencing
// (resident-before-non-resident across the broader phase schedule).
export function filterByI68Residency(
  doctorIds: readonly string[],
  doctors: readonly Doctor[],
): { residentsFirst: readonly string[]; fallbackPool: readonly string[] } {
  const doctorById = new Map<string, Doctor>();
  for (const d of doctors) doctorById.set(d.doctorId, d);
  const residentsFirst: string[] = [];
  const fallbackPool: string[] = [];
  for (const id of doctorIds) {
    const d = doctorById.get(id);
    const isResident = d ? RESIDENT_GRADES.has(canonicalGrade(d.grade)) : false;
    if (isResident) residentsFirst.push(id);
    else fallbackPool.push(id);
  }
  return { residentsFirst, fallbackPool };
}

// LTFT-aware matrix view — see Session Pre-A 2b.1 design notes.
// Relaxes `ltft_off` cells on block nights + morning-after so
// `isSlotEligible`'s strict Stage-3f rejection doesn't short-circuit
// F49/F50 flexibility. `checkLtftDisposition` is the authoritative gate.
function buildLtftFlexMatrix(
  doctor: Doctor,
  blockNightDates: readonly string[],
  matrix: AvailabilityMatrix,
): AvailabilityMatrix {
  if (blockNightDates.length === 0) return matrix;
  const daysOff = getDoctorLtftDaysOff(doctor);
  if (daysOff.length === 0) return matrix;
  const doctorRow = { ...(matrix[doctor.doctorId] ?? {}) };
  const lastNight = blockNightDates[blockNightDates.length - 1];
  const scopeDates = [...blockNightDates, addDaysUtc(lastNight, 1)];
  let modified = false;
  for (const d of scopeDates) {
    if (doctorRow[d] === 'ltft_off') {
      doctorRow[d] = 'available';
      modified = true;
    }
  }
  if (!modified) return matrix;
  return { ...matrix, [doctor.doctorId]: doctorRow };
}

// A8-window lieu staging (AL / SL / LTFT overlapping the 46h REST
// window). CSB does not return staged lieu — derive by inspecting rest
// days 1/2 against the availability matrix.
function deriveA8LieuDates(
  lastNightIso: string,
  doctorId: string,
  matrix: AvailabilityMatrix,
): LieuStagedEntry[] {
  const dm = matrix[doctorId] ?? {};
  const out: LieuStagedEntry[] = [];
  for (const delta of [1, 2]) {
    const d = addDaysUtc(lastNightIso, delta);
    const s = dm[d];
    if (s === 'annual_leave') out.push({ doctorId, date: d, source: 'AL' });
    else if (s === 'study') out.push({ doctorId, date: d, source: 'SL' });
    else if (s === 'ltft_off') out.push({ doctorId, date: d, source: 'LTFT' });
  }
  return out;
}

// Scarcity score for weekend ordering. Counts (doctor, weekend-pattern)
// combinations that pass the full eligibility chain. Lower = more
// constrained. Partial-slot case: when a pattern's dates include a
// missing slot, that pattern is skipped — the other patterns still
// count.
export function scoreWeekendScarcity(
  saturdayIso: string,
  eligibleDoctors: readonly Doctor[],
  matrix: AvailabilityMatrix,
  slotsByDate: Record<string, ShiftSlotEntry>,
  periodEndIso: string,
): number {
  const w = deriveWeekendDates(saturdayIso);
  const weekendCombos: ReadonlyArray<{ id: BlockPatternId; dates: readonly string[] }> = [
    { id: '3N_FRI_SUN', dates: [w.fri, w.sat, w.sun] },
    { id: '2N_SAT_SUN', dates: [w.sat, w.sun] },
    { id: '2N_FRI_SAT', dates: [w.fri, w.sat] },
  ];
  let count = 0;
  for (const doctor of eligibleDoctors) {
    for (const combo of weekendCombos) {
      const pattern = BLOCK_PATTERNS.find(p => p.id === combo.id)!;
      let eligOk = true;
      for (const date of combo.dates) {
        const slot = slotsByDate[date];
        if (!slot) { eligOk = false; break; }
        if (!isSlotEligible(doctor, slot, 0, date, matrix, periodEndIso)) {
          eligOk = false; break;
        }
      }
      if (!eligOk) continue;
      const ltft = checkLtftDisposition(pattern, combo.dates, doctor);
      if (!ltft.allowed) continue;
      count += 1;
    }
  }
  return count;
}

// ─── Orchestrator: unified weekend-night sub-pass ─────────────

interface BlockAttemptResult {
  ok: boolean;
  assignments: readonly InternalDayAssignment[];
  lieuStaged: readonly LieuStagedEntry[];
  restUntilMs: number;
  rejectionReason: string;
}

// Per-doctor block attempt. Pipeline:
//   1. Per-night isSlotEligible (LTFT-flex matrix applied).
//   2. checkLtftDisposition (spec §7 F49/F50/F51/F52/F54).
//   3. checkSequenceB (spec §8 Check Sequence B — full WTR validation).
// On success, builds commit intent: assignments, lieu staging, REST-
// until timestamp.
function tryBlockForDoctor(
  doctor: Doctor,
  pattern: BlockPattern,
  blockNightDates: readonly string[],
  state: DoctorState,
  input: FinalRotaInput,
  availabilityMatrix: AvailabilityMatrix,
  nightShiftKey: string,
): BlockAttemptResult {
  const periodEndIso = input.preRotaInput.period.endDate;
  const wtr = input.preRotaInput.wtrConstraints;
  const totalWeeks = input.preRotaInput.period.totalWeeks;

  const slotByDate: Record<string, ShiftSlotEntry> = {};
  for (const date of blockNightDates) {
    const dk = getDayKeyUtc(date);
    const slot = input.preRotaInput.shiftSlots.find(
      s => s.shiftKey === nightShiftKey && s.dayKey === dk,
    );
    if (!slot) {
      return {
        ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
        rejectionReason: `no slot entry for ${nightShiftKey}/${dk}`,
      };
    }
    slotByDate[date] = slot;
  }

  const ltftFlexMatrix = buildLtftFlexMatrix(doctor, blockNightDates, availabilityMatrix);
  for (const date of blockNightDates) {
    if (!isSlotEligible(doctor, slotByDate[date], 0, date, ltftFlexMatrix, periodEndIso)) {
      return {
        ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
        rejectionReason: `isSlotEligible fail on ${date}`,
      };
    }
  }

  const ltft = checkLtftDisposition(pattern, blockNightDates, doctor);
  if (!ltft.allowed) {
    return {
      ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
      rejectionReason: ltft.blockedReason ?? ltft.disposition,
    };
  }

  const representativeSlot = slotByDate[blockNightDates[0]];
  const csb = checkSequenceB(
    doctor,
    [...blockNightDates],
    representativeSlot,
    state,
    wtr,
    availabilityMatrix,
    totalWeeks,
    periodEndIso,
  );
  if (!csb.pass) {
    return {
      ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
      rejectionReason: `CSB ${csb.failedRule ?? 'fail'}: ${csb.reason ?? ''}`,
    };
  }

  const blockId = `${doctor.doctorId}:${pattern.id}:${blockNightDates[0]}`;
  const assignments: InternalDayAssignment[] = [];
  for (const date of blockNightDates) {
    const slot = slotByDate[date];
    const { startMs, endMs } = parseShiftTimes(slot, date);
    assignments.push({
      doctorId: doctor.doctorId,
      shiftKey: slot.shiftKey,
      shiftId: slot.shiftId,
      slotIndex: 0,
      slotLabel: slot.slots[0]?.label ?? null,
      durationHours: slot.durationHours,
      startTime: slot.startTime,
      endTime: slot.endTime,
      shiftStartMs: startMs,
      shiftEndMs: endMs,
      isNightShift: true,
      isOncall: slot.isOncall,
      isLong: slot.durationHours > 10,
      blockId,
      badges: [...slot.badges],
      violations: [],
    });
  }
  const lastNightEndMs = assignments[assignments.length - 1].shiftEndMs;
  const restUntilMs = getRestUntilMs(lastNightEndMs, wtr.minRestHoursAfter.nights);

  // Lieu staging:
  //   (a) OK_WITH_LIEU disposition — spec F52.
  //   (b) A8 REST window × AL/SL/LTFT — spec G55/G56/G57.
  // Deduplicate by (doctorId, date). Unified source label: 'LTFT'.
  const lieu: LieuStagedEntry[] = [];
  if (ltft.disposition === 'OK_WITH_LIEU' && ltft.requiresLieuOnDate) {
    lieu.push({
      doctorId: doctor.doctorId,
      date: ltft.requiresLieuOnDate,
      source: 'LTFT',
    });
  }
  const lastNightIso = blockNightDates[blockNightDates.length - 1];
  for (const entry of deriveA8LieuDates(lastNightIso, doctor.doctorId, availabilityMatrix)) {
    if (!lieu.some(e => e.doctorId === entry.doctorId && e.date === entry.date)) {
      lieu.push(entry);
    }
  }

  return {
    ok: true,
    assignments,
    lieuStaged: lieu,
    restUntilMs,
    rejectionReason: '',
  };
}

// Best-achievable pattern tier for a doctor at a given weekend. Used for
// tied-deficit tiebreak (Tier 1 beats Tier 3). Runs the full eligibility
// chain — expensive, but bounded to three calls per (doctor, weekend).
function bestAchievablePatternTier(
  cached: CachedAttempts,
): number | null {
  if (cached.a3N?.ok) return 1;
  if (cached.a2NSatSun?.ok || cached.a2NFriSat?.ok) return 3;
  return null;
}

interface CachedAttempts {
  a3N: BlockAttemptResult | null;
  a2NSatSun: BlockAttemptResult | null;
  a2NFriSat: BlockAttemptResult | null;
}

// Attempts forward-bridge (3N_SUN_TUE) consumption of the Sun orphan
// created when a doctor takes 2N_FRI_SAT. Iterates the already-ranked
// pool excluding the primary doctor; returns the first bridge doctor
// whose full eligibility chain passes, or null if none found / slots
// missing / bridge would extend past the rota period.
function attemptForwardBridgeConsumption(
  weekendDates: WeekendDates,
  primaryDoctorId: string,
  rankedDoctors: readonly string[],
  doctorById: Map<string, Doctor>,
  state: Map<string, DoctorState>,
  input: FinalRotaInput,
  availabilityMatrix: AvailabilityMatrix,
  nightShiftKey: string,
  slotFor: (date: string) => ShiftSlotEntry | null,
): { doctorId: string; attempt: BlockAttemptResult } | null {
  const periodEndIso = input.preRotaInput.period.endDate;
  if (weekendDates.nextTue > periodEndIso) return null;
  const slotSun = slotFor(weekendDates.sun);
  const slotMon = slotFor(weekendDates.nextMon);
  const slotTue = slotFor(weekendDates.nextTue);
  if (!slotSun || !slotMon || !slotTue) return null;
  for (const docId of rankedDoctors) {
    if (docId === primaryDoctorId) continue;
    const doctor = doctorById.get(docId);
    const s = state.get(docId);
    if (!doctor || !s) continue;
    const attempt = tryBlockForDoctor(
      doctor, BLOCK_3N_SUN_TUE,
      [weekendDates.sun, weekendDates.nextMon, weekendDates.nextTue],
      s, input, availabilityMatrix, nightShiftKey,
    );
    if (attempt.ok) return { doctorId: docId, attempt };
  }
  return null;
}

// Attempts backward-orphan (3N_WED_FRI) consumption of the Fri orphan
// created when a doctor takes 2N_SAT_SUN. Mirrors the forward bridge:
// iterates the already-ranked pool excluding the primary doctor; returns
// the first Wed/Thu/Fri block that passes the eligibility chain. The
// backward consumer runs entirely within the same ISO week as the
// weekend anchor — no period-boundary concern.
function attemptBackwardOrphanConsumption(
  weekendDates: WeekendDates,
  primaryDoctorId: string,
  rankedDoctors: readonly string[],
  doctorById: Map<string, Doctor>,
  state: Map<string, DoctorState>,
  input: FinalRotaInput,
  availabilityMatrix: AvailabilityMatrix,
  nightShiftKey: string,
  slotFor: (date: string) => ShiftSlotEntry | null,
): { doctorId: string; attempt: BlockAttemptResult } | null {
  const wedIso = addDaysUtc(weekendDates.fri, -2);
  const thuIso = addDaysUtc(weekendDates.fri, -1);
  const friIso = weekendDates.fri;
  const slotWed = slotFor(wedIso);
  const slotThu = slotFor(thuIso);
  const slotFri = slotFor(friIso);
  if (!slotWed || !slotThu || !slotFri) return null;
  for (const docId of rankedDoctors) {
    if (docId === primaryDoctorId) continue;
    const doctor = doctorById.get(docId);
    const s = state.get(docId);
    if (!doctor || !s) continue;
    const attempt = tryBlockForDoctor(
      doctor, BLOCK_3N_WED_FRI, [wedIso, thuIso, friIso],
      s, input, availabilityMatrix, nightShiftKey,
    );
    if (attempt.ok) return { doctorId: docId, attempt };
  }
  return null;
}

// Top-level orchestrator. Unified deficit-driven loop replaces the
// Pass 1 / Pass 2 / Relaxation cascade from Session Pre-A.
export function placeWeekendNightsForWeekend(
  saturdayIso: string,
  input: FinalRotaInput,
  state: Map<string, DoctorState>,
  availabilityMatrix: AvailabilityMatrix,
  shuffleOrder: readonly string[],
  nightShiftKey: string,
  avgNightShiftHours: number,
  onCallOnly: boolean,
): WeekendPlacementResult {
  const w = deriveWeekendDates(saturdayIso);
  const periodStartIso = input.preRotaInput.period.startDate;
  const periodEndIso = input.preRotaInput.period.endDate;

  const slotFor = (date: string): ShiftSlotEntry | null => {
    if (date < periodStartIso || date > periodEndIso) return null;
    const dk = getDayKeyUtc(date);
    const slot = input.preRotaInput.shiftSlots.find(
      s => s.shiftKey === nightShiftKey && s.dayKey === dk,
    );
    if (!slot) return null;
    if (onCallOnly && !slot.isOncall) return null;
    if (!onCallOnly && slot.isOncall) return null;
    return slot;
  };

  const slotFri = slotFor(w.fri);
  const slotSat = slotFor(w.sat);
  const slotSun = slotFor(w.sun);

  if (!slotFri && !slotSat && !slotSun) {
    return {
      assignments: [], lieuStaged: [], restStampsByDoctor: {},
      unfilledSlots: [], penaltyApplied: 0,
      pathTaken: 'UNFILLED', orphanConsumed: null,
    };
  }

  const candidatePool: string[] = [];
  for (const doctor of input.doctors) {
    if (doctor.fairnessTargets.targetNightShiftCount === 0) continue;
    if (!state.has(doctor.doctorId)) continue;
    candidatePool.push(doctor.doctorId);
  }

  const doctorById = new Map<string, Doctor>();
  for (const d of input.doctors) doctorById.set(d.doctorId, d);

  // Precompute the three weekend-anchored attempts (3N_FRI_SUN,
  // 2N_SAT_SUN, 2N_FRI_SAT) per doctor. Used both for ranking tiebreak
  // and for the main loop — no duplicate CSB calls.
  const precomputed = new Map<string, CachedAttempts & { deficit: number; tier: number | null }>();
  for (const docId of candidatePool) {
    const doctor = doctorById.get(docId)!;
    const s = state.get(docId)!;
    const a3N = (slotFri && slotSat && slotSun)
      ? tryBlockForDoctor(doctor, BLOCK_3N_FRI_SUN, [w.fri, w.sat, w.sun], s, input, availabilityMatrix, nightShiftKey)
      : null;
    const a2NSatSun = (slotSat && slotSun)
      ? tryBlockForDoctor(doctor, BLOCK_2N_SAT_SUN, [w.sat, w.sun], s, input, availabilityMatrix, nightShiftKey)
      : null;
    const a2NFriSat = (slotFri && slotSat)
      ? tryBlockForDoctor(doctor, BLOCK_2N_FRI_SAT, [w.fri, w.sat], s, input, availabilityMatrix, nightShiftKey)
      : null;
    const deficit = computeNormalisedNightDeficit(doctor, s, avgNightShiftHours, nightShiftKey);
    const tier = bestAchievablePatternTier({ a3N, a2NSatSun, a2NFriSat });
    precomputed.set(docId, { a3N, a2NSatSun, a2NFriSat, deficit, tier });
  }

  // Ranking: deficit DESC → tier ASC (null = last) → shuffle ASC.
  const shufflePos = new Map<string, number>();
  for (let i = 0; i < shuffleOrder.length; i += 1) {
    shufflePos.set(shuffleOrder[i], i);
  }
  const ranked = [...candidatePool].sort((a, b) => {
    const pa = precomputed.get(a)!;
    const pb = precomputed.get(b)!;
    if (pa.deficit !== pb.deficit) return pb.deficit - pa.deficit;
    const tierA = pa.tier ?? Number.MAX_SAFE_INTEGER;
    const tierB = pb.tier ?? Number.MAX_SAFE_INTEGER;
    if (tierA !== tierB) return tierA - tierB;
    return (shufflePos.get(a) ?? Number.MAX_SAFE_INTEGER) - (shufflePos.get(b) ?? Number.MAX_SAFE_INTEGER);
  });

  // Accumulators.
  const outAssignments: InternalDayAssignment[] = [];
  const outLieu: LieuStagedEntry[] = [];
  const outRest: Record<string, number> = {};
  const outUnfilled: UnfilledSlot[] = [];
  let outPath: WeekendPathTaken = 'UNFILLED';
  let outPenalty = 0;
  let outOrphanConsumed: boolean | null = null;

  const markUnfilled = (date: string, slot: ShiftSlotEntry | null): void => {
    if (!slot || slot.staffing.target <= 0) return;
    outUnfilled.push({
      date,
      shiftKey: nightShiftKey,
      slotIndex: 0,
      isCritical: slot.staffing.min > 0,
    });
  };

  const commit = (
    intents: readonly BlockAttemptResult[],
    path: WeekendPathTaken,
    penalty: number,
    orphan: boolean | null,
  ): WeekendPlacementResult => {
    for (const intent of intents) {
      outAssignments.push(...intent.assignments);
      outLieu.push(...intent.lieuStaged);
      if (intent.assignments.length > 0) {
        outRest[intent.assignments[0].doctorId] = intent.restUntilMs;
      }
    }
    outPath = path;
    outPenalty = penalty;
    outOrphanConsumed = orphan;
    return finalise();
  };

  function finalise(): WeekendPlacementResult {
    const sorted = [...outAssignments].sort((a, b) => a.shiftStartMs - b.shiftStartMs);
    return {
      assignments: sorted,
      lieuStaged: outLieu,
      restStampsByDoctor: outRest,
      unfilledSlots: outUnfilled,
      penaltyApplied: outPenalty,
      pathTaken: outPath,
      orphanConsumed: outOrphanConsumed,
    };
  }

  // Main loop — per-doctor pattern sequence with orphan consumption.
  for (const docId of ranked) {
    const p = precomputed.get(docId)!;

    // a. 3N_FRI_SUN — no orphan scenario.
    if (p.a3N?.ok) {
      return commit([p.a3N], 'UNIFIED_3N', BLOCK_3N_FRI_SUN.basePenalty, null);
    }

    // b. 2N_SAT_SUN + backward consumption (3N_WED_FRI for Fri orphan).
    if (p.a2NSatSun?.ok) {
      const backward = attemptBackwardOrphanConsumption(
        w, docId, ranked, doctorById, state, input, availabilityMatrix,
        nightShiftKey, slotFor,
      );
      if (backward) {
        const penalty = BLOCK_2N_SAT_SUN.basePenalty + BLOCK_3N_WED_FRI.basePenalty;
        return commit(
          [p.a2NSatSun, backward.attempt],
          'UNIFIED_2N_SATSUN_BACKWARD',
          penalty,
          true,
        );
      }
      // Backward consumption failed → discard 2N_SAT_SUN intent,
      // try 2N_FRI_SAT for this doctor.
    }

    // c. 2N_FRI_SAT + forward consumption (3N_SUN_TUE bridge for Sun orphan).
    if (p.a2NFriSat?.ok) {
      const forward = attemptForwardBridgeConsumption(
        w, docId, ranked, doctorById, state, input, availabilityMatrix,
        nightShiftKey, slotFor,
      );
      if (forward) {
        const penalty = BLOCK_2N_FRI_SAT.basePenalty + BLOCK_3N_SUN_TUE.basePenalty;
        return commit(
          [p.a2NFriSat, forward.attempt],
          'UNIFIED_2N_FRISAT_FORWARD',
          penalty,
          true,
        );
      }
      // Forward bridge failed → discard 2N_FRI_SAT intent,
      // move to next doctor.
    }
  }

  // Relaxation — partial coverage with CRITICAL UNFILLED orphan.
  for (const docId of ranked) {
    const p = precomputed.get(docId)!;
    if (p.a2NSatSun?.ok) {
      if (slotFri) markUnfilled(w.fri, slotFri);
      return commit(
        [p.a2NSatSun],
        'RELAXATION_2N_SATSUN',
        BLOCK_2N_SAT_SUN.basePenalty,
        false,
      );
    }
    if (p.a2NFriSat?.ok) {
      if (slotSun) markUnfilled(w.sun, slotSun);
      return commit(
        [p.a2NFriSat],
        'RELAXATION_2N_FRISAT',
        BLOCK_2N_FRI_SAT.basePenalty,
        false,
      );
    }
  }

  // Complete failure — all three weekend nights CRITICAL UNFILLED.
  outPath = 'UNFILLED';
  outOrphanConsumed = null;
  if (slotFri) markUnfilled(w.fri, slotFri);
  if (slotSat) markUnfilled(w.sat, slotSat);
  if (slotSun) markUnfilled(w.sun, slotSun);
  return finalise();
}
