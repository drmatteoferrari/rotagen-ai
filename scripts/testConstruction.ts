// scripts/testConstruction.ts
// Stage 3g.3a — Construction-driver unit tests. Eight test cases
// per design v2 §7. Run with:
//
//   npx tsx scripts/testConstruction.ts
//
// PASS / FAIL output format mirrors testAlgorithm.ts. process.exit(1)
// on any failure; exits with the count printed on success.

import nodeAssert from 'node:assert/strict';
import {
  buildAvailabilityMatrix,
  computeBucketFloors,
} from '../src/lib/finalRotaPhase0';
import {
  runSingleIteration,
  applyWeekendResult,
  type IterationAccumulator,
} from '../src/lib/finalRotaConstruction';
import type {
  AvailabilityMatrix,
  BucketFloors,
  DoctorState,
  IterationResult,
} from '../src/lib/finalRotaTypes';
import type { FinalRotaInput } from '../src/lib/rotaGenInput';
import type {
  WeekendPlacementResult,
} from '../src/lib/finalRotaNightBlocks';
import {
  minimalInputWeekendNights,
  minimalInputWeekendNightsAllLtft,
  minimalInputWeekdayNights,
  minimalInputWeekdayMaxConsec3,
  minimalInputFullNights,
} from './fixtures/minimalInput';

let passCount = 0;
let failCount = 0;

function pass(msg: string): void {
  passCount += 1;
  console.log(`PASS: ${msg}`);
}

function fail(msg: string, detail?: string): void {
  failCount += 1;
  console.error(`FAIL: ${msg}${detail ? ` — ${detail}` : ''}`);
}

function assertTrue(cond: boolean, msg: string, detail?: string): void {
  if (cond) pass(msg);
  else fail(msg, detail);
}

function runFixture(input: FinalRotaInput): {
  matrix: AvailabilityMatrix;
  floors: BucketFloors;
  shuffle: readonly string[];
  result: IterationResult;
} {
  const matrix = buildAvailabilityMatrix(input);
  const floors = computeBucketFloors(input);
  const shuffle = input.doctors.map((d) => d.doctorId).sort();
  const result = runSingleIteration(input, matrix, floors, shuffle);
  return { matrix, floors, shuffle, result };
}

// ─── Test 1 — minimalInputWeekendNights ──────────────────────
// Fixture has weekend night demand only (Fri/Sat/Sun/Mon/Tue rows in
// the shift slots). Verify the driver places weekend assignments and
// records pathsTaken entries.
{
  console.log('\n=== Test 1 — minimalInputWeekendNights ===');
  const { result } = runFixture(minimalInputWeekendNights);

  let totalAssignments = 0;
  for (const ds of result.doctorStates) totalAssignments += ds.assignments.length;

  assertTrue(
    totalAssignments > 0,
    'Test 1: weekend-night fixture produces > 0 assignments',
    `got ${totalAssignments}`,
  );
  assertTrue(
    Object.keys(result.pathsTaken).length > 0,
    'Test 1: pathsTaken contains ≥ 1 entry',
    `got ${Object.keys(result.pathsTaken).length}`,
  );
  // Sanity: every recorded path string is a known WeekendPathTaken or
  // WeekdayPathTaken value.
  const knownPaths = new Set([
    'UNIFIED_3N',
    'UNIFIED_2N_SATSUN_BACKWARD',
    'UNIFIED_2N_FRISAT_FORWARD',
    'RELAXATION_2N_SATSUN',
    'RELAXATION_2N_FRISAT',
    'UNIFIED_4N_MON_THU',
    'UNIFIED_TIER15_PAIR',
    'UNIFIED_3N_MON_WED',
    'UNIFIED_3N_MON_WED_THU_ORPHAN',
    'UNIFIED_3N_WED_FRI',
    'UNIFIED_3N_WED_FRI_WITH_BACKWARD',
    'UNIFIED_2N_SINGLE',
    'UNIFIED_TIER4',
    'RELAXATION_PARTIAL',
    'SKIP_NO_RESIDUAL',
    'UNFILLED',
  ]);
  let allKnown = true;
  for (const v of Object.values(result.pathsTaken)) {
    if (!knownPaths.has(v)) {
      allKnown = false;
      break;
    }
  }
  assertTrue(allKnown, 'Test 1: every pathsTaken value is a typed enum value');
}

// ─── Test 2 — minimalInputWeekdayNights ──────────────────────
// Fixture has Mon-Thu night demand. Verify weekday paths used and
// oncallDatesLast7 populated for any doctor with assignments.
{
  console.log('\n=== Test 2 — minimalInputWeekdayNights ===');
  const { result } = runFixture(minimalInputWeekdayNights);

  let weekdayPathSeen = false;
  for (const v of Object.values(result.pathsTaken)) {
    if (v.startsWith('UNIFIED_4N_') || v.startsWith('UNIFIED_3N_') || v.startsWith('UNIFIED_TIER15_PAIR') || v === 'UNIFIED_2N_SINGLE') {
      weekdayPathSeen = true;
      break;
    }
  }
  assertTrue(
    weekdayPathSeen,
    'Test 2: at least one weekday path (UNIFIED_4N_/3N_/TIER15_PAIR/2N_SINGLE) emitted',
    `paths=${JSON.stringify(result.pathsTaken)}`,
  );

  // For any doctor with on-call assignments, oncallDatesLast7 must be non-empty.
  let oncallAssigneeFound = false;
  let oncallTrackingOk = true;
  for (const ds of result.doctorStates) {
    const hasOncallAssignment = ds.assignments.some((a) => a.isOncall);
    if (!hasOncallAssignment) continue;
    oncallAssigneeFound = true;
    if (ds.oncallDatesLast7.length === 0) {
      oncallTrackingOk = false;
      break;
    }
  }
  assertTrue(
    oncallAssigneeFound,
    'Test 2: at least one doctor has on-call assignments',
  );
  assertTrue(
    oncallTrackingOk,
    'Test 2: every doctor with on-call assignments has non-empty oncallDatesLast7',
  );
}

// ─── Test 3 — minimalInputWeekdayMaxConsec3 ──────────────────
// Fixture caps maxConsecutive.nights at 3. The 4N_MON_THU pattern is
// forbidden by E43; the engine must fall back to TIER15_PAIR or
// 3N_MON_WED. Verify no 4N path appears.
{
  console.log('\n=== Test 3 — minimalInputWeekdayMaxConsec3 ===');
  const { result } = runFixture(minimalInputWeekdayMaxConsec3);

  const has4N = Object.values(result.pathsTaken).some(
    (v) => v === 'UNIFIED_4N_MON_THU',
  );
  assertTrue(
    !has4N,
    'Test 3: no UNIFIED_4N_MON_THU emitted under maxConsec=3',
    `paths=${JSON.stringify(result.pathsTaken)}`,
  );

  // Every doctor's nightBlockHistory entries should be ≤ 3 nights long.
  let allBlocksUnderCap = true;
  for (const ds of result.doctorStates) {
    for (const block of ds.nightBlockHistory) {
      if (block.length > 3) {
        allBlocksUnderCap = false;
        break;
      }
    }
    if (!allBlocksUnderCap) break;
  }
  assertTrue(
    allBlocksUnderCap,
    'Test 3: every committed night block has ≤ 3 nights (maxConsec=3 cap respected)',
  );
}

// ─── Test 4 — Phase 1 commits before Phase 2 reads ──────────
// Sentinel: collect every (doctorId, date) committed by the run.
// No (doctorId, date) pair should appear twice — duplicates would
// indicate Phase 2 attempted to re-fill a date Phase 1 already
// committed for that doctor (a clear sequencing regression).
{
  console.log('\n=== Test 4 — Phase 1 ⇒ Phase 2 sequencing ===');
  const { result } = runFixture(minimalInputFullNights);

  const seen = new Set<string>();
  let duplicate: string | null = null;
  for (const ds of result.doctorStates) {
    for (const a of ds.assignments) {
      const date = new Date(a.shiftStartMs).toISOString().slice(0, 10);
      const key = `${ds.doctorId}|${date}|${a.shiftKey}`;
      if (seen.has(key)) {
        duplicate = key;
        break;
      }
      seen.add(key);
    }
    if (duplicate) break;
  }
  assertTrue(
    duplicate === null,
    'Test 4: no (doctor, date, shiftKey) appears twice across all assignments',
    duplicate ? `dup=${duplicate}` : undefined,
  );

  // And: the public `assignments` byDate map should mirror per-doctor lists
  // by total count.
  let publicTotal = 0;
  for (const list of Object.values(result.assignments)) publicTotal += list.length;
  let stateTotal = 0;
  for (const ds of result.doctorStates) stateTotal += ds.assignments.length;
  assertTrue(
    publicTotal === stateTotal,
    'Test 4: public assignments-by-date count matches sum of per-doctor lists',
    `public=${publicTotal} state=${stateTotal}`,
  );
}

// ─── Test 5 — minimalInputWeekendNightsAllLtft ──────────────
// Every doctor has at least one LTFT day-off — the fixture is
// designed to force the relaxation / penalty path.
{
  console.log('\n=== Test 5 — minimalInputWeekendNightsAllLtft ===');
  const { result } = runFixture(minimalInputWeekendNightsAllLtft);

  const stressed =
    result.totalPenaltyScore > 0 || result.unfilledSlots.length > 0;
  assertTrue(
    stressed,
    'Test 5: all-LTFT fixture exercises relaxation/penalty path (penalty>0 OR unfilled>0)',
    `penalty=${result.totalPenaltyScore} unfilled=${result.unfilledSlots.length}`,
  );
}

// ─── Test 6 — Determinism (deepStrictEqual, Nit C4) ─────────
{
  console.log('\n=== Test 6 — Determinism ===');
  const inputA = minimalInputFullNights;
  const matrixA = buildAvailabilityMatrix(inputA);
  const floorsA = computeBucketFloors(inputA);
  const shuffleA = inputA.doctors.map((d) => d.doctorId).sort();

  const resultA = runSingleIteration(inputA, matrixA, floorsA, shuffleA);
  const resultB = runSingleIteration(inputA, matrixA, floorsA, shuffleA);

  let deepEqualOk = true;
  let deepEqualDetail = '';
  try {
    nodeAssert.deepStrictEqual(resultA, resultB);
  } catch (err) {
    deepEqualOk = false;
    deepEqualDetail = (err as Error).message.split('\n')[0] ?? '';
  }
  assertTrue(
    deepEqualOk,
    'Test 6: identical shuffleOrder ⇒ assert.deepStrictEqual(resultA, resultB)',
    deepEqualDetail,
  );
}

// ─── Test 7 — State isolation (structuredClone, Nit C5) ─────
{
  console.log('\n=== Test 7 — State isolation ===');
  const input = minimalInputFullNights;
  const clonedBefore = structuredClone(input);
  const matrix = buildAvailabilityMatrix(input);
  const floors = computeBucketFloors(input);
  const shuffle = input.doctors.map((d) => d.doctorId).sort();
  runSingleIteration(input, matrix, floors, shuffle);

  let isolated = true;
  let isolationDetail = '';
  try {
    nodeAssert.deepStrictEqual(clonedBefore, input);
  } catch (err) {
    isolated = false;
    isolationDetail = (err as Error).message.split('\n')[0] ?? '';
  }
  assertTrue(
    isolated,
    'Test 7: input unchanged after runSingleIteration (structuredClone deep-equality)',
    isolationDetail,
  );
}

// ─── Test 8 — Rest advancement is monotonic ─────────────────
// Direct unit test of applyWeekendResult: feed two synthetic
// WeekendPlacementResult objects whose restStampsByDoctor stamps
// for the same doctor decrease across calls; the driver's max()
// rule must keep the larger first stamp on doctorState.restUntilMs.
{
  console.log('\n=== Test 8 — Rest advancement non-regressive ===');
  const stateMap = new Map<string, DoctorState>();
  const ds: DoctorState = {
    doctorId: 'doc-1',
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
  stateMap.set('doc-1', ds);

  const accumulator: IterationAccumulator = {
    unfilledSlots: [],
    pathsTaken: {},
    totalPenaltyScore: 0,
    orphansConsumedCount: 0,
    orphansRelaxedCount: 0,
  };

  // First sub-pass commits a high rest stamp.
  const HIGH_STAMP = 1_800_000_000_000; // ~ 2027-01-15 in ms
  const LOW_STAMP = 1_750_000_000_000;  // ~ 2025-06-15 in ms
  const resultHigh: WeekendPlacementResult = {
    assignments: [],
    lieuStaged: [],
    restStampsByDoctor: { 'doc-1': HIGH_STAMP },
    unfilledSlots: [],
    penaltyApplied: 0,
    pathTaken: 'UNFILLED',
    orphanConsumed: null,
  };
  applyWeekendResult(stateMap, resultHigh, accumulator, '2026-05-09#night');
  assertTrue(
    ds.restUntilMs === HIGH_STAMP,
    'Test 8: first sub-pass advances restUntilMs to HIGH_STAMP',
    `got ${ds.restUntilMs}`,
  );

  // Second sub-pass tries to commit a smaller rest stamp.
  // Driver must take max() and keep HIGH_STAMP.
  const resultLow: WeekendPlacementResult = {
    assignments: [],
    lieuStaged: [],
    restStampsByDoctor: { 'doc-1': LOW_STAMP },
    unfilledSlots: [],
    penaltyApplied: 0,
    pathTaken: 'UNFILLED',
    orphanConsumed: null,
  };
  applyWeekendResult(stateMap, resultLow, accumulator, '2026-05-16#night');
  assertTrue(
    ds.restUntilMs === HIGH_STAMP,
    'Test 8: second sub-pass with smaller stamp does NOT regress restUntilMs (max() rule)',
    `got ${ds.restUntilMs} expected ${HIGH_STAMP}`,
  );
}

// ─── Summary ────────────────────────────────────────────────
// Use distinct wording so `grep -c "^PASS:"` from a parent harness
// counts only test-line PASSes, not the summary line.
console.log(`\n=== testConstruction.ts summary ===`);
console.log(`Tests passed: ${passCount}`);
console.log(`Tests failed: ${failCount}`);
if (failCount > 0) process.exit(1);
console.log('\nAll Stage 3g.3a construction-driver tests passed.');
process.exit(0);
