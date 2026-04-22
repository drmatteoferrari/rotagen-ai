// scripts/testAlgorithm.ts
// End-to-end smoke test for generateFinalRota. Run after every algorithm stage:
//   npx tsx scripts/testAlgorithm.ts

import { generateFinalRota } from '../src/lib/finalRotaGenerator';
import { minimalInput } from './fixtures/minimalInput';

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

  console.log('\nAll assertions passed.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
