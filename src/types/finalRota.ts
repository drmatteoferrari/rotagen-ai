// src/types/finalRota.ts
// Public types for the final rota generation feature.
// Internal algorithm types live in src/lib/finalRotaTypes.ts (created in a later prompt).

import type { FinalRotaInput } from '@/lib/rotaGenInput';

// ─── Output types ─────────────────────────────────────────────

export interface DayAssignment {
  doctorId: string;
  shiftKey: string;
  shiftStartIso: string;  // ISO 8601 datetime
  shiftEndIso: string;    // ISO 8601 datetime
  isOncall: boolean;
  badges: string[];       // e.g. ['night', 'long-day']
}

export interface RotaScore {
  tier1CriticalUnfilled: number;     // mandatory minimum staffing slots unfilled — primary sort key
  tier2WarningUnfilled: number;      // target staffing slots unfilled — secondary sort key
  tier3FairnessDeviation: number;    // sum of squared WTE-weighted % deviations — tertiary sort key
}

export interface SwapLogEntry {
  doctorFromId: string;
  doctorToId: string;
  date: string;           // ISO date YYYY-MM-DD
  shiftKey: string;
  reason: string;         // human-readable reason for the swap
}

export interface PerDoctorMetrics {
  doctorId: string;
  name: string;
  wtePct: number;
  totalHoursAssigned: number;
  targetTotalHours: number;
  deviationPct: number;          // ((actual - target) / target) * 100
  weekendDays: number;
  nightBlocks: number;
  unallocatedHours: number;      // targetTotalHours - totalHoursAssigned, floored at 0
}

export interface FinalRotaResult {
  configId: string;
  generatedAt: string;    // ISO 8601 datetime
  status: 'complete' | 'complete_with_gaps' | 'failed' | 'cancelled';
  iterationsCompleted: number;
  iterationsTarget: number;
  runtimeMs: number;
  // Record<ISO date string, DayAssignment[]> — one entry per calendar date in rota period
  assignments: Record<string, DayAssignment[]>;
  score: RotaScore;
  perDoctor: PerDoctorMetrics[];
  swapLog: SwapLogEntry[];
  violations: string[];   // WTR rule IDs that were logged (audit only — not hard blocks)
}

// ─── Progress reporting ────────────────────────────────────────

export interface GenerationProgress {
  iterationsCompleted: number;
  iterationsTarget: number;
  elapsedMs: number;
  bestScore: RotaScore | null;   // null until first complete iteration
  currentPhase: string;          // e.g. 'Monte Carlo iteration 47', 'Phase 11 local swap'
}

// ─── Worker message protocol ───────────────────────────────────

export type WorkerInboundMessage =
  | { type: 'start'; input: FinalRotaInput; iterations: number }
  | { type: 'cancel' };

export type WorkerOutboundMessage =
  | { type: 'progress'; progress: GenerationProgress }
  | { type: 'complete'; result: FinalRotaResult }
  | { type: 'error'; message: string };
// SECTION 1 COMPLETE
