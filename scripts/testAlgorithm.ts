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
} from '../src/lib/finalRotaWtr';
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
} from './fixtures/minimalInput';

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

  console.log('\nAll assertions passed.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
