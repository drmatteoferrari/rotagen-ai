// src/lib/finalRotaTypes.ts
// Internal working types for the final rota algorithm (spec v2.9 §4.1).
// These never cross the Web Worker boundary and are not persisted.
// Public output types live in src/types/finalRota.ts.
//
// Per spec Note 35: algorithm internal modules import from this file only.
// They must not import from @/types/finalRota.ts — working state must never
// be shaped by what the UI currently happens to render.
//
// No imports from React, Supabase, or any browser API. Node-runnable.

import type {
  WeekendPathTaken,
  WeekdayPathTaken,
  LieuStagedEntry,
} from './finalRotaNightBlocks';

// ─── AvailabilityStatus ────────────────────────────────────────

export type AvailabilityStatus =
  | 'available'
  | 'annual_leave'
  | 'sick'
  | 'bank_holiday'
  | 'ltft_off'
  | 'rotation'
  | 'parental'
  | 'study'
  | 'blocked'
  | 'noc';

// ─── AvailabilityMatrix ────────────────────────────────────────

// Outer key = doctorId, inner key = ISO date 'YYYY-MM-DD'.
export type AvailabilityMatrix = Record<string, Record<string, AvailabilityStatus>>;

// ─── InternalDayAssignment ─────────────────────────────────────
// Richer than the public DayAssignment: carries fields needed for WTR
// arithmetic (Unix ms timestamps), block tracking (blockId), and audit
// (violations). Projected to DayAssignment at the boundary in Stage 3i.

export interface InternalDayAssignment {
  doctorId: string;
  shiftKey: string;
  shiftId: string;
  slotIndex: number;
  slotLabel: string | null;
  durationHours: number;
  startTime: string;              // "HH:MM"
  endTime: string;                // "HH:MM"
  shiftStartMs: number;           // Unix ms, UTC
  shiftEndMs: number;              // Unix ms, UTC
  isNightShift: boolean;
  isOncall: boolean;
  isLong: boolean;
  blockId: string | null;         // same id for all nights in a block; null for day shifts
  badges: string[];
  violations: string[];           // audit-only rule IDs; never a hard failure
}

// ─── RestBlock ─────────────────────────────────────────────────

export interface RestBlock {
  startIso: string;
  endUntilMs: number;             // Unix ms; doctor cannot be assigned before this point
}

// ─── DoctorState ───────────────────────────────────────────────
// Mutable per-doctor construction state. Cloned per Monte Carlo iteration.

export interface DoctorState {
  doctorId: string;
  assignments: InternalDayAssignment[];
  restUntilMs: number;
  weeklyHoursUsed: Record<string, number>;      // ISO week key 'YYYY-WNN' → hours
  consecutiveShiftDates: string[];
  consecutiveNightDates: string[];
  consecutiveLongDates: string[];
  weekendDatesWorked: string[];
  nightBlockHistory: string[][];                // each inner array = one completed block
  oncallDatesLast7: string[];
  bucketHoursUsed: { oncall: number; nonOncall: number };
  lieuDatesStaged: string[];                    // G55–G57 obligations pending commit

  // ─── Cascade placeholders (spec §7 D35) ──────────────────────
  // Populated by finalRotaCascade.ts (Stage 3g.4). Read as empty /
  // zero until that stage lands. Stage 3g.3 construction code may
  // write actualHoursByShiftType as a convenience for downstream
  // cascade consumption, but the cascade is the authoritative
  // writer. Keys are shiftKey (matching DoctorShiftTarget.shiftKey).

  // Hours actually assigned per shift type this iteration. Used by
  // D35 Rule 1 to compute `debt(T) = effectiveCeiling(T) − actualHours(T)`.
  actualHoursByShiftType: Record<string, number>;
  // Carry-forward debt per shift type, accrued from prior cascade
  // checkpoints in priority order (spec §7 D35 Rule 1). Added to
  // raw `maxTargetHours(T)` at ceiling-check time to produce the
  // cascade-adjusted effectiveCeiling.
  debtCarriedForwardByShiftType: Record<string, number>;
  // Per-doctor non-on-call deficit remaining after the final
  // non-on-call cascade checkpoint (D35 Rule 4). Surfaces in
  // PerDoctorMetrics as `unallocatedContractualHours`. Zero when
  // all contractual hours are placed.
  unallocatedContractualHours: number;
}

// ─── BucketFloors ──────────────────────────────────────────────
// Key = doctorId. Values = minimum hours required per bucket after leave
// deduction. Consumed by the Phase 0 V1 guard (§5.0).

export type BucketFloors = Record<string, { oncall: number; nonOncall: number }>;

// ─── UnfilledSlot ──────────────────────────────────────────────

export interface UnfilledSlot {
  date: string;                   // ISO date 'YYYY-MM-DD'
  shiftKey: string;
  slotIndex: number;
  isCritical: boolean;            // true if slot count < staffing.min
}

// ─── IterationResult ───────────────────────────────────────────
// Stage 3g.3a additions (per design v2 §4 + Delta 2):
//   - pathsTaken              : weekendIso|weekStartIso → typed path enum
//   - totalPenaltyScore       : sum of unified penaltyApplied numbers across sub-passes
//   - orphansConsumedCount    : count where orphanConsumed === true
//   - orphansRelaxedCount     : count where orphanConsumed === false (deliberate CRITICAL UNFILLED)
//   - restBlocks              : empty stub now; Stage 3g.4 cascade populates
//   - lieuStaged              : empty stub now; Stage 3g.5 lieu phase populates the
//                               post-Phase-9 LieuDay[] view in a separate field.
//                               Renamed from `lieuDays` per Delta 2 — this field
//                               carries staged obligations (LieuStagedEntry), not
//                               committed lieu days.
// `returnedLeave` (spec §4.1) intentionally omitted until a consumer exists.

export interface IterationResult {
  assignments: Record<string, InternalDayAssignment[]>;  // ISO date → assignments
  doctorStates: DoctorState[];
  unfilledSlots: UnfilledSlot[];

  // ─── Stage 3g.3a additions ─────────────────────────────────
  pathsTaken: Record<string, WeekendPathTaken | WeekdayPathTaken>;
  totalPenaltyScore: number;
  orphansConsumedCount: number;
  orphansRelaxedCount: number;

  // ─── Spec §4.1 stubs (populated by later stages) ──────────
  restBlocks: RestBlock[];          // Stage 3g.4 cascade
  lieuStaged: LieuStagedEntry[];    // Stage 3g.5 lieu phase (Delta 2 rename: was lieuDays)
}

// ─── CheckResult ───────────────────────────────────────────────

export interface CheckResult {
  pass: boolean;
  failedRule?: string;
  reason?: string;
}

// ─── ShiftCandidate ────────────────────────────────────────────

export interface ShiftCandidate {
  doctorId: string;
  fairnessScore: number;          // lower = more under-target = higher priority
}
