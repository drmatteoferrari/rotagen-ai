// test/wtr.test.ts
// 20 WTR unit tests.
// Run with: npx tsx test/wtr.test.ts
// All 20 must pass before any allocation code is written.

import assert from 'assert';
import { checkSingleShift, checkNightBlock } from '../src/lib/algo/finalRotaWtr';
import type {
  DoctorRunningTotals,
  WtrConstraints,
  ProposedShift,
  ProposedBlock,
} from '../src/lib/algo/finalRotaTypes';

const WTR: WtrConstraints = {
  maxAvgHoursPerWeek: 48,
  maxHoursIn168h: 72,
  maxShiftLengthH: 13,
  minInterShiftRestH: 11,
  maxConsecutive: { standard: 7, long: 4, nights: 4, longEvening: 4 },
  minRestHoursAfter: { nights: 46, longShifts: 48, standardShifts: 11, longEveningShifts: 11 },
  weekendFrequencyMax: 1 / 3,
  oncall: {
    maxPer7Days: 3,
    localAgreementMaxConsec: 2,
    dayAfterMaxHours: 10,
    restPer24hHours: 8,
    continuousRestHours: 5,
    continuousRestStart: '22:00',
    continuousRestEnd: '07:00',
    ifRestNotMetNextDayMaxHours: 10,
    noSimultaneousShift: true,
    noConsecExceptWknd: true,
    dayAfterLastConsecMaxH: 10,
  },
};

function doc(overrides: Partial<DoctorRunningTotals> = {}): DoctorRunningTotals {
  return {
    doctorId: 'dr-test',
    assignments: [],
    restUntilMs: 0,
    consecutiveDates: [],
    consecutiveNightDates: [],
    consecutiveLongDates: [],
    weekendDatesWorked: [],
    oncallDatesLast7: [],
    nightBlockHistory: [],
    weeklyHoursUsed: {},
    totalWeeksInRota: 13,
    exemptFromNights: false,
    exemptFromWeekends: false,
    exemptFromOncall: false,
    ...overrides,
  };
}

function night(date: string): ProposedShift {
  const start = new Date(date + 'T21:00:00Z').getTime();
  return { date, shiftKey: 'night', startMs: start, endMs: start + 11 * 3_600_000, durationHours: 11, isOncall: true, isNight: true, isLong: false, isWeekend: false };
}

function day(date: string, opts: { hours?: number; isLong?: boolean; isWeekend?: boolean; isOncall?: boolean } = {}): ProposedShift {
  const { hours = 8, isLong = false, isWeekend = false, isOncall = false } = opts;
  const start = new Date(date + 'T08:00:00Z').getTime();
  return { date, shiftKey: isLong ? 'long-day' : 'standard', startMs: start, endMs: start + hours * 3_600_000, durationHours: hours, isOncall, isNight: false, isLong, isWeekend };
}

let passed = 0; let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e: any) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}

console.log('\n── WTR Unit Tests ──────────────────────────────────\n');

// ── A0 ──────────────────────────────────────────────────────
test('A0: second shift same date → FAIL', () => {
  const r = checkSingleShift(doc({ assignments: [day('2026-06-01')] }), day('2026-06-01'), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A0_DUPLICATE_DATE');
});
test('A0: shift on different date → PASS', () => {
  const r = checkSingleShift(doc({ assignments: [day('2026-06-01')] }), day('2026-06-02'), WTR);
  assert.strictEqual(r.pass, true);
});

// ── A3 ──────────────────────────────────────────────────────
test('A3: exactly 11h gap after previous shift → PASS', () => {
  const prev = day('2026-06-01', { hours: 8 }); // 08:00–16:00
  const next: ProposedShift = { ...day('2026-06-02'), startMs: prev.endMs + 11 * 3_600_000, endMs: prev.endMs + 19 * 3_600_000 };
  const r = checkSingleShift(doc({ assignments: [prev] }), next, WTR);
  assert.strictEqual(r.pass, true);
});
test('A3: 10h59m gap → FAIL', () => {
  const prev = day('2026-06-01', { hours: 8 });
  const next: ProposedShift = { ...day('2026-06-02'), startMs: prev.endMs + 11 * 3_600_000 - 60_000, endMs: prev.endMs + 19 * 3_600_000 };
  const r = checkSingleShift(doc({ assignments: [prev] }), next, WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A3_MIN_REST');
});
test('A3: restUntilMs not yet passed → FAIL', () => {
  const futureRest = new Date('2026-06-10T12:00:00Z').getTime();
  const shift: ProposedShift = { ...day('2026-06-10'), startMs: futureRest - 3_600_000, endMs: futureRest + 7 * 3_600_000 };
  const r = checkSingleShift(doc({ restUntilMs: futureRest }), shift, WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A3_MIN_REST');
});

// ── A4 ──────────────────────────────────────────────────────
test('A4: 4th consecutive night (max=4) → PASS', () => {
  const r = checkSingleShift(doc({ consecutiveNightDates: ['2026-06-01','2026-06-02','2026-06-03'] }), night('2026-06-04'), WTR);
  assert.strictEqual(r.pass, true);
});
test('A4: 5th consecutive night → FAIL', () => {
  const r = checkSingleShift(doc({ consecutiveNightDates: ['2026-06-01','2026-06-02','2026-06-03','2026-06-04'] }), night('2026-06-05'), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A4_MAX_CONSEC_NIGHTS');
});
test('A4: non-consecutive night resets streak → PASS', () => {
  // streak was ['..01','..02','..03','..04'], gap on '..05', new night on '..06' → streak resets to 1
  const r = checkSingleShift(doc({ consecutiveNightDates: ['2026-06-01','2026-06-02','2026-06-03','2026-06-04'] }), night('2026-06-06'), WTR);
  assert.strictEqual(r.pass, true);
});

// ── A5 ──────────────────────────────────────────────────────
test('A5: 4th consecutive long shift (max=4) → PASS', () => {
  const r = checkSingleShift(doc({ consecutiveLongDates: ['2026-06-01','2026-06-02','2026-06-03'] }), day('2026-06-04', { hours: 12, isLong: true }), WTR);
  assert.strictEqual(r.pass, true);
});
test('A5: 5th consecutive long shift → FAIL', () => {
  const r = checkSingleShift(doc({ consecutiveLongDates: ['2026-06-01','2026-06-02','2026-06-03','2026-06-04'] }), day('2026-06-05', { hours: 12, isLong: true }), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A5_MAX_CONSEC_LONG');
});

// ── A6 ──────────────────────────────────────────────────────
test('A6: 7th consecutive shift (max=7) → PASS', () => {
  const r = checkSingleShift(doc({ consecutiveDates: ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06'] }), day('2026-06-07'), WTR);
  assert.strictEqual(r.pass, true);
});
test('A6: 8th consecutive shift → FAIL', () => {
  const r = checkSingleShift(doc({ consecutiveDates: ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07'] }), day('2026-06-08'), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A6_MAX_CONSEC_SHIFTS');
});

// ── A7 ──────────────────────────────────────────────────────
test('A7: exactly 1-in-3 frequency → PASS', () => {
  // 3 weeks elapsed, 1 weekend day worked → adding 2nd → weekendUnits=1, freq=1/3 → not >1/3 → PASS
  const r = checkSingleShift(
    doc({ weekendDatesWorked: ['2026-06-06'], weeklyHoursUsed: {'2026-W23':8,'2026-W24':8,'2026-W25':8}, totalWeeksInRota: 13 }),
    day('2026-06-13', { isWeekend: true }), WTR
  );
  assert.strictEqual(r.pass, true);
});
test('A7: exceeds 1-in-3 → FAIL', () => {
  // 3 weeks elapsed, 4 weekend days = 2 weekends → adding 5th = 3 weekends in 3 weeks → FAIL
  const r = checkSingleShift(
    doc({ weekendDatesWorked: ['2026-06-06','2026-06-07','2026-06-13','2026-06-14'], weeklyHoursUsed: {'2026-W23':8,'2026-W24':8,'2026-W25':8}, totalWeeksInRota: 13 }),
    day('2026-06-20', { isWeekend: true }), WTR
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A7_WEEKEND_FREQ');
});

// ── A14 ─────────────────────────────────────────────────────
test('A14: 3rd on-call in 7 days (max=3) → PASS', () => {
  const r = checkSingleShift(doc({ oncallDatesLast7: ['2026-06-01','2026-06-03'] }), day('2026-06-05', { isOncall: true }), WTR);
  assert.strictEqual(r.pass, true);
});
test('A14: 4th on-call in 7 days → FAIL', () => {
  const r = checkSingleShift(doc({ oncallDatesLast7: ['2026-06-01','2026-06-03','2026-06-05'] }), day('2026-06-07', { isOncall: true }), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'A14_MAX_ONCALL_7D');
});

// ── Exemptions ──────────────────────────────────────────────
test('B27: exempt from nights → FAIL', () => {
  const r = checkSingleShift(doc({ exemptFromNights: true }), night('2026-06-01'), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'B27_EXEMPT_NIGHTS');
});
test('B28: exempt from weekends → FAIL', () => {
  const r = checkSingleShift(doc({ exemptFromWeekends: true }), day('2026-06-06', { isWeekend: true }), WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'B28_EXEMPT_WEEKENDS');
});

// ── Night block checks ───────────────────────────────────────
test('BLOCK: single night → FAIL', () => {
  const r = checkNightBlock(doc(), { nights: [night('2026-06-01')] }, WTR);
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'BLOCK_TOO_SHORT');
});
test('BLOCK: 7-day gap not met → FAIL', () => {
  // Last block ended 2026-06-03. New block starts 2026-06-08 — only 5 days later.
  const r = checkNightBlock(
    doc({ nightBlockHistory: [['2026-06-01','2026-06-02','2026-06-03']] }),
    { nights: [night('2026-06-08'), night('2026-06-09')] },
    WTR
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rule, 'BLOCK_GAP_7D');
});
test('BLOCK: valid 2-night block, no history → PASS', () => {
  const r = checkNightBlock(doc(), { nights: [night('2026-06-01'), night('2026-06-02')] }, WTR);
  assert.strictEqual(r.pass, true);
});

// ── Summary ─────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
