// scripts/postRunDiagnostics.ts
// Post-run diagnostic for the construction driver. Reads a JSONL trace
// (produced by ROTAGEN_TRACE=1 npx tsx scripts/runAlgorithm.ts) and
// emits a second JSONL with two diagnostic event types:
//
//   unfilled_postmortem  — for every unfilled slot, why each doctor
//                          was rejected. Calls into the LOCKED but
//                          EXPORTED helpers (isSlotEligible,
//                          checkLtftDisposition, checkSequenceA,
//                          checkSequenceB) so rule attribution is
//                          authoritative, not reimplemented.
//
//   stale_read_check     — for every PerDoctorStateSnapshot field
//                          (consecutive*Dates), compares the engine-
//                          read length to a recomputed calendar
//                          truth, and — only in the narrow cap-
//                          crossing case — declares a false-fail.
//                          All ambiguous cases set
//                          wouldHaveChangedDecision = null with an
//                          explicit reason string.
//
// The diagnostic does NOT call into the construction driver and does
// NOT replay the commit loop. Snapshots from the trace are the
// authoritative view of state at decision time. This avoids replay-
// drift masking real bugs.
//
// Invocation:
//   npx tsx scripts/postRunDiagnostics.ts \
//     [trace-input=/tmp/rotagen_trace.jsonl] \
//     [diagnostics-output=/tmp/rotagen_diagnostics.jsonl] \
//     [fixture=minimalInputFullNights]

import * as fs from 'node:fs';

import {
  buildAvailabilityMatrix,
} from '../src/lib/finalRotaPhase0';
import {
  checkSequenceA,
  checkSequenceB,
  parseShiftTimes,
} from '../src/lib/finalRotaWtr';
import { isSlotEligible } from '../src/lib/finalRotaEligibility';
import {
  addDaysUtc,
  getDayKeyUtc,
  buildBlockDictionary,
  checkLtftDisposition,
  type BlockPatternId,
} from '../src/lib/finalRotaNightBlocks';
import type {
  AvailabilityMatrix,
  AvailabilityStatus,
  DoctorState,
  InternalDayAssignment,
} from '../src/lib/finalRotaTypes';
import type { FinalRotaInput, ShiftSlotEntry } from '../src/lib/rotaGenInput';
import type {
  TraceEvent,
  AssignmentSummary,
  PerDoctorStateSnapshot,
  UnfilledSlotSummary,
  PhaseId,
} from '../src/lib/finalRotaTrace';

import {
  minimalInput,
  minimalInputWeekendNights,
  minimalInputWeekendNightsAllLtft,
  minimalInputWeekdayNights,
  minimalInputWeekdayMaxConsec3,
  minimalInputFullNights,
  minimalInputWithOverdeductedLeave,
  minimalInputWithOncallSlot,
  minimalInputWithNroc,
} from './fixtures/minimalInput';

const FIXTURES: Record<string, FinalRotaInput> = {
  minimalInput,
  minimalInputWeekendNights,
  minimalInputWeekendNightsAllLtft,
  minimalInputWeekdayNights,
  minimalInputWeekdayMaxConsec3,
  minimalInputFullNights,
  minimalInputWithOverdeductedLeave,
  minimalInputWithOncallSlot,
  minimalInputWithNroc,
};

// ─── CLI args ─────────────────────────────────────────────────

const TRACE_INPUT = process.argv[2] ?? '/tmp/rotagen_trace.jsonl';
const DIAG_OUTPUT = process.argv[3] ?? '/tmp/rotagen_diagnostics.jsonl';
const FIXTURE_NAME = process.argv[4] ?? 'minimalInputFullNights';

const input = FIXTURES[FIXTURE_NAME];
if (!input) {
  console.error(`Unknown fixture: ${FIXTURE_NAME}`);
  console.error(`Available: ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(1);
}

// ─── Diagnostic event taxonomy ───────────────────────────────

type Doctor = FinalRotaInput['doctors'][0];

interface EligibilityInputs {
  matrixStatus: AvailabilityStatus | 'missing';
  nextDayMatrixStatus: AvailabilityStatus | 'missing' | 'past-period';
  ltftDaysOff: string[];
  ltftDaysBlocked: string[];
  nocDateHit: boolean;
  grade: string;
  slotPermittedGrades: string[];
  doctorCompetencies: { hasIac: boolean; hasIaoc: boolean; hasIcu: boolean; hasTransfer: boolean };
  slotRequirements: { reqIac: number; reqIaoc: number; reqIcu: number; reqTransfer: number };
  exemptFromNights: boolean;
  exemptFromWeekends: boolean;
  exemptFromOncall: boolean;
  slotIsOncall: boolean;
  slotIsNight: boolean;
  shiftOverlapsWeekend: boolean;
}

interface PerDoctorVerdict {
  doctorId: string;
  passes: {
    eligibility: boolean;
    csa: { pass: boolean; failedRule?: string; reason?: string } | null;
    blocks: Array<{
      patternId: BlockPatternId;
      blockDates: string[];
      ltft: { allowed: boolean; disposition: string; blockedReason?: string };
      csb: { pass: boolean; failedRule?: string; reason?: string };
    }>;
  };
  firstFailingRule: string;
  ruleDetails: string;
  // Populated only when firstFailingRule === 'eligibility'.
  eligibilityInputs?: EligibilityInputs;
}

type DiagnosticEvent =
  | {
      type: 'unfilled_postmortem';
      anchorDate: string;
      nightShiftKey: string;
      pathTaken: string;
      slot: { date: string; shiftKey: string; slotIndex: number; isCritical: boolean };
      perDoctor: PerDoctorVerdict[];
    }
  | {
      type: 'stale_read_check';
      phase: PhaseId;
      anchorDate: string;
      nightShiftKey: string;
      doctorId: string;
      fieldName: 'consecutiveShiftDates' | 'consecutiveNightDates' | 'consecutiveLongDates';
      engineReadLength: number;
      engineReadValue: string[];
      calendarTruthLength: number;
      calendarTruthValue: string[];
      divergent: boolean;
      wouldHaveChangedDecision: boolean | null;
      decisionAttributionReason: string;
    }
  | {
      type: 'temporal_inversion_check';
      phase: PhaseId;
      anchorDate: string;
      nightShiftKey: string;
      doctorId: string;
      fieldName: 'consecutiveShiftDates' | 'consecutiveNightDates' | 'consecutiveLongDates';
      engineReadLength: number;
      engineReadValue: string[];
      calendarTruthAnchored: number;     // streak ending at anchorDate − 1 day
      calendarTruthAnchoredValue: string[];
      calendarTruthRecent: number;       // existing stale_read_check truth (most-recent commit)
      hasFutureAssignments: boolean;     // any commit date > anchorDate at snapshot time
      capForField: number;
      divergent: boolean;                // engineReadLength !== calendarTruthAnchored
      wouldHaveChangedDecision: boolean | null;
      decisionAttributionReason: string;
    };

// ─── Trace event reader ──────────────────────────────────────

function readTraceEvents(path: string): TraceEvent[] {
  const raw = fs.readFileSync(path, 'utf-8');
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as TraceEvent);
}

// ─── DoctorState reconstruction from snapshot ────────────────
// CSA / CSB read several InternalDayAssignment fields not in the
// AssignmentSummary projection. Look them up from the input fixture
// to reconstruct full assignments.

function snapshotToInternalAssignment(
  s: AssignmentSummary,
): InternalDayAssignment | null {
  const dk = getDayKeyUtc(s.date);
  const slot = input.preRotaInput.shiftSlots.find(
    (e) => e.shiftKey === s.shiftKey && e.dayKey === dk,
  );
  if (!slot) return null;
  return {
    doctorId: s.doctorId,
    shiftKey: s.shiftKey,
    shiftId: slot.shiftId,
    slotIndex: 0,
    slotLabel: null,
    durationHours: s.durationHours,
    startTime: slot.startTime,
    endTime: slot.endTime,
    shiftStartMs: s.shiftStartMs,
    shiftEndMs: s.shiftStartMs + s.durationHours * 3_600_000,
    isNightShift: s.isNightShift,
    isOncall: s.isOncall,
    isLong: s.isLong,
    blockId: s.blockId,
    badges: [...slot.badges],
    violations: [],
  };
}

function snapshotToDoctorState(pds: PerDoctorStateSnapshot): DoctorState {
  return {
    doctorId: pds.doctorId,
    assignments: pds.assignments
      .map(snapshotToInternalAssignment)
      .filter((a): a is InternalDayAssignment => a !== null),
    restUntilMs: pds.restUntilMs,
    weeklyHoursUsed: { ...pds.weeklyHoursUsed },
    consecutiveShiftDates: [...pds.consecutiveShiftDates],
    consecutiveNightDates: [...pds.consecutiveNightDates],
    consecutiveLongDates: [...pds.consecutiveLongDates],
    weekendDatesWorked: [...pds.weekendDatesWorked],
    nightBlockHistory: [],
    oncallDatesLast7: [...pds.oncallDatesLast7],
    bucketHoursUsed: { ...pds.bucketHoursUsed },
    lieuDatesStaged: [],
    actualHoursByShiftType: { ...pds.actualHoursByShiftType },
    debtCarriedForwardByShiftType: {},
    unallocatedContractualHours: 0,
  };
}

// ─── Eligibility-input capture (data, not derivation) ────────
// When isSlotEligible returns false we capture the inputs that
// informed it. Step 5's analyser interprets these into a
// human-readable cause; we do not re-derive cause here.

function captureEligibilityInputs(
  doctor: Doctor,
  slot: ShiftSlotEntry,
  slotIndex: number,
  date: string,
  matrix: AvailabilityMatrix,
  periodEndIso: string,
): EligibilityInputs {
  const matrixStatus =
    (matrix[doctor.doctorId]?.[date] as AvailabilityStatus | undefined) ?? 'missing';
  const slotDef = slot.slots[slotIndex];
  const slotReqs = slotDef
    ? {
        reqIac: slotDef.reqIac,
        reqIaoc: slotDef.reqIaoc,
        reqIcu: slotDef.reqIcu,
        reqTransfer: slotDef.reqTransfer,
      }
    : { reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0 };
  const slotPermittedGrades = slotDef ? [...slotDef.permittedGrades] : [];
  const isNight = slot.badges.includes('night');
  let nextDayMatrixStatus: AvailabilityStatus | 'missing' | 'past-period' = 'past-period';
  if (isNight) {
    const nextIso = addDaysUtc(date, 1);
    if (nextIso <= periodEndIso) {
      nextDayMatrixStatus =
        (matrix[doctor.doctorId]?.[nextIso] as AvailabilityStatus | undefined) ?? 'missing';
    }
  }
  const { startMs, endMs } = parseShiftTimes(slot, date);
  // shift-overlaps-weekend via crude inspection (Sat/Sun touched).
  let shiftOverlapsWeekend = false;
  let cursorMs = startMs;
  while (cursorMs < endMs) {
    const dow = new Date(cursorMs).getUTCDay();
    if (dow === 0 || dow === 6) {
      shiftOverlapsWeekend = true;
      break;
    }
    cursorMs += 3_600_000; // hour increment is sufficient for any plausible shift
  }
  return {
    matrixStatus,
    nextDayMatrixStatus,
    ltftDaysOff: doctor.ltft?.daysOff ?? [],
    ltftDaysBlocked: doctor.constraints.hard.ltftDaysBlocked,
    nocDateHit: doctor.constraints.soft.nocDates.includes(date),
    grade: doctor.grade,
    slotPermittedGrades,
    doctorCompetencies: {
      hasIac: doctor.hasIac,
      hasIaoc: doctor.hasIaoc,
      hasIcu: doctor.hasIcu,
      hasTransfer: doctor.hasTransfer,
    },
    slotRequirements: slotReqs,
    exemptFromNights: doctor.constraints.hard.exemptFromNights,
    exemptFromWeekends: doctor.constraints.hard.exemptFromWeekends,
    exemptFromOncall: doctor.constraints.hard.exemptFromOncall,
    slotIsOncall: slot.isOncall,
    slotIsNight: isNight,
    shiftOverlapsWeekend,
  };
}

// ─── Candidate block enumeration ─────────────────────────────
// For an unfilled (date, anchor, kind) tuple, list the block
// patterns from the dictionary that contain `date` when anchored
// at `anchorDate`. Used only for CSB attribution; we don't try to
// guess the engine's exact attempt order.

interface CandidateBlock {
  patternId: BlockPatternId;
  blockDates: string[];
}

function enumerateCandidateBlocks(
  unfilledDate: string,
  anchorDate: string,
  kind: 'weekend' | 'weekday',
): CandidateBlock[] {
  const dict = buildBlockDictionary();
  const out: CandidateBlock[] = [];

  // Weekend anchor = Saturday. Weekday anchor = Monday.
  // Saturday's ISO DOW = 6 (UTC).
  const offsetsToTry: number[] = kind === 'weekend' ? [-1, 0, 1, 2, 3] : [0, 1, 2, 3, 4];

  for (const pattern of dict) {
    // Compute the pattern's dates anchored at `anchorDate`. The
    // pattern's startDow tells us where the first night falls.
    const anchorDowUtc = new Date(`${anchorDate}T00:00:00Z`).getUTCDay();
    const anchorIsoDow = anchorDowUtc === 0 ? 7 : anchorDowUtc;
    // Offset from anchor to the pattern's first night.
    const offsetToFirstNight = pattern.startDow - anchorIsoDow;
    // Block can sit anywhere in the surrounding 5-day window of the anchor.
    const blockDates: string[] = [];
    let valid = true;
    for (let i = 0; i < pattern.length; i += 1) {
      const cand = addDaysUtc(anchorDate, offsetToFirstNight + i);
      if (
        cand < input.preRotaInput.period.startDate ||
        cand > input.preRotaInput.period.endDate
      ) {
        valid = false;
        break;
      }
      // Restrict to the anchor's natural window.
      const offsetFromAnchor = offsetToFirstNight + i;
      if (!offsetsToTry.includes(offsetFromAnchor)) {
        valid = false;
        break;
      }
      blockDates.push(cand);
    }
    if (!valid) continue;
    if (!blockDates.includes(unfilledDate)) continue;
    out.push({ patternId: pattern.id, blockDates });
  }
  return out;
}

// ─── Per-doctor verdict for an unfilled slot ─────────────────

function verdictForDoctor(
  doctor: Doctor,
  unfilledSlot: UnfilledSlotSummary,
  anchorDate: string,
  kind: 'weekend' | 'weekday',
  matrix: AvailabilityMatrix,
  pds: PerDoctorStateSnapshot,
): PerDoctorVerdict {
  const periodEndIso = input.preRotaInput.period.endDate;
  const totalWeeks = input.preRotaInput.period.totalWeeks;
  const wtr = input.preRotaInput.wtrConstraints;

  // Find the slot for this date+shiftKey.
  const dk = getDayKeyUtc(unfilledSlot.date);
  const slot = input.preRotaInput.shiftSlots.find(
    (s) => s.shiftKey === unfilledSlot.shiftKey && s.dayKey === dk,
  );
  if (!slot) {
    return {
      doctorId: doctor.doctorId,
      passes: { eligibility: false, csa: null, blocks: [] },
      firstFailingRule: 'no-slot-found',
      ruleDetails: `no ShiftSlotEntry for ${unfilledSlot.shiftKey} on ${dk}`,
    };
  }

  const eligOk = isSlotEligible(
    doctor,
    slot,
    unfilledSlot.slotIndex,
    unfilledSlot.date,
    matrix,
    periodEndIso,
  );
  if (!eligOk) {
    const inputs = captureEligibilityInputs(
      doctor,
      slot,
      unfilledSlot.slotIndex,
      unfilledSlot.date,
      matrix,
      periodEndIso,
    );
    return {
      doctorId: doctor.doctorId,
      passes: { eligibility: false, csa: null, blocks: [] },
      firstFailingRule: 'eligibility',
      ruleDetails:
        'isSlotEligible returned false; see eligibilityInputs for the data informing the decision',
      eligibilityInputs: inputs,
    };
  }

  const state = snapshotToDoctorState(pds);

  // CSA — single-shift WTR.
  const csa = checkSequenceA(doctor, unfilledSlot.date, slot, state, wtr, totalWeeks);

  // Block-level: enumerate candidate blocks containing this date.
  const candidates = enumerateCandidateBlocks(unfilledSlot.date, anchorDate, kind);
  const blockVerdicts: PerDoctorVerdict['passes']['blocks'] = [];
  for (const cand of candidates) {
    const dict = buildBlockDictionary();
    const pattern = dict.find((p) => p.id === cand.patternId);
    if (!pattern) continue;
    const ltft = checkLtftDisposition(pattern, cand.blockDates, doctor);
    const csb = checkSequenceB(
      doctor,
      cand.blockDates,
      slot,
      state,
      wtr,
      matrix,
      totalWeeks,
      periodEndIso,
    );
    blockVerdicts.push({
      patternId: cand.patternId,
      blockDates: cand.blockDates,
      ltft: {
        allowed: ltft.allowed,
        disposition: ltft.disposition,
        blockedReason: ltft.blockedReason,
      },
      csb: { pass: csb.pass, failedRule: csb.failedRule, reason: csb.reason },
    });
  }

  // Pick the first failing rule. Order: CSA fails > all-blocks-fail > "no failure detected".
  let firstFailingRule = 'none-detected';
  let ruleDetails = 'CSA passed; at least one candidate block also passes (eligible candidate)';
  if (!csa.pass) {
    firstFailingRule = `csa:${csa.failedRule ?? 'unknown'}`;
    ruleDetails = csa.reason ?? 'CSA failed';
  } else if (blockVerdicts.length > 0) {
    const anyAllowed = blockVerdicts.some((b) => b.ltft.allowed && b.csb.pass);
    if (!anyAllowed) {
      // Pick the most-permissive failure: prefer LTFT-allowed blocks that fail CSB; surface the CSB failedRule.
      const ltftAllowed = blockVerdicts.filter((b) => b.ltft.allowed);
      if (ltftAllowed.length > 0) {
        const v = ltftAllowed[0];
        firstFailingRule = `csb:${v.csb.failedRule ?? 'unknown'}`;
        ruleDetails = `pattern ${v.patternId}: ${v.csb.reason ?? 'CSB failed'}`;
      } else {
        const v = blockVerdicts[0];
        firstFailingRule = `ltft:${v.ltft.disposition}`;
        ruleDetails = `pattern ${v.patternId}: ${v.ltft.blockedReason ?? v.ltft.disposition}`;
      }
    }
  } else {
    firstFailingRule = 'no-candidate-blocks';
    ruleDetails =
      'no block pattern in the dictionary places this date relative to the anchor';
  }

  return {
    doctorId: doctor.doctorId,
    passes: {
      eligibility: true,
      csa: { pass: csa.pass, failedRule: csa.failedRule, reason: csa.reason },
      blocks: blockVerdicts,
    },
    firstFailingRule,
    ruleDetails,
  };
}

// ─── Calendar-truth recompute for stale-read attribution ─────

function lastConsecutiveTail(
  dates: readonly string[],
): { length: number; value: string[] } {
  if (dates.length === 0) return { length: 0, value: [] };
  const sorted = [...dates].sort();
  const out: string[] = [sorted[sorted.length - 1]];
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    if (addDaysUtc(sorted[i], 1) === out[0]) {
      out.unshift(sorted[i]);
    } else {
      break;
    }
  }
  return { length: out.length, value: out };
}

function calendarTruth(
  field: 'consecutiveShiftDates' | 'consecutiveNightDates' | 'consecutiveLongDates',
  pds: PerDoctorStateSnapshot,
): { length: number; value: string[] } {
  const all = pds.assignments;
  let filtered: AssignmentSummary[];
  if (field === 'consecutiveShiftDates') {
    filtered = all;
  } else if (field === 'consecutiveNightDates') {
    filtered = all.filter((a) => a.isNightShift);
  } else {
    filtered = all.filter((a) => a.isLong);
  }
  // De-dup by date (multiple assignments same date shouldn't happen,
  // but defensive).
  const uniqueDates = Array.from(new Set(filtered.map((a) => a.date)));
  return lastConsecutiveTail(uniqueDates);
}

// ─── Temporal-inversion calendar truth ───────────────────────
// Anchors at `anchorDate − 1 day` (the day that would be CSB's
// "prior" day for a block starting at the anchor). Returns the
// contiguous tail of matching commits ending at exactly anchorDate−1
// — or 0 if no commit lands on anchorDate−1. Forward-committed dates
// (date > anchorDate) are excluded from the tail computation
// regardless of contiguity.

function calendarTruthAnchored(
  field: 'consecutiveShiftDates' | 'consecutiveNightDates' | 'consecutiveLongDates',
  pds: PerDoctorStateSnapshot,
  anchorDate: string,
): { length: number; value: string[]; hasFutureAssignments: boolean } {
  const all = pds.assignments;
  let filtered: AssignmentSummary[];
  if (field === 'consecutiveShiftDates') {
    filtered = all;
  } else if (field === 'consecutiveNightDates') {
    filtered = all.filter((a) => a.isNightShift);
  } else {
    filtered = all.filter((a) => a.isLong);
  }
  const uniqueDates = Array.from(new Set(filtered.map((a) => a.date)));
  const dayBeforeAnchor = addDaysUtc(anchorDate, -1);
  // hasFutureAssignments: any commit date strictly > anchorDate.
  const hasFutureAssignments = uniqueDates.some((d) => d > anchorDate);
  // Strict-prior dates: <= anchorDate-1.
  const priorDates = uniqueDates.filter((d) => d <= dayBeforeAnchor);
  if (priorDates.length === 0) {
    return { length: 0, value: [], hasFutureAssignments };
  }
  const sorted = [...priorDates].sort();
  // The tail must END exactly at anchorDate-1 to count as "prior streak
  // ending immediately before evaluation". Otherwise the streak is
  // broken by a calendar gap and prior = 0.
  if (sorted[sorted.length - 1] !== dayBeforeAnchor) {
    return { length: 0, value: [], hasFutureAssignments };
  }
  // Walk backward to find contiguous tail.
  const out: string[] = [sorted[sorted.length - 1]];
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    if (addDaysUtc(sorted[i], 1) === out[0]) {
      out.unshift(sorted[i]);
    } else {
      break;
    }
  }
  return { length: out.length, value: out, hasFutureAssignments };
}

// ─── Main ─────────────────────────────────────────────────────

const events = readTraceEvents(TRACE_INPUT);
const matrix = buildAvailabilityMatrix(input);
const wtr = input.preRotaInput.wtrConstraints;

const diagnostics: DiagnosticEvent[] = [];

// Index state_snapshot by (anchor, key) so we can pair with subpass_result.
const snapshotByAnchorKey = new Map<string, PerDoctorStateSnapshot[]>();
for (const ev of events) {
  if (ev.type !== 'state_snapshot') continue;
  const k = `${ev.anchorDate}#${ev.nightShiftKey}`;
  snapshotByAnchorKey.set(k, ev.perDoctor);
}

// Pair each subpass_result with its preceding state_snapshot.
for (const ev of events) {
  if (ev.type !== 'subpass_result') continue;
  const k = `${ev.anchorDate}#${ev.nightShiftKey}`;
  const snapshot = snapshotByAnchorKey.get(k);
  if (!snapshot) continue;

  // Per-unfilled-slot postmortem.
  for (const u of ev.unfilledSlots) {
    const perDoctor: PerDoctorVerdict[] = [];
    for (const doctor of input.doctors) {
      const pds = snapshot.find((s) => s.doctorId === doctor.doctorId);
      if (!pds) continue;
      perDoctor.push(verdictForDoctor(doctor, u, ev.anchorDate, ev.kind, matrix, pds));
    }
    diagnostics.push({
      type: 'unfilled_postmortem',
      anchorDate: ev.anchorDate,
      nightShiftKey: ev.nightShiftKey,
      pathTaken: ev.pathTaken,
      slot: u,
      perDoctor,
    });
  }

  // Per-(doctor, field) stale-read check.
  for (const pds of snapshot) {
    for (const field of [
      'consecutiveShiftDates',
      'consecutiveNightDates',
      'consecutiveLongDates',
    ] as const) {
      const engineRead = pds[field];
      const truth = calendarTruth(field, pds);
      const divergent = engineRead.length !== truth.length;
      let wouldHaveChangedDecision: boolean | null = null;
      let reason: string;
      if (!divergent) {
        reason = 'no divergence';
      } else {
        // Was this doctor assigned by the following sub-pass?
        const doctorAssigned = ev.assignments.some(
          (a) => a.doctorId === pds.doctorId,
        );
        if (doctorAssigned) {
          reason = 'divergent but doctor was assigned; rejection did not occur';
        } else {
          // Was the rejection due to the consecutive cap for this field?
          let cap: number;
          if (field === 'consecutiveShiftDates') cap = wtr.maxConsecutive.standard;
          else if (field === 'consecutiveNightDates') cap = wtr.maxConsecutive.nights;
          else cap = wtr.maxConsecutive.long;
          if (engineRead.length >= cap && truth.length < cap) {
            wouldHaveChangedDecision = true;
            reason = `engine read (${engineRead.length}) >= cap (${cap}); calendar truth (${truth.length}) < cap`;
          } else {
            reason =
              'divergent but not cap-crossing; post-hoc attribution requires synthetic re-run, not performed';
          }
        }
      }
      diagnostics.push({
        type: 'stale_read_check',
        phase: ev.phase,
        anchorDate: ev.anchorDate,
        nightShiftKey: ev.nightShiftKey,
        doctorId: pds.doctorId,
        fieldName: field,
        engineReadLength: engineRead.length,
        engineReadValue: [...engineRead],
        calendarTruthLength: truth.length,
        calendarTruthValue: truth.value,
        divergent,
        wouldHaveChangedDecision,
        decisionAttributionReason: reason,
      });

      // ── Temporal-inversion check (anchored at anchorDate − 1) ──
      // Same doctor, field, and snapshot, but with the calendar
      // truth re-anchored to "streak ending at anchorDate − 1 day"
      // — the temporally-correct prior streak for evaluation at the
      // sub-pass anchor. Forward-committed dates are excluded from
      // the tail.
      const truthAnchored = calendarTruthAnchored(field, pds, ev.anchorDate);
      const inversionDivergent = engineRead.length !== truthAnchored.length;
      let inversionCap: number;
      if (field === 'consecutiveShiftDates') inversionCap = wtr.maxConsecutive.standard;
      else if (field === 'consecutiveNightDates') inversionCap = wtr.maxConsecutive.nights;
      else inversionCap = wtr.maxConsecutive.long;
      let inversionDecision: boolean | null = null;
      let inversionReason: string;
      if (!inversionDivergent) {
        inversionReason = 'no divergence at anchor';
      } else {
        const doctorAssigned = ev.assignments.some(
          (a) => a.doctorId === pds.doctorId,
        );
        if (doctorAssigned) {
          if (
            engineRead.length >= inversionCap &&
            truthAnchored.length < inversionCap
          ) {
            // Engine over-read but doctor was still assigned. Either the
            // engine has compensating logic OR the over-read didn't
            // actually fire the cap rejection (perhaps another check
            // that wasn't strictly cap-bound). Surface explicitly.
            inversionDecision = false;
            inversionReason = `engine over-read (${engineRead.length} >= cap ${inversionCap}) but doctor was assigned; engine apparently let them through despite inflated read — investigate compensating logic`;
          } else {
            inversionReason = 'divergent at anchor but doctor was assigned; rejection did not occur';
          }
        } else {
          if (
            engineRead.length >= inversionCap &&
            truthAnchored.length < inversionCap
          ) {
            inversionDecision = true;
            inversionReason = `engine read (${engineRead.length}) >= cap (${inversionCap}); calendar truth at anchor (${truthAnchored.length}) < cap; doctor rejected`;
          } else {
            inversionReason = `divergent at anchor but not cap-crossing (engine ${engineRead.length}, truth ${truthAnchored.length}, cap ${inversionCap})`;
          }
        }
      }
      diagnostics.push({
        type: 'temporal_inversion_check',
        phase: ev.phase,
        anchorDate: ev.anchorDate,
        nightShiftKey: ev.nightShiftKey,
        doctorId: pds.doctorId,
        fieldName: field,
        engineReadLength: engineRead.length,
        engineReadValue: [...engineRead],
        calendarTruthAnchored: truthAnchored.length,
        calendarTruthAnchoredValue: truthAnchored.value,
        calendarTruthRecent: truth.length,
        hasFutureAssignments: truthAnchored.hasFutureAssignments,
        capForField: inversionCap,
        divergent: inversionDivergent,
        wouldHaveChangedDecision: inversionDecision,
        decisionAttributionReason: inversionReason,
      });
    }
  }
}

const lines = diagnostics.map((d) => JSON.stringify(d)).join('\n') + '\n';
fs.writeFileSync(DIAG_OUTPUT, lines);

console.log(`postRunDiagnostics — wrote ${diagnostics.length} events to ${DIAG_OUTPUT}`);
const counts: Record<string, number> = {};
for (const d of diagnostics) counts[d.type] = (counts[d.type] ?? 0) + 1;
console.log(`  by type:`, counts);
process.exit(0);
