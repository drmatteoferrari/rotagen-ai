// src/lib/finalRotaConstruction.ts
// Placeholder — populated in Stage 3g.3 (Construction driver).
//
// Owns spec v2.9 §8 Phase Sequence phases 1–8 (night blocks via
// `finalRotaNightBlocks.ts`; day shifts via Check Sequence A and
// §11 candidate scoring layers) plus Phase 10 iteration metrics.
// Cascade checkpoints (D35) are delegated to `finalRotaCascade.ts`
// (Stage 3g.4); lieu Phase 9 (G60) to `finalRotaLieu.ts`
// (Stage 3g.5). Spec §13 file structure (line 1682) lists this
// file as `finalRotaConstruction.ts`.
//
// Exported entry point (Stage 3g.3): `runSingleIteration(input,
// matrix, floors, shuffleOrder): IterationResult`.
//
// Boundary rules (carried forward from Stages 3b–3f):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No React / Supabase / browser or Node runtime globals.
//   - UTC-only date arithmetic; never setDate / getDate.

export const STAGE_3G_PLACEHOLDER = true;
