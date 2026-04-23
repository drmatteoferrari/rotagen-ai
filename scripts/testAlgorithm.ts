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
  minimalInput,
  minimalInputWithOverdeductedLeave,
  minimalInputWithOncallSlot,
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

  console.log('\nAll assertions passed.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
