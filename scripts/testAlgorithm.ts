// scripts/testAlgorithm.ts
// End-to-end smoke test for generateFinalRota. Run after every algorithm stage:
//   npx tsx scripts/testAlgorithm.ts

import { generateFinalRota } from '../src/lib/finalRotaGenerator';
import {
  buildAvailabilityMatrix,
  computeBucketFloors,
  validateBucketFloors,
  collectZeroCompetencyWarnings,
} from '../src/lib/finalRotaPhase0';
import {
  checkSequenceA,
  checkSequenceB,
  parseShiftTimes,
  getWeekKey,
  isWeekendDate,
  getRestUntilMs,
  getOverlappedWeekendDates,
} from '../src/lib/finalRotaWtr';
import { isSlotEligible } from '../src/lib/finalRotaEligibility';
import type {
  DoctorState,
  InternalDayAssignment,
  CheckResult,
} from '../src/lib/finalRotaTypes';
import type { ShiftSlotEntry, FinalRotaInput } from '../src/lib/rotaGenInput';
import {
  minimalInput,
  minimalInputWithOverdeductedLeave,
  minimalInputWithOncallSlot,
  minimalInputWithNroc,
  minimalInputWeekendNights,
  minimalInputWeekendNightsAllLtft,
} from './fixtures/minimalInput';
import {
  buildBlockDictionary,
  isTier15AtomicPair,
  hasSplitWeekend,
  checkLtftDisposition,
  getDayKeyUtc,
  getLtftFlags,
  getDoctorLtftDaysOff,
  getWeekendSaturdays,
  deriveWeekendDates,
  computeNormalisedNightDeficit,
  scoreWeekendScarcity,
  rankDoctorsForBlock,
  filterByI68Residency,
  placeWeekendNightsForWeekend,
  type BlockPattern,
  type DayKey,
} from '../src/lib/finalRotaNightBlocks';

async function run() {
  console.log('=== RotaGen Algorithm Test ===');
  console.log(`Doctors: ${minimalInput.doctors.length}`);
  console.log(
    `Period: ${minimalInput.preRotaInput.period.startDate} to ${minimalInput.preRotaInput.period.endDate}`
  );
  console.log(`Shift slots: ${minimalInput.preRotaInput.shiftSlots.length}`);
  console.log('Running 10 iterations...\n');

  const startMs = Date.now();

  const result = await generateFinalRota(minimalInput, {
    iterations: 10,
    onProgress: (p) => {
      console.log(
        `  [${p.iterationsCompleted}/${p.iterationsTarget}] ` +
          `T1=${p.bestScore?.tier1CriticalUnfilled ?? '?'} ` +
          `T2=${p.bestScore?.tier2WarningUnfilled ?? '?'} ` +
          `T3=${p.bestScore?.tier3FairnessDeviation?.toFixed(1) ?? '?'} ` +
          `phase="${p.currentPhase}"`
      );
    },
    shouldCancel: () => false,
  });

  console.log('\n=== Result ===');
  console.log(`Status:               ${result.status}`);
  console.log(`Iterations:           ${result.iterationsCompleted} / ${result.iterationsTarget}`);
  console.log(`Runtime:              ${result.runtimeMs}ms`);
  console.log(`Score T1 (critical):  ${result.score.tier1CriticalUnfilled}`);
  console.log(`Score T2 (warning):   ${result.score.tier2WarningUnfilled}`);
  console.log(`Score T3 (fairness):  ${result.score.tier3FairnessDeviation.toFixed(2)}`);
  console.log(`Assignments (dates):  ${Object.keys(result.assignments).length}`);
  console.log(`Per-doctor entries:   ${result.perDoctor.length}`);
  console.log(`Swap log entries:     ${result.swapLog.length}`);
  console.log(`Elapsed:              ${Date.now() - startMs}ms`);

  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`FAIL: ${msg}`);
      process.exit(1);
    }
    console.log(`PASS: ${msg}`);
  };

  console.log('\n=== Assertions ===');
  assert(
    ['complete', 'cancelled', 'complete_with_gaps', 'failed'].includes(result.status),
    'status is a valid value'
  );
  assert(result.iterationsCompleted > 0, 'at least one iteration completed');
  assert(result.runtimeMs > 0, 'runtimeMs is positive');
  assert(typeof result.score.tier1CriticalUnfilled === 'number', 'T1 is a number');
  assert(typeof result.score.tier2WarningUnfilled === 'number', 'T2 is a number');
  assert(typeof result.score.tier3FairnessDeviation === 'number', 'T3 is a number');
  assert(
    result.perDoctor.length === minimalInput.doctors.length,
    `perDoctor has ${minimalInput.doctors.length} entries`
  );
  assert(Array.isArray(result.swapLog), 'swapLog is an array');
  assert(Array.isArray(result.violations), 'violations is an array');

  // ─── Stage 3d: Phase 0 ─────────────────────────────────────

  console.log('\n=== Stage 3d — Phase 0 ===');

  const matrix = buildAvailabilityMatrix(minimalInput);
  assert(Object.keys(matrix).length === 3, 'matrix has 3 doctors');
  assert(Object.keys(matrix['doc-1']).length === 28, 'doc-1 has 28 date entries');
  assert(matrix['doc-1']['2026-05-04'] === 'available', 'doc-1 available on start date');
  assert(matrix['doc-3']['2026-05-04'] === 'ltft_off', 'doc-3 ltft_off on Monday 2026-05-04');
  assert(matrix['doc-3']['2026-05-05'] === 'available', 'doc-3 available on Tuesday 2026-05-05');

  const floors = computeBucketFloors(minimalInput);
  assert(floors['doc-1'].nonOncall === 172, 'doc-1 nonOncall floor = 172h');
  assert(floors['doc-3'].nonOncall === 137.5, 'doc-3 nonOncall floor = 137.5h');

  try {
    validateBucketFloors(floors, matrix, minimalInput);
    console.log('PASS: bucket floor validation passes on valid input');
  } catch (e: any) {
    console.error('FAIL: unexpected bucket floor violation:', e.message);
    process.exit(1);
  }

  // V1 guard: over-deducted leave pushes non-on-call bucket negative.
  // Uses a dedicated fixture variant (see minimalInputWithOverdeductedLeave)
  // rather than negative shiftTarget values, which aren't a realistic data
  // entry failure mode.
  const violatingInput = minimalInputWithOverdeductedLeave;
  const violatingMatrix = buildAvailabilityMatrix(violatingInput);
  const violatingFloors = computeBucketFloors(violatingInput);
  try {
    validateBucketFloors(violatingFloors, violatingMatrix, violatingInput);
    console.error('FAIL: expected bucket floor violation to throw');
    process.exit(1);
  } catch (e: any) {
    console.log(
      'PASS: bucket floor violation correctly throws: ' +
        e.message.substring(0, 80) +
        '...',
    );
  }

  // V2 guard (spec §5.0 V2): warnings are surfaced only for on-call
  // shifts. minimalInput has no on-call shifts → zero warnings.
  const zeroCompWarnings = collectZeroCompetencyWarnings(minimalInput);
  assert(
    zeroCompWarnings.length === 0,
    'no V2 warnings when fixture has no on-call shifts',
  );

  // Variant injects one on-call shift with reqIac/Iaoc/Icu/Transfer = 0
  // and permittedGrades = [] → exactly one warning.
  const oncallWarnings = collectZeroCompetencyWarnings(minimalInputWithOncallSlot);
  assert(
    oncallWarnings.length === 1,
    `on-call slot variant produces exactly one V2 warning (${oncallWarnings.length})`,
  );

  // ─── Stage 3e: WTR check engine ─────────────────────────────

  console.log('\n=== Stage 3e — WTR check engine ===');

  const WTR = minimalInput.preRotaInput.wtrConstraints;
  const TOTAL_WEEKS = minimalInput.preRotaInput.period.totalWeeks;
  const PERIOD_END = minimalInput.preRotaInput.period.endDate;

  // Helper: day-key lookup ('mon' … 'sun') for a UTC ISO date.
  const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  function dayKeyForDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return DOW_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }

  function getSlot(
    input: FinalRotaInput,
    shiftKey: string,
    date: string,
  ): ShiftSlotEntry {
    const dk = dayKeyForDate(date);
    const slot = input.preRotaInput.shiftSlots.find(
      (s) => s.shiftKey === shiftKey && s.dayKey === dk,
    );
    if (!slot) throw new Error(`no slot for ${shiftKey}/${dk}`);
    return slot;
  }

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

  function mkAssignment(
    doctorId: string,
    slot: ShiftSlotEntry,
    date: string,
  ): InternalDayAssignment {
    const { startMs, endMs } = parseShiftTimes(slot, date);
    return {
      doctorId,
      shiftKey: slot.shiftKey,
      shiftId: slot.shiftId,
      slotIndex: 0,
      slotLabel: null,
      durationHours: slot.durationHours,
      startTime: slot.startTime,
      endTime: slot.endTime,
      shiftStartMs: startMs,
      shiftEndMs: endMs,
      isNightShift: slot.shiftKey === 'night',
      isOncall: slot.isOncall,
      isLong: slot.durationHours > 10,
      blockId: null,
      badges: [...slot.badges],
      violations: [],
    };
  }

  function expectFail(r: CheckResult, rule: string, label: string) {
    const ok = !r.pass && r.failedRule === rule;
    assert(
      ok,
      `${label} — expected fail=${rule}, got ${r.pass ? 'pass' : r.failedRule ?? '?'}${r.reason ? ' (' + r.reason + ')' : ''}`,
    );
  }

  // Helper exports sanity.
  assert(getWeekKey('2026-05-04') === '2026-W19', 'getWeekKey: Mon 2026-05-04 = 2026-W19');
  assert(isWeekendDate('2026-05-09'), 'isWeekendDate: Sat 2026-05-09 = true');
  assert(!isWeekendDate('2026-05-04'), 'isWeekendDate: Mon 2026-05-04 = false');
  {
    const shortSlot = getSlot(minimalInput, 'short-day', '2026-05-04');
    const { startMs, endMs } = parseShiftTimes(shortSlot, '2026-05-04');
    assert(endMs - startMs === 9 * 3_600_000, 'parseShiftTimes: short-day = 9h');
    assert(
      getRestUntilMs(endMs, 11) - endMs === 11 * 3_600_000,
      'getRestUntilMs: +11h',
    );
  }

  const D1 = minimalInput.doctors[0];

  // (1) Clean state passes a routine short-day assignment.
  {
    const s = freshState(D1.doctorId);
    const slot = getSlot(minimalInput, 'short-day', '2026-05-04');
    const r = checkSequenceA(D1, '2026-05-04', slot, s, WTR, TOTAL_WEEKS);
    assert(r.pass, 'CSA baseline: short-day on Mon, clean state passes');
  }

  // (2) A0 — same-date collision (neither side NROC).
  {
    const s = freshState(D1.doctorId);
    const shortSlot = getSlot(minimalInput, 'short-day', '2026-05-04');
    s.assignments.push(mkAssignment(D1.doctorId, shortSlot, '2026-05-04'));
    const longSlot = getSlot(minimalInput, 'long-day', '2026-05-04');
    const r = checkSequenceA(D1, '2026-05-04', longSlot, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A0', 'CSA A0: second shift on same date');
  }

  // (3) A3 — inter-shift rest violation.
  {
    const s = freshState(D1.doctorId);
    s.restUntilMs = Date.UTC(2026, 4, 5, 12, 0, 0);
    const slot = getSlot(minimalInput, 'short-day', '2026-05-05'); // 08:00 start
    const r = checkSequenceA(D1, '2026-05-05', slot, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A3', 'CSA A3: proposed start before restUntilMs');
  }

  // (4) A5 — max consecutive long shifts.
  {
    const s = freshState(D1.doctorId);
    s.consecutiveLongDates = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'];
    s.consecutiveShiftDates = [...s.consecutiveLongDates];
    const slot = getSlot(minimalInput, 'long-day', '2026-05-08');
    const r = checkSequenceA(D1, '2026-05-08', slot, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A5', 'CSA A5: 5th consecutive long shift');
  }

  // (5) A7 — max consecutive shifts (any type).
  {
    const s = freshState(D1.doctorId);
    s.consecutiveShiftDates = [
      '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07',
      '2026-05-08', '2026-05-09', '2026-05-10',
    ];
    const slot = getSlot(minimalInput, 'short-day', '2026-05-11');
    const r = checkSequenceA(D1, '2026-05-11', slot, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A7', 'CSA A7: 8th consecutive shift');
  }

  // (6) A2 — 72h in 168h rolling window.
  {
    const s = freshState(D1.doctorId);
    const workdays = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'];
    for (const d of workdays) {
      const slot = getSlot(minimalInput, 'long-day', d);
      s.assignments.push(mkAssignment(D1.doctorId, slot, d));
    }
    // 5 × 12.5 = 62.5h already committed, all inside the backward 168h
    // window of a Saturday night shift. Adding a 13h night → 75.5 > 72.
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-09');
    const r = checkSequenceA(D1, '2026-05-09', nightSlot, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A2', 'CSA A2: 75.5h in backward 168h window');
  }

  // (7) CSB — clean 3-night block passes.
  {
    const s = freshState(D1.doctorId);
    const nightMon = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-04', '2026-05-05', '2026-05-06'],
      nightMon,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    assert(r.pass, 'CSB: clean 3-night block passes');
  }

  // (8) CSB E43_BLOCK_TOO_LONG — block length > maxConsecutive.nights.
  {
    const s = freshState(D1.doctorId);
    const nightMon = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'],
      nightMon,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'E43_BLOCK_TOO_LONG', 'CSB: 5-night block exceeds cap');
  }

  // (9) CSB A8 — committed shift falls within post-block REST window.
  {
    const s = freshState(D1.doctorId);
    const shortSlot = getSlot(minimalInput, 'short-day', '2026-05-07');
    s.assignments.push(mkAssignment(D1.doctorId, shortSlot, '2026-05-07'));
    const nightMon = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-04', '2026-05-05'],
      nightMon,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A8', 'CSB: short-day 2026-05-07 inside REST window');
  }

  // ── NROC (A14–A18) using minimalInputWithNroc ─────────────────
  const NROC_WTR = minimalInputWithNroc.preRotaInput.wtrConstraints;

  // (10) A14 — NROC count in 168h window exceeds maxPer7Days (=3).
  {
    const s = freshState(D1.doctorId);
    const nrocSat = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02'); // Sat
    // Three prior NROC assignments all within a 168h window of 2026-05-09.
    for (const d of ['2026-05-04', '2026-05-05', '2026-05-06']) {
      s.assignments.push(mkAssignment(D1.doctorId, nrocSat, d));
    }
    const r = checkSequenceA(D1, '2026-05-09', nrocSat, s, NROC_WTR, TOTAL_WEEKS);
    expectFail(r, 'A14', 'CSA A14: 4th NROC in 168h window');
  }

  // (11) A15 — consecutive NROC on non-Sat→Sun adjacency fails.
  {
    const s = freshState(D1.doctorId);
    const nrocSlot = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02');
    s.assignments.push(mkAssignment(D1.doctorId, nrocSlot, '2026-05-05')); // Tue
    const r = checkSequenceA(D1, '2026-05-06', nrocSlot, s, NROC_WTR, TOTAL_WEEKS);
    expectFail(r, 'A15', 'CSA A15: Tue→Wed NROC adjacency blocked');
  }

  // (12) A15 — Sat→Sun NROC adjacency is permitted.
  {
    const s = freshState(D1.doctorId);
    const nrocSlot = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02');
    s.assignments.push(mkAssignment(D1.doctorId, nrocSlot, '2026-05-09')); // Sat
    s.weekendDatesWorked = ['2026-05-09'];
    const r = checkSequenceA(D1, '2026-05-10', nrocSlot, s, NROC_WTR, TOTAL_WEEKS);
    assert(r.pass, 'CSA A15: Sat→Sun NROC adjacency passes');
  }

  // (13) A16 — day after NROC: non-NROC shift > dayAfterMaxHours (10h).
  {
    const s = freshState(D1.doctorId);
    const nrocSlot = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02');
    s.assignments.push(mkAssignment(D1.doctorId, nrocSlot, '2026-05-04')); // Mon
    const longTue = getSlot(minimalInputWithNroc, 'long-day', '2026-05-05');
    const r = checkSequenceA(D1, '2026-05-05', longTue, s, NROC_WTR, TOTAL_WEEKS);
    expectFail(r, 'A16', 'CSA A16: 12.5h long-day day after NROC');
  }

  // (14) A18 — same-date rostered + NROC collision.
  {
    const s = freshState(D1.doctorId);
    const nrocSlot = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02');
    s.assignments.push(mkAssignment(D1.doctorId, nrocSlot, '2026-05-04'));
    const shortMon = getSlot(minimalInputWithNroc, 'short-day', '2026-05-04');
    const r = checkSequenceA(D1, '2026-05-04', shortMon, s, NROC_WTR, TOTAL_WEEKS);
    expectFail(r, 'A18', 'CSA A18: rostered short-day on same date as NROC');
  }

  // ── Stage 3e audit fixes — positive coverage gap closers ─────

  // (15) A12 positive — non-NROC slot 14h > maxShiftLengthH (13h).
  {
    const s = freshState(D1.doctorId);
    const longMon = getSlot(minimalInput, 'long-day', '2026-05-04');
    const long14: ShiftSlotEntry = { ...longMon, durationHours: 14 };
    const r = checkSequenceA(D1, '2026-05-04', long14, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A12', 'CSA A12: non-NROC 14h shift exceeds 13h cap');
  }

  // (16) A12 mirror — NROC slot 14h is exempt and passes.
  {
    const s = freshState(D1.doctorId);
    const nrocSlot = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02');
    const nroc14: ShiftSlotEntry = { ...nrocSlot, durationHours: 14 };
    const r = checkSequenceA(D1, '2026-05-04', nroc14, s, NROC_WTR, TOTAL_WEEKS);
    assert(r.pass, 'CSA A12: NROC 14h exempt from shift-length cap');
  }

  // (17) A13 positive — pre-populated weekend days push proposal over cap.
  //     weekendDatesWorked = 2 (full weekend 1), propose Sat short-day
  //     → prospective 3 days / 2 = 1.5 > 4 / 3 = 1.333.
  {
    const s = freshState(D1.doctorId);
    s.weekendDatesWorked = ['2026-05-09', '2026-05-10'];
    const satSlot = getSlot(minimalInput, 'short-day', '2026-05-16');
    const r = checkSequenceA(D1, '2026-05-16', satSlot, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A13', 'CSA A13: Sat short-day pushes weekend frequency over cap');
  }

  // (18) A13 Fri-night overlap variant — validates Defect 1 fix.
  //     Fri 19:00 → Sat 08:00 overlaps Sat 05-09; combined with
  //     pre-populated full weekend 05-16/17, prospective = 3 days.
  {
    const s = freshState(D1.doctorId);
    s.weekendDatesWorked = ['2026-05-16', '2026-05-17'];
    const friNight = getSlot(minimalInput, 'night', '2026-05-08');
    const r = checkSequenceA(D1, '2026-05-08', friNight, s, WTR, TOTAL_WEEKS);
    expectFail(r, 'A13', 'CSA A13: Fri-start night overlaps Sat, trips weekend cap');
  }

  // (19) A17 positive — day after last consec NROC: 9h short-day >
  //     dayAfterLastConsecMaxH (overridden to 8h) but ≤ dayAfterMaxHours
  //     (10h) so A16 passes and A17 is the first firing rule.
  {
    const A17_WTR = {
      ...NROC_WTR,
      oncall: { ...NROC_WTR.oncall, dayAfterLastConsecMaxH: 8 },
    };
    const s = freshState(D1.doctorId);
    const nrocSlot = getSlot(minimalInputWithNroc, 'nroc', '2026-05-02');
    s.assignments.push(mkAssignment(D1.doctorId, nrocSlot, '2026-05-04'));
    const shortTue = getSlot(minimalInputWithNroc, 'short-day', '2026-05-05');
    const r = checkSequenceA(D1, '2026-05-05', shortTue, s, A17_WTR, TOTAL_WEEKS);
    expectFail(r, 'A17', 'CSA A17: 9h day after last consec NROC > 8h override cap');
  }

  // (20) CSB A2 per-night positive — three long-days commit 37.5h
  //     inside the backward 168h window of a 3-night block's last
  //     night; at night-3 end, 37.5 + 2×13 (prior nights) + 13 (self)
  //     = 76.5h > 72h cap. Earlier nights pass.
  {
    const s = freshState(D1.doctorId);
    for (const d of ['2026-05-03', '2026-05-04', '2026-05-05']) {
      const longSlot = getSlot(minimalInput, 'long-day', d);
      s.assignments.push(mkAssignment(D1.doctorId, longSlot, d));
    }
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-06');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-06', '2026-05-07', '2026-05-08'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A2', 'CSB A2: 76.5h in backward 168h window at night-3');
  }

  // (21) CSB A4 v1 — prior 2 + block 3 + subsequent 0 = 5 > 4 cap.
  {
    const s = freshState(D1.doctorId);
    s.consecutiveNightDates = ['2026-05-01', '2026-05-02'];
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-06');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-06', '2026-05-07', '2026-05-08'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A4', 'CSB A4: prior 2 + block 3 nights > cap 4');
  }

  // (22) CSB A4 v2 — validates Defect 2 fix: prior 1 + block 2 +
  //     subsequent 2 pre-committed nights = 5 > 4.
  {
    const s = freshState(D1.doctorId);
    s.consecutiveNightDates = ['2026-05-03'];
    for (const d of ['2026-05-06', '2026-05-07']) {
      const nSlot = getSlot(minimalInput, 'night', d);
      s.assignments.push(mkAssignment(D1.doctorId, nSlot, d));
    }
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-04', '2026-05-05'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A4', 'CSB A4: prior 1 + block 2 + subsequent 2 nights > cap 4');
  }

  // (23) CSB A7 v1 — prior 5 + block 3 = 8 > 7.
  {
    const s = freshState(D1.doctorId);
    s.consecutiveShiftDates = [
      '2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03',
    ];
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-04', '2026-05-05', '2026-05-06'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A7', 'CSB A7: prior 5 + block 3 shifts > cap 7');
  }

  // (24) CSB A7 v2 — validates Defect 2 fix: prior 2 + block 3 +
  //     subsequent 3 committed day-shifts = 8 > 7.
  {
    const s = freshState(D1.doctorId);
    s.consecutiveShiftDates = ['2026-05-02', '2026-05-03'];
    for (const d of ['2026-05-07', '2026-05-08', '2026-05-09']) {
      const shortSlot = getSlot(minimalInput, 'short-day', d);
      s.assignments.push(mkAssignment(D1.doctorId, shortSlot, d));
    }
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-04', '2026-05-05', '2026-05-06'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A7', 'CSB A7: prior 2 + block 3 + subsequent 3 shifts > cap 7');
  }

  // (25) CSB A13 block positive — Fri→Sun night block adds weekend
  //     days 05-09 and 05-10 via overlap; combined with pre-populated
  //     05-16, prospective = 3 days / 2 = 1.5 > 1.333.
  {
    const s = freshState(D1.doctorId);
    s.weekendDatesWorked = ['2026-05-16'];
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-08');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1,
      ['2026-05-08', '2026-05-09', '2026-05-10'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'A13', 'CSB A13: Fri-Sun block + prior weekend > cap');
  }

  // (26) CSB C32 positive — doctor's soft preference maxConsecNights=2,
  //     proposed 3-night block exceeds it. A4 (hard cap 4) passes first.
  {
    const D1_strict = {
      ...D1,
      constraints: {
        ...D1.constraints,
        soft: { ...D1.constraints.soft, maxConsecNights: 2 },
      },
    };
    const s = freshState(D1_strict.doctorId);
    const nightSlot = getSlot(minimalInput, 'night', '2026-05-04');
    const matrix = buildAvailabilityMatrix(minimalInput);
    const r = checkSequenceB(
      D1_strict,
      ['2026-05-04', '2026-05-05', '2026-05-06'],
      nightSlot,
      s,
      WTR,
      matrix,
      TOTAL_WEEKS,
      PERIOD_END,
    );
    expectFail(r, 'C32', 'CSB C32: 3-night block > doctor soft preference 2');
  }

  // ─── Stage 3f — Shift eligibility ───────────────────────────

  console.log('\n=== Stage 3f — Shift eligibility ===');

  const eligMatrix = buildAvailabilityMatrix(minimalInput);
  const PERIOD_START = minimalInput.preRotaInput.period.startDate;
  const nightMonSlot = getSlot(minimalInput, 'night', '2026-05-04');    // Mon
  const nightTueSlot = getSlot(minimalInput, 'night', '2026-05-05');    // Tue
  const shortMonSlot = getSlot(minimalInput, 'short-day', '2026-05-04');
  const shortTueSlot = getSlot(minimalInput, 'short-day', '2026-05-05');
  const satShortSlot = getSlot(minimalInput, 'short-day', '2026-05-09'); // Sat
  const doc1 = minimalInput.doctors[0]; // Consultant, all competencies, FTE
  const doc2 = minimalInput.doctors[1]; // SpR, all competencies, FTE
  const doc3 = minimalInput.doctors[2]; // SpR LTFT Monday-off, 0.8 WTE

  // (27) Prompt baseline — doc-1 eligible on a routine available date.
  assert(
    isSlotEligible(doc1, nightTueSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
    'Stage 3f: doc-1 eligible for night on Tuesday 2026-05-05',
  );

  // (28) Prompt baseline — doc-3 ltft_off on Monday → reject (Rule 1 / B26).
  assert(
    !isSlotEligible(doc3, nightMonSlot, 0, PERIOD_START, eligMatrix, PERIOD_END),
    'Stage 3f B26: doc-3 ltft_off on Monday cannot take night',
  );

  // (29) Prompt baseline — exemptFromNights blocks a night shift (B27).
  {
    const exemptNightDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        hard: { ...doc1.constraints.hard, exemptFromNights: true },
      },
    };
    assert(
      !isSlotEligible(exemptNightDoc, nightTueSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f B27: exempt-from-nights doctor cannot take night shift',
    );
  }

  // (30) Prompt baseline — grade-restricted slot rejects SpR.
  {
    const restrictedSlot: typeof nightTueSlot = {
      ...nightTueSlot,
      slots: [{
        slotIndex: 0, label: null, permittedGrades: ['Consultant'],
        reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0,
      }],
    };
    assert(
      !isSlotEligible(doc2, restrictedSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A20: SpR cannot fill Consultant-restricted slot',
    );
    // (31) Prompt baseline — Consultant passes the same slot.
    assert(
      isSlotEligible(doc1, restrictedSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A20: Consultant passes Consultant-restricted slot',
    );
  }

  // (32) B30 positive — night on D where D+1 is hard-blocked (AL) → reject.
  {
    const alDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        hard: { ...doc1.constraints.hard, annualLeaveDates: ['2026-05-06'] }, // Wed = D+1
      },
    };
    const alMatrix = buildAvailabilityMatrix({ ...minimalInput, doctors: [alDoc, doc2, doc3] });
    assert(
      !isSlotEligible(alDoc, nightTueSlot, 0, '2026-05-05', alMatrix, PERIOD_END),
      'Stage 3f B30: night on D where D+1 is AL rejects',
    );
  }

  // (33) B30 negative — night on D where D+1 available → pass.
  assert(
    isSlotEligible(doc1, nightTueSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
    'Stage 3f B30: night on D where D+1 available passes (baseline mirror)',
  );

  // (34) C31 positive — proposed date in nocDates → reject.
  {
    const nocDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        soft: { ...doc1.constraints.soft, nocDates: ['2026-05-05'] },
      },
    };
    assert(
      !isSlotEligible(nocDoc, shortTueSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f C31: date in nocDates rejects (Pass 1 hard-block)',
    );
  }

  // (35) C31 night-D+1 positive — night on D where D+1 in nocDates → reject.
  {
    const nocNextDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        soft: { ...doc1.constraints.soft, nocDates: ['2026-05-06'] },
      },
    };
    assert(
      !isSlotEligible(nocNextDoc, nightTueSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f B30+C31: night on D where D+1 in nocDates rejects',
    );
  }

  // (36) B28 positive — Sat shift + exemptFromWeekends → reject.
  {
    const weekendExemptDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        hard: { ...doc1.constraints.hard, exemptFromWeekends: true },
      },
    };
    assert(
      !isSlotEligible(weekendExemptDoc, satShortSlot, 0, '2026-05-09', eligMatrix, PERIOD_END),
      'Stage 3f B28: weekend-exempt doctor cannot take Sat shift',
    );
  }

  // (37) B29 positive — on-call slot + exemptFromOncall → reject.
  {
    const oncallDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        hard: { ...doc1.constraints.hard, exemptFromOncall: true },
      },
    };
    const oncallSlot: typeof shortTueSlot = { ...shortTueSlot, isOncall: true };
    assert(
      !isSlotEligible(oncallDoc, oncallSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f B29: oncall-exempt doctor cannot take oncall slot',
    );
  }

  // (38) A19 positive — slot requires IAC, doctor lacks it → reject.
  {
    const iacSlot: typeof shortTueSlot = {
      ...shortTueSlot,
      slots: [{
        slotIndex: 0, label: null, permittedGrades: [],
        reqIac: 1, reqIaoc: 0, reqIcu: 0, reqTransfer: 0,
      }],
    };
    const noIacDoc: typeof doc1 = { ...doc1, hasIac: false };
    assert(
      !isSlotEligible(noIacDoc, iacSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: slot requires IAC but doctor lacks hasIac → reject',
    );
    // (39) A19 negative — same slot, doctor has IAC → pass.
    assert(
      isSlotEligible(doc1, iacSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: slot requires IAC and doctor has it → pass',
    );
  }

  // (40) Unconstrained slot (slots[] empty) — rules 7/8 skipped; BH
  //      positive doubles as this test: matrix = 'bank_holiday' must
  //      permit the assignment. Fixture has no BH by default, so we
  //      synthesise an input variant adding 2026-05-05 as BH.
  {
    const bhInput: FinalRotaInput = {
      ...minimalInput,
      preRotaInput: {
        ...minimalInput.preRotaInput,
        period: { ...minimalInput.preRotaInput.period, bankHolidayDates: ['2026-05-05'] },
      },
    };
    const bhMatrix = buildAvailabilityMatrix(bhInput);
    assert(
      bhMatrix['doc-1']['2026-05-05'] === 'bank_holiday',
      'Stage 3f: BH matrix cell populated correctly',
    );
    const unconstrainedBhSlot: typeof shortTueSlot = { ...shortTueSlot, slots: [] };
    assert(
      isSlotEligible(doc1, unconstrainedBhSlot, 0, '2026-05-05', bhMatrix, PERIOD_END),
      'Stage 3f BH+unconstrained: doctor eligible on bank_holiday with empty slots[]',
    );
  }

  // ─── Stage 3f audit-fix regression tests (I1–I6) ────────────

  // (I1) B22/B23/B24/B25 individual rejects — guard HARD_BLOCK_STATUSES.
  //      For each of the four matrix statuses, force doc-1's Tue cell to
  //      that value and assert the short-day shift is rejected.
  {
    const statuses = ['annual_leave', 'study', 'parental', 'rotation'] as const;
    for (const status of statuses) {
      const statusMatrix = {
        ...eligMatrix,
        [doc1.doctorId]: { ...eligMatrix[doc1.doctorId], '2026-05-05': status },
      };
      assert(
        !isSlotEligible(doc1, shortTueSlot, 0, '2026-05-05', statusMatrix, PERIOD_END),
        `Stage 3f ${status}: HARD_BLOCK_STATUSES rejects ${status}`,
      );
    }
  }

  // (I2) B30 period-boundary pass — night on the last day of the rota.
  //      D+1 (2026-06-01) is past PERIOD_END and has no matrix entry;
  //      the within-period guard must short-circuit before lookup.
  {
    const lastDay = PERIOD_END; // '2026-05-31' = Sun
    // Ensure doctor is available on the last day itself.
    const lastDayMatrix = {
      ...eligMatrix,
      [doc1.doctorId]: { ...eligMatrix[doc1.doctorId], [lastDay]: 'available' as const },
    };
    // Fetch any night slot — parseShiftTimes uses only slot.startTime +
    // slot.durationHours with the supplied isoDate, not slot.dayKey.
    // B28 overlap will fire because the last day is a Sunday, so use a
    // doctor without weekend exemption (doc1 is not exempt).
    assert(
      isSlotEligible(doc1, nightMonSlot, 0, lastDay, lastDayMatrix, PERIOD_END),
      'Stage 3f B30: night on last day of rota passes (D+1 outside period)',
    );
  }

  // (I3) B30 year-boundary UTC safety — night on 2026-12-31 must
  //      correctly compute D+1 = 2027-01-01 via addDaysUtc and detect
  //      AL there.
  {
    const yearBoundaryMatrix = {
      [doc1.doctorId]: {
        '2026-12-31': 'available' as const,
        '2027-01-01': 'annual_leave' as const,
      },
    };
    assert(
      !isSlotEligible(doc1, nightMonSlot, 0, '2026-12-31', yearBoundaryMatrix, '2027-01-31'),
      'Stage 3f B30: year-boundary D+1 (2027-01-01) AL rejects',
    );
  }

  // (I4) A19 individual competencies — reqIaoc / reqIcu / reqTransfer.
  //      reqIac already covered by tests 38/39. Each sub-case: slot
  //      requires exactly one competency, doctor lacks it → reject;
  //      doctor has it → pass.
  {
    const mkReqSlot = (
      flag: 'reqIaoc' | 'reqIcu' | 'reqTransfer',
    ): typeof shortTueSlot => ({
      ...shortTueSlot,
      slots: [{
        slotIndex: 0, label: null, permittedGrades: [],
        reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0,
        [flag]: 1,
      }],
    });

    // reqIaoc
    const iaocSlot = mkReqSlot('reqIaoc');
    const noIaocDoc: typeof doc1 = { ...doc1, hasIaoc: false };
    assert(
      !isSlotEligible(noIaocDoc, iaocSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: reqIaoc > 0 rejects doctor without hasIaoc',
    );
    assert(
      isSlotEligible(doc1, iaocSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: reqIaoc > 0 passes doctor with hasIaoc',
    );

    // reqIcu
    const icuSlot = mkReqSlot('reqIcu');
    const noIcuDoc: typeof doc1 = { ...doc1, hasIcu: false };
    assert(
      !isSlotEligible(noIcuDoc, icuSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: reqIcu > 0 rejects doctor without hasIcu',
    );
    assert(
      isSlotEligible(doc1, icuSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: reqIcu > 0 passes doctor with hasIcu',
    );

    // reqTransfer
    const transferSlot = mkReqSlot('reqTransfer');
    const noTransferDoc: typeof doc1 = { ...doc1, hasTransfer: false };
    assert(
      !isSlotEligible(noTransferDoc, transferSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: reqTransfer > 0 rejects doctor without hasTransfer',
    );
    assert(
      isSlotEligible(doc1, transferSlot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A19: reqTransfer > 0 passes doctor with hasTransfer',
    );
  }

  // (I5) A20 legacy grade label — "CT1 (or ACCS)" canonicalises to "CT1"
  //      and passes a slot with permittedGrades: ['CT1'].
  {
    const legacyGradeDoc: typeof doc1 = { ...doc1, grade: 'CT1 (or ACCS)' };
    const ct1Slot: typeof shortTueSlot = {
      ...shortTueSlot,
      slots: [{
        slotIndex: 0, label: null, permittedGrades: ['CT1'],
        reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0,
      }],
    };
    assert(
      isSlotEligible(legacyGradeDoc, ct1Slot, 0, '2026-05-05', eligMatrix, PERIOD_END),
      'Stage 3f A20: legacy "CT1 (or ACCS)" canonicalises to CT1 and passes',
    );
  }

  // (I6) B28 Friday-night overlap — exempt-from-weekends doctor on a
  //      Fri 19:00 → Sat 08:00 night must be rejected because the
  //      shift overlaps Saturday. Complement: same shift, no exemption
  //      → passes.
  {
    const friday = '2026-05-08';
    const nightFriSlot = getSlot(minimalInput, 'night', friday);
    // Sanity: the slot's time span overlaps Saturday.
    const { startMs: friStart, endMs: friEnd } = parseShiftTimes(nightFriSlot, friday);
    const overlap = getOverlappedWeekendDates(friStart, friEnd);
    assert(
      overlap.includes('2026-05-09'),
      'Stage 3f B28 precheck: Fri night overlaps Sat 2026-05-09',
    );

    const fridayNightExemptDoc: typeof doc1 = {
      ...doc1,
      constraints: {
        ...doc1.constraints,
        hard: { ...doc1.constraints.hard, exemptFromWeekends: true },
      },
    };
    assert(
      !isSlotEligible(fridayNightExemptDoc, nightFriSlot, 0, friday, eligMatrix, PERIOD_END),
      'Stage 3f B28: weekend-exempt doctor rejected on Fri-night overlapping Sat',
    );
    // Complement — doc1 (no exemption) passes the same shift.
    assert(
      isSlotEligible(doc1, nightFriSlot, 0, friday, eligMatrix, PERIOD_END),
      'Stage 3f B28: non-exempt doctor passes Fri-night overlapping Sat',
    );
  }

  // ─── Stage 3g.2b.1 — Tiling Engine foundation + weekend-night sub-pass ─

  console.log('\n=== Stage 3g.2b.1 — Block dictionary ===');

  // (1) 12 patterns, one per id.
  {
    const dict = buildBlockDictionary();
    assert(dict.length === 12, `Stage 3g.2b.1: 12 patterns (got ${dict.length})`);
  }

  // (2) Tier 1 penalty = 0 (both Tier 1 patterns).
  {
    const dict = buildBlockDictionary();
    const tier1 = dict.filter(p => p.tier === 1);
    assert(
      tier1.length === 2 && tier1.every(p => p.basePenalty === 0),
      'Stage 3g.2b.1: Tier 1 patterns have basePenalty 0',
    );
  }

  // (3) Tier 2 penalty = 10.
  {
    const tier2 = buildBlockDictionary().filter(p => p.tier === 2);
    assert(
      tier2.length === 3 && tier2.every(p => p.basePenalty === 10),
      'Stage 3g.2b.1: Tier 2 patterns have basePenalty 10',
    );
  }

  // (4) Tier 3 penalty = 25.
  {
    const tier3 = buildBlockDictionary().filter(p => p.tier === 3);
    assert(
      tier3.length === 4 && tier3.every(p => p.basePenalty === 25),
      'Stage 3g.2b.1: Tier 3 patterns have basePenalty 25',
    );
  }

  // (5) Tier 4 penalty = 40.
  {
    const tier4 = buildBlockDictionary().filter(p => p.tier === 4);
    assert(
      tier4.length === 3 && tier4.every(p => p.basePenalty === 40),
      'Stage 3g.2b.1: Tier 4 patterns have basePenalty 40',
    );
  }

  // (6) 3N_SUN_TUE crosses week boundary.
  {
    const p = buildBlockDictionary().find(b => b.id === '3N_SUN_TUE')!;
    assert(p.crossesWeekBoundary === true, 'Stage 3g.2b.1: 3N_SUN_TUE crosses week boundary');
  }

  // (7) 2N_SUN_MON crosses week boundary.
  {
    const p = buildBlockDictionary().find(b => b.id === '2N_SUN_MON')!;
    assert(p.crossesWeekBoundary === true, 'Stage 3g.2b.1: 2N_SUN_MON crosses week boundary');
  }

  // (8) 4N_MON_THU does not cross week boundary.
  {
    const p = buildBlockDictionary().find(b => b.id === '4N_MON_THU')!;
    assert(p.crossesWeekBoundary === false, 'Stage 3g.2b.1: 4N_MON_THU contained within week');
  }

  // (9) Atomic pair positive.
  assert(
    isTier15AtomicPair(['2N_A_MON_TUE', '2N_B_WED_THU']) === true,
    'Stage 3g.2b.1: Tier 1.5 atomic pair positive',
  );

  // (10) Atomic pair negative — mismatched.
  assert(
    isTier15AtomicPair(['2N_A_MON_TUE', '2N_FRI_SAT']) === false,
    'Stage 3g.2b.1: Tier 1.5 atomic pair negative on unrelated ids',
  );

  // (11) Split weekend positive.
  assert(
    hasSplitWeekend(['2N_FRI_SAT', '2N_SAT_SUN']) === true,
    'Stage 3g.2b.1: split-weekend positive',
  );

  // (12) Split weekend negative — only one of the pair.
  assert(
    hasSplitWeekend(['2N_FRI_SAT']) === false,
    'Stage 3g.2b.1: split-weekend negative on single 2N_FRI_SAT',
  );

  console.log('\n=== Stage 3g.2b.1 — LTFT generic function (F49/F50/F51) ===');

  const DICT = buildBlockDictionary();
  const pattern4N = DICT.find(p => p.id === '4N_MON_THU')!;
  const pattern3N = DICT.find(p => p.id === '3N_FRI_SUN')!;
  const pattern2NSatSun = DICT.find(p => p.id === '2N_SAT_SUN')!;
  const pattern2NFriSat = DICT.find(p => p.id === '2N_FRI_SAT')!;

  // Block-date mappings (May 2026 reference):
  // 4N_MON_THU starting Mon 2026-05-04: [05-04, 05-05, 05-06, 05-07]
  // 3N_FRI_SUN starting Fri 2026-05-08: [05-08, 05-09, 05-10]
  // 2N_SAT_SUN starting Sat 2026-05-09: [05-09, 05-10]
  // 2N_FRI_SAT starting Fri 2026-05-08: [05-08, 05-09]
  const dates4N = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'];
  const dates3N = ['2026-05-08', '2026-05-09', '2026-05-10'];
  const datesSatSun = ['2026-05-09', '2026-05-10'];
  const datesFriSat = ['2026-05-08', '2026-05-09'];

  // Test-doctor builder — produces a minimal Doctor with configurable
  // LTFT profile. Does not affect ranking / CSB tests.
  function ltftDoctor(
    daysOff: readonly string[],
    perDayFlags: Readonly<Record<string, { canStart: boolean; canEnd: boolean }>>,
  ): typeof minimalInput.doctors[0] {
    return {
      ...minimalInput.doctors[0],
      ltft: {
        isLtft: daysOff.length > 0,
        daysOff: [...daysOff],
        nightFlexibility: Object.entries(perDayFlags).map(([day, f]) => ({
          day,
          canStartNightsOnDay: f.canStart,
          canEndNightsOnDay: f.canEnd,
        })),
      },
    };
  }
  const nonLtftDoctor = minimalInput.doctors[0]; // Alice — no LTFT
  const ltftMonBoth = ltftDoctor(['monday'], { monday: { canStart: true, canEnd: true } });
  const ltftMonEnd = ltftDoctor(['monday'], { monday: { canStart: false, canEnd: true } });
  const ltftMonNone = ltftDoctor(['monday'], { monday: { canStart: false, canEnd: false } });
  const ltftTue = ltftDoctor(['tuesday'], { tuesday: { canStart: false, canEnd: false } });
  const ltftFriStart = ltftDoctor(['friday'], { friday: { canStart: true, canEnd: false } });
  const ltftFriNone = ltftDoctor(['friday'], { friday: { canStart: false, canEnd: false } });
  const ltftSat = ltftDoctor(['saturday'], { saturday: { canStart: false, canEnd: false } });
  const ltftSun = ltftDoctor(['sunday'], { sunday: { canStart: false, canEnd: false } });
  const ltftMonFriBoth = ltftDoctor(['monday', 'friday'], {
    monday: { canStart: true, canEnd: true },
    friday: { canStart: true, canEnd: true },
  });
  const ltftMonFriNoStart = ltftDoctor(['monday', 'friday'], {
    monday: { canStart: false, canEnd: true },  // Mon first-night REQUIRES_CAN_START
    friday: { canStart: true, canEnd: true },   // Fri morning-after OK via canEnd
  });
  const ltftMonFriNoEnd = ltftDoctor(['monday', 'friday'], {
    monday: { canStart: true, canEnd: true },   // Mon first-night OK via canStart
    friday: { canStart: true, canEnd: false },  // Fri morning-after REQUIRES_CAN_END
  });
  const ltftMonFriNone = ltftDoctor(['monday', 'friday'], {
    monday: { canStart: false, canEnd: false },
    friday: { canStart: false, canEnd: false },
  });

  // (1) Non-LTFT + 4N_MON_THU → OK.
  {
    const r = checkLtftDisposition(pattern4N, dates4N, nonLtftDoctor);
    assert(
      r.disposition === 'OK' && r.allowed,
      `Stage 3g.2b.1 LTFT: non-LTFT + 4N → OK (got ${r.disposition})`,
    );
  }

  // (2) LTFT-Tue + 4N_MON_THU (Tue=mid-block) → ALWAYS_BLOCKED.
  {
    const r = checkLtftDisposition(pattern4N, dates4N, ltftTue);
    assert(
      r.disposition === 'ALWAYS_BLOCKED' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Tue-off + 4N mid-block → ALWAYS_BLOCKED (got ${r.disposition})`,
    );
  }

  // (3) LTFT-Mon canEnd=true + 3N_FRI_SUN → OK.
  {
    const r = checkLtftDisposition(pattern3N, dates3N, ltftMonBoth);
    assert(
      r.disposition === 'OK' && r.allowed,
      `Stage 3g.2b.1 LTFT: Mon-off + 3N_FRI_SUN canEnd=true → OK (got ${r.disposition})`,
    );
  }

  // (4) LTFT-Mon canEnd=false + 3N_FRI_SUN → REQUIRES_CAN_END.
  {
    const r = checkLtftDisposition(pattern3N, dates3N, ltftMonNone);
    assert(
      r.disposition === 'REQUIRES_CAN_END' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Mon-off + 3N canEnd=false → REQUIRES_CAN_END (got ${r.disposition})`,
    );
  }

  // (5) LTFT-Fri canStart=true + 3N_FRI_SUN → OK.
  {
    const r = checkLtftDisposition(pattern3N, dates3N, ltftFriStart);
    assert(
      r.disposition === 'OK' && r.allowed,
      `Stage 3g.2b.1 LTFT: Fri-off + 3N canStart=true → OK (got ${r.disposition})`,
    );
  }

  // (6) LTFT-Fri canStart=false + 3N_FRI_SUN → REQUIRES_CAN_START.
  {
    const r = checkLtftDisposition(pattern3N, dates3N, ltftFriNone);
    assert(
      r.disposition === 'REQUIRES_CAN_START' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Fri-off + 3N canStart=false → REQUIRES_CAN_START (got ${r.disposition})`,
    );
  }

  // (7) LTFT-Tue + 3N_FRI_SUN (Tue = restDay2) → OK_WITH_LIEU.
  {
    const r = checkLtftDisposition(pattern3N, dates3N, ltftTue);
    assert(
      r.disposition === 'OK_WITH_LIEU' && r.allowed && r.requiresLieuOnDate === '2026-05-12',
      `Stage 3g.2b.1 LTFT: Tue-off + 3N (Tue=rest) → OK_WITH_LIEU on 2026-05-12 (got ${r.disposition}/${r.requiresLieuOnDate})`,
    );
  }

  // (8) LTFT-Sun + 3N_FRI_SUN (Sun=last night) → ALWAYS_BLOCKED.
  {
    const r = checkLtftDisposition(pattern3N, dates3N, ltftSun);
    assert(
      r.disposition === 'ALWAYS_BLOCKED' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Sun-off + 3N Sun=last → ALWAYS_BLOCKED (got ${r.disposition})`,
    );
  }

  // (9) LTFT-Sat canStart=false + 2N_SAT_SUN → REQUIRES_CAN_START.
  {
    const r = checkLtftDisposition(pattern2NSatSun, datesSatSun, ltftSat);
    assert(
      r.disposition === 'REQUIRES_CAN_START' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Sat-off + 2N_SAT_SUN canStart=false → REQUIRES_CAN_START (got ${r.disposition})`,
    );
  }

  // (10) LTFT-Sat + 2N_FRI_SAT (Sat=last night) → ALWAYS_BLOCKED.
  {
    const r = checkLtftDisposition(pattern2NFriSat, datesFriSat, ltftSat);
    assert(
      r.disposition === 'ALWAYS_BLOCKED' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Sat-off + 2N_FRI_SAT Sat=last → ALWAYS_BLOCKED (got ${r.disposition})`,
    );
  }

  // (11) LTFT-Sun + 2N_SAT_SUN (Sun=last night) → ALWAYS_BLOCKED.
  {
    const r = checkLtftDisposition(pattern2NSatSun, datesSatSun, ltftSun);
    assert(
      r.disposition === 'ALWAYS_BLOCKED' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Sun-off + 2N_SAT_SUN Sun=last → ALWAYS_BLOCKED (got ${r.disposition})`,
    );
  }

  // (12) Multi-day LTFT (Mon + Tue off) + 4N_MON_THU → ALWAYS_BLOCKED
  //      (Tue mid-block wins over Mon first-night).
  {
    const doc = ltftDoctor(['monday', 'tuesday'], {
      monday: { canStart: true, canEnd: true },
      tuesday: { canStart: true, canEnd: true },
    });
    const r = checkLtftDisposition(pattern4N, dates4N, doc);
    assert(
      r.disposition === 'ALWAYS_BLOCKED' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Mon+Tue off + 4N → ALWAYS_BLOCKED wins (got ${r.disposition})`,
    );
  }

  // (13) Multi-day LTFT (Mon + Fri off) canStart[mon]=true & canEnd[fri]=true
  //      + 4N_MON_THU (Mon=first, Fri=morning-after) → OK.
  {
    const r = checkLtftDisposition(pattern4N, dates4N, ltftMonFriBoth);
    assert(
      r.disposition === 'OK' && r.allowed,
      `Stage 3g.2b.1 LTFT: Mon+Fri off with both flags true → OK (got ${r.disposition})`,
    );
  }

  // (14) Same combo with canStart[mon]=false → REQUIRES_CAN_START.
  {
    const r = checkLtftDisposition(pattern4N, dates4N, ltftMonFriNoStart);
    assert(
      r.disposition === 'REQUIRES_CAN_START' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Mon+Fri off canStart[mon]=false → REQUIRES_CAN_START (got ${r.disposition})`,
    );
  }

  // (15) Same combo with canEnd[fri]=false → REQUIRES_CAN_END.
  {
    const r = checkLtftDisposition(pattern4N, dates4N, ltftMonFriNoEnd);
    assert(
      r.disposition === 'REQUIRES_CAN_END' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Mon+Fri off canEnd[fri]=false → REQUIRES_CAN_END (got ${r.disposition})`,
    );
  }

  // (16) Same combo with both flags false → REQUIRES_BOTH.
  {
    const r = checkLtftDisposition(pattern4N, dates4N, ltftMonFriNone);
    assert(
      r.disposition === 'REQUIRES_BOTH' && !r.allowed,
      `Stage 3g.2b.1 LTFT: Mon+Fri off both false → REQUIRES_BOTH (got ${r.disposition})`,
    );
  }

  // (17) getDayKeyUtc: Mon 2026-05-04 → 'mon'.
  assert(getDayKeyUtc('2026-05-04') === 'mon', 'Stage 3g.2b.1 LTFT: getDayKeyUtc Mon');
  // (18) getDayKeyUtc: Sun 2026-05-03 → 'sun'.
  assert(getDayKeyUtc('2026-05-03') === 'sun', 'Stage 3g.2b.1 LTFT: getDayKeyUtc Sun');

  // (19) getLtftFlags on non-LTFT doctor → both false.
  {
    const f = getLtftFlags(nonLtftDoctor, 'mon');
    assert(
      f.canStart === false && f.canEnd === false,
      'Stage 3g.2b.1 LTFT: getLtftFlags non-LTFT returns both false',
    );
  }

  // (20) getDoctorLtftDaysOff: [] for non-LTFT; ['mon'] for LTFT-Mon.
  {
    const noneOff = getDoctorLtftDaysOff(nonLtftDoctor);
    assert(noneOff.length === 0, 'Stage 3g.2b.1 LTFT: getDoctorLtftDaysOff [] for non-LTFT');
    const monOff = getDoctorLtftDaysOff(ltftMonNone);
    assert(
      monOff.length === 1 && monOff[0] === 'mon',
      `Stage 3g.2b.1 LTFT: getDoctorLtftDaysOff ['mon'] for LTFT-Mon (got ${JSON.stringify(monOff)})`,
    );
  }

  console.log('\n=== Stage 3g.2b.1 — Weekend primitives ===');

  // (1) getWeekendSaturdays finds 4 Saturdays in 2026-05-04..2026-05-31.
  {
    const sats = getWeekendSaturdays('2026-05-04', '2026-05-31');
    assert(
      sats.length === 4
        && sats[0] === '2026-05-09'
        && sats[1] === '2026-05-16'
        && sats[2] === '2026-05-23'
        && sats[3] === '2026-05-30',
      `Stage 3g.2b.1 primitives: getWeekendSaturdays (got ${JSON.stringify(sats)})`,
    );
  }

  // (2) deriveWeekendDates for Sat 2026-05-09.
  {
    const w = deriveWeekendDates('2026-05-09');
    assert(
      w.fri === '2026-05-08'
        && w.sat === '2026-05-09'
        && w.sun === '2026-05-10'
        && w.nextMon === '2026-05-11'
        && w.nextTue === '2026-05-12',
      `Stage 3g.2b.1 primitives: deriveWeekendDates (got ${JSON.stringify(w)})`,
    );
  }

  // (3) computeNormalisedNightDeficit: target 4 count × 13h = 52h, actual 0.
  {
    const doc = minimalInputWeekendNights.doctors[0];
    const s = freshState(doc.doctorId);
    const d = computeNormalisedNightDeficit(doc, s, 13, 'night');
    assert(d === 1, `Stage 3g.2b.1 primitives: deficit target 52h / actual 0 = 1.0 (got ${d})`);
  }

  // (4) deficit: actual 13h.
  {
    const doc = minimalInputWeekendNights.doctors[0];
    const s = freshState(doc.doctorId);
    s.actualHoursByShiftType['night'] = 13;
    const d = computeNormalisedNightDeficit(doc, s, 13, 'night');
    assert(d === 0.75, `Stage 3g.2b.1 primitives: deficit 13h = 0.75 (got ${d})`);
  }

  // (5) deficit: actual 52h → 0.
  {
    const doc = minimalInputWeekendNights.doctors[0];
    const s = freshState(doc.doctorId);
    s.actualHoursByShiftType['night'] = 52;
    const d = computeNormalisedNightDeficit(doc, s, 13, 'night');
    assert(d === 0, `Stage 3g.2b.1 primitives: deficit 52h = 0 (got ${d})`);
  }

  // (6) deficit: target 0 → 0 (zero-guard).
  {
    const baseDoc = minimalInputWeekendNights.doctors[0];
    const doc = {
      ...baseDoc,
      fairnessTargets: { ...baseDoc.fairnessTargets, targetNightShiftCount: 0 },
    };
    const s = freshState(doc.doctorId);
    const d = computeNormalisedNightDeficit(doc, s, 13, 'night');
    assert(d === 0, `Stage 3g.2b.1 primitives: deficit with target 0 = 0 (got ${d})`);
  }

  // (7) scoreWeekendScarcity returns non-negative integer.
  {
    const wnInput = minimalInputWeekendNights;
    const wnMatrix = buildAvailabilityMatrix(wnInput);
    const slots: Record<string, ShiftSlotEntry> = {};
    for (const date of ['2026-05-08', '2026-05-09', '2026-05-10']) {
      const dk = dayKeyForDate(date);
      const slot = wnInput.preRotaInput.shiftSlots.find(
        s => s.shiftKey === 'night' && s.dayKey === dk,
      );
      if (slot) slots[date] = slot;
    }
    const score = scoreWeekendScarcity(
      '2026-05-09', wnInput.doctors, wnMatrix, slots, wnInput.preRotaInput.period.endDate,
    );
    assert(
      typeof score === 'number' && score >= 0 && Number.isInteger(score),
      `Stage 3g.2b.1 primitives: scarcity non-negative integer (got ${score})`,
    );
  }

  // (8) filterByI68Residency: residents separated from non-residents.
  {
    const doctors = [
      { ...minimalInput.doctors[0], grade: 'Consultant' },
      { ...minimalInput.doctors[0], doctorId: 'doc-resident', grade: 'ST5' },
      { ...minimalInput.doctors[0], doctorId: 'doc-sas', grade: 'SAS' },
    ];
    const r = filterByI68Residency(
      ['doc-1', 'doc-resident', 'doc-sas'],
      doctors,
    );
    assert(
      r.residentsFirst.length === 1
        && r.residentsFirst[0] === 'doc-resident'
        && r.fallbackPool.length === 2,
      `Stage 3g.2b.1 primitives: I68 separates residents (got residents=${JSON.stringify(r.residentsFirst)}, fallback=${JSON.stringify(r.fallbackPool)})`,
    );
  }

  console.log('\n=== Stage 3g.2b.1 — Weekend sub-pass integration ===');

  // Helper: build a state map with fresh DoctorState for each doctor.
  function freshStateMap(input: FinalRotaInput): Map<string, DoctorState> {
    const m = new Map<string, DoctorState>();
    for (const d of input.doctors) m.set(d.doctorId, freshState(d.doctorId));
    return m;
  }

  // Helper: deep clone a doctor shape with override for constraints.hard.
  function cloneDoctorWithAL(
    doctor: typeof minimalInputWeekendNights.doctors[0],
    alDates: readonly string[],
  ): typeof minimalInputWeekendNights.doctors[0] {
    return {
      ...doctor,
      constraints: {
        hard: {
          ...doctor.constraints.hard,
          annualLeaveDates: [...alDates],
        },
        soft: doctor.constraints.soft,
      },
    };
  }

  const SAT1 = '2026-05-09'; // first weekend of the fixture period
  const SAT_LAST = '2026-05-30'; // last weekend

  // (1) Clean 3-full-time scenario → Pass 1 with 3N_FRI_SUN.
  {
    const doctors = minimalInputWeekendNights.doctors.map(d => ({
      ...d,
      grade: 'Consultant',
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: {
        hard: { ...d.constraints.hard, ltftDaysBlocked: [] },
        soft: d.constraints.soft,
      },
    }));
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    assert(
      r.pathTaken === 'PASS1' && r.assignments.length === 3 && r.penaltyApplied === 0,
      `Stage 3g.2b.1 integration: clean 3-FT → PASS1 3 assignments (got ${r.pathTaken}/${r.assignments.length})`,
    );
  }

  // (2) Mixed: D1 non-LTFT (Consultant), D2 LTFT-Mon, D3 LTFT-Fri.
  //     Residents (D2, D3) try 3N first (I68) but LTFT blocks — D1 wins.
  {
    const inp = minimalInputWeekendNights;
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    const uniqueDocs = new Set(r.assignments.map(a => a.doctorId));
    assert(
      r.pathTaken === 'PASS1'
        && r.assignments.length === 3
        && uniqueDocs.size === 1
        && uniqueDocs.has('doc-1'),
      `Stage 3g.2b.1 integration: mixed LTFT + FT → PASS1 D1 placed (got ${r.pathTaken}/${JSON.stringify([...uniqueDocs])})`,
    );
  }

  // (3) Pass 2 Group A with 2N_SAT_SUN: D1 Sun-AL forces Group B;
  //     D2 LTFT-Mon blocks 2N_SAT_SUN; D3 LTFT-Fri allows 2N_SAT_SUN
  //     (Fri out of scope). D3 wins Pass 2A; Fri marked CRITICAL UNFILLED.
  {
    const doctors = [
      cloneDoctorWithAL(minimalInputWeekendNights.doctors[0], ['2026-05-10']), // D1 Sun AL
      minimalInputWeekendNights.doctors[1], // D2 LTFT-Mon
      minimalInputWeekendNights.doctors[2], // D3 LTFT-Fri
    ];
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    const uniqueDocs = new Set(r.assignments.map(a => a.doctorId));
    const friUnfilled = r.unfilledSlots.some(u => u.date === '2026-05-08' && u.isCritical);
    assert(
      r.pathTaken === 'PASS2_GROUP_A'
        && r.assignments.length === 2
        && uniqueDocs.has('doc-3')
        && friUnfilled
        && r.penaltyApplied === 25,
      `Stage 3g.2b.1 integration: Pass 2A with 2N_SAT_SUN, Fri CRITICAL (got ${r.pathTaken}/${r.assignments.length}/${friUnfilled})`,
    );
  }

  // (4) Bridge success: all three doctors LTFT-blocked from 3N and
  //     2N_SAT_SUN. D1 LTFT-Sun canEnd=true handles 2N_FRI_SAT
  //     (Sun=morning-after allowed). D3 LTFT-Sun canStart=true handles
  //     the bridge (Sun=first-night allowed). Expected outcome:
  //     PASS2_GROUP_A with bridge consumed, 5 assignments.
  {
    const base = minimalInputWeekendNights.doctors;
    const doctors = [
      {
        ...base[0],
        ltft: {
          isLtft: true,
          daysOff: ['sunday'],
          nightFlexibility: [
            { day: 'sunday', canStartNightsOnDay: false, canEndNightsOnDay: true },
          ],
        },
        constraints: {
          hard: { ...base[0].constraints.hard, ltftDaysBlocked: ['sunday'] },
          soft: base[0].constraints.soft,
        },
      },
      base[1], // D2 LTFT-Mon canStart=false canEnd=false (default fixture)
      {
        ...base[2],
        ltft: {
          isLtft: true,
          daysOff: ['sunday'],
          nightFlexibility: [
            { day: 'sunday', canStartNightsOnDay: true, canEndNightsOnDay: true },
          ],
        },
        constraints: {
          hard: { ...base[2].constraints.hard, ltftDaysBlocked: ['sunday'] },
          soft: base[2].constraints.soft,
        },
      },
    ];
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    const uniqueDocs = new Set(r.assignments.map(a => a.doctorId));
    assert(
      r.pathTaken === 'PASS2_GROUP_A'
        && r.orphanConsumedByBridge === true
        && r.assignments.length === 5
        && uniqueDocs.size === 2
        && r.penaltyApplied === 35,
      `Stage 3g.2b.1 integration: bridge success (got ${r.pathTaken}/${r.assignments.length}/bridge=${r.orphanConsumedByBridge})`,
    );
  }

  // (5) Bridge fail → Relaxation. D1 LTFT-Sun canEnd=true can do only
  //     2N_FRI_SAT (alone). D2/D3 have state.consecutiveNightDates=3
  //     so every CSB A4 check (3+3=6 or 3+2=5 against cap 4) fails,
  //     leaving no bridge partner. Pass 2A primary for D1 succeeds
  //     but bridge pool [D2, D3] both A4-fail → bridge discarded.
  //     Relaxation then places 2N_FRI_SAT for D1 alone.
  const bridgeFailDoctors = [
    {
      ...minimalInputWeekendNights.doctors[0],
      ltft: {
        isLtft: true,
        daysOff: ['sunday'],
        nightFlexibility: [
          { day: 'sunday', canStartNightsOnDay: false, canEndNightsOnDay: true },
        ],
      },
      constraints: {
        hard: { ...minimalInputWeekendNights.doctors[0].constraints.hard, ltftDaysBlocked: ['sunday'] },
        soft: minimalInputWeekendNights.doctors[0].constraints.soft,
      },
    },
    { ...minimalInputWeekendNights.doctors[1],
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: {
        hard: { ...minimalInputWeekendNights.doctors[1].constraints.hard, ltftDaysBlocked: [] },
        soft: minimalInputWeekendNights.doctors[1].constraints.soft,
      },
    },
    { ...minimalInputWeekendNights.doctors[2],
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: {
        hard: { ...minimalInputWeekendNights.doctors[2].constraints.hard, ltftDaysBlocked: [] },
        soft: minimalInputWeekendNights.doctors[2].constraints.soft,
      },
    },
  ];
  const bridgeFailInput: FinalRotaInput = { ...minimalInputWeekendNights, doctors: bridgeFailDoctors };
  const bridgeFailMatrix = buildAvailabilityMatrix(bridgeFailInput);
  function bridgeFailState(): Map<string, DoctorState> {
    const m = new Map<string, DoctorState>();
    for (const d of bridgeFailInput.doctors) {
      const s = freshState(d.doctorId);
      if (d.doctorId !== 'doc-1') {
        // Inflate consecutive-night counter for D2/D3 so A4 fails on
        // any placement involving them.
        s.consecutiveNightDates = ['2026-05-05', '2026-05-06', '2026-05-07'];
      }
      m.set(d.doctorId, s);
    }
    return m;
  }
  {
    const r = placeWeekendNightsForWeekend(
      SAT1, bridgeFailInput, bridgeFailState(), bridgeFailMatrix,
      bridgeFailInput.doctors.map(d => d.doctorId),
      'night', 13, true,
    );
    assert(
      r.pathTaken === 'RELAXATION'
        && r.orphanConsumedByBridge === false
        && r.assignments.length === 2,
      `Stage 3g.2b.1 integration: bridge fail → Relaxation 2 assignments (got ${r.pathTaken}/${r.assignments.length})`,
    );
  }

  // (6) Relaxation Sun CRITICAL UNFILLED. Same scenario as (5); verify
  //     unfilled slot emitted for Sun 05-10.
  {
    const r = placeWeekendNightsForWeekend(
      SAT1, bridgeFailInput, bridgeFailState(), bridgeFailMatrix,
      bridgeFailInput.doctors.map(d => d.doctorId),
      'night', 13, true,
    );
    const sunUnfilled = r.unfilledSlots.some(u => u.date === '2026-05-10' && u.isCritical);
    assert(
      sunUnfilled,
      `Stage 3g.2b.1 integration: Relaxation Sun CRITICAL UNFILLED (got unfilled=${JSON.stringify(r.unfilledSlots)})`,
    );
  }

  // (7) Full UNFILLED: all doctors have targetNightShiftCount=0 → empty
  //     candidate pool → no placement attempted. 3 CRITICAL UNFILLED.
  {
    const doctors = minimalInputWeekendNights.doctors.map(d => ({
      ...d,
      fairnessTargets: { ...d.fairnessTargets, targetNightShiftCount: 0 },
    }));
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    assert(
      r.pathTaken === 'UNFILLED'
        && r.assignments.length === 0
        && r.unfilledSlots.filter(u => u.isCritical).length === 3,
      `Stage 3g.2b.1 integration: targetNightShiftCount=0 excludes all → UNFILLED (got ${r.pathTaken}/${r.assignments.length}/${r.unfilledSlots.length})`,
    );
  }

  // (8) A8 LTFT lieu staging: LTFT-Tue doctor placed on 3N_FRI_SUN;
  //     lieuStaged has Tue 05-12 with source LTFT_REST (from
  //     OK_WITH_LIEU disposition; deduped against A8-derived entry).
  {
    const doctors = [
      minimalInputWeekendNights.doctors[0],
      minimalInputWeekendNights.doctors[1],
      // D3 LTFT-Tue canStart/canEnd=true (Tue isn't in block anyway);
      // 3N_FRI_SUN has Tue=restDay2 → OK_WITH_LIEU.
      {
        ...minimalInputWeekendNights.doctors[2],
        grade: 'Consultant', // non-resident so D3 is ranked last, but
                              // still the only doctor placed once others
                              // are eliminated. Simpler: just check lieu.
        ltft: {
          isLtft: true,
          daysOff: ['tuesday'],
          nightFlexibility: [
            { day: 'tuesday', canStartNightsOnDay: true, canEndNightsOnDay: true },
          ],
        },
        constraints: {
          hard: { ...minimalInputWeekendNights.doctors[2].constraints.hard, ltftDaysBlocked: ['tuesday'] },
          soft: minimalInputWeekendNights.doctors[2].constraints.soft,
        },
      },
    ];
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    // D1 (no LTFT) will win Pass 1 (non-resident, but D2 resident is
    // LTFT-Mon so blocked on 3N). Place D3 check via isolated direct
    // call: set D1 AL Sun to knock D1 out.
    void r;
    // Alternate — inject D1 AL Sun so only D3 can be placed.
    const doctorsAlt = [
      cloneDoctorWithAL(doctors[0], ['2026-05-10']), // D1 Sun AL — 3N isSlotEligible fails
      doctors[1], // D2 LTFT-Mon — 3N REQUIRES_CAN_END blocks
      doctors[2], // D3 LTFT-Tue
    ];
    const inpAlt: FinalRotaInput = { ...minimalInputWeekendNights, doctors: doctorsAlt };
    const matrixAlt = buildAvailabilityMatrix(inpAlt);
    const stateAlt = freshStateMap(inpAlt);
    const shuffleAlt = inpAlt.doctors.map(d => d.doctorId);
    const r2 = placeWeekendNightsForWeekend(
      SAT1, inpAlt, stateAlt, matrixAlt, shuffleAlt, 'night', 13, true,
    );
    const d3Placed = r2.assignments.some(a => a.doctorId === 'doc-3');
    const hasLtftLieu = r2.lieuStaged.some(
      l => l.doctorId === 'doc-3' && l.date === '2026-05-12' && l.source === 'LTFT_REST',
    );
    assert(
      d3Placed && hasLtftLieu,
      `Stage 3g.2b.1 integration: D3 LTFT-Tue placed with LTFT_REST lieu on Tue (d3=${d3Placed} lieu=${hasLtftLieu})`,
    );
  }

  // (9) A8 AL lieu staging: doctor has AL on restDay2 (Tue 05-12) —
  //     B30 on Sun-night would trip on AL-on-Mon (restDay1), so this
  //     test targets the +2 rest day which has no B30 cascade. A8
  //     stages the lieu via `deriveA8LieuDates`.
  {
    const doctors = [
      cloneDoctorWithAL(
        { ...minimalInputWeekendNights.doctors[0],
          ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
          constraints: {
            hard: { ...minimalInputWeekendNights.doctors[0].constraints.hard, ltftDaysBlocked: [] },
            soft: minimalInputWeekendNights.doctors[0].constraints.soft,
          },
        },
        ['2026-05-12'], // Tue AL — restDay2 of 3N_FRI_SUN (no B30 cascade)
      ),
      minimalInputWeekendNights.doctors[1],
      minimalInputWeekendNights.doctors[2],
    ];
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    const hasAlLieu = r.lieuStaged.some(
      l => l.doctorId === 'doc-1' && l.date === '2026-05-12' && l.source === 'AL',
    );
    assert(
      r.pathTaken === 'PASS1' && hasAlLieu,
      `Stage 3g.2b.1 integration: AL-on-restDay2 staged with source AL (got path=${r.pathTaken} lieu=${hasAlLieu})`,
    );
  }

  // (10) restStampsByDoctor: D1 placed on 3N_FRI_SUN → restUntilMs
  //      equals last night end + 46h.
  {
    const inp = minimalInputWeekendNights;
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    // Last night is Sun 2026-05-10 19:00 UTC → Mon 08:00 UTC.
    const lastNightEnd = Date.UTC(2026, 4, 11, 8, 0, 0);
    const expected = lastNightEnd + 46 * 3_600_000;
    assert(
      r.restStampsByDoctor['doc-1'] === expected,
      `Stage 3g.2b.1 integration: restUntilMs = lastEnd + 46h (got ${r.restStampsByDoctor['doc-1']}, expected ${expected})`,
    );
  }

  // (11) Competency promote: among deficit-tied doctors, competency
  //      eligibility wins. Build a slot requiring IAC; doctor with
  //      hasIac ranks above without.
  {
    const baseDoc = minimalInput.doctors[0];
    const competentDoc = { ...baseDoc, doctorId: 'comp-y', hasIac: true };
    const nonCompetentDoc = { ...baseDoc, doctorId: 'comp-n', hasIac: false };
    const iacSlot: ShiftSlotEntry = {
      ...minimalInput.preRotaInput.shiftSlots[0],
      slots: [{
        slotIndex: 0, label: null, permittedGrades: [],
        reqIac: 1, reqIaoc: 0, reqIcu: 0, reqTransfer: 0,
      }],
    };
    const stateMap = new Map<string, DoctorState>();
    stateMap.set('comp-y', freshState('comp-y'));
    stateMap.set('comp-n', freshState('comp-n'));
    const block3 = buildBlockDictionary().find(p => p.id === '3N_FRI_SUN')!;
    const ranked = rankDoctorsForBlock(
      ['comp-n', 'comp-y'], block3, iacSlot, stateMap, [competentDoc, nonCompetentDoc],
      13, 'night', ['comp-n', 'comp-y'],
    );
    assert(
      ranked[0] === 'comp-y',
      `Stage 3g.2b.1 integration: competency promotes comp-y over comp-n (got ${JSON.stringify(ranked)})`,
    );
  }

  // (12) Shuffle determinism: same inputs produce identical output.
  {
    const inp = minimalInputWeekendNights;
    const matrix = buildAvailabilityMatrix(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r1 = placeWeekendNightsForWeekend(
      SAT1, inp, freshStateMap(inp), matrix, shuffle, 'night', 13, true,
    );
    const r2 = placeWeekendNightsForWeekend(
      SAT1, inp, freshStateMap(inp), matrix, shuffle, 'night', 13, true,
    );
    assert(
      r1.pathTaken === r2.pathTaken
        && r1.assignments.length === r2.assignments.length
        && r1.assignments.every((a, i) => a.doctorId === r2.assignments[i].doctorId
            && a.shiftStartMs === r2.assignments[i].shiftStartMs),
      'Stage 3g.2b.1 integration: shuffle-deterministic output',
    );
  }

  // (13) Constraint-scarcity ordering: weekend with fewer eligible
  //      (doctor × pattern) combos scores lower.
  {
    const inp = minimalInputWeekendNights;
    const matrix = buildAvailabilityMatrix(inp);
    const slots1: Record<string, ShiftSlotEntry> = {};
    for (const date of ['2026-05-08', '2026-05-09', '2026-05-10']) {
      const dk = dayKeyForDate(date);
      const slot = inp.preRotaInput.shiftSlots.find(
        s => s.shiftKey === 'night' && s.dayKey === dk,
      );
      if (slot) slots1[date] = slot;
    }
    const score1 = scoreWeekendScarcity(
      '2026-05-09', inp.doctors, matrix, slots1, inp.preRotaInput.period.endDate,
    );
    // Heavier constraint: strip two doctors from the input.
    const score2 = scoreWeekendScarcity(
      '2026-05-09', [inp.doctors[0]], matrix, slots1, inp.preRotaInput.period.endDate,
    );
    assert(
      score2 <= score1,
      `Stage 3g.2b.1 integration: scarcity monotonic under pool reduction (got ${score2} ≤ ${score1})`,
    );
  }

  // (14) I68 residents attempted before non-residents in ranked order.
  {
    const consultant = {
      ...minimalInput.doctors[0], doctorId: 'd-cons', grade: 'Consultant',
    };
    const resident = {
      ...minimalInput.doctors[0], doctorId: 'd-res', grade: 'ST5',
    };
    const split = filterByI68Residency(
      ['d-cons', 'd-res'], [consultant, resident],
    );
    assert(
      split.residentsFirst[0] === 'd-res' && split.fallbackPool[0] === 'd-cons',
      'Stage 3g.2b.1 integration: I68 orders resident before consultant',
    );
  }

  // (15) Doctor with targetNightShiftCount=0 excluded from placement.
  {
    const doctors = minimalInputWeekendNights.doctors.map((d, i) =>
      i === 0
        ? { ...d, fairnessTargets: { ...d.fairnessTargets, targetNightShiftCount: 0 } }
        : d,
    );
    const inp: FinalRotaInput = { ...minimalInputWeekendNights, doctors };
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT1, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    const placed = new Set(r.assignments.map(a => a.doctorId));
    assert(
      !placed.has('doc-1'),
      `Stage 3g.2b.1 integration: target=0 excluded (placed=${JSON.stringify([...placed])})`,
    );
  }

  // (16) Bridge respects period end: last weekend 05-30 has nextTue
  //      06-02 > period end 05-31 → bridge not attempted. AllLtft
  //      fixture forces Pass 1/2A to fail; verify no bridge assignments.
  {
    const inp = minimalInputWeekendNightsAllLtft;
    const matrix = buildAvailabilityMatrix(inp);
    const stateMap = freshStateMap(inp);
    const shuffle = inp.doctors.map(d => d.doctorId);
    const r = placeWeekendNightsForWeekend(
      SAT_LAST, inp, stateMap, matrix, shuffle, 'night', 13, true,
    );
    assert(
      r.orphanConsumedByBridge === false,
      `Stage 3g.2b.1 integration: bridge not attempted past period end (bridge=${r.orphanConsumedByBridge}, path=${r.pathTaken})`,
    );
  }

  // (17) Deficit fairness: after simulated placement updates
  //      actualHoursByShiftType, the previously-placed doctor drops in
  //      rank against peers.
  {
    const inp = minimalInputWeekendNights;
    const doctors = inp.doctors;
    const baseBlock = buildBlockDictionary().find(p => p.id === '3N_FRI_SUN')!;
    const slot = inp.preRotaInput.shiftSlots.find(
      s => s.shiftKey === 'night' && s.dayKey === 'fri',
    )!;
    const stateBefore = freshStateMap(inp);
    const rankedBefore = rankDoctorsForBlock(
      doctors.map(d => d.doctorId), baseBlock, slot, stateBefore, doctors,
      13, 'night', doctors.map(d => d.doctorId),
    );
    // Simulate doc-1 having placed 39 hours of nights (3 nights).
    const stateAfter = freshStateMap(inp);
    stateAfter.get('doc-1')!.actualHoursByShiftType['night'] = 39;
    const rankedAfter = rankDoctorsForBlock(
      doctors.map(d => d.doctorId), baseBlock, slot, stateAfter, doctors,
      13, 'night', doctors.map(d => d.doctorId),
    );
    const doc1PosBefore = rankedBefore.indexOf('doc-1');
    const doc1PosAfter = rankedAfter.indexOf('doc-1');
    assert(
      doc1PosAfter > doc1PosBefore,
      `Stage 3g.2b.1 integration: doc-1 rank drops after night-hours accrue (${doc1PosBefore} → ${doc1PosAfter})`,
    );
  }

  // (18) All 82 prior assertions implicitly regressed by the script
  //      running end-to-end; surface an explicit checkpoint.
  assert(true, 'Stage 3g.2b.1 integration: prior-stage assertions reach this block');

  console.log('\nAll assertions passed.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
