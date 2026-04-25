// src/lib/finalRotaTrace.ts
// Diagnostic tracing for the construction driver. Pure, env-gated,
// zero runtime cost when ROTAGEN_TRACE !== '1'. No imports from
// React, Supabase, browser globals, or @/types/finalRota.
//
// Call-site contract:
//   if (TRACE_ENABLED) emit({ type: '...', ... });
//
// The buffered events list is module-private. Callers invoke flush()
// once, after all emit() calls in the run, to write the buffered
// events as JSON Lines to the configured path.
//
// Removal: delete this file + delete the import + grep '// TRACE'
// in finalRotaConstruction.ts to remove every guarded call site.
//
// This file is the SOLE owner of the TraceEvent discriminated union;
// algorithm types in finalRotaTypes.ts stay diagnostic-free so the
// diagnostic infrastructure can be removed in one PR.

import * as fs from 'node:fs';

// ─── Env-gated configuration (evaluated once on module load) ──

export const TRACE_ENABLED: boolean = process.env.ROTAGEN_TRACE === '1';
const TRACE_OUTPUT_PATH: string =
  process.env.ROTAGEN_TRACE_OUTPUT ?? '/tmp/rotagen_trace.jsonl';

// ─── Light per-event projections ──────────────────────────────
// Captured by spread copy at emission so subsequent commits cannot
// mutate captured event arrays/records.

export interface AssignmentSummary {
  doctorId: string;
  date: string;                // ISO 'YYYY-MM-DD' calendar date
  shiftKey: string;
  isNightShift: boolean;
  isOncall: boolean;
  isLong: boolean;
  blockId: string | null;
  shiftStartMs: number;
  durationHours: number;
}

export interface UnfilledSlotSummary {
  date: string;
  shiftKey: string;
  slotIndex: number;
  isCritical: boolean;
}

export interface PerDoctorStateSnapshot {
  doctorId: string;
  restUntilMs: number;
  consecutiveShiftDates: string[];
  consecutiveNightDates: string[];
  consecutiveLongDates: string[];
  weekendDatesWorked: string[];
  oncallDatesLast7: string[];
  weeklyHoursUsed: Record<string, number>;
  bucketHoursUsed: { oncall: number; nonOncall: number };
  actualHoursByShiftType: Record<string, number>;
  // Rich per-assignment data so post-run diagnostics can recompute
  // calendar truth for the consecutive*Dates fields without re-running
  // the commit loop. blockId enables Q3 night-block boundary
  // reconstruction; shiftStartMs disambiguates ordering.
  assignments: AssignmentSummary[];
}

// ─── TraceEvent discriminated union ───────────────────────────

export type PhaseId = 1 | 2 | 5 | 6;

export type TraceEvent =
  | {
      type: 'phase_enter';
      phase: PhaseId;
      kind: 'weekend' | 'weekday';
      anchorDate: string;
      nightShiftKey: string;
    }
  | {
      type: 'state_snapshot';
      phase: PhaseId;
      kind: 'weekend' | 'weekday';
      anchorDate: string;
      nightShiftKey: string;
      perDoctor: PerDoctorStateSnapshot[];
    }
  | {
      type: 'subpass_result';
      phase: PhaseId;
      kind: 'weekend' | 'weekday';
      anchorDate: string;
      nightShiftKey: string;
      pathTaken: string;
      penaltyApplied: number;
      orphanConsumed: boolean | null;
      assignments: AssignmentSummary[];
      unfilledSlots: UnfilledSlotSummary[];
      // Weekday-only diagnostics:
      residualBefore?: string[];
      residualAfter?: string[];
      pairPartnerDoctorId?: string | null;
    };

// Note: unfilled_postmortem and stale_read_check events are NOT
// emitted by the runtime call-sites — they are produced by
// scripts/postRunDiagnostics.ts and written to a separate JSONL
// file. Keeping the runtime taxonomy minimal keeps emission cheap
// and the call-site footprint small.

// ─── Module-private buffer ────────────────────────────────────

const events: TraceEvent[] = [];

export function emit(event: TraceEvent): void {
  if (!TRACE_ENABLED) return;
  events.push(event);
}

// Writes the buffered events as JSON Lines to TRACE_OUTPUT_PATH,
// truncating any prior content. Clears the buffer. Wrapped in
// try/catch by the caller (runSingleIteration) so disk failures
// do not crash the algorithm.
export function flush(): void {
  if (!TRACE_ENABLED) return;
  if (events.length === 0) {
    // Still truncate so a leftover file from a previous run is
    // not mistaken for the current run's output.
    fs.writeFileSync(TRACE_OUTPUT_PATH, '');
    return;
  }
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(TRACE_OUTPUT_PATH, lines);
  events.length = 0;
}

// ─── Test-only helpers (not used at runtime) ──────────────────

export function _peekBufferLength(): number {
  return events.length;
}

export function _resetBuffer(): void {
  events.length = 0;
}
