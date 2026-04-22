// src/lib/finalRotaGenerator.ts
// STUB — simulates rota generation for harness validation.
// Replace entirely with the real algorithm in Prompt 3.
// The exported function signature is the permanent contract — do NOT modify it.

import type { FinalRotaInput } from '@/lib/rotaGenInput';
import type {
  FinalRotaResult,
  GenerationProgress,
  RotaScore,
} from '@/types/finalRota';

// Constants — defined here for the stub; real algorithm imports from finalRotaRunner.ts
const PROGRESS_UPDATE_EVERY = 50;
const CANCEL_CHECK_EVERY = 10;

export async function generateFinalRota(
  input: FinalRotaInput,
  options: {
    iterations: number;
    onProgress?: (progress: GenerationProgress) => void;
    shouldCancel?: () => boolean;
  }
): Promise<FinalRotaResult> {
  const startTime = Date.now();
  const { iterations, onProgress, shouldCancel } = options;

  let bestScore: RotaScore = {
    tier1CriticalUnfilled: 12,
    tier2WarningUnfilled: 8,
    tier3FairnessDeviation: 95.4,
  };

  for (let i = 1; i <= iterations; i++) {
    // Simulate computational work — 10ms per iteration
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    // Simulate score improving over iterations
    bestScore = {
      tier1CriticalUnfilled: Math.max(0, 12 - Math.floor(i / (iterations / 12))),
      tier2WarningUnfilled: Math.max(0, 8 - Math.floor(i / (iterations / 8))),
      tier3FairnessDeviation: Math.max(0, 95.4 - (i / iterations) * 80),
    };

    // Cancel check
    if (i % CANCEL_CHECK_EVERY === 0 && shouldCancel?.()) {
      return buildResult(input, 'cancelled', i, iterations, bestScore, startTime);
    }

    // Progress update
    if (i % PROGRESS_UPDATE_EVERY === 0 || i === iterations) {
      onProgress?.({
        iterationsCompleted: i,
        iterationsTarget: iterations,
        elapsedMs: Date.now() - startTime,
        bestScore,
        currentPhase:
          i < iterations * 0.7
            ? `Monte Carlo iteration ${i}`
            : 'Phase 11 local swap',
      });
    }
  }

  return buildResult(input, 'complete', iterations, iterations, bestScore, startTime);
}

function buildResult(
  input: FinalRotaInput,
  status: FinalRotaResult['status'],
  iterationsCompleted: number,
  iterationsTarget: number,
  score: RotaScore,
  startTime: number,
): FinalRotaResult {
  return {
    configId: input.preRotaInput.configId,
    generatedAt: new Date().toISOString(),
    status,
    iterationsCompleted,
    iterationsTarget,
    runtimeMs: Date.now() - startTime,
    assignments: {},
    score,
    perDoctor: input.doctors.map((d: any) => {
      const target = d.totalMaxHours ?? 0;
      const assigned = Math.round(target * (0.8 + Math.random() * 0.15));
      return {
        doctorId: d.doctorId,
        name: d.name,
        wtePct: d.wtePct,
        totalHoursAssigned: assigned,
        targetTotalHours: target,
        deviationPct: target > 0 ? Math.round(((assigned - target) / target) * 100) : 0,
        weekendDays: Math.floor(Math.random() * 6) + 2,
        nightBlocks: Math.floor(Math.random() * 3) + 1,
        unallocatedHours: Math.max(0, target - assigned),
      };
    }),
    swapLog: [],
    violations: [],
  };
}
// SECTION 1 COMPLETE
