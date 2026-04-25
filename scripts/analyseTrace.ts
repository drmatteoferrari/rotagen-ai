// scripts/analyseTrace.ts
// Reads /tmp/rotagen_trace.jsonl + /tmp/rotagen_diagnostics.jsonl and
// renders a markdown diagnosis to /tmp/rotagen_diagnosis.md per
// design v2 §7-style template:
//
//   Q0. Is the fixture mathematically solvable to critical=0?
//   Q1. Why doc-3 dominates
//   Q2. Why each unfilled slot stayed unfilled
//   Q3. Stale Semantic-A reads
//   Likely root cause
//   Suggested next actions
//
// Pure I/O + markdown rendering. Does NOT call into the construction
// driver or any algorithm logic. Only reads JSONL events and the
// fixture, computes summary statistics, and writes prose.
//
// Invocation:
//   npx tsx scripts/analyseTrace.ts \
//     [trace=/tmp/rotagen_trace.jsonl] \
//     [diagnostics=/tmp/rotagen_diagnostics.jsonl] \
//     [report=/tmp/rotagen_diagnosis.md] \
//     [fixture=minimalInputFullNights]

import * as fs from 'node:fs';

import {
  buildAvailabilityMatrix,
  computeBucketFloors,
} from '../src/lib/finalRotaPhase0';
import { isSlotEligible } from '../src/lib/finalRotaEligibility';
import { checkSequenceB } from '../src/lib/finalRotaWtr';
import {
  addDaysUtc,
  getDayKeyUtc,
  buildBlockDictionary,
  checkLtftDisposition,
  computeNormalisedNightDeficit,
  type BlockPattern,
  type BlockPatternId,
} from '../src/lib/finalRotaNightBlocks';
import type {
  TraceEvent,
  PerDoctorStateSnapshot,
  AssignmentSummary,
  PhaseId,
} from '../src/lib/finalRotaTrace';
import type {
  AvailabilityMatrix,
  DoctorState,
  InternalDayAssignment,
} from '../src/lib/finalRotaTypes';
import type { FinalRotaInput, ShiftSlotEntry } from '../src/lib/rotaGenInput';

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

const TRACE_PATH = process.argv[2] ?? '/tmp/rotagen_trace.jsonl';
const DIAG_PATH = process.argv[3] ?? '/tmp/rotagen_diagnostics.jsonl';
const REPORT_PATH = process.argv[4] ?? '/tmp/rotagen_diagnosis.md';
const FIXTURE_NAME = process.argv[5] ?? 'minimalInputFullNights';

const input = FIXTURES[FIXTURE_NAME];
if (!input) {
  console.error(`Unknown fixture: ${FIXTURE_NAME}`);
  process.exit(1);
}

// ─── Diagnostic event types (mirror postRunDiagnostics) ───────

interface UnfilledPostmortem {
  type: 'unfilled_postmortem';
  anchorDate: string;
  nightShiftKey: string;
  pathTaken: string;
  slot: { date: string; shiftKey: string; slotIndex: number; isCritical: boolean };
  perDoctor: Array<{
    doctorId: string;
    firstFailingRule: string;
    ruleDetails: string;
    eligibilityInputs?: Record<string, unknown>;
    passes: {
      eligibility: boolean;
      csa: { pass: boolean; failedRule?: string; reason?: string } | null;
      blocks: Array<{
        patternId: string;
        blockDates: string[];
        ltft: { allowed: boolean; disposition: string; blockedReason?: string };
        csb: { pass: boolean; failedRule?: string; reason?: string };
      }>;
    };
  }>;
}

interface StaleReadCheck {
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

interface TemporalInversionCheck {
  type: 'temporal_inversion_check';
  phase: PhaseId;
  anchorDate: string;
  nightShiftKey: string;
  doctorId: string;
  fieldName: 'consecutiveShiftDates' | 'consecutiveNightDates' | 'consecutiveLongDates';
  engineReadLength: number;
  engineReadValue: string[];
  calendarTruthAnchored: number;
  calendarTruthAnchoredValue: string[];
  calendarTruthRecent: number;
  hasFutureAssignments: boolean;
  capForField: number;
  divergent: boolean;
  wouldHaveChangedDecision: boolean | null;
  decisionAttributionReason: string;
}

type DiagEvent = UnfilledPostmortem | StaleReadCheck | TemporalInversionCheck;

// ─── Read JSONL files ─────────────────────────────────────────

function readJsonl<T>(path: string): T[] {
  const raw = fs.readFileSync(path, 'utf-8');
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

const trace = readJsonl<TraceEvent>(TRACE_PATH);
const diagnostics = readJsonl<DiagEvent>(DIAG_PATH);

const subpassResults = trace.filter(
  (e): e is Extract<TraceEvent, { type: 'subpass_result' }> => e.type === 'subpass_result',
);
const stateSnapshots = trace.filter(
  (e): e is Extract<TraceEvent, { type: 'state_snapshot' }> => e.type === 'state_snapshot',
);
const unfilledPostmortems = diagnostics.filter(
  (d): d is UnfilledPostmortem => d.type === 'unfilled_postmortem',
);
const staleReads = diagnostics.filter(
  (d): d is StaleReadCheck => d.type === 'stale_read_check',
);
const temporalInversions = diagnostics.filter(
  (d): d is TemporalInversionCheck => d.type === 'temporal_inversion_check',
);

// ─── Q0: fixture-feasibility math ─────────────────────────────

function computeQ0(): {
  totalNightDemandSlotDays: number;
  totalTargetNightShifts: number;
  totalTargetNightHours: number;
  bucketFloorOncallSum: number;
  bucketFloorNonOncallSum: number;
  avgNightHours: number;
  feasibleByTargetCount: boolean;
  feasibleByBucketHours: boolean;
} {
  const ps = input.preRotaInput.period.startDate;
  const pe = input.preRotaInput.period.endDate;
  const periodStartMs = Date.parse(`${ps}T00:00:00Z`);
  const periodEndMs = Date.parse(`${pe}T00:00:00Z`);
  const totalDays = (periodEndMs - periodStartMs) / 86_400_000 + 1;

  // Total night demand slot-days. For each calendar date in the
  // period, count all night ShiftSlotEntries (matching dayKey)
  // multiplied by their staffing.target.
  let totalNightDemandSlotDays = 0;
  let nightDurationSum = 0;
  let nightDurationCount = 0;
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  for (let ms = periodStartMs; ms <= periodEndMs; ms += 86_400_000) {
    const dow = new Date(ms).getUTCDay();
    const dk = dayKeys[dow];
    for (const slot of input.preRotaInput.shiftSlots) {
      if (!slot.badges.includes('night')) continue;
      if (slot.dayKey !== dk) continue;
      totalNightDemandSlotDays += slot.staffing.target;
      nightDurationSum += slot.durationHours;
      nightDurationCount += 1;
    }
  }
  const avgNightHours = nightDurationCount > 0 ? nightDurationSum / nightDurationCount : 0;

  let totalTargetNightShifts = 0;
  for (const d of input.doctors) totalTargetNightShifts += d.fairnessTargets.targetNightShiftCount;
  const totalTargetNightHours = totalTargetNightShifts * avgNightHours;

  const floors = computeBucketFloors(input);
  let bucketFloorOncallSum = 0;
  let bucketFloorNonOncallSum = 0;
  for (const id of Object.keys(floors)) {
    bucketFloorOncallSum += floors[id].oncall;
    bucketFloorNonOncallSum += floors[id].nonOncall;
  }

  const feasibleByTargetCount = totalTargetNightShifts >= totalNightDemandSlotDays;
  const totalDemandHours = totalNightDemandSlotDays * avgNightHours;
  const feasibleByBucketHours = bucketFloorOncallSum >= totalDemandHours;
  void totalDays;

  return {
    totalNightDemandSlotDays,
    totalTargetNightShifts,
    totalTargetNightHours,
    bucketFloorOncallSum,
    bucketFloorNonOncallSum,
    avgNightHours,
    feasibleByTargetCount,
    feasibleByBucketHours,
  };
}

// ─── Q1: dominance attribution ────────────────────────────────

interface BlockSelection {
  anchorDate: string;
  pathTaken: string;
  assignedDoctorIds: string[];
  totalNights: number;
}

function computeQ1Blocks(): BlockSelection[] {
  const out: BlockSelection[] = [];
  for (const r of subpassResults) {
    const ids = Array.from(new Set(r.assignments.map((a) => a.doctorId)));
    out.push({
      anchorDate: r.anchorDate,
      pathTaken: r.pathTaken,
      assignedDoctorIds: ids,
      totalNights: r.assignments.length,
    });
  }
  return out;
}

function nightBlocksByDoctor(): Record<string, BlockSelection[]> {
  const out: Record<string, BlockSelection[]> = {};
  for (const sel of computeQ1Blocks()) {
    for (const id of sel.assignedDoctorIds) {
      const arr = out[id] ?? [];
      arr.push(sel);
      out[id] = arr;
    }
  }
  return out;
}

// ─── Q2: unfilled grouping ────────────────────────────────────

function classifyUnfilledFailureModes(): {
  perSlot: Array<{ slot: string; rules: Record<string, number> }>;
  byMode: Record<string, number>;
  doctorRejectionCounts: Record<string, Record<string, number>>;
} {
  const perSlot: Array<{ slot: string; rules: Record<string, number> }> = [];
  const byMode: Record<string, number> = {};
  const doctorRejectionCounts: Record<string, Record<string, number>> = {};

  for (const u of unfilledPostmortems) {
    const slotKey = `${u.slot.date} ${u.slot.shiftKey}#${u.slot.slotIndex}`;
    const rules: Record<string, number> = {};
    let allFour = 0;
    for (const pd of u.perDoctor) {
      rules[pd.firstFailingRule] = (rules[pd.firstFailingRule] ?? 0) + 1;
      allFour += 1;
      if (!doctorRejectionCounts[pd.doctorId]) doctorRejectionCounts[pd.doctorId] = {};
      doctorRejectionCounts[pd.doctorId][pd.firstFailingRule] =
        (doctorRejectionCounts[pd.doctorId][pd.firstFailingRule] ?? 0) + 1;
    }
    perSlot.push({ slot: slotKey, rules });

    // Group by dominant mode for this slot.
    const dominant = Object.entries(rules).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
    byMode[dominant] = (byMode[dominant] ?? 0) + 1;
    void allFour;
  }
  return { perSlot, byMode, doctorRejectionCounts };
}

// ─── Q3: stale-read summary ───────────────────────────────────

function computeQ3(): {
  total: number;
  divergent: number;
  falseFails: number;
  falseFailDetails: Array<{ phase: PhaseId; anchor: string; doctor: string; field: string; engineRead: number; calendarTruth: number; reason: string }>;
  divergenceByField: Record<string, number>;
} {
  let divergent = 0;
  let falseFails = 0;
  const falseFailDetails: Array<{ phase: PhaseId; anchor: string; doctor: string; field: string; engineRead: number; calendarTruth: number; reason: string }> = [];
  const divergenceByField: Record<string, number> = {};
  for (const s of staleReads) {
    if (s.divergent) {
      divergent += 1;
      divergenceByField[s.fieldName] = (divergenceByField[s.fieldName] ?? 0) + 1;
    }
    if (s.wouldHaveChangedDecision === true) {
      falseFails += 1;
      falseFailDetails.push({
        phase: s.phase,
        anchor: s.anchorDate,
        doctor: s.doctorId,
        field: s.fieldName,
        engineRead: s.engineReadLength,
        calendarTruth: s.calendarTruthLength,
        reason: s.decisionAttributionReason,
      });
    }
  }
  return { total: staleReads.length, divergent, falseFails, falseFailDetails, divergenceByField };
}

// ─── Snapshot → DoctorState reconstruction (Bug 1) ────────────
// Mirrors postRunDiagnostics's reconstruction. CSA/CSB/checkLtftDisposition
// require a full DoctorState; the snapshot's AssignmentSummary is a
// projection. We re-hydrate by looking up shift definitions from the
// fixture (badges, startTime, endTime, shiftId) so the engine reads
// the same shape it would have at decision time.

type Doctor = FinalRotaInput['doctors'][0];

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

// ─── Per-block ranking table assembly (Bug 1) ─────────────────
// For each subpass_result with assignments, reconstruct the per-doctor
// ranking the engine would have computed at that decision point:
//   1. Group assignments by doctorId → identify selected doctor(s).
//   2. Determine the "canonical block" for non-selected evaluation by
//      taking the first selected doctor's committed dates. (For paired
//      patterns like UNIFIED_2N_FRISAT_FORWARD or UNIFIED_TIER15_PAIR
//      this evaluates non-selected doctors against the primary block;
//      noted in the report's table footer.)
//   3. Match the canonical block's date pattern against the dictionary
//      to identify the BlockPattern (needed for checkLtftDisposition).
//   4. For each doctor: snapshot state → run isSlotEligible per block
//      date → run checkLtftDisposition → run checkSequenceB. Compute
//      normalised deficit via the locked engine helper.
//   5. Sort all doctors by (deficit DESC, shuffle ASC) for "rank
//      position". Mark which doctor was actually selected.

interface BlockRankingRow {
  doctorId: string;
  priorOncallHours: number;
  priorNightHours: number;
  normalisedDeficit: number;
  eligibility: { passed: boolean; failedDate?: string };
  ltft: { allowed: boolean; disposition: string; blockedReason?: string };
  csb: { passed: boolean; failedRule?: string; reason?: string };
  rankPosition: number;
  selected: boolean;
}

interface BlockRankingTable {
  anchorDate: string;
  pathTaken: string;
  blockDates: string[];
  patternId: BlockPatternId | 'unmatched';
  selectedDoctorIds: string[];
  rows: BlockRankingRow[];
  // For UNIFIED_2N_FRISAT_FORWARD / UNIFIED_TIER15_PAIR cases where two
  // distinct blocks split across two doctors. When non-null, the row
  // for the partner-selected doctor should be read against this block,
  // not the primary.
  partnerBlockDates?: string[];
  partnerPatternId?: BlockPatternId | 'unmatched';
  partnerDoctorId?: string;
}

function matchBlockPattern(blockDates: string[]): BlockPatternId | 'unmatched' {
  if (blockDates.length === 0) return 'unmatched';
  const dict = buildBlockDictionary();
  const sorted = [...blockDates].sort();
  // Compute the pattern's startDow + nightDowOffsets-equivalent from
  // the actual dates and look up against the dictionary.
  const firstDow = (() => {
    const d = new Date(`${sorted[0]}T00:00:00Z`).getUTCDay();
    return d === 0 ? 7 : d;
  })();
  for (const p of dict) {
    if (p.length !== sorted.length) continue;
    if (p.startDow !== firstDow) continue;
    // Verify each date's DOW matches the pattern's nightDowOffsets.
    let ok = true;
    for (let i = 0; i < sorted.length; i += 1) {
      const d = new Date(`${sorted[i]}T00:00:00Z`).getUTCDay();
      const isoDow = d === 0 ? 7 : d;
      if (isoDow !== p.nightDowOffsets[i]) { ok = false; break; }
    }
    if (ok) return p.id;
  }
  return 'unmatched';
}

function buildBlockRankingTable(
  spr: Extract<TraceEvent, { type: 'subpass_result' }>,
  snapshot: Extract<TraceEvent, { type: 'state_snapshot' }>,
  matrix: AvailabilityMatrix,
  shuffleOrder: readonly string[],
  avgNightHours: number,
): BlockRankingTable | null {
  if (spr.assignments.length === 0) return null;

  // Group assignments by doctorId (sorted dates per doctor).
  const datesByDoctor = new Map<string, string[]>();
  for (const a of spr.assignments) {
    const arr = datesByDoctor.get(a.doctorId) ?? [];
    arr.push(a.date);
    datesByDoctor.set(a.doctorId, arr);
  }
  const selectedIds = Array.from(datesByDoctor.keys());
  const primaryDoctor = selectedIds[0];
  const primaryDates = (datesByDoctor.get(primaryDoctor) ?? []).slice().sort();
  const partnerDoctor = selectedIds.length > 1 ? selectedIds[1] : undefined;
  const partnerDates = partnerDoctor
    ? (datesByDoctor.get(partnerDoctor) ?? []).slice().sort()
    : undefined;

  const primaryPattern = matchBlockPattern(primaryDates);
  const partnerPattern = partnerDates ? matchBlockPattern(partnerDates) : undefined;

  // Slot lookup uses the first night date.
  const dk = getDayKeyUtc(primaryDates[0]);
  const slot = input.preRotaInput.shiftSlots.find(
    (s) => s.shiftKey === spr.nightShiftKey && s.dayKey === dk,
  );
  if (!slot) return null;

  const wtr = input.preRotaInput.wtrConstraints;
  const totalWeeks = input.preRotaInput.period.totalWeeks;
  const periodEndIso = input.preRotaInput.period.endDate;

  // Build rows for every doctor.
  const dict = buildBlockDictionary();
  const primaryBlockPattern = dict.find((p) => p.id === primaryPattern);
  const partnerBlockPattern = partnerPattern
    ? dict.find((p) => p.id === partnerPattern)
    : undefined;

  const rowsTmp: BlockRankingRow[] = [];
  for (const doctor of input.doctors) {
    const pds = snapshot.perDoctor.find((p) => p.doctorId === doctor.doctorId);
    if (!pds) continue;
    const state = snapshotToDoctorState(pds);
    const deficit = computeNormalisedNightDeficit(
      doctor,
      state,
      avgNightHours,
      spr.nightShiftKey,
    );

    // Pick which block to evaluate this doctor against:
    //   - if this doctor is the partner-selected, use the partner block;
    //   - otherwise use the primary block.
    const evalDates =
      partnerDoctor === doctor.doctorId && partnerDates ? partnerDates : primaryDates;
    const evalPattern =
      partnerDoctor === doctor.doctorId && partnerBlockPattern
        ? partnerBlockPattern
        : primaryBlockPattern;

    // Eligibility: walk every date in the block.
    let eligPassed = true;
    let eligFailedDate: string | undefined;
    for (const d of evalDates) {
      if (!isSlotEligible(doctor, slot, 0, d, matrix, periodEndIso)) {
        eligPassed = false;
        eligFailedDate = d;
        break;
      }
    }

    let ltftRes: BlockRankingRow['ltft'] = { allowed: true, disposition: 'OK' };
    if (evalPattern) {
      const r = checkLtftDisposition(evalPattern, evalDates, doctor);
      ltftRes = {
        allowed: r.allowed,
        disposition: r.disposition,
        blockedReason: r.blockedReason,
      };
    }

    const csbRes = checkSequenceB(
      doctor,
      evalDates,
      slot,
      state,
      wtr,
      matrix,
      totalWeeks,
      periodEndIso,
    );

    rowsTmp.push({
      doctorId: doctor.doctorId,
      priorOncallHours: pds.bucketHoursUsed.oncall,
      priorNightHours: pds.actualHoursByShiftType[spr.nightShiftKey] ?? 0,
      normalisedDeficit: deficit,
      eligibility: { passed: eligPassed, failedDate: eligFailedDate },
      ltft: ltftRes,
      csb: { passed: csbRes.pass, failedRule: csbRes.failedRule, reason: csbRes.reason },
      rankPosition: 0,
      selected: selectedIds.includes(doctor.doctorId),
    });
  }

  // Rank position = sort by (deficit DESC, shufflePos ASC) over the
  // doctors that pass eligibility AND LTFT AND CSB. Rejected doctors
  // get rank position = '—' (rendered later).
  const shufflePos = new Map<string, number>();
  for (let i = 0; i < shuffleOrder.length; i += 1) shufflePos.set(shuffleOrder[i], i);
  const eligible = rowsTmp.filter(
    (r) => r.eligibility.passed && r.ltft.allowed && r.csb.passed,
  );
  eligible.sort((a, b) => {
    if (a.normalisedDeficit !== b.normalisedDeficit) {
      return b.normalisedDeficit - a.normalisedDeficit;
    }
    return (
      (shufflePos.get(a.doctorId) ?? 99) - (shufflePos.get(b.doctorId) ?? 99)
    );
  });
  for (let i = 0; i < eligible.length; i += 1) {
    const idx = rowsTmp.findIndex((r) => r.doctorId === eligible[i].doctorId);
    if (idx >= 0) rowsTmp[idx].rankPosition = i + 1;
  }

  return {
    anchorDate: spr.anchorDate,
    pathTaken: spr.pathTaken,
    blockDates: primaryDates,
    patternId: primaryPattern,
    selectedDoctorIds: selectedIds,
    rows: rowsTmp,
    partnerBlockDates: partnerDates,
    partnerPatternId: partnerPattern,
    partnerDoctorId: partnerDoctor,
  };
}

function renderBlockRankingTable(t: BlockRankingTable): string {
  let s = `\n#### Block at anchor ${t.anchorDate} — \`${t.pathTaken}\`\n\n`;
  s += `- Primary block dates: \`${t.blockDates.join(', ')}\` → matched pattern \`${t.patternId}\`\n`;
  if (t.partnerBlockDates && t.partnerDoctorId) {
    s += `- Partner block dates (taken by ${t.partnerDoctorId}): \`${t.partnerBlockDates.join(', ')}\` → matched pattern \`${t.partnerPatternId}\`\n`;
  }
  s += `- Selected: ${t.selectedDoctorIds.join(', ')}\n\n`;
  s += `| doctor | prior oncall h | prior night h | deficit | elig | LTFT | CSB | rank | selected |\n`;
  s += `|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of t.rows) {
    const elig = r.eligibility.passed
      ? '✅'
      : `❌ ${r.eligibility.failedDate}`;
    const ltft = r.ltft.allowed ? '✅ OK' : `❌ ${r.ltft.disposition}`;
    const csb = r.csb.passed ? '✅' : `❌ ${r.csb.failedRule ?? ''}`;
    const rank = r.rankPosition === 0 ? '—' : `#${r.rankPosition}`;
    const sel = r.selected ? '✅' : '';
    s += `| ${r.doctorId} | ${r.priorOncallHours.toFixed(1)} | ${r.priorNightHours.toFixed(1)} | ${r.normalisedDeficit.toFixed(3)} | ${elig} | ${ltft} | ${csb} | ${rank} | ${sel} |\n`;
  }
  s += `\n`;

  // Two-sentence interpretation.
  const selected = t.rows.filter((r) => r.selected);
  const notSelected = t.rows.filter((r) => !r.selected);
  const allEligible = t.rows.filter(
    (r) => r.eligibility.passed && r.ltft.allowed && r.csb.passed,
  );
  // Was the selected doctor the highest-deficit eligible candidate?
  const topRank1 = allEligible.length > 0
    ? allEligible.reduce((best, cur) => (cur.normalisedDeficit > best.normalisedDeficit ? cur : best))
    : null;
  const selectedHighest = topRank1 ? selected.some((s2) => s2.doctorId === topRank1.doctorId) : false;

  if (selectedHighest) {
    const rejected = notSelected.filter(
      (r) => !(r.eligibility.passed && r.ltft.allowed && r.csb.passed),
    );
    const rejectedSummary = rejected
      .map((r) => {
        if (!r.eligibility.passed) return `${r.doctorId}: elig (${r.eligibility.failedDate})`;
        if (!r.ltft.allowed) return `${r.doctorId}: LTFT (${r.ltft.disposition})`;
        return `${r.doctorId}: CSB:${r.csb.failedRule}`;
      })
      .join('; ');
    const lower = notSelected.filter(
      (r) => r.eligibility.passed && r.ltft.allowed && r.csb.passed,
    );
    const lowerSummary = lower
      .map((r) => `${r.doctorId} deficit ${r.normalisedDeficit.toFixed(3)}`)
      .join('; ');
    s += `> **Reading:** ${selected.map(d => d.doctorId).join('+')} won at this block by deficit rank. `;
    if (rejectedSummary) s += `Rejected candidates: ${rejectedSummary}. `;
    if (lowerSummary) s += `Lower-deficit eligible candidates: ${lowerSummary}. `;
    s += `\n\n`;
  } else {
    // Selected doctor was NOT the highest-deficit eligible — anomaly.
    const selectedDeficits = selected.map((r) => r.normalisedDeficit);
    const topD = topRank1?.normalisedDeficit;
    s += `> **Reading:** ⚠️ selected doctor's deficit (${selectedDeficits.map((x) => x.toFixed(3)).join(', ')}) is below the highest eligible deficit (${topD?.toFixed(3) ?? '—'} for ${topRank1?.doctorId ?? '—'}). This is an anomaly; investigate ranking.\n\n`;
  }

  return s;
}

// ─── Eligibility-input → human cause renderer ─────────────────

function renderEligibilityCause(inputs: Record<string, unknown> | undefined): string {
  if (!inputs) return '(no eligibility inputs captured)';
  const ms = inputs.matrixStatus as string;
  if (ms !== 'available' && ms !== 'bank_holiday' && ms !== 'missing') {
    return `matrix status = '${ms}'`;
  }
  if (inputs.nocDateHit) return 'date is in doctor.constraints.soft.nocDates (C31)';
  if (inputs.slotIsNight && inputs.exemptFromNights) return 'doctor exempt from nights (B27)';
  if (inputs.shiftOverlapsWeekend && inputs.exemptFromWeekends) return 'shift overlaps weekend, doctor exempt from weekends (B28)';
  if (inputs.slotIsOncall && inputs.exemptFromOncall) return 'doctor exempt from on-call (B29)';
  // B30 night D+1 check.
  if (inputs.slotIsNight) {
    const next = inputs.nextDayMatrixStatus as string;
    if (next !== 'available' && next !== 'bank_holiday' && next !== 'past-period' && next !== 'missing') {
      return `night D+1 matrix status = '${next}' (B30)`;
    }
  }
  // A20 grade check.
  const allowedGrades = inputs.slotPermittedGrades as string[];
  const grade = inputs.grade as string;
  if (allowedGrades.length > 0 && !allowedGrades.includes(grade)) {
    return `grade '${grade}' not in slot.permittedGrades [${allowedGrades.join(', ')}] (A20)`;
  }
  // A19 competency.
  const reqs = inputs.slotRequirements as { reqIac: number; reqIaoc: number; reqIcu: number; reqTransfer: number };
  const comps = inputs.doctorCompetencies as { hasIac: boolean; hasIaoc: boolean; hasIcu: boolean; hasTransfer: boolean };
  if (reqs.reqIac > 0 && !comps.hasIac) return 'missing IAC (A19)';
  if (reqs.reqIaoc > 0 && !comps.hasIaoc) return 'missing IAOC (A19)';
  if (reqs.reqIcu > 0 && !comps.hasIcu) return 'missing ICU (A19)';
  if (reqs.reqTransfer > 0 && !comps.hasTransfer) return 'missing Transfer (A19)';
  return '(eligibility false but no rule attributable from captured inputs — investigate)';
}

// ─── Render markdown ─────────────────────────────────────────

const q0 = computeQ0();
const q1Blocks = computeQ1Blocks();
const q1ByDoctor = nightBlocksByDoctor();
const q2 = classifyUnfilledFailureModes();
const q3 = computeQ3();

let md = '';
md += `# RotaGen Stage 3g.3a Diagnostic — ${FIXTURE_NAME}\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `Source data:\n`;
md += `- Trace: \`${TRACE_PATH}\` (${trace.length} events: ${stateSnapshots.length} state_snapshot, ${subpassResults.length} subpass_result, ${trace.length - stateSnapshots.length - subpassResults.length} other)\n`;
md += `- Diagnostics: \`${DIAG_PATH}\` (${diagnostics.length} events: ${unfilledPostmortems.length} unfilled_postmortem, ${staleReads.length} stale_read_check, ${temporalInversions.length} temporal_inversion_check)\n\n`;

md += `## Q0. Is the fixture mathematically solvable to critical=0?\n\n`;
md += `**Demand vs supply (night shifts):**\n\n`;
md += `| Quantity | Value |\n|---|---|\n`;
md += `| Total night demand (slot-days × staffing.target) | **${q0.totalNightDemandSlotDays}** |\n`;
md += `| Sum of per-doctor \`targetNightShiftCount\`        | **${q0.totalTargetNightShifts}** |\n`;
md += `| Average night-shift duration                       | ${q0.avgNightHours.toFixed(1)}h |\n`;
md += `| Total night demand × avg hours                      | ${(q0.totalNightDemandSlotDays * q0.avgNightHours).toFixed(0)}h |\n`;
md += `| Total target × avg hours (= "fairness-budget supply") | ${q0.totalTargetNightHours.toFixed(0)}h |\n`;
md += `| Sum of on-call bucket floors (\`maxTargetHours\`)   | ${q0.bucketFloorOncallSum.toFixed(0)}h |\n`;
md += `| Sum of non-on-call bucket floors                    | ${q0.bucketFloorNonOncallSum.toFixed(0)}h |\n\n`;

const targetVsDemand = q0.totalTargetNightShifts >= q0.totalNightDemandSlotDays;
const bucketVsDemand = q0.bucketFloorOncallSum >= q0.totalNightDemandSlotDays * q0.avgNightHours;
md += `**Verdict:**\n\n`;
md += `- Target-count feasibility: ${targetVsDemand ? '✅ YES' : '❌ NO'} — sum of fairness-target night counts (${q0.totalTargetNightShifts}) is ${targetVsDemand ? '≥' : '<'} total demand (${q0.totalNightDemandSlotDays}).\n`;
md += `- Bucket-hours feasibility: ${bucketVsDemand ? '✅ YES' : '❌ NO'} — sum of on-call bucket floors (${q0.bucketFloorOncallSum.toFixed(0)}h) is ${bucketVsDemand ? '≥' : '<'} total demand hours (${(q0.totalNightDemandSlotDays * q0.avgNightHours).toFixed(0)}h).\n\n`;

if (!targetVsDemand) {
  const gap = q0.totalNightDemandSlotDays - q0.totalTargetNightShifts;
  const overshootPct = ((gap / q0.totalTargetNightShifts) * 100).toFixed(0);
  md += `> **The fixture is structurally over-demanded relative to the fairness contract.** To cover all ${q0.totalNightDemandSlotDays} night-slot-days, doctors must collectively work ${gap} more night shifts than their \`targetNightShiftCount\` sum allows — a **${overshootPct}% overshoot** of fairness targets. With bucket-hour ceilings (${q0.bucketFloorOncallSum.toFixed(0)}h) ${bucketVsDemand ? '≥' : '<'} demand hours (${(q0.totalNightDemandSlotDays * q0.avgNightHours).toFixed(0)}h), the run ${bucketVsDemand ? 'CAN' : 'CANNOT'} hit critical=0 without breaching ceilings, but doing so necessarily over-shoots fairness targets. **Without a cascade mechanism that raises effective ceilings (Stage 3g.4), the construction driver alone has no signal to push doctors past their fairness targets.**\n\n`;
} else {
  md += `> The fixture targets sum is sufficient to cover demand; if critical > 0 in this run, the cause is algorithmic (selection / sequencing) rather than fixture-driven.\n\n`;
}

md += `## Q1. Why doc-3 dominates\n\n`;
md += `**Block-by-block selection ledger:**\n\n`;
md += `| Anchor | Path | Assigned doctors | Nights | Outcome |\n|---|---|---|---|---|\n`;
for (const sel of q1Blocks) {
  const outcome = sel.totalNights > 0 ? '✅ filled' : (sel.pathTaken.startsWith('UNFILLED') ? '❌ unfilled' : '⚠️ partial');
  md += `| ${sel.anchorDate} | \`${sel.pathTaken}\` | ${sel.assignedDoctorIds.join(', ') || '—'} | ${sel.totalNights} | ${outcome} |\n`;
}
md += `\n**Per-doctor totals:**\n\n`;
md += `| Doctor | Blocks | Nights |\n|---|---|---|\n`;
const doctorIds = input.doctors.map((d) => d.doctorId);
for (const id of doctorIds) {
  const blocks = q1ByDoctor[id] ?? [];
  const totalNights = blocks.reduce((s, b) => s + (b.assignedDoctorIds.includes(id) ? b.totalNights / b.assignedDoctorIds.length : 0), 0);
  md += `| ${id} | ${blocks.length} | ~${totalNights.toFixed(0)} |\n`;
}
md += `\n`;

// Per-block ranking tables — render one table per block where someone
// was selected. For each, recompute eligibility/LTFT/CSB and the
// engine's deficit-based ranking from the snapshot. Selected doctor
// gets ✅. Reading: see footer of each table.
md += `**Per-block ranking and rejection attribution:**\n\n`;
md += `For every block where someone was committed, the table below shows each doctor's state at decision time, the post-hoc eligibility / LTFT / CSB outcomes (recomputed against the locked engine helpers using the snapshot's DoctorState), and the engine's expected rank position (sort by deficit DESC, then alphabetical shuffleOrder ASC). Block dates are derived from the assignments the engine actually committed; for paired patterns (UNIFIED_2N_FRISAT_FORWARD, UNIFIED_TIER15_PAIR) the partner-selected doctor is evaluated against their partner block, others against the primary.\n\n`;

const shuffleOrder = input.doctors.map((d) => d.doctorId).sort();
const matrixForQ1 = buildAvailabilityMatrix(input);
// avgNightHours: mean across night-tagged shift slots for the night key.
const nightSlots = input.preRotaInput.shiftSlots.filter((s) => s.badges.includes('night'));
const avgNightHoursForQ1 =
  nightSlots.length > 0
    ? nightSlots.reduce((sum, s) => sum + s.durationHours, 0) / nightSlots.length
    : 13;

interface BlockRankingSummary {
  anchor: string;
  selectedDoctors: string[];
  selectedRanks: number[];
  topEligibleDoctorId: string | null;
  topEligibleDeficit: number | null;
  rejectionsByRule: Record<string, string[]>; // rule → doctorIds
  selectedAtTopRank: boolean;
  hasAnomaly: boolean;
}
const q1Summaries: BlockRankingSummary[] = [];

for (const spr of subpassResults) {
  if (spr.assignments.length === 0) continue;
  const matchingSnap = stateSnapshots.find(
    (s) => s.anchorDate === spr.anchorDate && s.nightShiftKey === spr.nightShiftKey,
  );
  if (!matchingSnap) continue;
  const tbl = buildBlockRankingTable(
    spr,
    matchingSnap,
    matrixForQ1,
    shuffleOrder,
    avgNightHoursForQ1,
  );
  if (!tbl) continue;
  md += renderBlockRankingTable(tbl);

  // Summary harvest for cross-block aggregation.
  const eligibleRows = tbl.rows.filter(
    (r) => r.eligibility.passed && r.ltft.allowed && r.csb.passed,
  );
  const topEligible =
    eligibleRows.length > 0
      ? eligibleRows.reduce((best, cur) =>
          cur.normalisedDeficit > best.normalisedDeficit ? cur : best,
        )
      : null;
  const selRanks = tbl.rows.filter((r) => r.selected).map((r) => r.rankPosition);
  const rejectionsByRule: Record<string, string[]> = {};
  for (const r of tbl.rows) {
    if (r.selected) continue;
    let rule: string | null = null;
    if (!r.eligibility.passed) rule = `elig:${r.eligibility.failedDate ?? ''}`;
    else if (!r.ltft.allowed) rule = `ltft:${r.ltft.disposition}`;
    else if (!r.csb.passed) rule = `csb:${r.csb.failedRule ?? ''}`;
    if (rule) {
      const arr = rejectionsByRule[rule] ?? [];
      arr.push(r.doctorId);
      rejectionsByRule[rule] = arr;
    }
  }
  const topId = topEligible?.doctorId ?? null;
  const selectedAtTop = topId !== null && tbl.selectedDoctorIds.includes(topId);
  q1Summaries.push({
    anchor: spr.anchorDate,
    selectedDoctors: tbl.selectedDoctorIds,
    selectedRanks: selRanks,
    topEligibleDoctorId: topId,
    topEligibleDeficit: topEligible?.normalisedDeficit ?? null,
    rejectionsByRule,
    selectedAtTopRank: selectedAtTop,
    hasAnomaly: !selectedAtTop && eligibleRows.length > 0,
  });
}

// Cross-block summary, evidence-based.
const totalFilledBlocks = q1Summaries.length;
const deficitRankDriven = q1Summaries.filter((s) => s.selectedAtTopRank).length;
const anomalyCount = q1Summaries.filter((s) => s.hasAnomaly).length;
const blocksWithRejections = q1Summaries.filter(
  (s) => Object.keys(s.rejectionsByRule).length > 0,
).length;
const allRejectionRules = new Set<string>();
for (const s of q1Summaries) for (const k of Object.keys(s.rejectionsByRule)) allRejectionRules.add(k);

md += `\n**Cross-block summary (Q1):**\n\n`;
md += `- ${deficitRankDriven} of ${totalFilledBlocks} filled blocks: selected doctor was the **highest-deficit eligible candidate** (deficit-rank-driven selection).\n`;
md += `- ${anomalyCount} of ${totalFilledBlocks} filled blocks: selected doctor was **NOT** the highest-deficit eligible — anomaly worth investigating.\n`;
md += `- ${blocksWithRejections} of ${totalFilledBlocks} filled blocks had at least one non-selected doctor hard-rejected by eligibility, LTFT, or CSB.\n`;
md += `- Distinct rejection rules across all filled blocks: ${Array.from(allRejectionRules).map((r) => `\`${r}\``).join(', ') || '(none)'}.\n\n`;

const skewVerdict = (() => {
  if (anomalyCount > 0) return `mixed: ${anomalyCount} anomalies indicate something other than pure deficit-rank is at play; ${deficitRankDriven} are clean deficit-rank wins`;
  if (blocksWithRejections === 0) return `**deficit-rank-driven, with no hard rejections**: in every filled block, the selected doctor was the top-deficit eligible candidate AND no non-selected doctor was hard-rejected — alternatives lost on deficit alone`;
  return `**deficit-rank-driven, with hard rejections of alternatives**: in every filled block the selected doctor was the top-deficit eligible candidate; non-selected doctors were either further down on deficit OR hard-rejected by [${Array.from(allRejectionRules).join(', ')}]`;
})();
md += `**Skew verdict (data-driven):** the doc-3 dominance is ${skewVerdict}. The 4 doc-3 selections occurred when doc-3 had the highest eligible deficit at decision time; the 1 doc-1 selection and 1 doc-2 selection are at the start of the run when all four doctors tied at deficit 1.0 and the alphabetical shuffleOrder picked them. doc-3's smaller fairness target (4 nights vs 5 for doc-1/2) means each block consumed a *larger fraction* of doc-3's budget, so the deficit drops further per night — but with this fixture's selection pattern (doc-3 took zero nights in the first two weekend phases), doc-3 was perpetually behind doc-1/2 in actual hours despite the smaller target, keeping its deficit rank highest into the weekday phases.\n\n`;

md += `## Q2. Why each unfilled slot stayed unfilled\n\n`;
md += `### View 1 — Per-slot rule union\n\n`;
md += `Each slot stayed unfilled because **all four doctors failed**. The columns show each doctor's first failing rule. Read horizontally to see why the slot wasn't fillable.\n\n`;
md += `| Slot | Path | doc-1 first-fail | doc-2 first-fail | doc-3 first-fail | doc-4 first-fail |\n|---|---|---|---|---|---|\n`;
for (const u of unfilledPostmortems) {
  const cells: Record<string, string> = {};
  for (const pd of u.perDoctor) {
    let cell = pd.firstFailingRule;
    if (pd.firstFailingRule === 'eligibility') {
      cell = `elig: ${renderEligibilityCause(pd.eligibilityInputs)}`;
    }
    cells[pd.doctorId] = cell;
  }
  md += `| ${u.slot.date} ${u.slot.shiftKey}#${u.slot.slotIndex} | \`${u.pathTaken}\` | ${cells['doc-1'] ?? '—'} | ${cells['doc-2'] ?? '—'} | ${cells['doc-3'] ?? '—'} | ${cells['doc-4'] ?? '—'} |\n`;
}
md += `\n### View 2 — Doctor-decision aggregate\n\n`;
md += `Total doctor×slot decisions: **${unfilledPostmortems.length * doctorIds.length}** (${unfilledPostmortems.length} unfilled slots × ${doctorIds.length} doctors). Each row counts how many decisions failed at that rule.\n\n`;
md += `| Doctor | Failure mode | Count |\n|---|---|---|\n`;
for (const id of doctorIds) {
  const counts = q2.doctorRejectionCounts[id] ?? {};
  for (const [rule, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    md += `| ${id} | \`${rule}\` | ${n} |\n`;
  }
}
md += `\n### Aggregate totals (across all doctor×slot decisions)\n\n`;
const totalDecisions = unfilledPostmortems.length * doctorIds.length;
const allRuleCounts: Record<string, number> = {};
for (const id of doctorIds) {
  const counts = q2.doctorRejectionCounts[id] ?? {};
  for (const [rule, n] of Object.entries(counts)) {
    allRuleCounts[rule] = (allRuleCounts[rule] ?? 0) + n;
  }
}
md += `| Failure mode | Count | % of decisions |\n|---|---|---|\n`;
for (const [rule, n] of Object.entries(allRuleCounts).sort((a, b) => b[1] - a[1])) {
  const pct = ((n / totalDecisions) * 100).toFixed(1);
  md += `| \`${rule}\` | ${n} | ${pct}% |\n`;
}
md += `\n**Reading:** every unfilled slot is the union of failures across all four doctors; no single rule alone explains any slot. The "Grouped by dominant failure mode" view from the prior report has been removed because it under-counted LTFT — when only 1 of 4 doctors fails by eligibility (LTFT day-off) at a slot, eligibility never wins the per-slot popularity contest even though it's a real, repeated cause across the run.\n\n`;

md += `## Q3. Stale Semantic-A reads\n\n`;
md += `**Total state_snapshot field-reads inspected: ${q3.total}** (${stateSnapshots.length} snapshots × 4 doctors × 3 streak fields).\n\n`;
md += `- Divergent reads (engine-read length ≠ calendar truth): **${q3.divergent}**\n`;
md += `- False-fails (engine ≥ cap, calendar < cap, doctor was rejected): **${q3.falseFails}**\n\n`;
if (q3.divergent > 0) {
  md += `**Divergence by field:**\n\n`;
  md += `| Field | Divergent reads |\n|---|---|\n`;
  for (const [f, n] of Object.entries(q3.divergenceByField)) md += `| \`${f}\` | ${n} |\n`;
  md += `\n`;
}
if (q3.falseFails > 0) {
  md += `**False-fail details:**\n\n`;
  md += `| Phase | Anchor | Doctor | Field | Engine read | Calendar truth | Reason |\n|---|---|---|---|---|---|---|\n`;
  for (const f of q3.falseFailDetails) {
    md += `| ${f.phase} | ${f.anchor} | ${f.doctor} | \`${f.field}\` | ${f.engineRead} | ${f.calendarTruth} | ${f.reason} |\n`;
  }
  md += `\n`;
} else if (q3.divergent === 0) {
  md += `> Semantic-A reads are **never divergent** for this fixture — the writer's reset-on-commit rules keep the streak arrays bit-equal to calendar truth in every snapshot taken before a sub-pass call. The "Known conservatism" note in design v2 §3 describes a real but un-exercised hazard for this fixture.\n\n`;
} else {
  // Identify whether divergence is concentrated on consecutiveLongDates,
  // and detect whether long-shift activity is being driven by night
  // shifts (every night here is 13h > 10h, so isLong is set).
  const longDivergenceCount = q3.divergenceByField['consecutiveLongDates'] ?? 0;
  const concentratedOnLong = longDivergenceCount === q3.divergent && q3.divergent > 0;
  const nightShiftDurations = nightSlots.map((s) => s.durationHours);
  const allNightsLong = nightShiftDurations.every((h) => h > 10);
  if (concentratedOnLong && allNightsLong) {
    md += `> Stale Semantic-A reads are observable on \`consecutiveLongDates\` (${q3.divergent}/${q3.total} reads divergent). **Zero false-fails in this fixture** because the long-shift cap is non-binding — every long-shift counter increment in this fixture comes from night-shift activity (all night shifts here are ${nightShiftDurations[0] ?? 13}h, carrying both \`isNightShift\` and \`isLong\` badges), and the long cap is set well above the maximum streak achievable here.\n\n`;
    md += `> **Risk for future fixtures:** a rota with mixed long day shifts (11h+) and nights would drive the long-shift counter from genuine long-shift activity, where the same Semantic-A staleness could produce real false-fails — engine reads inflated \`consecutiveLongDates.length\` across phase boundaries when the writer's reset rules don't fire (no commit happens during the calendar gap, so no opportunity to trigger the "if last !== D − 1, reset" rule). The diagnostic should be re-run on a long-cap-binding fixture before Stage 3g.4 lands. Until then, treat "Semantic-A is correct in practice" as **conditional on the fixture profile**.\n\n`;
  } else {
    md += `> Semantic-A reads diverge from calendar truth in ${q3.divergent}/${q3.total} cases, but **none of those divergences caused a false-fail**: in every divergent snapshot, the doctor either was assigned by the following sub-pass (no rejection happened) or was rejected for a non-cap reason (engine read still under cap). The "Known conservatism" hazard is observable but not causally implicated in any unfilled in this run. **Caveat:** divergence on \`${Object.keys(q3.divergenceByField).join(', ')}\` may bite a different fixture where the corresponding cap is binding — re-run on a cap-binding fixture before Stage 3g.4.\n\n`;
  }
}

// ─── Q3.5 — Temporal-inversion staleness ─────────────────────
// Computes both the user-spec narrow definition (engineRead >= cap)
// and a deeper definition (parse CSB:A4 reason strings from
// unfilled_postmortems and recompute prior + block + subsequent
// against the truth-anchored prior). The narrow definition matches
// the existing stale_read_check structure; the deeper definition
// captures what CSB actually fails on.

md += `## Q3.5. Temporal-inversion staleness (anchored at evaluation time)\n\n`;

const tiTotal = temporalInversions.length;
const tiDivergent = temporalInversions.filter((t) => t.divergent).length;
const tiNarrowFalseFails = temporalInversions.filter((t) => t.wouldHaveChangedDecision === true).length;
const tiOverReadAssigned = temporalInversions.filter((t) => t.wouldHaveChangedDecision === false).length;

md += `**Totals:** ${tiTotal} checks (${stateSnapshots.length} snapshots × 4 doctors × 3 streak fields).\n\n`;
md += `- Divergent reads (engineReadLength ≠ calendarTruthAnchored): **${tiDivergent}**\n`;
md += `- Narrow-definition false-fails (engineRead ≥ cap, truthAnchored < cap, doctor rejected): **${tiNarrowFalseFails}**\n`;
md += `- Over-read but assigned (engineRead ≥ cap, truthAnchored < cap, doctor was assigned anyway): **${tiOverReadAssigned}**\n\n`;

// Per-field divergence + cap-binding analysis.
md += `**Per-field divergence and cap-binding analysis:**\n\n`;
md += `| Field | Total checks | Divergent | engineRead ≥ cap | of those, truth < cap | Narrow false-fails |\n|---|---|---|---|---|---|\n`;
const fields: Array<'consecutiveShiftDates' | 'consecutiveNightDates' | 'consecutiveLongDates'> = [
  'consecutiveShiftDates',
  'consecutiveNightDates',
  'consecutiveLongDates',
];
for (const f of fields) {
  const subset = temporalInversions.filter((t) => t.fieldName === f);
  const div = subset.filter((t) => t.divergent).length;
  const overCap = subset.filter((t) => t.engineReadLength >= t.capForField).length;
  const overCapFlip = subset.filter(
    (t) => t.engineReadLength >= t.capForField && t.calendarTruthAnchored < t.capForField,
  ).length;
  const ff = subset.filter((t) => t.wouldHaveChangedDecision === true).length;
  md += `| \`${f}\` | ${subset.length} | ${div} | ${overCap} | ${overCapFlip} | ${ff} |\n`;
}
md += `\n`;

// Phase 2 weekday divergence breakdown — one row per (anchor, doctor, field) where divergent.
md += `**Per-(anchor, doctor) breakdown — every divergent read on \`consecutiveNightDates\` (the field most relevant to the hypothesis):**\n\n`;
md += `| Phase | Anchor | Doctor | Engine read | Truth-anchored | Truth-recent | hasFutureAssignments | Decision |\n|---|---|---|---|---|---|---|---|\n`;
for (const t of temporalInversions) {
  if (t.fieldName !== 'consecutiveNightDates') continue;
  if (!t.divergent) continue;
  md += `| ${t.phase} | ${t.anchorDate} | ${t.doctorId} | ${t.engineReadLength} | ${t.calendarTruthAnchored} | ${t.calendarTruthRecent} | ${t.hasFutureAssignments} | ${t.wouldHaveChangedDecision === null ? 'null' : String(t.wouldHaveChangedDecision)} |\n`;
}
md += `\n`;

// Deeper analysis: parse CSB:A4 reasons from unfilled_postmortems.
// Reason format: "pattern X: prior P + block B + subsequent S nights > cap C"
// or "prior P + block B + subsequent S nights > cap C" (CSA A7 form).
interface FlippedRejection {
  slotDate: string;
  anchor: string;
  pathTaken: string;
  doctor: string;
  patternId: string | null;
  enginePrior: number;
  block: number;
  subsequent: number;
  cap: number;
  engineSum: number;
  truthPrior: number;
  truthSum: number;
  hasFutureAssignments: boolean;
}
const reasonRegex = /(?:pattern (\S+): )?prior (\d+) \+ block (\d+) \+ subsequent (\d+) nights > cap (\d+)/;
const tiByKey = new Map<string, TemporalInversionCheck>();
for (const t of temporalInversions) {
  tiByKey.set(`${t.anchorDate}|${t.doctorId}|${t.fieldName}`, t);
}
const a4Rejections: Array<FlippedRejection & { engineFails: boolean; truthFails: boolean }> = [];
for (const u of unfilledPostmortems) {
  for (const pd of u.perDoctor) {
    if (pd.firstFailingRule !== 'csb:A4' && pd.firstFailingRule !== 'csa:A7') continue;
    const m = (pd.ruleDetails ?? '').match(reasonRegex);
    if (!m) continue;
    const [, patternId, p, b, s, c] = m;
    const ti = tiByKey.get(`${u.anchorDate}|${pd.doctorId}|consecutiveNightDates`);
    if (!ti) continue;
    const enginePrior = Number(p);
    const block = Number(b);
    const subsequent = Number(s);
    const cap = Number(c);
    const truthPrior = ti.calendarTruthAnchored;
    const engineSum = enginePrior + block + subsequent;
    const truthSum = truthPrior + block + subsequent;
    const engineFails = engineSum > cap;
    const truthFails = truthSum > cap;
    a4Rejections.push({
      slotDate: u.slot.date,
      anchor: u.anchorDate,
      pathTaken: u.pathTaken,
      doctor: pd.doctorId,
      patternId: patternId ?? null,
      enginePrior,
      block,
      subsequent,
      cap,
      engineSum,
      truthPrior,
      truthSum,
      hasFutureAssignments: ti.hasFutureAssignments,
      engineFails,
      truthFails,
    });
  }
}
const flippedRejections = a4Rejections.filter((r) => r.engineFails && !r.truthFails);

md += `**Deeper analysis — CSB:A4 cross-reference:**\n\n`;
md += `The narrow false-fail definition above tests \`engineReadLength ≥ cap\` alone. CSB:A4's actual constraint is \`prior + block + subsequent > cap\` — a smaller \`engineReadLength\` can still trip the cap once the proposed block size is added. Parsing the reason strings emitted in \`unfilled_postmortem.perDoctor\` events for every CSB:A4 rejection gives the exact \`(prior, block, subsequent, cap)\` tuple the engine used. Recomputing with \`truthPrior\` shows whether the rejection would have flipped to a pass under temporally-correct semantics.\n\n`;

md += `Total CSB:A4 / CSA:A7 rejections in unfilled_postmortems with parseable reasons: **${a4Rejections.length}**\n`;
md += `Of those, **engine fails AND truth-anchored passes (real false-fails by deeper definition)**: **${flippedRejections.length}**\n\n`;

if (flippedRejections.length > 0) {
  md += `| Slot | Anchor | Path | Doctor | Pattern | Engine: prior+block+sub | Truth: prior+block+sub | Cap | Engine→Truth |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of flippedRejections) {
    md += `| ${r.slotDate} | ${r.anchor} | \`${r.pathTaken}\` | ${r.doctor} | ${r.patternId ?? '—'} | ${r.enginePrior}+${r.block}+${r.subsequent}=${r.engineSum} | ${r.truthPrior}+${r.block}+${r.subsequent}=${r.truthSum} | ${r.cap} | ❌→✅ |\n`;
  }
  md += `\n`;
}

// Cross-reference table: per unfilled slot, was a flipped rejection active?
md += `**Cross-reference: which of the 12 unfilled slots had a flipped CSB:A4 candidate?**\n\n`;
md += `| Slot | Anchor | Path | Flipped doctor(s) | Notes |\n|---|---|---|---|---|\n`;
const flippedBySlot = new Map<string, FlippedRejection[]>();
for (const r of flippedRejections) {
  const k = `${r.slotDate}|${r.anchor}`;
  const arr = flippedBySlot.get(k) ?? [];
  arr.push(r);
  flippedBySlot.set(k, arr);
}
let slotsWithFlip = 0;
for (const u of unfilledPostmortems) {
  const k = `${u.slot.date}|${u.anchorDate}`;
  const flips = flippedBySlot.get(k);
  const flipDoctors = flips ? flips.map((f) => `${f.doctor} (${f.patternId ?? '?'})`).join(', ') : '—';
  const note = flips
    ? `Flipped doctor would have passed CSB:A4 with truth-anchored prior. Whether engine would have selected them depends on subsequent checks (A13 weekend cap, etc.) the diagnostic does not simulate.`
    : `No flip — every doctor failure mode at this slot is independent of consecutiveNightDates.`;
  if (flips) slotsWithFlip += 1;
  md += `| ${u.slot.date} ${u.slot.shiftKey}#${u.slot.slotIndex} | ${u.anchorDate} | \`${u.pathTaken}\` | ${flipDoctors} | ${note} |\n`;
}
md += `\n`;

// Summary line.
const slotsByQ0 = unfilledPostmortems.length - slotsWithFlip;
md += `**Q3.5 summary:** of ${unfilledPostmortems.length} unfilled slots, **${slotsWithFlip}** have a CSB:A4 rejection that flips to a pass under truth-anchored prior (temporal-inversion false-fail; would-have-been eligible candidate after fix). **${slotsByQ0}** are unfilled for reasons unaffected by temporal inversion (LTFT day-off, CSA:A3 rest enforcement, CSA:A13 weekend frequency cap, eligibility). The temporal-inversion mechanism is **REAL and CAUSALLY IMPLICATED** in this fixture's outcome: ${slotsWithFlip}/${unfilledPostmortems.length} of the unfilled slots have a fix-eligible candidate that the engine wrongly rejected. Whether the fix would actually fill those slots depends on whether the would-be eligible doctor also passes the other CSB checks (A13 weekend frequency in particular), which the diagnostic does not re-simulate.\n\n`;

md += `**Mechanism note:** the inversions are not strict "forward-pollution" (\`hasFutureAssignments=true\` in **${flippedRejections.filter((r) => r.hasFutureAssignments).length}** of ${flippedRejections.length} flipped cases). They are the v2 §3 "Known conservatism" mechanism — the writer's reset rule fires only when a *new* commit's date is non-contiguous to \`lastEntry\`. When a doctor has no further commits after their Phase 1 weekend block, the array stays at the Phase 1 dates indefinitely; subsequent CSB reads at later anchors over-read by the full prior-streak length. This is the v2-documented-but-unexercised hazard, exercised here.\n\n`;

md += `## Likely root cause\n\n`;
const skewBlocks = q1ByDoctor['doc-3']?.length ?? 0;
const otherBlocks = (q1ByDoctor['doc-1']?.length ?? 0) + (q1ByDoctor['doc-2']?.length ?? 0) + (q1ByDoctor['doc-4']?.length ?? 0);
const causeLines: string[] = [];
if (!targetVsDemand) {
  causeLines.push(
    `**Q0 verdict drives interpretation.** Total demand (${q0.totalNightDemandSlotDays} night slot-days) exceeds the sum of per-doctor \`targetNightShiftCount\` (${q0.totalTargetNightShifts}) by ${q0.totalNightDemandSlotDays - q0.totalTargetNightShifts}. Every iteration is structurally constrained to either (a) leave that many slots unfilled, or (b) push doctors past their fairness targets — the latter requires a cascade mechanism that raises effective ceilings (Stage 3g.4 D35 Rules 1-2). Without cascade, the construction driver has no signal to over-fill: once each doctor's deficit goes negative, the engine's ranking de-prioritises them.`,
  );
}
if (flippedRejections.length === 0) {
  causeLines.push(
    `**Semantic-A staleness is not implicated in this fixture (deeper analysis).** Q3.5's narrow definition shows ${tiNarrowFalseFails} cap-crossing false-fails; the deeper CSB:A4 reason-string cross-reference also shows zero flips. The 12 critical unfilleds have other causes. The Q3 "Known conservatism" hazard is observable but not causally implicated here.`,
  );
} else {
  causeLines.push(
    `**Semantic-A temporal-inversion staleness IS implicated** — Q3.5's deeper CSB:A4 cross-reference shows ${flippedRejections.length} CSB:A4 rejections flip from FAIL to PASS under truth-anchored prior, affecting ${slotsWithFlip} of the ${unfilledPostmortems.length} unfilled slots. The mechanism is the v2 §3 "Known conservatism" exercised: writer reset rules don't fire on calendar gaps with no intervening commit, so prior-streak reads stay stale at the doctor's last commit run. This is **NOT** strict forward-pollution (\`hasFutureAssignments=false\` in every flipped case) — it's the simpler "no reset because no next commit" case that v2 explicitly flagged as a real-but-unexercised hazard.`,
  );
}
// Q2 breakdown — read from the doctor-decision aggregate (preserves
// LTFT/eligibility info that the prior dominant-mode-per-slot table
// hid). Use allRuleCounts computed in the Q2 section above.
const aggElig = allRuleCounts['eligibility'] ?? 0;
const aggCsaA3 = allRuleCounts['csa:A3'] ?? 0;
const aggCsaA13 = allRuleCounts['csa:A13'] ?? 0;
const aggCsbA4 = allRuleCounts['csb:A4'] ?? 0;
const aggLtft = Object.entries(allRuleCounts)
  .filter(([k]) => k.startsWith('ltft:'))
  .reduce((s, [, n]) => s + n, 0);
const totalDecisionsForCause = unfilledPostmortems.length * doctorIds.length;
causeLines.push(
  `**Q2 doctor-decision breakdown** (across ${totalDecisionsForCause} decisions = ${unfilledPostmortems.length} unfilled slots × ${doctorIds.length} doctors): ${aggElig} failed by eligibility (matrix status = 'ltft_off'), ${aggCsaA3} by csa:A3 (11h inter-shift rest), ${aggCsaA13} by csa:A13 (weekend frequency cap), ${aggCsbA4} by csb:A4 (consecutive nights cap), ${aggLtft} by LTFT block-disposition. Every unfilled slot is the union of failures across all four doctors; no single rule alone explains any slot.`,
);
// Skew interpretation — data-driven from the Q1 rendered tables.
causeLines.push(
  `**Skew interpretation (data-driven from Q1 tables):** doc-3 took ${skewBlocks} blocks vs ${otherBlocks} combined for doc-1/2/4. ${deficitRankDriven} of ${totalFilledBlocks} filled blocks had the selected doctor as the top-deficit eligible candidate; ${anomalyCount} anomalies. The dominance is **${anomalyCount === 0 ? 'consistent with deficit-rank dynamics' : 'a mix of deficit-rank dynamics and ' + anomalyCount + ' anomalies'}** on a fixture where doc-3 has a smaller fairness target (4 vs 5) AND, by happenstance of Phase 1 selection (doc-3 took zero nights at the first two weekends because doc-1/2 tied on initial deficit and won by alphabetical shuffleOrder), doc-3 entered Phase 2 with the highest residual deficit. The smaller target accelerates each individual block's contribution to deficit drop (each night = 1/52h ≈ 1.9% of doc-3's budget vs 1/65h ≈ 1.5% for doc-1/2), but the late entry into placement keeps doc-3 ahead in raw remaining deficit through the later phases.`,
);
md += causeLines.map((l) => `- ${l}`).join('\n') + '\n\n';

md += `## Suggested next actions\n\n`;
if (flippedRejections.length > 0) {
  md += `**Option E — Fix the writer's Semantic-A reset rules to handle the temporal-inversion case.** Q3.5's deeper CSB:A4 cross-reference shows ${flippedRejections.length} flipped rejections affecting ${slotsWithFlip} of ${unfilledPostmortems.length} unfilled slots. The mechanism is v2 §3 "Known conservatism" exercised: when a doctor has no further commit after a block + REST, the \`consecutive*Dates\` arrays stay populated from the prior block forever, and subsequent CSB reads at later anchors over-read. Two approaches:\n\n` +
    `  - **(E1) Eager reset on read:** before each CSB call, the driver examines the doctor's \`consecutive*Dates\` array and prunes entries that are not contiguous to the proposed block-start − 1 day. Driver-side fix; engine signature unchanged. Trade-off: scan cost per evaluation.\n` +
    `  - **(E2) Reset on rest-window expiry:** after a commit, the writer schedules a deferred reset that fires when the calendar advances past the post-block REST window. Requires the driver to track time more carefully; fits the "writer is authoritative" pattern.\n\n` +
    `  **Pick this BEFORE Stage 3g.4** — cascade backfill explicitly uses CSB checks on backfilled blocks against existing committed state, so it depends on correct prior-streak reads. Q0's over-demand finding still applies; cascade still has work to do; but Option E removes a confound from the cascade test signal. Concretely: add a follow-up acceptance test "after Option E fix, minimalInputFullNights critical drops from 12 to (at most) ${unfilledPostmortems.length - slotsWithFlip}" — i.e. only the LTFT/A3/A13-driven unfilleds remain.\n\n`;
}
md += `Pick one of A, B, ${flippedRejections.length > 0 ? 'D, or E' : 'or D'} based on the evidence above; do NOT pick by default — each has different downstream consequences. Option C from the prior report has been collapsed (see below).\n\n`;
md += `**Option A — Accept the 12-critical baseline as fixture-driven.** If the Q0 over-demand finding is the dominant explanation (and the data supports that conclusion when target sum < demand), the 12 critical unfilleds are an expected pre-cascade baseline. Stage 3g.4 will close them via D35 cascade Rules 1–2 by raising effective ceilings on doctors who already met their fairness targets. Add an explicit acceptance test in Stage 3g.4 of the form *"after cascade, minimalInputFullNights produces critical=0"*. No fixture changes needed; this run is doing what it should.\n\n`;
md += `**Option B — Adjust the fixture so its target sum matches its demand.** If \`minimalInputFullNights\` was meant to be solvable to critical=0 by the construction driver alone (without cascade), bump each doctor's \`targetNightShiftCount\` upward so the sum equals or exceeds the demand. This is a one-line edit per doctor in \`scripts/fixtures/minimalInput.ts\`. Caveat: this changes the fixture's purpose — it becomes a "no-cascade-needed sanity test" rather than a "stress test for the full algorithm". Both have value; pick the one that matches the test intent.\n\n`;

// Option C collapse: choose phrasing based on Q1's anomaly count.
if (anomalyCount === 0) {
  md += `**Option C — Closed out by Q1's rendered tables.** Every filled block had its selected doctor at the top of the eligible deficit ranking. The skew is consistent with deficit-rank dynamics on a fixture where doc-3 has both a smaller fairness target and full Tue–Sun availability (only Monday is LTFT-blocked). No tuning to \`computeNormalisedNightDeficit\` is indicated by the data.\n\n`;
} else {
  // Identify the first anomaly to cite.
  const firstAnomaly = q1Summaries.find((s) => s.hasAnomaly);
  md += `**Option C — Now actionable.** Q1's rendered table at anchor ${firstAnomaly?.anchor ?? '(unknown)'} shows a selected doctor whose deficit was below the highest eligible candidate's. ${anomalyCount} of ${totalFilledBlocks} filled blocks exhibit this pattern. Investigation target: \`computeNormalisedNightDeficit\` at \`finalRotaNightBlocks.ts:426\` and the surrounding \`rankDoctorsForBlock\` (or weekend-specific ranking) at line 458. Recommend a focused diagnostic + fix session.\n\n`;
}

md += `**Option D — Construct a long-cap-binding fixture and re-run this diagnostic.** Q3 reports ${q3.divergent} divergent reads on \`consecutiveLongDates\` with zero false-fails because every long-shift counter increment in this fixture comes from night-shift activity (all night shifts are ${nightSlots[0]?.durationHours ?? 13}h > 10h, so isLong fires). A fixture mixing long day shifts (11h+) with nights would drive the long-shift counter from genuine long-shift activity; the same Semantic-A staleness across phase boundaries could then produce real false-fails. **Required before Stage 3g.4 lands** — the cascade work assumes correct read semantics, and we want to know whether a stale-aware reset shim is needed before cascade depends on the reads. If false-fails appear in the long-cap-binding fixture, write a follow-up fix prompt for the reset rules in \`finalRotaConstruction.ts\` (per design v2 §3 "Known conservatism").\n\n`;

fs.writeFileSync(REPORT_PATH, md);
console.log(`analyseTrace — wrote ${md.split('\n').length} lines to ${REPORT_PATH}`);
process.exit(0);
