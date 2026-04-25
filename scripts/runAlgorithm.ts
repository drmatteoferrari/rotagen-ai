// scripts/runAlgorithm.ts
// Stage 3g.3a — Construction-driver CLI for manual inspection.
// Per design v2 §5: thin harness that runs a single iteration and
// prints a report. Not a test file — no assertions. Default fixture
// is `minimalInputFullNights`; override with the first CLI arg.
//
//   npx tsx scripts/runAlgorithm.ts [fixture-name]
//
// Exit codes:
//   0 on success (even with unfilled slots — those are normal output).
//   1 on V1 guard failure or any thrown exception.

import {
  buildAvailabilityMatrix,
  computeBucketFloors,
  validateBucketFloors,
} from '../src/lib/finalRotaPhase0';
import { runSingleIteration } from '../src/lib/finalRotaConstruction';
import type { FinalRotaInput } from '../src/lib/rotaGenInput';

import {
  minimalInput,
  minimalInputWithOverdeductedLeave,
  minimalInputWithOncallSlot,
  minimalInputWithNroc,
  minimalInputWeekendNights,
  minimalInputWeekendNightsAllLtft,
  minimalInputWeekdayNights,
  minimalInputWeekdayMaxConsec3,
  minimalInputFullNights,
} from './fixtures/minimalInput';

const FIXTURES: Record<string, FinalRotaInput> = {
  minimalInput,
  minimalInputWithOverdeductedLeave,
  minimalInputWithOncallSlot,
  minimalInputWithNroc,
  minimalInputWeekendNights,
  minimalInputWeekendNightsAllLtft,
  minimalInputWeekdayNights,
  minimalInputWeekdayMaxConsec3,
  minimalInputFullNights,
};

function main(): void {
  const fixtureName = process.argv[2] ?? 'minimalInputFullNights';
  const input = FIXTURES[fixtureName];
  if (!input) {
    console.error(`Unknown fixture: ${fixtureName}`);
    console.error(`Available: ${Object.keys(FIXTURES).join(', ')}`);
    process.exit(1);
  }

  console.log('=== runAlgorithm.ts — Stage 3g.3a single-iteration CLI ===');
  console.log(`Fixture:        ${fixtureName}`);
  console.log(`Doctors:        ${input.doctors.length}`);
  console.log(
    `Period:         ${input.preRotaInput.period.startDate} → ${input.preRotaInput.period.endDate}`,
  );
  console.log(`Shift slots:    ${input.preRotaInput.shiftSlots.length}`);
  console.log();

  // ── Phase 0 ────────────────────────────────────────────────
  const matrix = buildAvailabilityMatrix(input);
  const floors = computeBucketFloors(input);
  try {
    validateBucketFloors(floors, matrix, input);
  } catch (err) {
    console.error('V1 bucket-floor guard failed:');
    console.error((err as Error).message);
    process.exit(1);
  }

  // ── Driver run ─────────────────────────────────────────────
  // Deterministic for inspection. Stage 3i seeds differently per
  // Monte Carlo trial.
  const shuffleOrder = input.doctors.map((d) => d.doctorId).sort();
  const startMs = Date.now();
  const result = runSingleIteration(input, matrix, floors, shuffleOrder);
  const elapsedMs = Date.now() - startMs;

  // ── Report ─────────────────────────────────────────────────
  let totalAssignments = 0;
  for (const ds of result.doctorStates) totalAssignments += ds.assignments.length;

  let critical = 0;
  let warning = 0;
  for (const u of result.unfilledSlots) {
    if (u.isCritical) critical += 1;
    else warning += 1;
  }

  console.log('=== Result ===');
  console.log(`Elapsed:                  ${elapsedMs}ms`);
  console.log(`Total assignments:        ${totalAssignments}`);
  console.log(`Unfilled slots:           ${result.unfilledSlots.length} (critical=${critical}, warning=${warning})`);
  console.log(`Total penalty score:      ${result.totalPenaltyScore}`);
  console.log(`Orphans consumed:         ${result.orphansConsumedCount}`);
  console.log(`Orphans relaxed:          ${result.orphansRelaxedCount}`);
  console.log(`Rest blocks (stub):       ${result.restBlocks.length}`);
  console.log(`Lieu staged (stub):       ${result.lieuStaged.length}`);
  console.log();

  console.log('=== Paths taken (anchor#nightShiftKey → path) ===');
  const pathKeys = Object.keys(result.pathsTaken).sort();
  if (pathKeys.length === 0) {
    console.log('  (none)');
  } else {
    for (const key of pathKeys) {
      console.log(`  ${key.padEnd(28)} ${result.pathsTaken[key]}`);
    }
  }
  console.log();

  console.log('=== Per-doctor bucket hours (used vs floor) ===');
  for (const ds of result.doctorStates) {
    const floor = floors[ds.doctorId] ?? { oncall: 0, nonOncall: 0 };
    const oc = ds.bucketHoursUsed.oncall.toFixed(1);
    const noc = ds.bucketHoursUsed.nonOncall.toFixed(1);
    const ocFloor = floor.oncall.toFixed(1);
    const nocFloor = floor.nonOncall.toFixed(1);
    const nights = ds.assignments.filter((a) => a.isNightShift).length;
    console.log(
      `  ${ds.doctorId.padEnd(12)}` +
        `  oncall ${oc.padStart(6)} / ${ocFloor.padStart(6)}h` +
        `  noOC ${noc.padStart(6)} / ${nocFloor.padStart(6)}h` +
        `  nights=${nights}` +
        `  weekendDays=${ds.weekendDatesWorked.length}` +
        `  blocks=${ds.nightBlockHistory.length}`,
    );
  }

  process.exit(0);
}

main();
