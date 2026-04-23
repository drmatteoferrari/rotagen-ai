// src/lib/finalRotaLieu.ts
// Placeholder — populated in Stage 3g.5 (Lieu Phase 9).
//
// Owns spec v2.9 §8 Phase 9 and the G55–G61 lieu ruleset, in
// particular G60's four-step escalation for resolving staged lieu
// obligations (`DoctorState.lieuDatesStaged`) into committed rest
// days, including:
//   - Step 1: attempt same-week placement.
//   - Step 2: attempt subsequent-week placement.
//   - Step 3: attempt prior-week placement.
//   - Step 4: escalate to unresolvable lieu — surfaces in metrics.
// Spec §13 file structure (line 1685) lists this file as
// `finalRotaLieu.ts`.
//
// Consumers: `finalRotaConstruction.ts` (Phase 9 invokes the lieu
// resolver after all shift allocation completes).
//
// Boundary rules (carried forward from Stages 3b–3f):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No React / Supabase / browser or Node runtime globals.
//   - UTC-only date arithmetic; never setDate / getDate.

export const STAGE_3G_PLACEHOLDER = true;
