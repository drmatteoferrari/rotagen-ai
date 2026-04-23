// src/lib/finalRotaCascade.ts
// Placeholder — populated in Stage 3g.4 (Cascade engine).
//
// Owns spec v2.9 §7 D35 — the per-shift-type cascade debt engine:
//   - Rule 1: carry-forward after each shift-type allocation completes.
//   - Rule 2: backfill attempts in reverse priority order (including
//             night backfill via the tiling engine).
//   - Rule 3: one-way on-call → non-on-call cross-bucket transfer
//             after the final on-call checkpoint.
//   - Rule 4: residual non-on-call deficit → `unallocatedContractualHours`.
//
// Runs at each cascade checkpoint enumerated in §8 Phase Sequence
// (lines 1201–1241). Reads/writes the three `DoctorState` cascade
// fields (`actualHoursByShiftType`, `debtCarriedForwardByShiftType`,
// `unallocatedContractualHours`) defined in `finalRotaTypes.ts`.
// Spec §13 file structure (line 1683) lists this file as
// `finalRotaCascade.ts`.
//
// Consumers: `finalRotaConstruction.ts` (invokes the cascade at
// each checkpoint), `finalRotaNightBlocks.ts` (night backfill
// invokes the tiling engine via a callback).
//
// Boundary rules (carried forward from Stages 3b–3f):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No React / Supabase / browser or Node runtime globals.
//   - UTC-only date arithmetic; never setDate / getDate.

export const STAGE_3G_PLACEHOLDER = true;
