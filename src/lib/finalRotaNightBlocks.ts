// src/lib/finalRotaNightBlocks.ts
// Stage 3g.2b.1 — Tiling Engine foundation + weekend-night sub-pass.
//
// Owns spec v2.9:
//   §9.1 — block dictionary (extended to 12 patterns across 4 tiers; see
//          Section 2 of the 3g.2b.1 prompt for the product decision).
//   §7 F49 / F50 / F51 — LTFT night flexibility (generic function;
//          supersedes §9.3's tabular decision logic per 3g.2b.1
//          Section 1.1 — the §9.3 table contains typos and omissions).
//   §7 F52 — REST-on-LTFT lieu generation.
//   §7 F54 — multi-day LTFT composition (strictest wins).
//   §7 I68 — resident-before-non-resident priority.
//   §11 Layers 1–5 — candidate scoring (competency, night-target
//          deviation, total-hours deviation, shuffle tiebreak).
//
// Weekend sub-pass (this session) covers night blocks touching
// Fri / Sat / Sun of each weekend in the rota period. Cascading
// strategy per weekend:
//   PASS 1         3N_FRI_SUN for ranked doctor (residents first, I68)
//   PASS 2 Group A 2N_SAT_SUN or 2N_FRI_SAT + 3N_SUN_TUE bridge for
//                  doctors whose ONLY 3N blocker was LTFT flexibility
//   PASS 2 Group B Same for doctors blocked for non-LTFT reasons
//   RELAXATION     2N_SAT_SUN or 2N_FRI_SAT alone with CRITICAL UNFILLED
//                  on the uncovered night
//   UNFILLED       Fri / Sat / Sun all emitted as UnfilledSlot entries
//
// Out of scope for this session (handled by later sub-sessions):
//   - Weekday sub-pass (4N_MON_THU, 3N_MON_WED/WED_FRI, 2N_A / 2N_B,
//     Tier-4 2N_TUE_WED / 2N_THU_FRI / 2N_SUN_MON) — Stage 3g.2b.2.
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

export interface LieuStagedEntry {
  doctorId: string;
  date: string;
  source?: string;
}

export interface WeekendPlacementResult {
  assignments: readonly InternalDayAssignment[];
  lieuStaged: ReadonlyArray<LieuStagedEntry>;
  restStampsByDoctor: Readonly<Record<string, number>>;
  unfilledSlots: readonly UnfilledSlot[];
  penaltyApplied: number;
  pathTaken: 'PASS1' | 'PASS2_GROUP_A' | 'PASS2_GROUP_B' | 'RELAXATION' | 'UNFILLED';
  orphanConsumedByBridge: boolean;
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

// Residency determination for I68. Training grades (CT1..ST9) are
// resident; SAS / Post-CCT Fellow / Consultant are non-resident.
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

// Exported — callers may need symmetric date helpers and the WTR module
// keeps its own addDaysUtc private. Re-implementing once here keeps the
// Tiling Engine self-contained for cascade backfill reuse in 3g.4.
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
  // Tier 2 — acceptable alternative / LTFT relief
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

export function buildBlockDictionary(): readonly BlockPattern[] {
  return BLOCK_PATTERNS;
}

// Tier 1.5 atomic pair — 2N_A_MON_TUE + 2N_B_WED_THU form a "Tier 1.5"
// composite when both placed in the same week (spec §9.1 implicit from
// E44 "≤3: use 2N-A+2N-B"). Surfaced for the scoring path that applies
// a +5 penalty bonus when the pair is detected. Not used in the weekend
// sub-pass (no Mon..Thu coverage in 3g.2b.1), but exported for 3g.2b.2.
export function isTier15AtomicPair(ids: readonly BlockPatternId[]): boolean {
  if (ids.length !== 2) return false;
  return ids.includes('2N_A_MON_TUE') && ids.includes('2N_B_WED_THU');
}

// Split-weekend detection (spec §9.1 line 1468) — 2N_FRI_SAT + 2N_SAT_SUN
// used instead of a single 3N_FRI_SUN. Weekend sub-pass never places both
// 2Ns (it always chooses one or the other), so this helper is primarily
// for the weekday sub-pass's tiling scorer — exported for reuse.
export function hasSplitWeekend(ids: readonly BlockPatternId[]): boolean {
  return ids.includes('2N_FRI_SAT') && ids.includes('2N_SAT_SUN');
}

// ─── LTFT helpers (Option A: internal canStart / canEnd) ──────

// Resolves `doctor.ltft.nightFlexibility[{day, canStartNightsOnDay,
// canEndNightsOnDay}]` → internal `{canStart, canEnd}` for a given
// day-key. Returns both false for doctors with no LTFT entry for that
// day (including entirely non-LTFT doctors), which is the safe default
// for spec §7 F49/F50 — the flag must be explicitly true.
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

// Returns the doctor's LTFT days-off as internal day-keys. Non-LTFT
// doctors return []. De-duplicated; order preserved from input.
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
// For every calendar date spanning [firstNight, lastNight+2] whose
// day-of-week matches one of the doctor's LTFT days off, classify the
// overlap and collapse to the strictest composite disposition.
//
// Per-date classification:
//   - Mid-block night on LTFT day  → ALWAYS_BLOCKED (F51)
//   - First-night on LTFT day      → REQUIRES_CAN_START or OK (F49)
//   - Last-night on LTFT day       → ALWAYS_BLOCKED (spec-silent edge;
//                                     treated as strictly blocked — a
//                                     doctor who is off this day must
//                                     not work the night itself)
//   - Morning-after on LTFT day    → REQUIRES_CAN_END or OK (F50)
//   - REST-window day (+2) on LTFT → OK_WITH_LIEU (F52)
//   - Otherwise (no real overlap)  → OK
//
// Composition (F54): ALWAYS_BLOCKED > REQUIRES_BOTH > REQUIRES_CAN_START
// = REQUIRES_CAN_END > OK_WITH_LIEU > OK. `REQUIRES_BOTH` triggers only
// when both a canStart-requiring day and a canEnd-requiring day appear.
export function checkLtftDisposition(
  block: BlockPattern,
  blockNightDates: readonly string[],
  doctor: Doctor,
): LtftOverrideResult {
  const daysOff = getDoctorLtftDaysOff(doctor);
  if (daysOff.length === 0) {
    return { disposition: 'OK', allowed: true, requiresLieuOnDate: null };
  }
  // Defensive: caller must pass aligned block + dates. If misaligned,
  // fall through to permissive OK rather than crash. Stage 3g.3
  // construction driver is the authoritative caller and never misaligns.
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
    // Enumerate every calendar date in [firstNight, restDay2] matching
    // this LTFT day-of-week.
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
          // Last-night on LTFT day — doctor should not be working the
          // night itself. Blocked regardless of flags.
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

  // Compose — strictest wins.
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

// All Saturdays in [periodStartIso, periodEndIso] inclusive, UTC.
// Deterministic ascending order.
export function getWeekendSaturdays(
  periodStartIso: string,
  periodEndIso: string,
): readonly string[] {
  const startMs = isoToUtcMs(periodStartIso);
  const endMs = isoToUtcMs(periodEndIso);
  if (endMs < startMs) return [];
  const startDow = new Date(startMs).getUTCDay(); // 0=Sun..6=Sat
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
// `targetNightHours = targetNightShiftCount × avgNightShiftHours`; caller
// pre-computes avgNightShiftHours once per iteration.
// Returns (target − actual) / target ∈ (-∞, 1]. 1.0 = 100% below target;
// 0 = on target. Zero-guard: target === 0 → returns 0.
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

// Sum of actualHoursByShiftType across all shift types — total-hours
// deviation feeder for §11 Layer 3.
function computeTotalActualHours(state: DoctorState): number {
  let sum = 0;
  for (const v of Object.values(state.actualHoursByShiftType)) sum += v;
  return sum;
}

// §11 Layer 1 competency scoring. One point per slot requirement the
// doctor satisfies. Fallback path (no per-position requirements — see
// rotaGenInput.ts fallback where `slots: []`) yields 0 for all doctors,
// so Layer 1 collapses to a tie and Layer 2 takes over.
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

// §11 lexicographic comparator (Layers 1–5). Block param is reserved
// for future block-aware boosting (Layer 4 look-ahead); unused here and
// the block itself is ranked via caller (3N tried first, 2N fallback).
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
    deficit: number;       // higher first
    compScore: number;     // higher first
    totalDev: number;      // lower first
    shufflePos: number;    // lower first
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
// fallback pools. Order within each group is preserved from the input.
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

// LTFT-aware matrix view. Spec §7 F49 / F50 permit night-on-LTFT-day
// (canStart) and morning-after-on-LTFT-day (canEnd) when the doctor's
// flag is set — but `isSlotEligible` is the strict Stage-3f gate and
// flat-rejects every `ltft_off` status. The Tiling Engine is the
// authoritative override point (spec F-rules + finalRotaEligibility.ts
// header). Before calling `isSlotEligible` we relax the doctor's
// `ltft_off` cells on the block's night dates plus the morning-after,
// which is the exact scope over which F49/F50 grant flexibility.
// `checkLtftDisposition` then gates with the spec-accurate decision.
// Non-LTFT statuses (AL / SL / PL / ROT / BH) are never touched.
// Other doctors' rows pass through unchanged — only the current
// doctor's cells are rewritten on a shallow copy.
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

// Derives A8-window lieu staging (AL / SL / LTFT overlapping the 46h
// REST window). Per Section 1.7 of the 3g.2b.1 prompt: CSB does not
// currently return staged lieu — derive by inspecting rest days 1/2
// against the availability matrix.
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

// Scarcity score for weekend ordering (3g.2b.1 Section 1.3). Counts
// (doctor, weekend-pattern) combinations where the doctor is eligible
// across every night of the pattern AND the pattern's LTFT disposition
// is allowed. Lower score = more constrained weekend = processed first.
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

// ─── Orchestrator: weekend-night sub-pass ─────────────────────

interface BlockAttemptResult {
  ok: boolean;
  assignments: readonly InternalDayAssignment[];
  lieuStaged: readonly LieuStagedEntry[];
  restUntilMs: number;
  rejectionCategory: 'LTFT' | 'NON_LTFT' | 'NONE';
  rejectionReason: string;
}

// Per-doctor block attempt. Pipeline:
//   1. Per-night isSlotEligible (fast fail on availability / exemption /
//      grade / competency / NOC / B30 D+1).
//   2. checkLtftDisposition (spec §7 F49/F50/F51/F52/F54).
//   3. checkSequenceB (spec §8 Check Sequence B — full WTR validation
//      including E47 block atomicity).
// Rejection category distinguishes LTFT-only blockers (Pass 2 Group A)
// from non-LTFT blockers (Pass 2 Group B). On success builds commit
// intent: assignments, lieu-staging (OK_WITH_LIEU + A8-window), and
// post-block rest-until timestamp.
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

  // Resolve per-night slot entries by (shiftKey, dayKey).
  const slotByDate: Record<string, ShiftSlotEntry> = {};
  for (const date of blockNightDates) {
    const dk = getDayKeyUtc(date);
    const slot = input.preRotaInput.shiftSlots.find(
      s => s.shiftKey === nightShiftKey && s.dayKey === dk,
    );
    if (!slot) {
      return {
        ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
        rejectionCategory: 'NON_LTFT',
        rejectionReason: `no slot entry for ${nightShiftKey}/${dk}`,
      };
    }
    slotByDate[date] = slot;
  }

  // Step 1 — per-night isSlotEligible pre-filter. LTFT-flex matrix
  // relaxes the doctor's `ltft_off` cells on block nights + morning-
  // after so §7 F49/F50 flexibility isn't short-circuited by
  // Stage 3f's strict rejection. `checkLtftDisposition` (Step 2)
  // gates authoritatively.
  const ltftFlexMatrix = buildLtftFlexMatrix(doctor, blockNightDates, availabilityMatrix);
  for (const date of blockNightDates) {
    if (!isSlotEligible(doctor, slotByDate[date], 0, date, ltftFlexMatrix, periodEndIso)) {
      return {
        ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
        rejectionCategory: 'NON_LTFT',
        rejectionReason: `isSlotEligible fail on ${date}`,
      };
    }
  }

  // Step 2 — LTFT disposition (§7 F49/F50/F51/F52/F54).
  const ltft = checkLtftDisposition(pattern, blockNightDates, doctor);
  if (!ltft.allowed) {
    return {
      ok: false, assignments: [], lieuStaged: [], restUntilMs: 0,
      rejectionCategory: 'LTFT',
      rejectionReason: ltft.blockedReason ?? ltft.disposition,
    };
  }

  // Step 3 — Check Sequence B (full WTR validation, block atomic).
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
      rejectionCategory: 'NON_LTFT',
      rejectionReason: `CSB ${csb.failedRule ?? 'fail'}: ${csb.reason ?? ''}`,
    };
  }

  // Build commit intent.
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
  // Post-block REST: 46h (wtr.minRestHoursAfter.nights) from last night end.
  const lastNightEndMs = assignments[assignments.length - 1].shiftEndMs;
  const restUntilMs = getRestUntilMs(lastNightEndMs, wtr.minRestHoursAfter.nights);

  // Lieu staging:
  //   (a) OK_WITH_LIEU disposition — REST day falls on LTFT day (§7 F52).
  //   (b) A8 REST window × AL/SL/LTFT (§7 G55/G56/G57).
  // Deduplicate by (doctorId, date).
  const lieu: LieuStagedEntry[] = [];
  if (ltft.disposition === 'OK_WITH_LIEU' && ltft.requiresLieuOnDate) {
    lieu.push({
      doctorId: doctor.doctorId,
      date: ltft.requiresLieuOnDate,
      source: 'LTFT_REST',
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
    rejectionCategory: 'NONE',
    rejectionReason: '',
  };
}

// Top-level orchestrator. Places night coverage for a single weekend
// anchored at `saturdayIso`. Returns commit intent + path diagnostics.
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

  // Resolve a slot for `date` honouring the onCallOnly phase flag and
  // the rota-period bounds. Returns null for out-of-period dates or
  // missing slot entries.
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

  // Empty weekend (no night demand in any Fri/Sat/Sun slot) → no work.
  if (!slotFri && !slotSat && !slotSun) {
    return {
      assignments: [], lieuStaged: [], restStampsByDoctor: {},
      unfilledSlots: [], penaltyApplied: 0,
      pathTaken: 'UNFILLED', orphanConsumedByBridge: false,
    };
  }

  // Candidate pool: doctors with a non-zero night target that have a
  // live DoctorState entry for this iteration.
  const candidatePool: string[] = [];
  for (const doctor of input.doctors) {
    if (doctor.fairnessTargets.targetNightShiftCount === 0) continue;
    if (!state.has(doctor.doctorId)) continue;
    candidatePool.push(doctor.doctorId);
  }

  const block3N = BLOCK_PATTERNS.find(p => p.id === '3N_FRI_SUN')!;
  const block2NSatSun = BLOCK_PATTERNS.find(p => p.id === '2N_SAT_SUN')!;
  const block2NFriSat = BLOCK_PATTERNS.find(p => p.id === '2N_FRI_SAT')!;
  const blockBridge = BLOCK_PATTERNS.find(p => p.id === '3N_SUN_TUE')!;

  const doctorById = new Map<string, Doctor>();
  for (const d of input.doctors) doctorById.set(d.doctorId, d);

  // Rank once for 3N_FRI_SUN against the Fri slot (or the Sat slot if
  // Fri has no demand). Used across Pass 1 and Pass 2 classification.
  const rankingSlot = slotFri ?? slotSat ?? slotSun!;
  const rankedAll = rankDoctorsForBlock(
    candidatePool, block3N, rankingSlot, state, input.doctors,
    avgNightShiftHours, nightShiftKey, shuffleOrder,
  );
  const i68 = filterByI68Residency(rankedAll, input.doctors);
  const fullOrder = [...i68.residentsFirst, ...i68.fallbackPool];

  // Accumulators.
  const outAssignments: InternalDayAssignment[] = [];
  const outLieu: LieuStagedEntry[] = [];
  const outRest: Record<string, number> = {};
  const outUnfilled: UnfilledSlot[] = [];
  let outPath: WeekendPlacementResult['pathTaken'] = 'UNFILLED';
  let outPenalty = 0;
  let outBridge = false;

  // Helper: mark a date as unfilled (isCritical = min > 0 when nothing
  // is assigned; target < min is also critical by spec but cannot occur
  // with ≥ 0 assignments against a slot with min = target in fixtures).
  const markUnfilled = (date: string, slot: ShiftSlotEntry | null): void => {
    if (!slot || slot.staffing.target <= 0) return;
    outUnfilled.push({
      date,
      shiftKey: nightShiftKey,
      slotIndex: 0,
      isCritical: slot.staffing.min > 0,
    });
  };

  // ── PASS 1 — 3N_FRI_SUN ──────────────────────────────────
  // Requires all three slots present.
  const pass1Results = new Map<string, BlockAttemptResult>();
  if (slotFri && slotSat && slotSun) {
    const pass1Dates = [w.fri, w.sat, w.sun];
    for (const docId of fullOrder) {
      const doctor = doctorById.get(docId)!;
      const s = state.get(docId)!;
      const attempt = tryBlockForDoctor(
        doctor, block3N, pass1Dates, s, input, availabilityMatrix, nightShiftKey,
      );
      pass1Results.set(docId, attempt);
      if (attempt.ok) {
        outAssignments.push(...attempt.assignments);
        outLieu.push(...attempt.lieuStaged);
        outRest[docId] = attempt.restUntilMs;
        outPath = 'PASS1';
        outPenalty = block3N.basePenalty;
        return finalise();
      }
    }
  }

  // ── PASS 2 — 2N_SAT_SUN then 2N_FRI_SAT + bridge ─────────
  // Classify remaining doctors. Cached Pass-1 rejection category drives
  // Group A (LTFT-only blockers) vs Group B (non-LTFT blockers). Group A
  // attempted first — these doctors are the most constrained and should
  // consume limited weekend slots before fully-eligible doctors fall to
  // alternative weekends.
  const groupA: string[] = [];
  const groupB: string[] = [];
  for (const docId of fullOrder) {
    const cached = pass1Results.get(docId);
    if (cached && cached.rejectionCategory === 'LTFT') groupA.push(docId);
    else groupB.push(docId);
  }

  const tryPass2Group = (
    groupIds: readonly string[],
    pathLabel: 'PASS2_GROUP_A' | 'PASS2_GROUP_B',
  ): boolean => {
    // 2N_SAT_SUN alone — Fri becomes orphan if it has demand.
    if (slotSat && slotSun) {
      for (const docId of groupIds) {
        const doctor = doctorById.get(docId)!;
        const s = state.get(docId)!;
        const attempt = tryBlockForDoctor(
          doctor, block2NSatSun, [w.sat, w.sun], s,
          input, availabilityMatrix, nightShiftKey,
        );
        if (attempt.ok) {
          outAssignments.push(...attempt.assignments);
          outLieu.push(...attempt.lieuStaged);
          outRest[docId] = attempt.restUntilMs;
          outPath = pathLabel;
          outPenalty = block2NSatSun.basePenalty;
          // Fri orphan — E42 forbids single-night placement, so leave
          // it as CRITICAL UNFILLED if demand exists.
          if (slotFri) markUnfilled(w.fri, slotFri);
          return true;
        }
      }
    }
    // 2N_FRI_SAT + 3N_SUN_TUE bridge — requires Mon+Tue slots within
    // period (bridge extends 3 days beyond the Sat pivot).
    if (slotFri && slotSat && w.nextTue <= periodEndIso) {
      const slotMonBridge = slotFor(w.nextMon);
      const slotTueBridge = slotFor(w.nextTue);
      if (slotSun && slotMonBridge && slotTueBridge) {
        for (const docId of groupIds) {
          const doctor = doctorById.get(docId)!;
          const s = state.get(docId)!;
          const primary = tryBlockForDoctor(
            doctor, block2NFriSat, [w.fri, w.sat], s,
            input, availabilityMatrix, nightShiftKey,
          );
          if (!primary.ok) continue;

          // Bridge attempt — excludes the 2N_FRI_SAT doctor (same
          // doctor cannot take consecutive blocks across the REST
          // window; formally enforced inside CSB A8 only when state is
          // mutated, so we pre-filter here to keep state immutable).
          const bridgePool = candidatePool.filter(id => id !== docId);
          const bridgeRanked = rankDoctorsForBlock(
            bridgePool, blockBridge, slotSun, state, input.doctors,
            avgNightShiftHours, nightShiftKey, shuffleOrder,
          );
          const bridgeI68 = filterByI68Residency(bridgeRanked, input.doctors);
          const bridgeOrder = [...bridgeI68.residentsFirst, ...bridgeI68.fallbackPool];
          let bridgePlaced: BlockAttemptResult | null = null;
          let bridgeDoctorId: string | null = null;
          for (const bDocId of bridgeOrder) {
            const bDoctor = doctorById.get(bDocId)!;
            const bS = state.get(bDocId)!;
            const bridgeAttempt = tryBlockForDoctor(
              bDoctor, blockBridge, [w.sun, w.nextMon, w.nextTue], bS,
              input, availabilityMatrix, nightShiftKey,
            );
            if (bridgeAttempt.ok) {
              bridgePlaced = bridgeAttempt;
              bridgeDoctorId = bDocId;
              break;
            }
          }
          if (!bridgePlaced || !bridgeDoctorId) {
            // Bridge failed — discard speculative 2N and try next doctor.
            continue;
          }

          outAssignments.push(...primary.assignments, ...bridgePlaced.assignments);
          outLieu.push(...primary.lieuStaged, ...bridgePlaced.lieuStaged);
          outRest[docId] = primary.restUntilMs;
          outRest[bridgeDoctorId] = bridgePlaced.restUntilMs;
          outPath = pathLabel;
          outPenalty = block2NFriSat.basePenalty + blockBridge.basePenalty;
          outBridge = true;
          return true;
        }
      }
    }
    return false;
  };

  if (tryPass2Group(groupA, 'PASS2_GROUP_A')) return finalise();
  if (tryPass2Group(groupB, 'PASS2_GROUP_B')) return finalise();

  // ── RELAXATION — partial coverage with explicit CRITICAL UNFILLED ─
  // Accepts a single 2N placement even when the other weekend night
  // cannot be covered. Tried against the full ranked pool (no LTFT/non-
  // LTFT partitioning) since at this point any valid fit is preferable
  // to emitting three CRITICAL UNFILLED slots.
  if (slotSat && slotSun) {
    for (const docId of fullOrder) {
      const doctor = doctorById.get(docId)!;
      const s = state.get(docId)!;
      const attempt = tryBlockForDoctor(
        doctor, block2NSatSun, [w.sat, w.sun], s,
        input, availabilityMatrix, nightShiftKey,
      );
      if (attempt.ok) {
        outAssignments.push(...attempt.assignments);
        outLieu.push(...attempt.lieuStaged);
        outRest[docId] = attempt.restUntilMs;
        outPath = 'RELAXATION';
        outPenalty = block2NSatSun.basePenalty;
        if (slotFri) markUnfilled(w.fri, slotFri);
        return finalise();
      }
    }
  }
  if (slotFri && slotSat) {
    for (const docId of fullOrder) {
      const doctor = doctorById.get(docId)!;
      const s = state.get(docId)!;
      const attempt = tryBlockForDoctor(
        doctor, block2NFriSat, [w.fri, w.sat], s,
        input, availabilityMatrix, nightShiftKey,
      );
      if (attempt.ok) {
        outAssignments.push(...attempt.assignments);
        outLieu.push(...attempt.lieuStaged);
        outRest[docId] = attempt.restUntilMs;
        outPath = 'RELAXATION';
        outPenalty = block2NFriSat.basePenalty;
        // Sun orphan — no bridge attempted in relaxation (bridge
        // success would put us back in Pass 2 territory; relaxation
        // accepts the orphan).
        if (slotSun) markUnfilled(w.sun, slotSun);
        return finalise();
      }
    }
  }

  // ── UNFILLED — every weekend night with demand is CRITICAL UNFILLED.
  outPath = 'UNFILLED';
  if (slotFri) markUnfilled(w.fri, slotFri);
  if (slotSat) markUnfilled(w.sat, slotSat);
  if (slotSun) markUnfilled(w.sun, slotSun);
  return finalise();

  function finalise(): WeekendPlacementResult {
    // Stable chronological sort for deterministic downstream diffing.
    const sorted = [...outAssignments].sort((a, b) => a.shiftStartMs - b.shiftStartMs);
    return {
      assignments: sorted,
      lieuStaged: outLieu,
      restStampsByDoctor: outRest,
      unfilledSlots: outUnfilled,
      penaltyApplied: outPenalty,
      pathTaken: outPath,
      orphanConsumedByBridge: outBridge,
    };
  }
}
