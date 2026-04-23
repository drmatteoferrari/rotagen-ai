// src/lib/finalRotaWtr.ts
// WTR check engine (Stage 3e). Implements spec v2.9 §8 Check Sequences A
// (single shift) and B (night block). Rule IDs emitted via
// `CheckResult.failedRule` correspond to spec §7 numbering — the build
// guide's rule numbering is a paraphrase and is not authoritative.
//
// Scope (confirmed 2026-04-23):
//   CSA: A0, A2, A3, A5, A6 (dormant), A7, A12, A13, A14–A18 (NROC, gated
//        on slot.isNonResOncall or prior NROC in state).
//        Out of scope (handled elsewhere): A1 (audit-only, Stage 3h),
//        A4 + A8 (Check Sequence B only), A9/A10/A11 (stamped at commit
//        via restUntilMs in Stage 3g — A3 then enforces), A19–A21
//        (Stage 3f eligibility), D33 ceiling (Stage 3g cascade),
//        B22–B30 (Availability Matrix + Stage 3f).
//   CSB: A2 (per night), A4 (full span), A7 (full span), A8 (post-block
//        REST window per v2.9 F1), A13 (unique weekend days in block),
//        C32 (soft preference), E43_BLOCK_TOO_LONG (block-dictionary
//        guard via wtr.maxConsecutive.nights).
//
// Boundary rules carried forward from Stage 3d:
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No imports from React, Supabase, or browser/Node globals; runs in
//     a Web Worker at runtime.
//   - UTC-only date arithmetic; never setDate/getDate.

import type { FinalRotaInput, ShiftSlotEntry } from './rotaGenInput';
import type {
  AvailabilityMatrix,
  CheckResult,
  DoctorState,
  InternalDayAssignment,
} from './finalRotaTypes';

type Doctor = FinalRotaInput['doctors'][0];
type WtrConstraints = FinalRotaInput['preRotaInput']['wtrConstraints'];

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const WINDOW_168H_MS = 168 * MS_PER_HOUR;

// ─── Private: date arithmetic ─────────────────────────────────

function parseIsoDate(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { y, m, d };
}

function isoDateToUtcMidnightMs(isoDate: string): number {
  const { y, m, d } = parseIsoDate(isoDate);
  return Date.UTC(y, m - 1, d);
}

function msToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDaysUtc(isoDate: string, delta: number): string {
  const base = new Date(isoDateToUtcMidnightMs(isoDate));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

function getUtcDow(isoDate: string): number {
  return new Date(isoDateToUtcMidnightMs(isoDate)).getUTCDay();
}

// ─── Helper: getWeekKey ───────────────────────────────────────
// ISO-8601 week key 'YYYY-WNN' for the UTC calendar date. Monday = start
// of week. Exported for use by Stage 3g's weekly-hours accumulator.

export function getWeekKey(isoDate: string): string {
  const { y, m, d } = parseIsoDate(isoDate);
  const day = new Date(Date.UTC(y, m - 1, d));
  const dow = day.getUTCDay();                 // 0 = Sun … 6 = Sat
  const isoDow = dow === 0 ? 7 : dow;          // ISO: Mon = 1 … Sun = 7
  day.setUTCDate(day.getUTCDate() + 4 - isoDow); // shift to ISO week's Thursday
  const year = day.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const weekNo = Math.ceil(((day.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

// ─── Helper: parseShiftTimes ──────────────────────────────────
// Unix-ms UTC bounds of a shift on a given ISO date. Duration-based to
// stay unambiguous across midnight and across shifts that exceed 24h
// (NROC per spec A12 may run up to 24h).

export function parseShiftTimes(
  slot: ShiftSlotEntry,
  isoDate: string,
): { startMs: number; endMs: number } {
  const [sh, sm] = slot.startTime.split(':').map(Number);
  const baseMs = isoDateToUtcMidnightMs(isoDate);
  const startMs = baseMs + (sh * 60 + sm) * 60_000;
  const endMs = startMs + slot.durationHours * MS_PER_HOUR;
  return { startMs, endMs };
}

// ─── Helper: getRestUntilMs ───────────────────────────────────
// Point in time after which the doctor may be assigned again, given the
// end of the current shift and a required rest window.

export function getRestUntilMs(shiftEndMs: number, restHours: number): number {
  return shiftEndMs + restHours * MS_PER_HOUR;
}

// ─── Helper: isWeekendDate ────────────────────────────────────
// Saturday or Sunday (UTC).

export function isWeekendDate(isoDate: string): boolean {
  const dow = getUtcDow(isoDate);
  return dow === 0 || dow === 6;
}

// ─── Helper: getOverlappedWeekendDates ────────────────────────
// Spec §7 A13 / §10: "Weekend day = any Saturday or Sunday where a
// shift overlaps 00:00–23:59 of that calendar day. Each calendar day
// counted once maximum." A Fri 19:00 → Sat 08:00 night overlaps Sat;
// a Sat 19:00 → Sun 08:00 night overlaps both Sat AND Sun; a Sun
// 19:00 → Mon 07:00 night overlaps Sun only.
//
// Walks days from the shift-start date to the shift-end date
// inclusive, returning the ISO dates of every Sat/Sun that has
// non-zero overlap with [startMs, endMs). De-duplicated.

export function getOverlappedWeekendDates(startMs: number, endMs: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cursor = msToIsoDate(startMs);
  const last = msToIsoDate(endMs - 1); // inclusive last touched date
  while (true) {
    const dayStart = isoDateToUtcMidnightMs(cursor);
    const dayEnd = dayStart + MS_PER_DAY;
    const overlapMs = Math.max(0, Math.min(endMs, dayEnd) - Math.max(startMs, dayStart));
    if (overlapMs > 0 && isWeekendDate(cursor) && !seen.has(cursor)) {
      out.push(cursor);
      seen.add(cursor);
    }
    if (cursor === last) break;
    cursor = addDaysUtc(cursor, 1);
  }
  return out;
}

// ─── Private: overlap and classification ──────────────────────

function overlapHours(aStart: number, aEnd: number, wStart: number, wEnd: number): number {
  const overlapMs = Math.max(0, Math.min(aEnd, wEnd) - Math.max(aStart, wStart));
  return overlapMs / MS_PER_HOUR;
}

function assignmentCalendarDate(a: InternalDayAssignment): string {
  return msToIsoDate(a.shiftStartMs);
}

function assignmentIsNroc(a: InternalDayAssignment): boolean {
  // NROC propagates as the 'nonres' badge from rotaGenInput.ts.
  return a.badges.includes('nonres');
}

function slotIsNroc(slot: ShiftSlotEntry): boolean {
  return slot.isNonResOncall === true;
}

// ─── Private: countSubsequentConsecutive ──────────────────────
// Walks calendar dates forward from the day after `lastBlockDate`
// and counts the unbroken run of consecutive days for which the
// doctor already has an assignment satisfying `filterFn`. A date
// with no matching assignment ends the run. Used by CSB A4 and A7
// to form the spec's `prior + block + subsequent` sum (§7 lines
// 1427–1428) during cascade backfill, where committed shifts can
// sit on either side of a newly inserted block.

function countSubsequentConsecutive(
  state: DoctorState,
  lastBlockDate: string,
  filterFn: (a: InternalDayAssignment) => boolean,
): number {
  let cursor = addDaysUtc(lastBlockDate, 1);
  let count = 0;
  // Unbounded loop guard: rota period is at most ~52 weeks → 400 iterations
  // is a hard ceiling that can't be reached in practice.
  for (let guard = 0; guard < 400; guard += 1) {
    const matches = state.assignments.some(
      (a) => assignmentCalendarDate(a) === cursor && filterFn(a),
    );
    if (!matches) return count;
    count += 1;
    cursor = addDaysUtc(cursor, 1);
  }
  return count;
}

// ─── checkSequenceA ───────────────────────────────────────────
// Single-shift validation per spec §8 Check Sequence A. Steps 1 (ceiling
// — cascade-dependent), 2 (Availability Matrix) and 3 (slot eligibility)
// belong to Stage 3f/3g callers; this function owns Step 0 + Step 4 only.
//
// Rule order (first failure returned):
//   A0 / A18   — same-date collision (A18 when any side is NROC)
//   A3         — 11h inter-shift rest (skipped for NROC per spec A3)
//   A12        — max shift length (skipped for NROC per spec A12)
//   A2         — 72h in 168h rolling window (backward + forward)
//   A5         — max consec long shifts (> 10h)
//   A6         — max consec long-evening (dormant; DepartmentStep2)
//   A7         — max consec shifts (all types)
//   A13        — weekend frequency per spec §10
//   A14..A18   — NROC-scoped (gated on slot.isNonResOncall or prior NROC)
//
// `totalWeekendsInRota` is the denominator for the spec §10 A13 check.
// Callers pass `input.preRotaInput.period.totalWeeks`.

export function checkSequenceA(
  doctor: Doctor,
  date: string,
  slot: ShiftSlotEntry,
  state: DoctorState,
  wtr: WtrConstraints,
  totalWeekendsInRota: number,
): CheckResult {
  void doctor; // reserved for per-doctor WTR (e.g. LTFT) in later stages
  const { startMs: proposedStartMs, endMs: proposedEndMs } = parseShiftTimes(slot, date);
  const isProposedNroc = slotIsNroc(slot);

  // ── A0 / A18 — same-date collision ────────────────────────
  const sameDate = state.assignments.filter(
    (a) => assignmentCalendarDate(a) === date,
  );
  if (sameDate.length > 0) {
    const anyNroc = isProposedNroc || sameDate.some(assignmentIsNroc);
    if (anyNroc && wtr.oncall.noSimultaneousShift) {
      return {
        pass: false,
        failedRule: 'A18',
        reason: `NROC + separate rostered shift on ${date} not permitted`,
      };
    }
    return {
      pass: false,
      failedRule: 'A0',
      reason: `doctor already has an assignment on ${date}`,
    };
  }

  // ── A3 — min inter-shift rest ─────────────────────────────
  // NROC is exempt per spec A3 ("Does NOT apply to NROC").
  if (!isProposedNroc && proposedStartMs < state.restUntilMs) {
    return {
      pass: false,
      failedRule: 'A3',
      reason: `start ${new Date(proposedStartMs).toISOString()} is before restUntil ${new Date(state.restUntilMs).toISOString()}`,
    };
  }

  // ── A12 — max shift length ────────────────────────────────
  // Spec §7 A12: "On-call up to 24h" — interpreted as NROC-only per
  // NHS convention (resident on-call treated as a regular ≤13h shift).
  // Exempts isNonResOncall only. If spec is later clarified to mean
  // all on-call, revisit here.
  if (!isProposedNroc && slot.durationHours > wtr.maxShiftLengthH) {
    return {
      pass: false,
      failedRule: 'A12',
      reason: `shift length ${slot.durationHours}h exceeds ${wtr.maxShiftLengthH}h`,
    };
  }

  // ── A2 — 72h in 168h rolling window ───────────────────────
  const backStart = proposedEndMs - WINDOW_168H_MS;
  const backEnd = proposedEndMs;
  const fwdStart = proposedStartMs;
  const fwdEnd = proposedStartMs + WINDOW_168H_MS;

  let backHours = overlapHours(proposedStartMs, proposedEndMs, backStart, backEnd);
  let fwdHours = overlapHours(proposedStartMs, proposedEndMs, fwdStart, fwdEnd);
  for (const a of state.assignments) {
    backHours += overlapHours(a.shiftStartMs, a.shiftEndMs, backStart, backEnd);
    fwdHours += overlapHours(a.shiftStartMs, a.shiftEndMs, fwdStart, fwdEnd);
  }
  if (backHours > wtr.maxHoursIn168h) {
    return {
      pass: false,
      failedRule: 'A2',
      reason: `backward 168h window = ${backHours.toFixed(1)}h > ${wtr.maxHoursIn168h}h`,
    };
  }
  if (fwdHours > wtr.maxHoursIn168h) {
    return {
      pass: false,
      failedRule: 'A2',
      reason: `forward 168h window = ${fwdHours.toFixed(1)}h > ${wtr.maxHoursIn168h}h`,
    };
  }

  // ── A5 — max consec long shifts (badge.long) ─────────────
  // Spec §7 line 906: "Consecutive badge.long shifts ≤ maxConsecLong".
  // Uses the explicit 'long' badge, not a duration proxy — a 13h night
  // carries the 'night' badge, not 'long', and must not count here.
  // Contract: Stage 3g commit logic must only push badge.long shifts
  // onto DoctorState.consecutiveLongDates so this gate and the
  // counter stay aligned.
  if (
    slot.badges.includes('long') &&
    state.consecutiveLongDates.length >= wtr.maxConsecutive.long
  ) {
    return {
      pass: false,
      failedRule: 'A5',
      reason: `${state.consecutiveLongDates.length} consecutive long shifts already at cap ${wtr.maxConsecutive.long}`,
    };
  }

  // ── A6 — max consec long-evening (dormant) ────────────────
  // The 'long-evening' badge is not emitted until DepartmentStep2
  // (spec note M3 / guide note 33), and DoctorState does not yet carry
  // a consecutiveLongEveningDates counter. When it lands, extend
  // DoctorState and enforce against wtr.maxConsecutive.longEvening here.
  // Left as a comment to keep the rule ordering visible.

  // ── A7 — max consec shifts (all types) ────────────────────
  if (state.consecutiveShiftDates.length >= wtr.maxConsecutive.standard) {
    return {
      pass: false,
      failedRule: 'A7',
      reason: `${state.consecutiveShiftDates.length} consecutive shifts already at cap ${wtr.maxConsecutive.standard}`,
    };
  }

  // ── A13 — weekend frequency (spec §10) ────────────────────
  // Uses shift-overlap (not just the slot's starting calendar date)
  // so a Fri 19:00→Sat 08:00 night correctly contributes Saturday.
  const overlappedWeekends = getOverlappedWeekendDates(proposedStartMs, proposedEndMs);
  if (overlappedWeekends.length > 0) {
    const prospective = new Set(state.weekendDatesWorked);
    for (const w of overlappedWeekends) prospective.add(w);
    const equivalentFullWeekends = prospective.size / 2;
    const allowedEquivalent = totalWeekendsInRota / wtr.weekendFrequencyMax;
    if (equivalentFullWeekends > allowedEquivalent) {
      return {
        pass: false,
        failedRule: 'A13',
        reason: `weekend-days ${prospective.size}/2 = ${equivalentFullWeekends} > cap ${allowedEquivalent.toFixed(3)}`,
      };
    }
  }

  // ── A14..A18 — NROC-scoped rules ──────────────────────────
  const nrocAssignments = state.assignments.filter(assignmentIsNroc);

  if (isProposedNroc) {
    // A14 — count of NROC shifts in any 168h rolling window ≤ maxPer7Days.
    //       Window semantics identical to A2; a shift counts if it overlaps.
    let countBack = 1; // proposed NROC
    let countFwd = 1;
    for (const a of nrocAssignments) {
      if (overlapHours(a.shiftStartMs, a.shiftEndMs, backStart, backEnd) > 0) countBack += 1;
      if (overlapHours(a.shiftStartMs, a.shiftEndMs, fwdStart, fwdEnd) > 0) countFwd += 1;
    }
    if (countBack > wtr.oncall.maxPer7Days || countFwd > wtr.oncall.maxPer7Days) {
      return {
        pass: false,
        failedRule: 'A14',
        reason: `NROC count in 168h window (back=${countBack}, fwd=${countFwd}) > ${wtr.oncall.maxPer7Days}`,
      };
    }

    // A15 — no consecutive NROC except Sat→Sun.
    if (wtr.oncall.noConsecExceptWknd) {
      const prevIso = addDaysUtc(date, -1);
      const nextIso = addDaysUtc(date, 1);
      const prevIsNroc = nrocAssignments.some((a) => assignmentCalendarDate(a) === prevIso);
      const nextIsNroc = nrocAssignments.some((a) => assignmentCalendarDate(a) === nextIso);
      const dateDow = getUtcDow(date);
      const prevSatDateSun = prevIsNroc && getUtcDow(prevIso) === 6 && dateDow === 0;
      const dateSatNextSun = nextIsNroc && dateDow === 6 && getUtcDow(nextIso) === 0;
      if (prevIsNroc && !prevSatDateSun) {
        return {
          pass: false,
          failedRule: 'A15',
          reason: `NROC on ${prevIso} + NROC on ${date} not permitted (Sat→Sun exception only)`,
        };
      }
      if (nextIsNroc && !dateSatNextSun) {
        return {
          pass: false,
          failedRule: 'A15',
          reason: `NROC on ${date} + NROC on ${nextIso} not permitted (Sat→Sun exception only)`,
        };
      }
    }
  }

  // A16 / A17 — day after NROC: any NON-NROC rostered shift is capped.
  // Spec wording "any rostered shift" is interpreted per A18's usage of
  // "rostered" (explicitly contrasted with NROC). The Sat→Sun A15
  // exception would be self-defeating under the alternative reading.
  if (!isProposedNroc && nrocAssignments.length > 0) {
    const prevIso = addDaysUtc(date, -1);
    const prevIsNroc = nrocAssignments.some((a) => assignmentCalendarDate(a) === prevIso);
    if (prevIsNroc) {
      if (slot.durationHours > wtr.oncall.dayAfterMaxHours) {
        return {
          pass: false,
          failedRule: 'A16',
          reason: `day after NROC: shift ${slot.durationHours}h > ${wtr.oncall.dayAfterMaxHours}h`,
        };
      }
      // A17 — day after the LAST NROC in a consecutive run. Since no shift
      // is yet committed on `date`, `prevIso` is necessarily the last NROC
      // in its run, so A17 always applies when A16 does.
      if (slot.durationHours > wtr.oncall.dayAfterLastConsecMaxH) {
        return {
          pass: false,
          failedRule: 'A17',
          reason: `day after last consec NROC: shift ${slot.durationHours}h > ${wtr.oncall.dayAfterLastConsecMaxH}h`,
        };
      }
    }
  }

  return { pass: true };
}

// ─── checkSequenceB ───────────────────────────────────────────
// Night block validation per spec §8 Check Sequence B. Block atomicity
// is absolute (E47) — any failure rejects the entire block.
//
// This function does not mutate state. Lieu obligations from A8 REST
// overlaps (G55/G56/G57) are restaged by Stage 3g's commit path after
// CSB passes; here the AL/SL/LTFT cases simply do not fail.
//
// Step 1 (block availability gate via Matrix) is a caller responsibility:
// Stage 3g filters candidates through `availabilityMatrix` before invoking
// CSB, so a doctor reaching this function is already `available` on every
// date in `blockDates`. The matrix is still consulted for A8 REST status
// classification (AL/SL/LTFT vs NOC/PL/ROT/AVAILABLE/BH).

export function checkSequenceB(
  doctor: Doctor,
  blockDates: string[],
  slot: ShiftSlotEntry,
  state: DoctorState,
  wtr: WtrConstraints,
  availabilityMatrix: AvailabilityMatrix,
  totalWeekendsInRota: number,
  periodEndIso: string,
): CheckResult {
  // ── Step 0: block length (E43 dictionary guard) ──────────
  // Label 'E43_BLOCK_TOO_LONG' is a Stage 3e convention — spec §7
  // Section E governs block patterns, and this length cap is
  // logically adjacent. Kept for namespace clarity vs A-rule
  // strings; downstream consumers grep this literal.
  if (blockDates.length < 1) {
    return { pass: false, failedRule: 'E43_BLOCK_TOO_LONG', reason: 'empty block' };
  }
  if (blockDates.length > wtr.maxConsecutive.nights) {
    return {
      pass: false,
      failedRule: 'E43_BLOCK_TOO_LONG',
      reason: `block length ${blockDates.length} > max ${wtr.maxConsecutive.nights}`,
    };
  }

  const sorted = [...blockDates].sort();
  const nightShifts = sorted.map((d) => ({ date: d, ...parseShiftTimes(slot, d) }));

  // ── A4 — max consecutive nights, full span ────────────────
  // Spec §7 line 1427: prior + block + subsequent ≤ maxConsecNights.
  // Subsequent is counted forward from the day after the block's
  // last night and covers nights already committed on that side
  // (cascade backfill scenarios).
  const priorConsecNights = state.consecutiveNightDates.length;
  const subsequentConsecNights = countSubsequentConsecutive(
    state,
    sorted[sorted.length - 1],
    (a) => a.isNightShift,
  );
  if (
    priorConsecNights + sorted.length + subsequentConsecNights >
    wtr.maxConsecutive.nights
  ) {
    return {
      pass: false,
      failedRule: 'A4',
      reason: `prior ${priorConsecNights} + block ${sorted.length} + subsequent ${subsequentConsecNights} nights > cap ${wtr.maxConsecutive.nights}`,
    };
  }

  // ── C32 — soft max-consec-nights preference ──────────────
  const softCap = doctor.constraints.soft.maxConsecNights;
  if (softCap > 0 && sorted.length > softCap) {
    return {
      pass: false,
      failedRule: 'C32',
      reason: `block length ${sorted.length} > doctor preference ${softCap}`,
    };
  }

  // ── A7 — max consec shifts (all types, full span) ────────
  // Spec §7 line 1428: prior + block + subsequent ≤ maxConsecStandard.
  // Subsequent counts any shift type (filter always true); the run
  // breaks on the first date with no committed assignment.
  const priorConsecShifts = state.consecutiveShiftDates.length;
  const subsequentConsecShifts = countSubsequentConsecutive(
    state,
    sorted[sorted.length - 1],
    () => true,
  );
  if (
    priorConsecShifts + sorted.length + subsequentConsecShifts >
    wtr.maxConsecutive.standard
  ) {
    return {
      pass: false,
      failedRule: 'A7',
      reason: `prior ${priorConsecShifts} + block ${sorted.length} + subsequent ${subsequentConsecShifts} shifts > cap ${wtr.maxConsecutive.standard}`,
    };
  }

  // ── A13 — weekend frequency: unique Sat/Sun in block ─────
  // Uses shift-overlap per §10: a Fri-start night contributes Sat,
  // a Sat-start night contributes both Sat and Sun, etc. Dedup
  // across nights so a Sat counted via Fri-night + Sat-night is
  // still only one weekend day.
  const prospectiveWeekendDays = new Set(state.weekendDatesWorked);
  for (const n of nightShifts) {
    for (const w of getOverlappedWeekendDates(n.startMs, n.endMs)) {
      prospectiveWeekendDays.add(w);
    }
  }
  const equivalentFullWeekends = prospectiveWeekendDays.size / 2;
  const allowedEquivalent = totalWeekendsInRota / wtr.weekendFrequencyMax;
  if (equivalentFullWeekends > allowedEquivalent) {
    return {
      pass: false,
      failedRule: 'A13',
      reason: `block pushes weekend-days to ${prospectiveWeekendDays.size} (equiv ${equivalentFullWeekends}) > cap ${allowedEquivalent.toFixed(3)}`,
    };
  }

  // ── A2 — 72h in 168h rolling window, per night ────────────
  for (const n of nightShifts) {
    const backStart = n.endMs - WINDOW_168H_MS;
    const backEnd = n.endMs;
    const fwdStart = n.startMs;
    const fwdEnd = n.startMs + WINDOW_168H_MS;

    let backHours = 0;
    let fwdHours = 0;
    for (const a of state.assignments) {
      backHours += overlapHours(a.shiftStartMs, a.shiftEndMs, backStart, backEnd);
      fwdHours += overlapHours(a.shiftStartMs, a.shiftEndMs, fwdStart, fwdEnd);
    }
    for (const other of nightShifts) {
      backHours += overlapHours(other.startMs, other.endMs, backStart, backEnd);
      fwdHours += overlapHours(other.startMs, other.endMs, fwdStart, fwdEnd);
    }
    if (backHours > wtr.maxHoursIn168h) {
      return {
        pass: false,
        failedRule: 'A2',
        reason: `backward 168h window at ${n.date} = ${backHours.toFixed(1)}h > ${wtr.maxHoursIn168h}h`,
      };
    }
    if (fwdHours > wtr.maxHoursIn168h) {
      return {
        pass: false,
        failedRule: 'A2',
        reason: `forward 168h window at ${n.date} = ${fwdHours.toFixed(1)}h > ${wtr.maxHoursIn168h}h`,
      };
    }
  }

  // ── A8 — post-block REST window (spec v2.9 F1) ────────────
  // REST starts at the last night's clock-end and spans
  // `wtr.minRestHoursAfter.nights` hours (46h default — applies to any
  // block size per v2.9 F1, including 2-night blocks).
  const lastNight = nightShifts[nightShifts.length - 1];
  const restStartMs = lastNight.endMs;
  const restEndMs = getRestUntilMs(restStartMs, wtr.minRestHoursAfter.nights);
  const periodEndMs = isoDateToUtcMidnightMs(periodEndIso);
  const doctorAvail = availabilityMatrix[doctor.doctorId] ?? {};
  const blockDateSet = new Set(sorted);

  // Enumerate every calendar date the REST window touches.
  const restDates: string[] = [];
  {
    let cursor = msToIsoDate(restStartMs);
    const last = msToIsoDate(restEndMs - 1);
    while (true) {
      restDates.push(cursor);
      if (cursor === last) break;
      cursor = addDaysUtc(cursor, 1);
    }
  }

  for (const d of restDates) {
    // Dates past the rota period are trivially compatible with REST.
    if (isoDateToUtcMidnightMs(d) > periodEndMs) continue;
    // The block's own nights are not REST dates.
    if (blockDateSet.has(d)) continue;

    const committed = state.assignments.some((a) => assignmentCalendarDate(a) === d);
    if (committed) {
      return {
        pass: false,
        failedRule: 'A8',
        reason: `committed shift on ${d} falls within post-block REST window`,
      };
    }
    // Status-driven outcomes per v2.9 F1:
    //   annual_leave / study / ltft_off  → PASS, Stage 3g stages lieu (G55–G57).
    //   noc / parental / rotation         → PASS silently (no commitment).
    //   available / bank_holiday          → PASS (no commitment, rest dates vacant).
    // No case here mutates state; CSB's job is fail-only.
    void doctorAvail;
  }

  return { pass: true };
}
