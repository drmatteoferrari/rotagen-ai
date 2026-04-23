// src/lib/finalRotaNightBlocks.ts
// Placeholder — populated in Stage 3g.2 (Dynamic Tiling Engine).
//
// Owns spec v2.9 §9: block dictionary with penalty tiers (§9.1),
// combinatorial tiling with orphan filtering + penalty scoring (§9.2),
// and the authoritative LTFT night-block decision table (§9.3). Spec
// §13 file structure (line 1681) lists this file as
// `finalRotaNightBlocks.ts`.
//
// Consumers: `finalRotaConstruction.ts` (Phases 1/2/5/6 call the
// tiling engine to produce candidate blocks; doctor selection and
// Check Sequence B invocation happen there).
//
// Boundary rules (carried forward from Stages 3b–3f):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No React / Supabase / browser or Node runtime globals.
//   - UTC-only date arithmetic; never setDate / getDate.

export const STAGE_3G_PLACEHOLDER = true;
