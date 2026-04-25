# RotaGen Final Rota Algorithm — Complete Specification v3.0

> **Purpose:** Authoritative specification for the RotaGen final rota generation algorithm. Paste this entire document at the start of any chat about building, testing, debugging, or extending the algorithm. This is the version used in Claude Code for algorithm implementation.
>
> **Last updated:** April 2026
> **Supersedes:** v2.9. This version finalises the `FinalRotaInput` data contract. No algorithm rules change between v2.9 and v3.0. All rule changes from prior versions remain in force. The changes are: `resolvedAvailability[]` added as the canonical availability source; all leave date arrays removed from `FinalRotaInput`; Phase 0 source reference corrected; §14 Data Source Map updated; doctor roster drift check added to `validateFinalRotaInput`.
> **Status:** LOCKED — do not modify rules without Matteo's approval.

---

## Companion documents

- **`ROTAGEN_WORKER_RUNTIME_SPEC_v1_0.md`** — Web Worker architecture, main-thread runner, message protocol, UI state machine. §17 of this document summarises the relevant decisions; the companion document is authoritative.
- **`ROTAGEN_ALGORITHM_BUILD_GUIDE.md`** — Stage-by-stage implementation guide for Claude Code. Operational, not normative.

---

## AUDIT FINDINGS

The following bugs, gaps, and corrections were identified across audit passes:

**v2.1 audit (April 2026 — now resolved in v2.2):** Bugs 1–9 + Spec Issues 1–4. All fixes documented in the v2.1 → v2.2 change log.

**v2.5 audit (April 2026 — now resolved in v2.6):** Eight critical and high-severity issues: Phase 11 same-day collisions, availability source contradiction, G60 evicted-doctor fate, leave × ceiling interaction documentation, standard-day fallback, night bucket disambiguation, Phase 11 stale REST after swaps, Phase 11 loop-break ambiguity. Plus six clarifying additions (A0 rule, weekend lieu, long-evening badge, NROC 7-day = 168h, BH-on-AL accounting, immutability principle). All fixes documented in the v2.5 → v2.6 change log below.

**v2.8 audit (April 2026 — now resolved in v2.8):** Five issues resolved. See v2.7 → v2.8 change log below.

**v2.9 reconciliation (April 2026 — now reflected in v2.9):** Repository-spec alignment audit after Lovable Prompts 1 and 2 deployment. No rule changes. Structural corrections: public output contract simplified, DB schema rewritten to match deployed migration, Web Worker runtime documented, internal/public type boundary formalised, `cancelled` status path added. See v2.8 → v2.9 change log below.

Details of each v2.1-era bug and v2.5-era issue are preserved below for historical reference. All are resolved as of v2.6.

---

### BUG 1 — Competency flags read from wrong source in `buildFinalRotaInput` [CRITICAL — RESOLVED v2.8]
**File:** `src/lib/rotaGenInput.ts` — `buildFinalRotaInput`, `doctorTargets` computation
**Issue:** `hasIac/hasIaoc/hasIcu/hasTransfer` were computed from `resp?.competencies_json` (JSONB), but the canonical source post-normalisation is the flat boolean columns (`iac_achieved`, `iaoc_achieved`, `icu_achieved`, `transfer_achieved`) populated by `handle_survey_normalization`.
**Fix (v2.8):** `buildFinalRotaInput` now applies the `hasFlat` branch: reads flat DB columns first, falls back to `competencies_json` only when all flat columns are NULL. `DoctorSurveyResponse` interface updated to declare the four flat columns.

---

### BUG 2 — `contractedHoursPerWeek` hardcoded to 40h [CRITICAL — RESOLVED v2.8]
**Fix (v2.8):** `contractedHoursPerWeek` now read from `pre_rota_results.targets_data` (`DoctorTargets.contractedHoursPerWeek`), which is computed as `(wtePct/100) × maxAvgHoursPerWeek`.

---

### BUG 3 — `fairnessTargets.targetTotalHours` uses hardcoded 40h [CRITICAL — RESOLVED v2.8]
**Fix (v2.8):** `fairnessTargets.targetTotalHours` now set to `DoctorTargets.totalMaxHours` from `pre_rota_results.targets_data` — leave-adjusted and override-aware.

---

### BUG 4 — Rotation (ROT) dates not included in `FinalRotaInput.constraints.hard` [CRITICAL — RESOLVED v2.8]
**Fix (v2.8):** `rotationDates: string[]` added to `FinalRotaInput.doctors[].constraints.hard`. Expanded from `unavailability_blocks` reason='rotation', with JSONB fallback.

---

### BUG 5 — `resolved_availability` not read by `buildFinalRotaInput` [CRITICAL — RESOLVED v2.6/v2.8]
**Fix (v3.0 — H2, H5):** `buildFinalRotaInput()` pre-fetches all `resolved_availability` rows for the config and includes them in `FinalRotaInput.resolvedAvailability[]`. Phase 0 iterates this array to build the canWork matrix. The algorithm is a pure function inside a Web Worker with no DB access — "Phase 0 reads resolved_availability directly" was architecturally impossible and has been corrected. The leave date arrays previously in `constraints.hard` have been removed — `resolvedAvailability` status codes are the sole source of availability truth.

---

### BUG 6 — `training_requests` and `dual_specialties` completely absent from `FinalRotaInput` [MEDIUM]
**Status:** Informational fields added to spec §4. Not enforced in v1. Live code populates as empty arrays.

---

### BUG 7 — `al_entitlement` not passed to the algorithm [RESOLVED v2.8 — RELOCATED]
**Resolution (v2.8):** `alEntitlementDays` removed from `FinalRotaInput.constraints.hard`. AL entitlement is a data-quality validation concern, not an algorithm scheduling input. The algorithm does not allocate leave — it treats leave as hard blocks from `resolved_availability`. Entitlement checking now lives exclusively in `validateFinalRotaInput` as a pre-generation warning.

---

### BUG 8 — `expandDateRange` uses local `setDate` — DST unsafe [MEDIUM — RESOLVED v2.8]
**Fix (v2.8):** `expandDateRange` now uses `Date.UTC` construction and `setUTCDate`/`getUTCDate` throughout.

---

### BUG 9 — `isLtft` flag set by `wtePct < 100` alone [LOW — RESOLVED v2.8]
**Fix (v2.8):** `isLtft = ltftDaysOff.length > 0`. LTFT days now read from `ltft_patterns` table (canonical), with JSONB fallback.

---

### SPEC ISSUE 1 — Phase sequence missing non-on-call night shifts [RESOLVED v2.2]
### SPEC ISSUE 2 — `resolved_availability` status values not defined [RESOLVED v2.2]
### SPEC ISSUE 3 — `bhShiftRules` shape mismatch [RESOLVED v2.2]
### SPEC ISSUE 4 — `shiftTargets` typed as `any[]` [RESOLVED v2.8 — type is now `DoctorShiftTarget[]`]

---

## CHANGE LOG (v2.9 → v3.0)

No algorithm rules change in this version. Changes reflect the finalisation of the `FinalRotaInput` data contract after the pre-algorithm infrastructure cleanup (April 2026).

| # | Section | Change |
|---|---|---|
| H1 | §3, §4.1, §14 | `FinalRotaInput` contract finalised. `resolvedAvailability[]` added as top-level field — the single canonical source for per-doctor-per-date availability passed into the algorithm. All leave date arrays removed from `doctors[].constraints.hard` (`annualLeaveDates`, `studyLeaveDates`, `parentalLeaveDates`, `rotationDates`, `ltftDaysBlocked`) — all encoded in `resolvedAvailability` status codes. `nocDates` removed from `constraints.soft` — encoded as `NOC` status. `ltft.nightFlexibility` removed — LTFT night-flexibility flags now in `resolvedAvailability` rows as `canStartNights`/`canEndNights`. Top-level `constraints: { hard: string[], soft: string[] }` string arrays removed — no algorithmic function. |
| H2 | §5.1 | Phase 0 source corrected. The algorithm iterates `FinalRotaInput.resolvedAvailability[]` to build the canWork matrix. The algorithm is a pure function with no DB access — it cannot query `resolved_availability` directly. The rows are pre-fetched by `buildFinalRotaInput()` in the main thread and included in the bundle before the worker starts. |
| H3 | §3 | `validateFinalRotaInput()` now includes a doctor roster drift check: blocks generation if any active doctor in the `doctors` table is absent from `pre_rota_results.calendar_data.doctors` (i.e. added after the last pre-rota generation). |
| H4 | §14 | `resolved_availability` schema updated: `can_start_nights` and `can_end_nights` columns added (migration `20260425000001`). Populated when `status = 'LTFT'` by both rebuild functions. Eliminates the need for a separate join against `ltft_patterns` during Phase 0. |
| H5 | Audit — Bug 5 | Bug 5 resolution clarified. The spec previously stated "Phase 0 reads `resolved_availability` directly" — impossible for a pure function inside a Web Worker. Correct: `buildFinalRotaInput()` pre-fetches all rows and includes them in `FinalRotaInput.resolvedAvailability[]`. Phase 0 iterates this array. |

---

## CHANGE LOG (v2.8 → v2.9)

No algorithm rules change in this version. All changes are structural reconciliations between the specification and the deployed codebase, to make the spec accurately describe what is being built and what will be built.

### Structural changes

| # | Rule / Section | Change |
|---|---|---|
| G1 | §4 | Section split into §4.1 (internal algorithm working types — rich, per former §4) and §4.2 (public boundary types — what crosses the worker boundary, what is stored in the DB, what the UI renders). The public types are deliberately simpler than the internal types. The algorithm composes internal state during generation then projects it into the public types via a `buildFinalResult()` helper at the boundary. |
| G2 | §4.2 | New types introduced at the boundary: `RotaScore` (structured three-tier score object replacing the flat `fairnessScore` number), `PerDoctorMetrics` (simplified projection of `DoctorMetrics` — only fields the UI renders), `GenerationProgress` (worker→main streaming). The full `DoctorMetrics`, `RestBlock[]`, `LieuDay[]`, `ReturnedLeave[]`, `UnfilledSlot[]` structures remain in `finalRotaTypes.ts` as internal algorithm state; they are not persisted in v1. |
| G3 | §4.2 | `SwapLogEntry` shape changed from `{ doctorId, fromDate, fromShiftKey, toDate, toShiftKey }` (single-doctor move) to `{ doctorFromId, doctorToId, date, shiftKey, reason }` (cross-doctor swap on one date for one shift). This matches what Phase 11 actually does — it moves a shift from a surplus doctor to a deficit doctor on the same date. The previous shape described a doctor shifting their own assignment across dates, which is not what Phase 11 performs. |
| G4 | §4.2, §8 | `cancelled` added to the `status` enum alongside `complete`, `complete_with_gaps`, `failed`. Triggered when `options.shouldCancel()` returns `true` during the Monte Carlo loop. The best result found so far is still returned and persisted. |
| G5 | §12 | DB migration rewritten to match the deployed schema. Columns: `id`, `rota_config_id`, `generated_at`, `status`, `iterations_completed`, `iterations_target`, `runtime_ms`, `assignments`, `score`, `per_doctor`, `swap_log`, `violations`, `created_at`. Removed from v2.8 spec: `generated_by`, `unfilled_slots`, `rest_blocks`, `lieu_days`, `returned_leave`, `metrics`. Removed: `UNIQUE (rota_config_id)` constraint — multiple results per config are expected (query `ORDER BY generated_at DESC LIMIT 1` for latest). RLS policy scoped to coordinator via `rota_configs.owned_by` rather than permissive. |
| G6 | §13 | File structure updated. New files added: `src/types/finalRota.ts` (public boundary types — §4.2), `src/lib/finalRotaGenerator.worker.ts` (worker entry point), `src/lib/finalRotaRunner.ts` (main-thread wrapper class + runtime constants). `src/lib/finalRotaTypes.ts` retained for internal types — §4.1. |
| G7 | §13, Note 17 | Monte Carlo iteration count is now a **caller-supplied parameter** via `options.iterations`, not a module-level constant. The `MONTE_CARLO_RUNS = 1000` constant from v2.8 Note 17 is superseded by `DEFAULT_ITERATIONS = 1000` exported from `finalRotaRunner.ts`. The UI reads this constant to populate the iteration-count input. |
| G8 | §15 Phase E | Monte Carlo runner validation test extended: must also verify (a) progress callback fires at the documented cadence, (b) cancel callback correctly short-circuits the loop and returns `status: 'cancelled'`, (c) algorithm has zero imports from React, Supabase, or any browser API (pure Node.js runnable). |
| G9 | §16 | Notes 34 and 35 added. Note 34: pure function contract — `generateFinalRota` signature is permanent and must not be modified. Note 35: internal/public type separation — algorithm files import from `@/lib/finalRotaTypes.ts` for working state; only `buildFinalResult()` at the boundary touches `@/types/finalRota.ts`. |
| G10 | §17 (new) | Runtime architecture section added. Summarises the Web Worker execution model, main-thread runner responsibilities, progress cadence, cancel semantics, and UI state machine. Points to `ROTAGEN_WORKER_RUNTIME_SPEC_v1_0.md` as authoritative. |
| G11 | §11 Candidate Scoring | Clarification added: candidate scoring layers apply during construction only. They do not affect the lexicographic Monte Carlo comparison (§8 A14), which uses only `RotaScore` tiers. The candidate scoring layers feed into construction choices; the Monte Carlo comparison picks the best construction across iterations. |

### Deferred items carried forward from v2.8

| # | Status | Description |
|---|---|---|
| D2 | Carried to v2.10 | Monte Carlo reproducibility via seed parameter. |
| D3 | Carried to v2.10 | Timeout fallback `status: 'failed'`. |
| D4 | Carried to v2.10 | Parameterise `maxShiftLengthOncallH`. |
| D5 | Carried to v2.10 | E44 legacy-informational. |
| D6 | Carried to v2.10 | Unused fields cleanup. |
| D7 | Carried to v2.10 | `PreRotaTargetsPage` fetch architecture. |
| Phase 12 | Carried to v2.10 | 2-opt coordinator-triggered local search — architecture locked in v2.7, full rule set deferred. |

### v2.9 additions — deferred items

| # | Status | Description |
|---|---|---|
| D8 (new) | Carried to v2.10 | Surface `RestBlock[]`, `LieuDay[]`, `ReturnedLeave[]`, `UnfilledSlot[]`, and full `DoctorMetrics` to the UI. In v1 these live only as internal algorithm working state. When the `/admin/final-rota` page grows a calendar view, these need to be added to `FinalRotaResult` and the DB schema. |
| D9 (new) | Carried to v2.10 | Timeout fallback is currently not implemented — the algorithm relies on caller-driven cancel. When D3 is resolved, the 8-second automatic fallback mentioned in §8 Performance Constraints must be re-evaluated against the Web Worker execution model where wall-clock time is not the primary limit. |

---

## CHANGE LOG (v2.7 → v2.8)

### Structural changes

| # | Rule / Section | Change |
|---|---|---|
| F1 | §7 Rule A8, §8 Check Sequence B Step 2 | A8 REST window check corrected. Only committed shifts in DoctorState constitute a FAIL. AL/SL/LTFT dates PASS and stage lieu obligations per G55–G57 (now reachable). NOC, PL, ROT dates PASS silently — REST is compatible with these states. Previous version incorrectly listed NOC, PL, and ROT as FAIL cases, making G55–G57 mathematically unreachable. |
| F2 | §8 Phase 0 V2 guard | Zero-competency warning condition tightened. Now requires `reqIac = 0 AND reqIaoc = 0 AND reqIcu = 0 AND reqTransfer = 0 AND permittedGrades.length = 0`. Grade-restricted slots with no competency requirements no longer trigger a false-positive warning. |
| F3 | §16 Note 32 | Bridge block (`3N Sun–Tue`) week-boundary hour allocation rule added. Hours must be allocated to the calendar week containing each shift's UTC start date. Prevents per-week accumulator corruption in audit output. |
| F4 | §16 Note 33 | `long-evening` badge deferred task documented. Badge must be stored as `badge_long_evening` on `shift_types` and set automatically in DepartmentStep2. Until that prompt is built, A6 and A11 are inactive. |
| F5 | §3, §4, §14 | `buildFinalRotaInput` pipeline corrected. Shift targets now read from `pre_rota_results.targets_data` via `DoctorShiftTarget[]` (leave-adjusted, override-aware). Leave dates read from `unavailability_blocks`. LTFT from `ltft_patterns`. Competency flags via `hasFlat` pattern. `alEntitlementDays` removed from `FinalRotaInput`, relocated to `validateFinalRotaInput`. `ShiftTargetResult` replaced by `DoctorShiftTarget` throughout. |
| F6 | §7 G55/G56/G57 | Scope clarification added: G55–G57 are triggered exclusively by A8 REST window overlaps from night blocks. Day shifts do not generate 46h REST obligations with lieu. |

### Deferred items carried forward from v2.7

| # | Status | Description |
|---|---|---|
| D2 | Carried to v2.9 | Monte Carlo reproducibility via seed parameter. |
| D3 | Carried to v2.9 | Timeout fallback `status: 'failed'`. |
| D4 | Carried to v2.9 | Parameterise `maxShiftLengthOncallH`. |
| D5 | Carried to v2.9 | E44 legacy-informational. |
| D6 | Carried to v2.9 | Unused fields cleanup. |
| D7 | Carried to v2.9 | `PreRotaTargetsPage` fetch architecture. |
| Phase 12 | Carried to v2.9 | 2-opt coordinator-triggered local search — architecture locked in v2.7, full rule set deferred. |

---

## CHANGE LOG (v2.6 → v2.7)

### Structural changes

| # | Rule / Section | Change |
|---|---|---|
| S1 | §7 D35 | Full replacement. Fixed Checkpoint A and Checkpoint B retired. Continuous per-shift-type cascade debt architecture adopted. Carry-forward, backfill, cross-bucket transfer, and final deficit reporting all specified. |
| S2 | §8 Phase Sequence | Checkpoint A and Checkpoint B labels retired. Replaced with cascade checkpoint notation aligned to D35. Phase numbering 1–11 unchanged. |
| S3 | §8 Phase 0 | Two new pre-generation input validation guards added: V1 bucket floor (halts generation) and V2 zero-competency on-call slot (non-blocking coordinator warning requiring acknowledgement). |
| S4 | §8 Monte Carlo Scoring | Tier 3 fairness formula updated from sum of squared deviations to WTE-normalised percentage deviation. Zero-guard specified. Rationale documented. |
| S5 | §8 Phase 12 (new) | Coordinator-triggered 2-opt local search placeholder added. Architecture decisions locked. Full rule set deferred to v2.9. |
| S6 | §4 RotaMetrics | `unallocatedContractualHours` field added to `DoctorMetrics`. |
| S7 | §7 I69 | Updated to reference cascade architecture (D35) rather than fixed checkpoints. |
| S8 | §13 File Structure | `finalRotaLocalSearch2Opt.ts` placeholder added. |
| S9 | §15 Phase D | Validation test updated to reference cascade checkpoints. |
| S10 | §16 | Implementation notes 27–31 added. |

### Deferred items resolved or carried forward

| # | Status | Description |
|---|---|---|
| D1 (v2.6) | **Resolved — S1** | Cascade architecture / D35 redesign. |
| D2 (v2.6) | Carried to v2.9 | Monte Carlo reproducibility via seed parameter. |
| D3 (v2.6) | Carried to v2.9 | Timeout fallback `status: 'failed'`. |
| D4 (v2.6) | Carried to v2.9 | Parameterise `maxShiftLengthOncallH`. |
| D5 (v2.6) | Carried to v2.9 | E44 legacy-informational. |
| D6 (v2.6) | Carried to v2.9 | Unused fields cleanup. |
| D7 (v2.6) | Carried to v2.9 | `PreRotaTargetsPage` fetch architecture. |
| 2-opt (v2.6 eval) | **Partially resolved — S5** | Architecture decision made. Full rules deferred to v2.9. |
| P1 (mathematician) | **Resolved — S4** | WTE fairness weighting. Adopted as percentage deviation, not mathematician's formula. |
| P2 (mathematician) | **Rejected (v2.6 evaluation)** | Stochastic shift order perturbation. I66 provides sufficient diversity. |
| P3 (mathematician) | **Partially resolved — S5** | 2-opt local search. Architecture adopted, rules deferred to v2.9. |

---

## CHANGE LOG (v2.5 → v2.6)

### Critical correctness fixes

| # | Rule / Section | Fix |
|---|---|---|
| C1 | §8 Phase 11 pseudo-code | Added same-day collision check: candidate doctor must have NO assignments (of any shiftKey) on target date D. |
| C2 | §5.2, §8 Phase 0 | Resolved availability-source contradiction. Unified: both now read `resolved_availability` exclusively. |
| C3 | §7 G60 Lieu Placement | Added explicit handling of evicted doctor state in Steps 2 and 3. |
| C4 | §5.2, §7 D33/D36 | Documented leave × ceiling interaction explicitly. |
| C5 | §5.2 | Standard-day hours calculation: always `wtrConstraints.maxAvgHoursPerWeek / 5`. |
| C6 | §8 Check Sequence B Step 2 | D33 row disambiguated: applies to the specific ShiftTargetResult entry matching the block's shiftId. |
| C7 | §8 Phase 11 | After each committed swap, REST blocks and WTR state must be recomputed from scratch for the swapping doctor. |
| C8 | §8 Phase 11 | "Break inner loop" replaced with explicit continuation. |

### Clarifying additions

| # | Rule / Section | Addition |
|---|---|---|
| M1 | §7 A-rules (new A0) | A0. Single rostered assignment per date. |
| M2 | §7 G58 | REST and LIEU days on Sat/Sun do NOT count toward weekend frequency. |
| M3 | §7 A6 + §2.2 | `long-evening` badge added. |
| M4 | §7 A14 (NROC rule) | "Any rolling 7-day window" = 168 hours rolling. |
| M5 | §7 H64 + §5.2 | BH-on-AL accounting clarified. |
| M6 | §8 Phase 11 + §16 note 24 | Immutability principle documented. |

*All v2.5 amendments (Phase 11 A15-Fix2 removal, Check Sequence A ceiling gate fix, multi-pass termination) and all prior content remain in force.*

---

## CHANGE LOG (v2.4 → v2.5)

Three changes. All v2.4 content otherwise unchanged.

| Change | Section | Description |
|--------|---------|-------------|
| **Remove A15-Fix2** | **§8 A15 pseudo-code, §8 termination block, §16 note 21** | **A15-Fix2 (targeted A3 neighbour-gap check) is mathematically redundant and removed.** |
| **Fix Check Sequence A Step 1 ceiling gate** | **§8 Check Sequence A** | **Bug: gate was `remaining ceiling ≤ 0 → EXCLUDE`. Fix: `currentHours + proposedShift.durationHours > maxTargetHours → EXCLUDE`.** |
| **Phase 11 multi-pass termination** | **§8 A15 termination block, §15 Phase H validation** | **Single-pass termination replaced with `while (swapsMadeThisPass > 0)` loop capped at `initialUnfilledCritical`.** |

*All v2.4 amendments (A14, A15 with Fix1 and Fix3) and all prior content remain in force.*

---

## CHANGE LOG (v2.3 → v2.4)

Three patches to Amendment A15 pseudo-code. No other rules modified.

| Change | Rule | Description |
|--------|------|-------------|
| **A15-Fix1** | **A15 swap loop — surplus gate** | **Add bucket-parity guard: `T.isOncall == S.isOncall`.** |
| **A15-Fix2** | **A15 swap loop — source date validation** | **REMOVED in v2.5.** |
| **A15-Fix3** | **A15 swap loop — surplus gate** | **Add BH date exclusion and lieu day exclusion.** |

*All v2.3 amendments (A14, A15) and all v2.2 content remain in force.*

---

## CHANGE LOG (v2.2 → v2.3)

| Change | Section | Description |
|--------|---------|-------------|
| **A14 (new)** | **§8 Monte Carlo Scoring** | **Lexicographic iteration scoring — replaces linear equation.** |
| **A15 (new)** | **§8 Phase Sequence (new Phase 11), §4 FinalRotaResult, §12 DB migration** | **Post-Monte-Carlo local search swap phase.** |

*Amendments A8–A13 from v2.1/v2.2 are unchanged and remain in force.*

---

## CHANGE LOG (v2.1 → v2.2)

| Change | Section | Description |
|--------|---------|-------------|
| Bug 1 fix | §3, §14, §16 | Competency flags: flat DB columns first, JSONB fallback |
| Bug 2 fix | §3, §16 | `contractedHoursPerWeek = (wtePct/100) × maxAvgHoursPerWeek` |
| Bug 3 fix | §4, §16 | `targetTotalHours = (wtePct/100) × maxAvgHoursPerWeek × weeks` |
| Bug 4 fix | §3, §4, §7, §14 | `rotationDates` added to `constraints.hard` |
| Bug 5 fix | §5.1, §14 | Availability Matrix reads from `resolved_availability` |
| Bug 6 fix | §3, §4 | `trainingPreferences`/`dualSpecialty` added as v1-informational |
| Bug 7 fix | §3, §4 | `alEntitlementDays` added to `constraints.hard` |
| Bug 8 fix | §16 | UTC date arithmetic throughout |
| Bug 9 fix | §5, §16 | `isLtft = daysOff.length > 0` |
| Spec Issue 1 fix | §8 | Non-on-call night phases 5/6 restored; Checkpoint B repositioned |
| Spec Issue 2 fix | §5.1 | `resolved_availability` status → canWork mapping table |
| Spec Issue 3 fix | §3 | `bhShiftRules` full field list |
| Spec Issue 4 fix | §3, §4 | `shiftTargets: ShiftTargetResult[]` |
| **A14 (v2.2)** | **§8, §7 E47, §11** | **Block-Level WTR Pre-Validation** |

*Note: The label A14 was reused in v2.2 for Block-Level WTR Pre-Validation. In v2.3 that rule is renumbered **A13b** to free A14 for Lexicographic Scoring. See §7 E-rules for the block atomicity rule, now referenced as E47 (unchanged).*

---

## 1. OVERVIEW

The algorithm is a constraint-satisfaction solver using **multi-start stochastic search** over phased allocation. It:
- Consumes `FinalRotaInput` from `src/lib/rotaGenInput.ts` (DO NOT modify this interface)
- Produces a day-indexed assignment map stored in `final_rota_results`
- Pre-computes a full Availability Matrix before any allocation (Phase 0)
- Runs the full phased sequence **N times** (default 1,000) with randomised doctor ordering per run, then selects the highest-scoring rota
- Fills hardest-to-staff shifts first (on-call before non-on-call, nights before days)
- Enforces ALL WTR rules on EVERY assignment attempt — no exceptions
- Assigns doctors to specific slot positions within each shift (per-slot competency + grade requirements)
- Reports unfilled slots for locum cover rather than violating any constraint

### Key Principles
- WTR compliance is non-negotiable
- Per-shift-type targets are HARD CEILINGS (never exceeded). Per-shift-type cascade debt mechanism manages under-allocation within and across buckets.
- On-call and non-on-call hour buckets are strictly firewalled — hours never cross except via the one-way transfer in D35 Rule 3
- Night shifts ALWAYS in blocks (never single nights)
- Leave (AL, SL, PL, lieu) counts as standard-day hours towards non-on-call targets and WTR 48h average **but NOT towards the 168h rolling window** (see A1/A2)
- REST periods are structural — stamped immediately, blocking further allocation
- Three-tier staffing: min (hard floor) → target (aim for) → max (ceiling)
- Pass 1 respects all soft constraints. Pass 2 (future) relaxes them.
- Unfilled slots = locum requirements
- Returning owed lieu days is prioritised over avoiding locum gaps (see G60)

---

## 2. UPDATED DATA MODEL

### 2.1 Key Schema Changes (vs v1.x spec)

**`shift_day_slots` table** — Per-day-of-week staffing for each shift type:
```
shift_type_id (FK), day_key ("mon"..."sun"),
min_doctors, target_doctors, max_doctors
```

**`shift_slot_requirements` table** — Per-doctor-position requirements:
```
shift_day_slot_id (FK), slot_index, label,
permitted_grades (text[]), req_iac, req_iaoc, req_icu, req_transfer
```

**`unavailability_blocks` table:**
```
doctor_id, reason (ENUM: annual/study/noc/rotation/parental/other),
start_date, end_date, notes, location
```

**`ltft_patterns` table:**
```
doctor_id, day (ENUM: monday...sunday),
is_day_off, can_start_nights, can_end_nights
```

**Updated `shift_types`:** Added `abbreviation`, `target_doctors`, `req_transfer`. Removed `badge_weekend`.

**Updated `rota_configs`:** Added `bh_same_as_weekend` (boolean), `bh_shift_rules` (jsonb).

**Updated `wtr_settings`:** Added `max_shift_length_h`, `min_inter_shift_rest_h`, `max_long_evening_consec`, `rest_after_long_evening_h`.

### 2.2 How Data Flows

The `ShiftSlotEntry` interface in `rotaGenInput.ts` is the algorithm's primary input per shift-day combination:

```typescript
interface ShiftSlotEntry {
  shiftId: string;
  shiftKey: string;       // e.g. "night", "long-day"
  name: string;
  dayKey: string;         // "mon" | "tue" | ... | "sun"
  startTime: string;      // "HH:MM"
  endTime: string;
  durationHours: number;
  isOncall: boolean;
  isNonResOncall: boolean;
  badges: string[];       // ["night", "long", "long-evening", "ooh", "oncall", "nonres"]
  staffing: {
    min: number;
    target: number;
    max: number | null;
  };
  slots: Array<{
    slotIndex: number;
    label: string | null;
    permittedGrades: string[];
    reqIac: number;
    reqIaoc: number;
    reqIcu: number;
    reqTransfer: number;
  }>;
  targetPct: number;
}
```

---

## 3. INPUT CONTRACT

The algorithm receives `FinalRotaInput` containing:

**preRotaInput:**
- `period`: startDate, endDate, totalDays, totalWeeks, bankHolidayDates[], bhSameAsWeekend, bhShiftRules[] — each rule has: `{ shift_key, name, start_time, end_time, target_doctors, included }`
- `shiftSlots[]`: ShiftSlotEntry (one per shift×day combination). **Badge `long-evening` [v2.6 — M3, v2.8 — F4 DEFERRED]:** Must be stored as `badge_long_evening` on `shift_types` and set automatically in DepartmentStep2 when a shift starts before 16:00 and ends after 23:00. Until that Lovable prompt is built, this badge will not appear in `ShiftSlotEntry.badges[]` and Rules A6 and A11 will be inactive. See Note 33.
- `wtrConstraints`: maxAvgHoursPerWeek, maxHoursIn168h, maxShiftLengthH, minInterShiftRestH, maxConsecutive (standard/long/nights/longEvening), minRestHoursAfter (nights/longShifts/standardShifts/longEveningShifts), weekendFrequencyMax, oncall (maxPer7Days, localAgreementMaxConsec, dayAfterMaxHours, restPer24hHours, continuousRestHours, continuousRestStart, continuousRestEnd, ifRestNotMetNextDayMaxHours, noSimultaneousShift, noConsecExceptWknd, dayAfterLastConsecMaxH)
- `distributionTargets`: globalOncallPct, globalNonOncallPct, byShift[]

**doctors[]:** Full type shown in §4.1. Key contract rules:
- `resolvedAvailability[]` — top-level array (not per-doctor). Pre-fetched from `resolved_availability` table by `buildFinalRotaInput()`. Each row: `{ doctorId, date, status, source, canStartNights, canEndNights }`. This is the ONLY source the algorithm uses for availability decisions. Status values: `AVAILABLE | AL | SL | PL | ROT | BH | NOC | LTFT`.
- `contractedHoursPerWeek` = `DoctorTargets.contractedHoursPerWeek` from `pre_rota_results.targets_data` — leave-adjusted, override-aware [v2.8 — F5]
- `fairnessTargets.targetTotalHours` = `DoctorTargets.totalMaxHours` from `pre_rota_results.targets_data` — post-leave, override-aware [v2.8 — F5]
- `shiftTargets` = `DoctorTargets.shiftTargets` from `pre_rota_results.targets_data` — leave-adjusted per-shift-type ceilings [v2.8 — F5]
- `ltft.isLtft` = `daysOff.length > 0` — NOT `wtePct < 100` [Bug 9]
- `ltft.daysOff` = from `ltft_patterns` table (canonical day-of-week pattern). LTFT night-flexibility flags (`canStartNights`, `canEndNights`) are in `resolvedAvailability` rows, not here.
- `hasIac/hasIaoc/hasIcu/hasTransfer` = flat DB columns first (`iac_achieved` etc.), `competencies_json` fallback only when all flat columns are NULL [Bug 1, v2.8 — F5]
- `constraints.hard` contains only global per-doctor flags with no per-date equivalent: `exemptFromNights`, `exemptFromWeekends`, `exemptFromOncall`. Leave dates are NOT here — they are encoded in `resolvedAvailability` status codes.
- `constraints.soft` contains `maxConsecNights` (WTR preference) and `additionalNotes` (free-text). `nocDates` is NOT here — encoded as `NOC` status in `resolvedAvailability`.

---

## 4. DATA STRUCTURES

Two type boundaries exist. The algorithm uses **internal types** (§4.1) for its own working state during construction. At the end of each run, `buildFinalResult()` projects this rich state into the simpler **public boundary types** (§4.2) which cross the Web Worker boundary, get stored in the DB, and are rendered by the UI. Keeping these separate prevents the boundary types from forcing shape decisions into the algorithm's working logic, and prevents the algorithm's working types from leaking into DB storage or UI code.

### 4.1 Internal algorithm working types

These live in `src/lib/finalRotaTypes.ts`. Algorithm modules (`finalRotaConstruction.ts`, `finalRotaWtr.ts`, `finalRotaSwap.ts`, etc.) import from here. Not exported to the worker or UI.

```typescript
// FinalRotaInput — produced by buildFinalRotaInput() in main thread.
// Passed into the algorithm. The algorithm is a pure function — 
// no DB access inside the worker. All data must be pre-fetched here.
export interface FinalRotaInput {
  preRotaInput: PreRotaInput;
  // Canonical per-doctor-per-date availability — pre-fetched from
  // resolved_availability table. ONLY source for canWork decisions.
  // canStartNights/canEndNights populated only when status = 'LTFT'.
  resolvedAvailability: Array<{
    doctorId: string;
    date: string;
    status: 'AVAILABLE' | 'AL' | 'SL' | 'PL' | 'ROT' | 'BH' | 'NOC' | 'LTFT';
    source: 'survey' | 'coordinator_override';
    canStartNights: boolean | null;
    canEndNights: boolean | null;
  }>;
  doctors: Array<{
    doctorId: string;
    name: string;
    grade: string;
    wtePct: number;
    contractedHoursPerWeek: number;
    hasIac: boolean;
    hasIaoc: boolean;
    hasIcu: boolean;
    hasTransfer: boolean;
    ltft: {
      isLtft: boolean;
      daysOff: string[];  // day names e.g. ['monday', 'tuesday']
      // LTFT flexibility flags are in resolvedAvailability rows, not here
    };
    constraints: {
      hard: {
        // Leave dates NOT here — encoded in resolvedAvailability status codes
        // Only global flags with no per-date equivalent belong here
        exemptFromNights: boolean;
        exemptFromWeekends: boolean;
        exemptFromOncall: boolean;
      };
      soft: {
        // nocDates NOT here — encoded as NOC in resolvedAvailability
        maxConsecNights: number;   // WTR-derived preference ceiling
        additionalNotes: string;   // free-text from survey
      };
    };
    fairnessTargets: {
      targetTotalHours: number;
      targetNightShiftCount: number;
      targetWeekendShiftCount: number;
      targetOncallCount: number;
      proportionFactor: number;    // wtePct / 100
    };
    shiftTargets: DoctorShiftTarget[];
    totalMaxHours: number;
    weekendCap: number;
    hardWeeklyCap: number;
  }>;
}

// DoctorShiftTarget (from src/lib/preRotaTypes.ts, produced by preRotaTargets.ts):
// Leave-adjusted, coordinator-override-aware ceilings. Field is shiftTypeId (not shiftId).
// [v2.8 — F5: replaces ShiftTargetResult from shiftTargets.ts]
interface DoctorShiftTarget {
  shiftTypeId: string;           // shift_types.id — use this to look up ceilings
  shiftName: string;
  shiftKey: string;
  isOncall: boolean;
  maxTargetHours: number;        // HARD CEILING — post-leave, never exceed
  estimatedShiftCount: number;
}

// ── Internal working state — not exported to worker/UI ────────

// Internal assignment record — rich fields used during construction and WTR checks.
// Projected to the simpler public DayAssignment (§4.2) at the boundary.
interface InternalDayAssignment {
  doctorId: string;
  shiftKey: string;
  shiftId: string;
  slotIndex: number;
  slotLabel: string | null;
  durationHours: number;
  startTime: string;
  endTime: string;
  shiftStartMs: number;          // Unix ms — for WTR time arithmetic
  shiftEndMs: number;            // Unix ms — for WTR time arithmetic
  isNightShift: boolean;
  isOncall: boolean;
  isLong: boolean;
  blockId: string | null;        // set for night blocks — same ID for all nights in a block
  badges: string[];
  violations: string[];          // rules logged for audit (not hard fails)
}

interface UnfilledSlot {
  date: string;
  shiftKey: string;
  shiftId: string;
  slotIndex: number;
  reason: string;
  severity: 'critical' | 'warning';
}

interface RestBlock {
  doctorId: string;
  startDatetime: string;
  endDatetime: string;
  hours: number;
  reason: string;                // e.g. 'post_night_block_46h', 'post_long_block_48h'
  blockId: string;
}

interface LieuDay {
  doctorId: string;
  date: string;
  reason: string;
  originDate: string;
  originType: 'REST_ON_LTFT' | 'REST_ON_AL' | 'REST_ON_SL' | 'BH_WORKED' | 'BH_ON_LEAVE';
}

interface ReturnedLeave {
  doctorId: string;
  date: string;
  leaveType: 'AL' | 'SL';
  reason: string;
}

interface InternalDoctorMetrics {
  totalHoursAssigned: number;
  shiftHoursOnly: number;
  leaveHours: number;
  oncallHours: number;
  nonOncallHours: number;
  nightBlocksAssigned: number;
  weekendDaysWorked: number;
  equivalentFullWeekends: number;
  weekendFrequency: string;
  hoursPerWeekAvg: number;
  targetDeviation: number;
  returnedLeaveDays: number;
  unallocatedContractualHours: number;  // [v2.7 — S6]
  perShiftType: Record<string, {
    ceiling: number;              // effectiveCeiling after cascade (D35)
    actualHours: number;
    actualCount: number;
    utilisationPct: number;
  }>;
}

// DoctorState — mutable per-doctor construction state.
// Cloned per Monte Carlo iteration; never mutate a shared reference.
interface DoctorState {
  doctorId: string;
  assignments: InternalDayAssignment[];
  restUntilMs: number;                         // Unix ms — cannot be assigned before this time
  weeklyHoursUsed: Record<string, number>;     // ISO week key 'YYYY-WNN' → hours [see Note 32]
  consecutiveShiftDates: string[];
  consecutiveNightDates: string[];
  consecutiveLongDates: string[];
  weekendDatesWorked: string[];
  nightBlockHistory: string[][];               // each inner array = one completed night block
  oncallDatesLast7: string[];                  // rolling 168h for A14
  bucketHoursUsed: { oncall: number; nonOncall: number };
  lieuDatesStaged: string[];                   // G55/G56/G57 obligations pending commit
  effectiveCeiling: Record<string, number>;    // per shiftTypeId — cascade-adjusted (D35)
}

interface IterationResult {
  assignments: Record<string, InternalDayAssignment[]>;  // ISO date → assignments
  doctorStates: DoctorState[];
  unfilledSlots: UnfilledSlot[];
  restBlocks: RestBlock[];
  lieuDays: LieuDay[];
  returnedLeave: ReturnedLeave[];
}
```

### 4.2 Public boundary types

These live in `src/types/finalRota.ts`. They cross the Web Worker boundary via `postMessage`, are persisted to `final_rota_results` as JSONB, and are consumed by the UI. They are deliberately simpler than the internal types — they contain only fields that are surfaced to the coordinator in v1.

```typescript
// ── Public assignment record ─────────────────────────────────

interface DayAssignment {
  doctorId: string;
  shiftKey: string;
  shiftStartIso: string;           // ISO 8601 datetime
  shiftEndIso: string;             // ISO 8601 datetime
  isOncall: boolean;
  badges: string[];                // e.g. ['night', 'long']
}

// ── Three-tier structured score object ───────────────────────
// [v2.9 — G2] Replaces the flat `fairnessScore` number in DoctorMetrics.
// Tier 1 dominates Tier 2 dominates Tier 3 — never combined arithmetically.

interface RotaScore {
  tier1CriticalUnfilled: number;   // primary sort key — staffing < min
  tier2WarningUnfilled: number;    // secondary sort key — staffing < target
  tier3FairnessDeviation: number;  // tertiary sort key — sum of squared % deviations
}

// ── Swap log ─────────────────────────────────────────────────
// [v2.9 — G3] Shape changed from v2.8 to match Phase 11 semantics:
// one shift on one date moves from doctorFrom to doctorTo.

interface SwapLogEntry {
  doctorFromId: string;
  doctorToId: string;
  date: string;                    // ISO date YYYY-MM-DD
  shiftKey: string;
  reason: string;                  // e.g. 'phase_11_critical_fill', 'fairness_improvement'
}

// ── Per-doctor metrics projection ────────────────────────────
// [v2.9 — G2] Simplified projection of InternalDoctorMetrics.
// perShiftType, detailed leave hours, and restBlocks live in
// InternalDoctorMetrics (§4.1) but are not surfaced in v1.

interface PerDoctorMetrics {
  doctorId: string;
  name: string;
  wtePct: number;
  totalHoursAssigned: number;
  targetTotalHours: number;
  deviationPct: number;            // ((actual - target) / target) * 100
  weekendDays: number;
  nightBlocks: number;
  unallocatedHours: number;        // max(0, targetTotalHours - totalHoursAssigned)
}

// ── Progress streaming ───────────────────────────────────────

interface GenerationProgress {
  iterationsCompleted: number;
  iterationsTarget: number;
  elapsedMs: number;
  bestScore: RotaScore | null;     // null until first iteration completes
  currentPhase: string;            // e.g. 'Monte Carlo iteration 47', 'Phase 11 local swap'
}

// ── Public result — what crosses the worker boundary ─────────

interface FinalRotaResult {
  configId: string;
  generatedAt: string;             // ISO 8601 datetime
  status: 'complete' | 'complete_with_gaps' | 'failed' | 'cancelled';  // [v2.9 — G4]
  iterationsCompleted: number;
  iterationsTarget: number;
  runtimeMs: number;
  assignments: Record<string, DayAssignment[]>;  // ISO date → assignments
  score: RotaScore;
  perDoctor: PerDoctorMetrics[];
  swapLog: SwapLogEntry[];
  violations: string[];            // WTR rule IDs logged during generation (audit only)
}

// ── Worker message protocol ──────────────────────────────────

type WorkerInboundMessage =
  | { type: 'start'; input: FinalRotaInput; iterations: number }
  | { type: 'cancel' };

type WorkerOutboundMessage =
  | { type: 'progress'; progress: GenerationProgress }
  | { type: 'complete'; result: FinalRotaResult }
  | { type: 'error'; message: string };
```

### 4.3 Boundary projection

`buildFinalResult(iterResult, score, input, status, ...)` is a pure function in `finalRotaGenerator.ts` that produces a `FinalRotaResult` from an `IterationResult`. It performs these projections:

| Internal (§4.1) | Public (§4.2) | Projection |
|---|---|---|
| `InternalDayAssignment` | `DayAssignment` | Keep `doctorId`, `shiftKey`, `isOncall`, `badges`. Compose `shiftStartIso` from `shiftStartMs`. Drop `slotIndex`, `slotLabel`, `durationHours`, `shiftId`, `blockId`, `violations`. |
| `IterationResult.unfilledSlots` | — | Counted into `RotaScore.tier1CriticalUnfilled` (critical) and `RotaScore.tier2WarningUnfilled` (warning). Raw list not persisted in v1 (see D8). |
| `RestBlock[]`, `LieuDay[]`, `ReturnedLeave[]` | — | Not persisted in v1 (see D8). Live only as algorithm working state. |
| `InternalDoctorMetrics` | `PerDoctorMetrics` | Keep `totalHoursAssigned`, compute `deviationPct`, count `weekendDaysWorked`, count `nightBlocksAssigned`. Drop `perShiftType`, `leaveHours`, `oncallHours`, `nonOncallHours`, `hoursPerWeekAvg`. |
| `violations` (from any source) | `violations: string[]` | Collected as rule ID strings (e.g. `'A1_LOGGED'`). Non-hard violations only — hard violations reject assignments before they land. |

---

## 5. PHASE 0: AVAILABILITY MATRIX (PRE-SCREENING) [Amendment A9]

### 5.0 Phase 0 Input Validation Guards [v2.7 — S3, v2.8 — F2]

Two validation guards run during Phase 0, before any iteration begins. Both run on static data and consume no iteration budget.

**V1 — Bucket floor guard:**

After leave deduction (§5.2), check per-doctor per-bucket:

```
IF nonOncallBucket(D) < 0 OR oncallBucket(D) < 0:
  HALT — do not begin any iteration.
  Surface error to coordinator:
  "Dr [name]: leave deductions exceed available [on-call / non-on-call]
   capacity by [Xh]. Reduce entered leave or adjust department hour
   targets before generating."
  Generation cannot proceed until corrected.
```

A negative bucket means leave entered exceeds the doctor's contractual hours in that bucket. This is a data entry error. Allocating against a negative ceiling produces nonsensical per-shift-type ceilings for all downstream phases. Halting cleanly is the correct response.

**V2 — Zero-competency on-call slot warning [v2.8 — F2]:**

```
FOR each on-call shift S in ShiftSlotEntry[] (isOncall = true):
  FOR each slot position in S.slots[]:
    IF reqIac = 0 AND reqIaoc = 0 AND reqIcu = 0 AND reqTransfer = 0
       AND permittedGrades.length = 0:
      Surface non-blocking coordinator warning (requires explicit acknowledgement):
      "Shift [S.name] slot [slotIndex] has no competency requirements and no
       grade restrictions. Any doctor regardless of training level may be assigned
       to on-call cover. Review slot configuration before proceeding."
      Coordinator must actively dismiss warning to continue.
      If overridden: generation proceeds normally. No automatic doctor exclusion applied.
      Log acknowledgement with timestamp.
```

The algorithm does not automatically exclude unqualified doctors from zero-competency on-call slots. If the coordinator overrides, the resulting assignments are their clinical responsibility. The warning surfaces the configuration risk; the override is the decision.

**Rationale for the `permittedGrades.length = 0` addition [v2.8 — F2]:** A slot may have no competency requirements but still carry a grade restriction via `permittedGrades[]`. In that case, Rule A20 enforces grade at assignment time and the slot is not clinically unconstrained. The warning is only clinically meaningful when both competency requirements AND grade restrictions are absent. The previous condition produced false-positive warnings on grade-restricted slots.

---

Before any allocation begins, the engine pre-computes a 3D availability grid:

```
canWork[doctorId][date][shiftKey] → boolean
```

### 5.1 Building the Matrix [Bug 5 fix]

**CRITICAL:** The Availability Matrix MUST be built from `FinalRotaInput.resolvedAvailability[]`, which contains rows pre-fetched by `buildFinalRotaInput()` from the `resolved_availability` table. The algorithm is a pure function inside a Web Worker — it has no DB access and cannot query `resolved_availability` directly. Never read from raw survey JSONB or `unavailability_blocks`.

For each doctor × date combination, find the matching row in `FinalRotaInput.resolvedAvailability[]` by `doctorId` and `date`, then read its `status` value (UNIQUE on rota_config_id, doctor_id, date). Map to `canWork`:

| `resolved_availability.status` | Hard block? | LTFT exception applies? |
|---|---|---|
| `AVAILABLE` | No — canWork = true | N/A |
| `AL` | Yes — canWork = false | No |
| `SL` | Yes — canWork = false | No |
| `PL` | Yes — canWork = false | No |
| `ROT` | Yes — canWork = false | No |
| `BH` | No — canWork = true (BH rules apply via demand matrix) | N/A |
| `NOC` | Soft block — canWork = false in Pass 1 | No |
| `LTFT` | Conditional — see LTFT edge flexibility below | Yes |

For each doctor × date × shiftKey combination:
- Apply the status-to-canWork mapping above
- Set additional `false` for: exemption flags (exemptFromNights, exemptFromWeekends, exemptFromOncall)
- **LTFT edge flexibility:** If status is `LTFT` (day off), check `canStartNights` and `canEndNights` on the matching `FinalRotaInput.resolvedAvailability[]` row for night block boundary positions only. These flags are pre-populated on the row itself — no separate `ltft_patterns` join is needed. All other leave types produce a hard `false` with zero flexibility.

### 5.2 Leave Hours Pre-Computation [v2.6 — C2, C4, C5]

**Source:** `resolved_availability` only. [Bug 5, C2]

**Standard day hours:** `standardDayHours = wtrConstraints.maxAvgHoursPerWeek / 5` (e.g. 48/5 = 9.6h). [C5]

**Per-doctor leave computation:**

For each doctor, iterate `resolved_availability` rows within rota period. For each row where the date is a weekday (Mon–Fri, UTC):

- If `status ∈ {'AL', 'SL', 'BH'}` → increment `alSlBhDays`
- If `status ∈ {'PL', 'ROT'}` → increment `plRotDays`

Weekend dates contribute zero leave hours.

**Bucket accounting:**

```
wteScalar = wtePct / 100

alSlBhHoursDeducted = alSlBhDays × standardDayHours              (NO WTE scaling)
plRotHoursDeducted  = plRotDays × standardDayHours × wteScalar   (WTE-scaled)

Total envelope      = maxAvgHoursPerWeek × rotaWeeks × wteScalar
Oncall bucket       = Total envelope × (oncallPct / 100)
NonOncall bucket    = Total envelope × (nonOncallPct / 100)

# PL/ROT treated as full absence — proportionally reduces BOTH buckets:
Oncall bucket      -= plRotHoursDeducted × (oncallPct / 100)
NonOncall bucket   -= plRotHoursDeducted × (nonOncallPct / 100)

# AL/SL/BH treated as standard-day hours — reduces NON-ONCALL bucket only:
NonOncall bucket   -= alSlBhHoursDeducted
```

After deduction, V1 guard (§5.0) checks both buckets ≥ 0 before continuing.

Per-shift-type ceilings (`DoctorShiftTarget.maxTargetHours`) are computed AFTER bucket deduction, by distributing each bucket across that bucket's shift types by `targetPercentage`. Ceilings are post-leave. [C4]

**BH-overlap-AL exception (H64):** A date's `resolved_availability.status` is a single primary code — no double-count risk.

**Clinical rationale:**
- AL, SL, BH: doctor present in workforce but not working that day. Non-on-call capacity reduces. Not WTE-scaled — pro-rata entitlement already delivers fewer AL days to part-timers.
- PL, ROT: doctor absent from workforce entirely. Both buckets reduce proportionally, WTE-scaled.
- Lieu: displaces an existing non-on-call shift assignment. No separate deduction.

### 5.3 Target Synchronisation [v2.8 — F5]

WTR target hours (on-call vs non-on-call) are inherited from `pre_rota_results.targets_data`, produced by `src/lib/preRotaTargets.ts` (`buildTargetsData`). The algorithm does not recalculate these — it consumes them from `FinalRotaInput.doctors[].shiftTargets` (type: `DoctorShiftTarget[]`).

`targets_data` is rebuilt by `refreshPreRotaTargets` after every coordinator override mutation. It is always current at the time the coordinator triggers generation. The leave computation described in §5.2 is performed by the algorithm independently from `resolved_availability` for the V1 bucket floor guard — this is intentional: the guard must verify the live state, not trust a cached value.

### 5.4 Structural Eligibility Pre-Filter [Amendment A13]

After building the base Availability Matrix, a second pass stamps additional night-shift exclusions based on fixed availability patterns:

**Night shift pre-exclusions:**

1. **D-1 leave rule:** Night ending morning of D+1, where D+1 is hard-blocked with rest gap < minInterShiftRestH → exclude.
2. **D+1 leave rule (Rule B30 extension):** Pre-stamped upfront.
3. **LTFT mid-block rule:** Date D falls mid-block for LTFT pattern with canStart=false and canEnd=false → exclude all night shift keys for that date.
4. **Post-on-call night exclusion:** D-1 has on-call shift ending within minInterShiftRestH of night start → exclude. *(Applies between phases, not at initial pre-filter time.)*

**When is the pre-filter run?** Once before the Monte Carlo loop begins. Not re-run between allocation phases. REST-block propagation is handled dynamically via doctor state in all subsequent phases.

### 5.5 Performance Constraint

The Availability Matrix (including pre-filter layer) must be passed as a flat Map or bitmask. Doctor assignment state must be cloned per iteration; the static matrix is read-only and shared.

---

## 6. DEMAND MATRIX

### 6.1 Building the Matrix

For each date in the rota period:
1. Determine day-of-week (dayKey)
2. Find all `ShiftSlotEntry` items matching that dayKey
3. Each entry defines: which shift runs, how many doctors needed (min/target/max), and per-position requirements (slots[])
4. For BH dates: if `bhSameAsWeekend=true`, replace the day's shift entries with BH-specific config from `bhShiftRules`

### 6.2 Three-Tier Staffing

```
min:    absolute minimum — failing to reach this = UNFILLED (critical)
target: ideal staffing — aim for this in normal allocation
max:    ceiling — never exceed (null = no ceiling beyond target)
```

### 6.3 Per-Position Assignment

Each `ShiftSlotEntry.slots[]` defines requirements for specific doctor positions. When filling a shift:
1. Fill constrained positions first (those with competency or grade requirements)
2. Fill unconstrained positions last
3. Each DayAssignment records the `slotIndex` it fills

---

## 7. COMPLETE RULESET (72 Rules)

### A. WTR HARD CONSTRAINTS (checked on EVERY assignment)

**A0. Single rostered assignment per date** [v2.6 — M1]

A doctor cannot have two rostered shift assignments on the same calendar date. Checked before WTR rule A3.

**Exception:** NROC + a separate resident shift on adjacent-day boundaries is governed by A18. A0 does not fire when A18 applies.

Checked in Check Sequence A (Step 0) and enforced in Phase 11 candidate selection.

**A1. 48h average working week — ENFORCED VIA TARGETS, NOT RUNTIME CHECK**

The 48h average is guaranteed structurally by target compliance (Rule D33). `computeShiftTargets()` calculates each doctor's total hour envelope as `maxHoursPerWeek × effectiveWeeks × WTE`.

- **AL and SL** are deducted from the **non-on-call bucket only** (no WTE scaling).
- **PL and ROT** are deducted from the **total hours envelope** proportionally across both buckets (WTE-scaled).
- **Lieu days** replace an already-assigned non-on-call shift slot. No double-counting.

A1 is an audit-level check only. Any breach must be flagged in `violations[]` but does not gate individual assignments.

**A2. 72h in any 168h rolling window**

Every shift assignment must not cause a breach in the 168h window anchored to that shift's clock times:

- **168h backward check:** Window = `[shiftEnd - 168h, shiftEnd]`. Sum all shifts in window. Partial overlap: `hoursInWindow = max(0, min(shiftEnd, windowEnd) - max(shiftStart, windowStart))`. Must be ≤ maxHoursIn168h (default 72h).
- **168h forward check:** Window = `[shiftStart, shiftStart + 168h]`. Same calculation.

**Leave is excluded.** AL/SL/PL/ROT/Lieu contribute 0h to these windows.

**For blocks:** For each night D in the proposed block, compute both windows including all other block nights. If any night D causes either window to exceed the limit → reject entire block.

**Note on cascade carry-forward:** Carry-forward (D35 Rule 1) can raise effective ceilings above `maxTargetHours`. A2 remains in force regardless — it is checked on every individual assignment attempt. A raised effective ceiling does not relax A2.

**A3. Minimum inter-shift rest** — Gap between previous rostered shift end and next start ≥ minInterShiftRestH (default 11h). Uses actual clock times across midnight.
- Does NOT apply to NROC.

**A4. Max consecutive nights** — Total consecutive nights (including adjacent blocks) ≤ maxConsecNights.

**A5. Max consecutive long shifts** — Consecutive badge.long shifts ≤ maxConsecLong.

**A6. Max consecutive long evening shifts** [v2.6 — M3] — Consecutive badge `long-evening` shifts ≤ `maxLongEveningConsec`. Badge set via `badge_long_evening` column on `shift_types` (DepartmentStep2). See Note 33 — inactive until DepartmentStep2 prompt is built.

**A7. Max consecutive shifts** — All shift types. ≤ maxConsecStandard. For night blocks: each night = one working day.

**A8. Rest after night block [v2.8 — F1]** — `restAfterNightsH` (default 46h) stamped immediately after the last night of ANY block, including 2-night blocks.

Block pre-validation must confirm the 46h REST window passes the following check for every date D within the window:

| Date D status in `resolved_availability` | A8 outcome |
|---|---|
| Committed shift assignment in DoctorState | **FAIL** — `A8_COMMITTED_SHIFT`. Reject entire block. |
| `AL` | **PASS** — stage lieu obligation `REST_ON_AL` per G55. Do not fail. |
| `SL` | **PASS** — stage lieu obligation `REST_ON_SL` per G56. Do not fail. |
| `LTFT` | **PASS** — stage lieu obligation `REST_ON_LTFT` per G57. Do not fail. |
| `NOC` | **PASS** — preference, compatible with REST. No action. |
| `PL` | **PASS** — physical absence from department; REST trivially satisfied. No action. |
| `ROT` | **PASS** — physical absence from department; REST trivially satisfied. No action. |
| `AVAILABLE` or `BH` | **PASS** — standard REST day. No action. |

Staged lieu obligations from AL/SL/LTFT overlaps are collected during the simulation phase and committed atomically only if the entire block passes Steps 1–3 (per Step 4 atomicity rule in Check Sequence B). If the block is rejected for any other reason, staged obligations are discarded.

**Why only committed shifts fail A8:** REST is a period of non-work. AL, SL, LTFT, NOC, PL, and ROT all represent states where the doctor is already not working — REST is compatible with each of them. Only a committed rostered shift genuinely prevents rest. AL/SL/LTFT specifically generate lieu obligations under G55–G57, which exist precisely to handle this scenario. The previous version of this rule incorrectly listed NOC, PL, and ROT as FAIL cases, making G55–G57 mathematically unreachable.

**REST window past rota period end:** If the 46h window extends beyond the rota end date, dates outside the period have no scheduling constraints and trivially pass. Do not fail A8 for post-period dates.

**A9. Rest after long shift block** — restAfterLongH after maxConsecLong consecutive long shifts.

**A10. Rest after standard shift block** — restAfterStandardH after maxConsecStandard consecutive shifts.

**A11. Rest after long evening block** — restAfterLongEveningH after maxLongEveningConsec consecutive long evenings.

**A12. Max shift length** — Any single shift ≤ maxShiftLengthH (default 13h). On-call up to 24h.

**A13. Weekend frequency** — `uniqueWeekendDaysWorked / 2 ≤ totalWeekendsInRota / weekendFrequencyMax`.
- Weekend day = any Saturday or Sunday where a shift overlaps 00:00–23:59 of that calendar day. Each calendar day counted once maximum.
- A 3N Fri–Sun block counts as 2 weekend days (Sat + Sun). Friday is not a weekend day.
- REST weekends do NOT count toward this total.

**A14. NROC: max per 7 days** [v2.6 — M4] — NROC only. Maximum NROC shifts in any 168-hour rolling window ≤ `oncall.maxPer7Days` (default 3). Window identical in construction to A2.

**A15. NROC: no consecutive (except Sat→Sun)** — NROC only. If `oncall.noConsecExceptWknd=true`, no consecutive NROC except Saturday followed by Sunday.

**A16. NROC: day-after max hours** — NROC only. Day after NROC: any rostered shift ≤ oncall.dayAfterMaxHours (default 10h).

**A17. NROC: day after last consecutive max hours** — NROC only. After final NROC in a consecutive sequence, following day ≤ oncall.dayAfterLastConsecMaxH.

**A18. No simultaneous NROC + rostered shift** — A doctor cannot have NROC and a separate rostered shift on the same date.

**A19. Per-position competency** — Doctor assigned to slot position N must meet that position's reqIac/reqIaoc/reqIcu from shift_slot_requirements.

**A20. Per-position grade restriction** — If slot has permittedGrades[] (non-empty), doctor's grade must be in the list.

**A21. Grade floor (shift-level fallback)** — If shift has reqMinGrade and no per-position requirements exist, at least one doctor must meet it.

### B. LEAVE & AVAILABILITY HARD CONSTRAINTS

**B22. AL hard-blocked** — No shifts. Counts as standard-day hours (non-on-call + WTR 48h). Does NOT count toward 168h rolling window.

**B23. SL hard-blocked** — Same as AL.

**B24. PL hard-blocked** [v2.6 — C4] — No shifts. Full absence: both buckets reduced proportionally (WTE-scaled). Does NOT count toward 168h rolling window.

**B25. ROT hard-blocked** [v2.6 — C4] — No shifts. Same accounting as PL. Does NOT count toward 168h rolling window.

**B26. LTFT day blocking** — Blocked for regular shifts. Night eligibility via canStart/canEnd (Section 9).

**B27. Night exemption** — exemptFromNights=true → never night shifts.

**B28. Weekend exemption** — exemptFromWeekends=true → never Sat/Sun shifts.

**B29. On-call exemption** — exemptFromOncall=true → never on-call shifts.

**B30. Night D+1 check** — Night on D requires D+1 not hard-blocked. If LTFT: requires canEnd=true. If NOC: blocked Pass 1.

### C. SOFT CONSTRAINTS (Pass 1 = treat as hard)

**C31. NOC dates** — Blocked in Pass 1. Future Pass 2 may override.

**C32. Max consecutive nights preference** — Respected if lower than WTR maxConsecNights.

### D. TARGET & FAIRNESS RULES

**D33. Per-shift-type ceiling** — HARD CAP from `DoctorShiftTarget.maxTargetHours`. Never exceed. Ceilings inherited from `pre_rota_results.targets_data` via `buildFinalRotaInput`. Under-allocation is handled by the cascade (D35), not by relaxing this ceiling.

**D34. Bucket separation** — On-call and non-on-call hours NEVER cross except via the one-way transfer in D35 Rule 3. This transfer occurs after all on-call shift types are exhausted within an iteration.

**D35. Per-shift-type cascade debt** [v2.7 — S1 — replaces previous fixed Checkpoint A/B mechanism]

The cascade manages under-allocation across all shift types and both buckets. It runs after every distinct shift type's allocation completes for all doctors, within each Monte Carlo iteration. All cascade state is ephemeral per-iteration — never written back to Phase 0 outputs (see note 27).

**Shift type priority order:** Determined by `isOncall` (on-call first) then `durationHours` descending (longest first). Identical to I67. Fixed per department configuration.

**Effective ceiling:** Each doctor's working ceiling per shift type. Starts as the Phase 0 `maxTargetHours` from `DoctorShiftTarget`. Raised by carry-forward debt from preceding types in the same bucket (Rule 1).

```
effectiveCeiling(doctor, T) = maxTargetHours(T) + debtCarriedForward(doctor, T)
```

**Rule 1 — Carry-forward (always, after backfill):**
After shift type T allocation completes and backfill (Rule 2) is exhausted:
```
debt(doctor, T) = effectiveCeiling(doctor, T) - actualHours(doctor, T)
IF debt(doctor, T) > 0:
  effectiveCeiling(doctor, T+1) += debt(doctor, T)
```

**Rule 2 — Backfill (attempt before carry-forward):**
Before carrying debt to T+1, for each doctor with `debt(doctor, T) > 0`, attempt to assign additional shifts of already-allocated types in reverse priority order (highest/longest first). Backfill is backwards only — never into types not yet allocated.

```
FOR each doctor D with debt(D, T) > 0:
  FOR each already-allocated type P in reverse priority order (highest first):

    IF P has badge "night":
      Attempt one complete additional night block for D.
      Uses Dynamic Tiling Engine (§9) + full Check Sequence B.
      D33 ceiling check is embedded in Check Sequence B Step 2 —
        no separate ceiling pre-check required.
      IF block assigned:
        debt(D, T) -= blockHours
        Update staffingLevel and unfilledSlots as Phase 1/2 assignment
        Stamp REST blocks (E48) — identical to Phase 1/2 commitment
        [Confirmed: backfill night assignments are real allocations,
         clinically identical to Phase 1/2 assignments.]

    IF P is a day type:
      Attempt one additional shift of type P for D on any available date.
      Uses Check Sequence A.
      IF assigned: debt(D, T) -= shiftHours

    IF debt(D, T) ≤ 0: stop backfill for D.

  Carry remaining debt(D, T) to effectiveCeiling(D, T+1) [Rule 1].
```

**Night backfill constraint:** Block atomicity (E47) is absolute. A partial night block is never assigned as backfill. If the tiling engine finds no valid complete block, or Check Sequence B fails for all candidates, the backfill attempt for that night type silently fails and the next lower-priority type is tried.

**Rule 3 — Cross-bucket transfer (one-way, after on-call cascade exhausted):**
After the final on-call shift type's cascade checkpoint:
```
onCallDeficit(D) = total on-call envelope(D) - actual on-call hours assigned(D)

IF onCallDeficit(D) > 0:
  FOR each non-on-call shift type T_noc in priority order:
    effectiveCeiling(D, T_noc) += onCallDeficit(D) × targetPct(T_noc)
  (Proportional to non-on-call shift type target percentages —
   identical split to original non-on-call bucket carving.)
```
Transfer is permanent within the iteration. Non-on-call hours never transfer back. The doctor must reach their contractual total hours; the non-on-call bucket absorbs any hours the on-call bucket could not place.

**Rule 4 — Non-on-call deficit reporting:**
After the final non-on-call shift type's cascade checkpoint, any remaining per-doctor deficit is recorded:
```
unallocatedContractualHours(D) = non-on-call deficit remaining after all backfill
```
Recorded in `DoctorMetrics.unallocatedContractualHours`. Represents hours the algorithm could not place due to insufficient demand or WTR constraints. Surfaces for coordinator review. Not an algorithm failure — a planning signal.

**Single shift type per bucket (common case):** If the department has only one on-call day shift type, the on-call cascade has one checkpoint after Phases 3-4. Any remaining deficit crosses to non-on-call immediately. D35 degrades gracefully.

**D36. Leave-as-hours — bucket accounting** [v2.6 — C4]

- **AL, SL, BH:** Standard-day hours. Reduce non-on-call bucket only. Not WTE-scaled. Count towards WTR 48h average. Do NOT count toward 168h rolling window (A2).
- **PL, ROT:** Full absence. Reduce both buckets proportionally (by global oncall/non-oncall percentage split). WTE-scaled. Count towards WTR 48h average. Do NOT count toward 168h rolling window (A2).
- **Lieu:** Standard-day hours, non-on-call bucket only. Displaces an already-assigned non-on-call shift slot. No double-count (see G61).

Weekend dates contribute zero leave hours. BH-on-AL: date counts once as BH (H64).

**Source:** `resolved_availability` only. [Bug 5, C2]

**D37. Target deviation scoring (primary)** — Doctor furthest below target for this shift type wins.

**D38. Total hours deviation (tiebreaker)** — If tied: globally most under-assigned wins.

**D39. Random tiebreaker** — If all equal: random.

**D40. Competency priority boost** — If slot needs unfilled competency, matching candidates promoted.

**D41. Three-tier staffing** — Algorithm aims for `target`. Below `target` but above `min` = WARNING. Below `min` = CRITICAL unfilled.

### E. NIGHT BLOCK RULES

**E42. No single nights** — NEVER.

**E43. Block patterns** — Standard: 4N Mon–Thu, 2N-A Mon–Tue, 2N-B Wed–Thu, 3N Fri–Sun, 2N Sat–Sun. Exception: 2N Fri–Sat, 3N Sun–Tue (bridge). See Section 9.

**E44. Block sizing** — ≥4: try 4N. ≤3: use 2N-A+2N-B. =2: random 2N.

**E45. Weekend night priority** — 3N Fri–Sun → 2N Sat–Sun → 2N Fri–Sat.

**E46. Orphaned Sunday bridge** — 2N Fri–Sat orphans Sunday → process that week FIRST → 3N Sun–Tue + 2N-B Wed–Thu.

**E47. Block atomicity** — All nights in a block are evaluated and committed together. Never assign individual nights one at a time. If any check fails for any night in the block, the entire block is rejected for that doctor. This rule is absolute — it applies equally during Phase 1/2 allocation and during cascade backfill (D35 Rule 2).

**E48. REST stamping** — Immediate after last night.

### F. LTFT NIGHT FLEXIBILITY

**F49. canStart** — Start new block on LTFT day evening. First night only.

**F50. canEnd** — Finish block on LTFT day morning. Last night +1 only.

**F51. Mid-block rule** — LTFT day mid-block → ALWAYS blocked. No exception.

**F52. REST on LTFT → lieu** — Does NOT block the block. Lieu generated.

**F53. Safety check** — Full WTR validation (§8 Check Sequence B, Steps 2–3) runs on the whole block regardless of canStart/canEnd.

**F54. Multi-day LTFT** — Intersect per-day results. Must pass ALL LTFT days.

### G. REST & LIEU RULES

**G55. REST on AL [v2.8 — F1, F6]** — AL returned (ReturnedLeave) + lieu (REST_ON_AL). Triggered exclusively by the A8 REST window check when a night block's 46h REST period overlaps an AL date. Day shifts do not generate 46h REST obligations and therefore never trigger G55.

**G56. REST on SL [v2.8 — F1, F6]** — SL returned + lieu (REST_ON_SL). Same scope as G55 — night block REST windows only.

**G57. REST on LTFT [v2.8 — F1, F6]** — Lieu (REST_ON_LTFT). No leave to return. Same scope as G55 — night block REST windows only.

**G58. REST and LIEU days on weekends** [v2.6 — M2] — REST periods falling on Sat/Sun do NOT count toward weekend frequency (A13). LIEU days placed on Sat/Sun also do NOT count.

**G59. Lieu timing** — Obligations collected Phases 1–8. Placed Phase 9.

**G60. Lieu placement priority** [Amendment A11, v2.6 — C3 FOUR-STEP ESCALATION]

Lieu days MUST be returned. Steps executed in order:

1. Overwrite unassigned/available surplus dates within rota period. No doctor displacement. No state change to any doctor's hour counters.
2. Overwrite assigned non-on-call shifts where staffing > min (surplus exists). **The displaced doctor's hour counters for that shift type are decremented by the shift's durationHours.** Displaced doctor is NOT re-allocated. Staffing level decrements by 1.
3. Overwrite assigned non-on-call shifts where staffing = min. **The displaced doctor's hour counters decremented.** Displaced doctor NOT re-allocated. Generates CRITICAL UNFILLED locum gap (logged to `unfilledSlots` with severity `critical`). This is mandatory — a locum gap is clinically and contractually preferred over leaving a lieu day unreturned.
4. If mathematically impossible: log to `metrics.unplacedLieuDays`. No displacement.

**Displaced doctor state rule [C3]:** In Steps 2 and 3:
- `perShiftType[shiftKey].actualHours -= durationHours`
- `perShiftType[shiftKey].actualCount -= 1`
- `totalHoursAssigned -= durationHours`
- `nonOncallHours -= durationHours`
- `weekendDaysWorked` recomputed if shift fell on Sat/Sun

Evicted doctors are NEVER added back to a candidate pool.

**G61. Lieu counts as hours** — Standard-day hours → non-on-call + WTR 48h.

### H. BANK HOLIDAY RULES

**H62. BH shift config** — If `bhSameAsWeekend=true`: use `bhShiftRules` to determine which shifts run and staffing. BH shifts are typically on-call; shift hours count against the relevant (on-call or non-on-call) ceiling normally.

**H63. BH work → lieu** — Doctor working BH earns lieu (BH_WORKED).

**H64. BH on AL** [v2.6 — M5] — When BH date falls on doctor's AL, AL is NOT consumed. Doctor earns lieu (BH_ON_LEAVE). AL day remains in entitlement (logged to `returnedLeave`).

**H65. BH weekend frequency** — Counts only if BH on Sat/Sun.

### I. ALLOCATION STRATEGY RULES

**I66. Randomised doctor order** — Within each phase, doctor evaluation order is randomly shuffled per Monte Carlo iteration.

**I67. Phase priority** — On-call before non-on-call. Within: weekend nights → weekday nights → weekend days → weekday days. Longest first. This priority order is also used by the cascade (D35) to determine backfill sequence — highest priority type is always tried first.

**I68. Resident before non-resident** — Resident on-call prioritised.

**I69. Per-shift-type cascade** [v2.7 — S7] — Under-allocation within each shift type is managed by the cascade debt mechanism (D35). Carry-forward raises effective ceilings for lower-priority shift types. Backfill attempts additional assignments in already-allocated types. Cross-bucket transfer handles residual on-call deficit. See D35 for the complete cascade specification.

**I70. Unfilled = acceptable** — Never violate hard constraint to fill.

**I71. Clock-time overlap** — ALL shifts use actual start/end times. earliestAvailable = prevEnd + minInterShiftRestH.

**I72. Weekend pairing** — Default Fri–Sun. Prefer same doctor Sat+Sun. Fallback Sat–Sun or Fri–Sat.

---

## 8. PHASE SEQUENCE (Per Monte Carlo Iteration) [Amendment A8]

Each of the N iterations (default 1,000) executes this full sequence. Doctor evaluation order within each phase is randomly shuffled per the iteration's seed.

```
Phase 0:  Read resolved_availability for all doctors in config [Bug 5]
          Build Availability Matrix: canWork[doctorId][date][shiftKey]
          Apply Structural Eligibility Pre-Filter (§5.4) — stamp night exclusions
          Build demand matrix from ShiftSlotEntry[]
          Init doctor state templates
          Pre-compute leave hours (AL/SL/PL/ROT from resolved_availability)
          Set per-shift ceilings from FinalRotaInput.doctors[].shiftTargets (DoctorShiftTarget[])
          Run Phase 0 Validation Guards V1 and V2 (§5.0)
            V1: bucket floor — HALT if any doctor's bucket < 0
            V2: zero-competency AND zero-grade-restriction on-call slot — coordinator warning
          (All Phase 0 outputs are static — shared read-only across all iterations)

--- ITERATIONS BEGIN (clone doctor state per iteration) ---

Phase 1:  Weekend on-call night blocks (Dynamic Tiling Engine — see §9)
          Sorted by hardest-to-fill weeks first
Phase 2:  Weekday on-call night blocks (Dynamic Tiling Engine)
          Orphaned-Sunday weeks processed FIRST

★ CASCADE CHECKPOINT — On-call nights complete [D35]:
  Per doctor: compute on-call night debt.
  No backfill (no earlier on-call type exists).
  Carry forward: effectiveCeiling(D, on-call day type 1) += night debt.

Phase 3:  Weekend on-call day shifts (effective-ceiling-gated, longest shift type first)
Phase 4:  Weekday on-call day shifts (effective-ceiling-gated, longest shift type first)

          If multiple distinct on-call day shift types exist, phases 3-4 process
          all weekend+weekday instances of type 1 (longest) before type 2 begins.
          A sub-checkpoint runs between each type — see D35. For departments with
          a single on-call day shift type, no sub-checkpoint is needed.

★ CASCADE CHECKPOINT — On-call day types complete [D35]:
  Per doctor: backfill attempted for any remaining on-call day debt.
    Try on-call night block first (Check Sequence B + tiling engine).
    Try lower-priority on-call day types already allocated (Check Sequence A).
    Highest-priority type always attempted first (I67).
  Remaining on-call deficit → one-way transfer to non-on-call envelope [D35 Rule 3].
    Non-on-call shift type effective ceilings raised proportionally.

Phase 5:  Weekend non-on-call night blocks (Dynamic Tiling Engine — if any exist)
Phase 6:  Weekday non-on-call night blocks (Dynamic Tiling Engine — if any exist)

★ CASCADE CHECKPOINT — Non-on-call nights complete [D35]:
  Per doctor: compute non-on-call night debt.
  No backfill (no earlier non-on-call type).
  Carry forward: effectiveCeiling(D, non-on-call day type 1) +=
    non-on-call night debt + any transferred on-call deficit from above.

Phase 7:  Weekend non-on-call day shifts (effective-ceiling-gated, longest first)
Phase 8:  Weekday non-on-call day shifts (effective-ceiling-gated, longest first)

          If multiple distinct non-on-call day shift types exist, same sub-checkpoint
          logic as Phases 3-4 applies. See D35.

★ CASCADE CHECKPOINT — Non-on-call bucket exhausted [D35]:
  Per doctor: backfill attempted for any remaining non-on-call day debt.
    Try non-on-call night block first, then lower-priority day types.
  Any remaining deficit recorded as
    DoctorMetrics.unallocatedContractualHours [D35 Rule 4].

Phase 9:  Place lieu days (G60 four-step escalation)
Phase 10: Compute metrics + iteration score

--- ITERATION COMPLETE ---

Phase 11: Post-Monte-Carlo Local Search Swap [Amendment A15]
          (Runs ONCE on the winning rota only — outside the iteration loop)
          Fill residual critical unfilled slots via targeted doctor swaps
          See §8 Local Search Swap Phase below

Phase 12: Coordinator-Triggered 2-opt Local Search [v2.7 — S5]
          (Runs on demand from /admin/final-rota page — never automatic)
          See §8 Phase 12 below
```

### Monte Carlo Scoring Formula [Amendment A14 — Lexicographic]

At the end of each iteration, compare candidate rota A against the current best rota B using **strict lexicographic comparison**. Do not combine metrics into a single number.

```
Tier 1 — totalUnfilledCritical:
  A.critical < B.critical → A wins unconditionally. Update best.
  A.critical > B.critical → B retained unconditionally.
  Equal                   → proceed to Tier 2.

Tier 2 — totalUnfilledWarning:
  A.warning < B.warning   → A wins unconditionally. Update best.
  A.warning > B.warning   → B retained unconditionally.
  Equal                   → proceed to Tier 3.

Tier 3 — fairnessDeviationMetric:
  Lower value wins. If identical → retain existing best (no change).
```

Where `fairnessDeviationMetric` is the **sum of WTE-normalised squared percentage deviations** across all doctors [v2.7 — S4]:

```
fairnessDeviationMetric = Sum over all doctors D:
  IF targetTotalHours(D) > 0:
    ((actualTotalHours(D) - targetTotalHours(D)) / targetTotalHours(D))²
  ELSE:
    0   ← zero-guard: a doctor with zero target contributes nothing
```

**Why percentage deviation, not SSD:** The previous sum-of-squared-deviations formula treated a 10h overage identically for a 1.0 WTE doctor (target ~520h, 1.9% error) and a 0.5 WTE LTFT doctor (target ~260h, 3.8% error). This is heteroskedastic: equal absolute deviations are not equal proportional burdens. Percentage deviation is scale-invariant — a 3.8% error is scored identically for any WTE level.

**Why not the formula `((Actual − Target) / WTE_Percent)²`:** That formula divides by WTE decimal (e.g. 0.5), amplifying LTFT penalties fourfold rather than normalising them. The direction was inverted. Correct normalisation divides by Target (total expected hours), not by WTE_Percent.

**Tier 1 and Tier 2 are unchanged.** Tier 3 is a tiebreaker only. No fairness improvement compensates for a single additional critical unfilled slot.

After all N iterations: select the highest-ranked rota. Pass it to Phase 11.

### Local Search Swap Phase [Amendment A15 — patched v2.5]

Executes after the Monte Carlo loop completes on the winning rota only. Never runs inside the iteration loop.

**Purpose:** Fix residual critical gaps caused by constructive greedy ordering.

**Night shift exclusion:** Night shifts are **never** candidates for swapping. Block atomicity (E47) prohibits partial reassignment. This exclusion is absolute.

**Algorithm:**

```
INPUT: winningRota, availabilityMatrix (read-only, Phase 0 output)

initialUnfilledCritical = count of critical unfilled slots in winningRota
passCount = 0
swapsMadeThisPass = 1  ← initialise > 0 to enter loop

WHILE swapsMadeThisPass > 0 AND passCount < initialUnfilledCritical:
  swapsMadeThisPass = 0
  passCount += 1

  FOR each date D in the rota period (chronological order):
    FOR each shift S on date D where:
      staffingLevel(S, D) < staffing.min             ← critical unfilled
      AND S.shiftKey does NOT have badge "night"     ← E47 guard

      candidateDoctors = doctors where:
        availabilityMatrix[doctorId][D][S.shiftKey].canWork = true
        AND doctorId has NO assignments of ANY shiftKey on date D  [C1]

      FOR each candidate C in candidateDoctors:
        surplusShifts = shifts T on any date D2 ≠ D where:
          C is assigned to T in winningRota
          AND staffingLevel(T, D2) > staffing.min    ← surplus gate
          AND T.shiftKey does NOT have badge "night" ← E47 guard
          AND T.isOncall == S.isOncall               ← [A15-Fix1] bucket parity
          AND D2 NOT in period.bankHolidayDates       ← [A15-Fix3] BH integrity
          AND lieuDays has no entry for (C.doctorId, D2) ← [A15-Fix3] lieu integrity

        FOR each surplusShift T on date D2:
          CLONE C's DoctorState
          Apply un-assignment of T on D2 to clone
          Apply assignment of S on D to clone

          Run Check Sequence A (§8) against clone for date D

          IF check passes:
            COMMIT swap to winningRota
            UPDATE staffingLevel(S, D) — increment by 1
            UPDATE staffingLevel(T, D2) — decrement by 1
            RECOMPUTE REST blocks and full WTR state for doctor C
              over the entire rota period [C7]
            APPEND to swapLog: { doctorId: C.doctorId, fromDate: D2,
                                 fromShiftKey: T.shiftKey, toDate: D,
                                 toShiftKey: S.shiftKey }
            swapsMadeThisPass += 1
            MARK S on D as filled
            CONTINUE to next unfilled slot [C8]
          ELSE:
            DISCARD clone. Try next surplusShift.

OUTPUT: winningRota with local improvements applied. swapLog[] populated.
```

**Termination proof:** Each committed swap strictly decreases `totalUnfilledCritical` by exactly 1 (surplus gate prevents new critical gaps). `totalUnfilledCritical` is a non-negative integer that strictly decreases on every productive pass. Hard cap = `initialUnfilledCritical`. Cycles are impossible. Loop terminates in all cases.

**Why no D2 validation is needed:** Removing shift T from D2 cannot create a sub-11h gap between assignments on D2−1 and D2+1. These are on different calendar days, separated by at minimum 24h. Check Sequence A at destination D is sufficient.

### Phase 12 — Coordinator-Triggered 2-opt Local Search [v2.7 — S5, PLACEHOLDER]

Phase 12 is distinct from Phase 11. It is a **coordinator-triggered action** on the `/admin/final-rota` output page. It is never automatic.

**Architecture decisions (locked for v2.9 implementation):**

1. **Trigger:** Button shown on `/admin/final-rota` only when Phase 11 output has `totalUnfilledCritical > 0`. Label: *"Attempt to fill remaining gaps."* Not shown if all critical gaps are resolved.

2. **Mechanism:** 2-opt chain swap — Doctor X moves from non-surplus shift T1 to critical gap S; Doctor Y moves from surplus shift T2 to fill T1. Both moves validated on a single **joint clone** of combined state before either is committed (atomicity requirement — if either move fails validation, neither is committed).

3. **Output:** A diff showing exactly which doctors move and where, with before/after staffing levels. Coordinator accepts or discards the entire diff atomically.

4. **REST recomputation:** Both Doctor X and Doctor Y require full REST/WTR state recomputation after a committed 2-opt swap. Y first (Y's placement at T1 must stabilise), then X (Check Sequence A at S references Y's updated state).

5. **Guards:** All Phase 11 guards apply to T2 (surplus gate, bucket parity A15-Fix1, BH/lieu exclusion A15-Fix3, night exclusion E47). T1 does not need to be surplus — that is the purpose of the chain. After the swap, T1 must not fall below its staffing minimum.

6. **Termination:** Each committed 2-opt swap reduces `totalUnfilledCritical` by exactly 1. Same monotonicity invariant as Phase 11.

7. **Night exclusion:** E47 applies absolutely — T1, T2, and S cannot be night shifts.

Full rule set, pseudo-code, and validation tests deferred to v2.9.

### Performance Constraints [Amendment A8, updated v2.9]

- **Default N = 1,000 iterations.** Caller-supplied via `options.iterations`. Bounds enforced by the UI: `MIN_ITERATIONS = 100`, `MAX_ITERATIONS = 50000`. Warning shown above `WARN_ABOVE_ITERATIONS = 10000`. See Note 17.
- **Cancellation, not timeout.** The algorithm does not self-terminate at a wall-clock limit in v1. The coordinator can stop generation at any time via the UI's Stop button, which triggers `options.shouldCancel`. The best result found so far is returned with `status: 'cancelled'`. Automatic timeout fallback is carried forward as D3 / D9 for v2.10.
- **Progress and cancel cadence.** `options.onProgress` fires every `PROGRESS_UPDATE_EVERY_ITERATIONS` (50) iterations. `options.shouldCancel` checked every `CANCEL_CHECK_EVERY_ITERATIONS` (10) iterations. Algorithm yields to the event loop (`await new Promise(r => setTimeout(r, 0))`) approximately every 100 iterations so worker messages can be received.
- **Availability Matrix is read-only and shared across iterations** — never clone it.
- **Doctor assignment state must be cloned per iteration** — never mutate a shared reference.
- **Use flat Maps rather than nested objects** to avoid deep-clone overhead in the per-iteration state copy.

### Check Sequences [Amendment A14]

There are **two distinct check sequences** depending on whether the assignment is a single shift or a night block. They must never be conflated.

---

#### A. Single-Shift Check Sequence (day shifts — Phases 3–4, 7–8)

0. **Same-day collision check** [v2.6 — A0] — Is the doctor already assigned to any other shift on this calendar date? → EXCLUDE.
1. **Ceiling check** — `currentHours + proposedShift.durationHours > effectiveCeiling` for this shift type? → EXCLUDE. Uses effectiveCeiling (Phase 0 ceiling + cascade carry-forward), not raw maxTargetHours.
2. **Availability Matrix check** — `canWork[doctorId][date][shiftKey]` = false? → EXCLUDE.
3. **Slot position check** — Does doctor meet this slot's competency + grade requirements? → EXCLUDE if not.
4. **Full WTR validation** — all applicable rules: A2 (168h window), A3 (inter-shift rest — not applicable if NROC), A5–A7 (consecutive counts), A12 (shift length), A13 (weekend frequency), A14–A18 (NROC rules — only if NROC).
5. If all pass → ASSIGN with slotIndex. If any fail → next candidate. If none → UNFILLED.

---

#### B. Night Block Check Sequence (Phases 1–2, 5–6, and cascade backfill)

Night shifts are **never assigned one at a time**. The entire block is evaluated atomically.

**Step 1 — Block Availability Gate (fast pre-screen)**

For every night D in the proposed block:
- `canWork[doctorId][D][nightShiftKey]` = false? → REJECT ENTIRE BLOCK immediately.

**Step 2 — Block-Level WTR Pre-Validation**

Simulate adding the entire block to the doctor's current state (without committing):

| Rule | Block-level check |
|---|---|
| **A2 (168h rolling window)** | For each night D: backward 168h window + forward 168h window. Sum committed hours + all block nights in each window ≤ 72h. If any night D breaches → reject entire block. |
| **A4 (max consecutive nights)** | Prior consecutive nights + block length + subsequent consecutive nights ≤ maxConsecNights. |
| **A7 (max consecutive shifts)** | priorConsecutiveDays + blockLength + subsequentConsecutiveDays ≤ maxConsecStandard. |
| **D33 (night shift ceiling)** [C6] | `currentNightHours + blockTotalHours ≤ effectiveCeiling` where effectiveCeiling is the cascade-adjusted ceiling for this shift type. On-call and non-on-call night ceilings are separate and never combined. |
| **A13 (weekend frequency)** | Count unique Sat/Sun calendar days in block → add to weekendDaysWorked → check ≤ weekendCap. |
| **A8 (post-block rest) [v2.8 — F1]** | For each date D in the 46h REST window: (a) if DoctorState has a committed assignment → **REJECT ENTIRE BLOCK** (`A8_COMMITTED_SHIFT`); (b) if status ∈ {`AL`, `SL`, `LTFT`} → stage lieu obligation per G55/G56/G57, **do not fail**; (c) if status ∈ {`NOC`, `PL`, `ROT`, `AVAILABLE`, `BH`} → **PASS**, no action; (d) dates beyond rota period end → **PASS** trivially. Staged obligations committed at Step 4; discarded if block rejected. |
| **C32 (max consec nights preference)** | Block length ≤ doctor's `soft.maxConsecNights` preference. |

If any check fails → **REJECT ENTIRE BLOCK** for this doctor.

**Step 3 — Slot Position Check**

Doctor must meet slot requirements for their assigned position on each night in the block.

If any slot fails → **REJECT ENTIRE BLOCK**.

**Step 4 — Commit or Reject**

If Steps 1–3 all pass → **COMMIT the entire block atomically**: assign all N nights, stamp REST period, commit any staged lieu obligations (G55–G57), generate any BH lieu, update doctor state.

If any step fails → try next candidate. If no candidates remain → mark all slots as CRITICAL UNFILLED.

---

## 9. DYNAMIC NIGHT TILING ENGINE (Phases 1–2) [Amendment A12]

### 9.1 Block Dictionary (By Priority Tier)

**Tier 1 — Ideal Standard (Penalty +0)**
- `4N Mon–Thu`: Nights Mon, Tue, Wed, Thu. Ends Fri AM. REST Fri–Sat.
- `3N Fri–Sun`: Nights Fri, Sat, Sun. Ends Mon AM. REST Mon–Tue.

**Tier 2 — Acceptable Alternative / LTFT Relief (Penalty +10)**
- `3N Mon–Wed`: Nights Mon, Tue, Wed. Ends Thu AM. REST Thu–Fri.
- `3N Wed–Fri`: Nights Wed, Thu, Fri. Ends Sat AM. REST Sat–Sun.
- `3N Sun–Tue`: Bridge block. Ends Wed AM. REST Wed–Thu.

**Tier 3 — Sub-optimal / Hard Fragmentation (Penalty +25)**
- `2N Mon–Tue`
- `2N Wed–Thu`
- `2N Fri–Sat`
- `2N Sat–Sun`
- Splitting a weekend (using `2N Fri–Sat` + `2N Sat–Sun` instead of a 3N block) adds an additional **+50 penalty** on top of the Tier 3 base.

### 9.2 Tiling Rules

For each week:
1. Generate all valid combinatorial tilings of the 7 days using the dictionary.
2. Filter out any tiling that leaves an orphaned night (a single night with no valid block partner).
3. Attempt to assign doctors to blocks using the Availability Matrix and on-call ceiling.
4. Score valid assignments using dictionary penalties.
5. Lock in the lowest-penalty valid tiling.

**Fallback:** If no tiling can cover the week without leaving an orphaned night or violating WTR, flag the highest-penalty gaps as `CRITICAL UNFILLED`. Do not assign an isolated single night under any circumstances (Rule E42).

### 9.3 LTFT Night Block Decision Logic

This table is authoritative. For each block pattern and each possible LTFT day off, the disposition is fixed:

**Monday off:**
- `4N Mon–Thu`: Mon = FIRST night → requires `can_start_nights = true`
- `2N-A Mon–Tue`: Mon = FIRST night → requires `can_start_nights = true`
- `2N-B Wed–Thu`: No overlap → OK
- `3N Fri–Sun`: Ends Mon AM → requires `can_end_nights = true`. If false → fallback `2N Fri–Sat`
- `3N Sun–Tue`: Mon = MID-BLOCK → **ALWAYS BLOCKED**

**Tuesday off:**
- `4N Mon–Thu`: Tue = MID-BLOCK → **ALWAYS BLOCKED**
- `2N-A Mon–Tue`: Tue = LAST night + morning-after → requires both `can_start_nights = true` AND `can_end_nights = true`
- `2N-B Wed–Thu`: No overlap → OK
- `3N Fri–Sun`: REST falls Tue → lieu generated. Block not blocked. OK.
- `3N Sun–Tue`: Tue = LAST night → requires `can_start_nights = true`

**Wednesday off:**
- `4N Mon–Thu`: Wed = MID-BLOCK → **ALWAYS BLOCKED**
- `2N-A Mon–Tue`: Ends Wed AM → requires `can_end_nights = true`
- `2N-B Wed–Thu`: Wed = FIRST night → requires `can_start_nights = true`
- `3N Fri–Sun`: No overlap → OK
- `3N Sun–Tue`: Ends Wed AM → requires `can_end_nights = true`

**Thursday off:**
- `4N Mon–Thu`: Thu = LAST night → requires `can_start_nights = true`
- `2N-A Mon–Tue`: No overlap → OK
- `2N-B Wed–Thu`: Thu = LAST night + morning-after → requires both `can_start_nights = true` AND `can_end_nights = true`
- `3N Fri–Sun`: No overlap → OK
- `3N Sun–Tue`: REST falls Thu → lieu generated. Block not blocked. OK.

**Friday off:**
- `4N Mon–Thu`: Ends Fri AM → requires `can_end_nights = true`
- `2N-A Mon–Tue`: No overlap → OK
- `2N-B Wed–Thu`: Ends Fri AM → requires `can_end_nights = true`
- `3N Fri–Sun`: Fri = FIRST night → requires `can_start_nights = true`
- `2N Sat–Sun`: No overlap → OK
- `2N Fri–Sat`: Fri = FIRST night → requires `can_start_nights = true`

**Multi-day LTFT (two or more days off):** Intersect per-day dispositions. Must pass ALL days. If any day is MID-BLOCK, the entire block is blocked regardless of other days.

---

## 10. WEEKEND FREQUENCY FORMULA

```
For each Saturday: did ANY shift overlap Sat 00:00–23:59? Count 1.
For each Sunday: same. Each day max once.
(Night Fri 21:00→Sat 07:00 overlaps Saturday and counts.)

equivalentFullWeekends = weekendDaysWorked / 2
Check: equivalentFullWeekends ≤ totalWeekendsInRota / weekendFrequencyMax
```

---

## 11. CANDIDATE SCORING (Per-Assignment, Within Each Iteration)

These layers rank eligible candidates after the check sequences in §8 have already excluded invalid doctors.

**[v2.9 — G11] Scope clarification:** The scoring layers in this section apply only during **construction within a single Monte Carlo iteration** — they answer the question "given this slot, which eligible doctor do I pick?" They are entirely distinct from the **lexicographic Monte Carlo comparison** (§8 A14), which answers the question "given two completed rotas, which is better?" The Monte Carlo comparison uses only `RotaScore` (tiers 1–3). The candidate scoring layers feed into which iteration produces the best rota; they do not weight iterations against each other.

### For night blocks (after Block Check Sequence B passes)

### Layer 0: Hard Gates (applied in Check Sequence B — candidates reaching scoring have already passed)
- All nights in block available in matrix ✓
- Block-level WTR pre-validation passed ✓
- All slot positions met for all nights in block ✓

### Layer 1: Block Competency Priority
If any slot in the block requires an unfilled competency, doctors with that competency are promoted.

### Layer 2: Night Target Deviation (Primary)
`nightDeviation = currentNightHours − targetNightHours`. Lowest wins.

### Layer 3: Total Hours Deviation (Tiebreaker)
If tied: `totalHoursAssigned − targetTotalHours`. Lowest wins.

### Layer 4: Block Penalty Awareness
Among equally-scored candidates, prefer the candidate that allows a higher-tier block (lower penalty) to be used for the remaining unassigned nights in the same week.

### Layer 5: Random Tiebreaker
Seeded by current Monte Carlo iteration.

---

### For day shifts (after Single-Shift Check Sequence A passes)

### Layer 0: Hard Gates (applied in Check Sequence A)
- Ceiling not exceeded ✓
- Availability Matrix = true ✓
- Slot position requirements met ✓
- WTR rules pass ✓

### Layer 1: Slot Position — Constrained First
Fill the most constrained slots first. Unconstrained positions filled last.

### Layer 2: Competency Priority
If slot needs an unfilled competency, doctors with that competency are promoted.

### Layer 3: Target Deviation (Primary)
`shiftDeviation = actualCount − targetCount` for this shift type. Lowest wins.

### Layer 4: Total Hours Deviation (Tiebreaker)
If tied: `totalHoursAssigned − targetTotalHours`. Lowest wins.

### Layer 5: Random Tiebreaker
Seeded by current Monte Carlo iteration.

---

## 12. DATABASE MIGRATION

**[v2.9 — G5] This replaces the v2.8 migration entirely.** The schema below matches the deployed `20260422000001_create_final_rota_results.sql` migration in the repo. Multiple results per config are permitted — the UI queries `ORDER BY generated_at DESC LIMIT 1` for the latest. RLS is scoped to coordinator ownership via `rota_configs.owned_by`.

```sql
-- final_rota_results: stores each completed or cancelled rota generation run.
-- No UNIQUE constraint on rota_config_id — multiple runs per config are expected.

CREATE TABLE IF NOT EXISTS final_rota_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_config_id        uuid NOT NULL REFERENCES rota_configs(id),
  generated_at          timestamptz NOT NULL DEFAULT now(),
  status                text NOT NULL CHECK (status IN
                          ('complete', 'complete_with_gaps', 'failed', 'cancelled')),
  iterations_completed  integer NOT NULL DEFAULT 0,
  iterations_target     integer NOT NULL DEFAULT 0,
  runtime_ms            integer NOT NULL DEFAULT 0,
  assignments           jsonb NOT NULL DEFAULT '{}',   -- Record<ISO date, DayAssignment[]>
  score                 jsonb NOT NULL DEFAULT '{}',   -- RotaScore
  per_doctor            jsonb NOT NULL DEFAULT '[]',   -- PerDoctorMetrics[]
  swap_log              jsonb NOT NULL DEFAULT '[]',   -- SwapLogEntry[]
  violations            jsonb NOT NULL DEFAULT '[]',   -- string[] — rule IDs
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE final_rota_results ENABLE ROW LEVEL SECURITY;

-- Coordinator-scoped policy: access via rota_configs ownership
CREATE POLICY "Coordinator access to own configs"
  ON final_rota_results
  FOR ALL
  USING (
    rota_config_id IN (
      SELECT id FROM rota_configs WHERE owned_by = auth.uid()::text
    )
  )
  WITH CHECK (
    rota_config_id IN (
      SELECT id FROM rota_configs WHERE owned_by = auth.uid()::text
    )
  );
```

**JSONB column shapes** — all types defined in §4.2:

| Column | TypeScript type | Notes |
|---|---|---|
| `assignments` | `Record<string, DayAssignment[]>` | Keys are ISO dates YYYY-MM-DD. |
| `score` | `RotaScore` | `{ tier1CriticalUnfilled, tier2WarningUnfilled, tier3FairnessDeviation }`. |
| `per_doctor` | `PerDoctorMetrics[]` | One entry per doctor in the rota config. |
| `swap_log` | `SwapLogEntry[]` | Empty array `[]` is valid and common. |
| `violations` | `string[]` | Rule IDs only — e.g. `['A1_LOGGED', 'WARNING_V2_ZERO_COMPETENCY_ACKNOWLEDGED']`. |

**Snake_case ↔ camelCase mapping** (frontend write site):

```typescript
await supabase.from('final_rota_results').insert({
  rota_config_id:       result.configId,
  generated_at:         result.generatedAt,
  status:               result.status,
  iterations_completed: result.iterationsCompleted,
  iterations_target:    result.iterationsTarget,
  runtime_ms:           result.runtimeMs,
  assignments:          result.assignments,
  score:                result.score,
  per_doctor:           result.perDoctor,
  swap_log:             result.swapLog,
  violations:           result.violations,
});
```

**Removed from v2.8 schema:** `generated_by`, `unfilled_slots`, `rest_blocks`, `lieu_days`, `returned_leave`, `metrics`, `UNIQUE (rota_config_id)`. All except `unfilled_slots` may return in a future version if the UI surfaces them (D8). `unfilled_slots` is replaced functionally by `score.tier1CriticalUnfilled` and `score.tier2WarningUnfilled` — the counts are sufficient for current UI needs.

---

## 13. FILE STRUCTURE

**[v2.9 — G6]** Files marked *public boundary* contain types or code that crosses the Web Worker boundary. Files marked *algorithm internal* are pure TypeScript and never import from React, Supabase, or any browser API.

| File | Scope | Responsibility |
|------|---|---|
| `src/types/finalRota.ts` | Public boundary | Public types (§4.2): `FinalRotaResult`, `DayAssignment`, `RotaScore`, `PerDoctorMetrics`, `SwapLogEntry`, `GenerationProgress`, `WorkerInboundMessage`, `WorkerOutboundMessage`. |
| `src/lib/finalRotaTypes.ts` | Algorithm internal | Internal types (§4.1): `DoctorState`, `InternalDayAssignment`, `UnfilledSlot`, `RestBlock`, `LieuDay`, `ReturnedLeave`, `IterationResult`, `InternalDoctorMetrics`, `CheckResult`, `BucketFloors`, `AvailabilityMatrix`, `AvailabilityStatus`. |
| `src/lib/finalRotaPhase0.ts` | Algorithm internal | Availability Matrix builder (§5.1), leave hours pre-computation (§5.2), bucket floor guard (§5.0 V1), zero-competency warning collector (§5.0 V2). |
| `src/lib/finalRotaDemand.ts` | Algorithm internal | Demand matrix from `ShiftSlotEntry[]` (§6). |
| `src/lib/finalRotaDoctorState.ts` | Algorithm internal | Doctor state initialisation + mutation helpers. Cloned per MC iteration. |
| `src/lib/finalRotaWtr.ts` | Algorithm internal | WTR validation — all 72 rules. Check Sequence A (single shift) and Check Sequence B (night block). |
| `src/lib/finalRotaEligibility.ts` | Algorithm internal | Slot eligibility — competency (A19), grade (A20), exemptions (B27–B29), availability matrix lookup. |
| `src/lib/finalRotaNightBlocks.ts` | Algorithm internal | Dynamic Tiling Engine + LTFT decision table (§9). |
| `src/lib/finalRotaConstruction.ts` | Algorithm internal | Single-iteration greedy construction — runs Phases 1–10 in sequence, returns `IterationResult`. |
| `src/lib/finalRotaCascade.ts` | Algorithm internal | Per-shift-type cascade debt engine (D35): carry-forward, backfill, cross-bucket transfer. |
| `src/lib/finalRotaScoring.ts` | Algorithm internal | Candidate scoring layers (§11) + `scoreIteration()` producing `RotaScore` + `compareRotas()` lexicographic comparator (§8 A14). |
| `src/lib/finalRotaLieu.ts` | Algorithm internal | Lieu days + returned leave (G60 four-step escalation). |
| `src/lib/finalRotaSwap.ts` | Algorithm internal | Post-Monte-Carlo 1-opt swap phase — Phase 11 (§8 A15). |
| `src/lib/finalRotaLocalSearch2Opt.ts` | Algorithm internal | Coordinator-triggered 2-opt swap — Phase 12. Deferred to v2.10. |
| `src/lib/finalRotaGenerator.ts` | Public boundary | Main orchestrator: `generateFinalRota(input, options)` → `Promise<FinalRotaResult>`. Runs Phase 0 once, then Monte Carlo loop, then Phase 11. Calls `buildFinalResult()` at the boundary. See Note 34. |
| `src/lib/finalRotaGenerator.worker.ts` | Public boundary | Web Worker entry point. Handles `WorkerInboundMessage`, calls `generateFinalRota()`, posts `WorkerOutboundMessage`. See §17. |
| `src/lib/finalRotaRunner.ts` | Public boundary | Main-thread wrapper class `FinalRotaRunner` with `start()`, `cancel()`, `terminate()`, `onProgress()`, `onComplete()`, `onError()`. Also exports `DEFAULT_ITERATIONS`, `MIN_ITERATIONS`, `MAX_ITERATIONS`, `WARN_ABOVE_ITERATIONS`, `PROGRESS_UPDATE_EVERY_ITERATIONS`, `CANCEL_CHECK_EVERY_ITERATIONS`. |
| `src/pages/admin/FinalRota.tsx` | UI | Four-state page: Idle → Running → Result → Error. Consumes `FinalRotaRunner` and persists `FinalRotaResult` to DB on complete. |
| `supabase/migrations/20260422000001_create_final_rota_results.sql` | DB | `final_rota_results` table — see §12. |

---

## 14. DATA SOURCE MAP

| Data | Source Table | Via Interface | Notes |
|------|-------------|---------------|-------|
| Rota period dates | `rota_configs` | `PreRotaInput.period` | |
| Bank holidays | `bank_holidays` | `PreRotaInput.period.bankHolidayDates` | Only `isActive=true` |
| BH config | `rota_configs.bh_same_as_weekend` + `bh_shift_rules` | `PreRotaInput.period.bhSameAsWeekend/bhShiftRules` | Full fields: shift_key, name, start_time, end_time, target_doctors, included |
| Shift definitions | `shift_types` | `RotaConfigShift` → `ShiftSlotEntry` | Per-shift identity, times, badges |
| Per-day staffing | `shift_day_slots` | `ShiftSlotEntry.staffing` | min/target/max per day |
| Per-position requirements | `shift_slot_requirements` | `ShiftSlotEntry.slots[]` | Competency + grade per position |
| WTR rules | `wtr_settings` | `PreRotaInput.wtrConstraints` | All WTR parameters |
| Distribution targets | `rota_configs` + `shift_types.target_percentage` | `PreRotaInput.distributionTargets` | On-call/non-on-call split |
| Doctor identity + grade | `doctors` + `doctor_survey_responses` | `FinalRotaInput.doctors[]` | |
| **Doctor availability (canonical)** | **`resolved_availability`** | **`FinalRotaInput.resolvedAvailability[]` (pre-fetched by `buildFinalRotaInput()`)** | **[v3.0 — H2, H4] ONLY source for canWork decisions. Rows include `canStartNights`/`canEndNights` for LTFT dates. Algorithm iterates this array — no direct DB access from within the worker.** |
| Doctor competencies | `doctor_survey_responses.iac_achieved` etc. (flat) | `doctors[].hasIac/hasIaoc/hasIcu/hasTransfer` | [Bug 1, v2.8] Flat columns first (`iac_achieved` etc.), `competencies_json` fallback only when all flat = NULL |
| Doctor WTE | `doctor_survey_responses.wte_percent` | `doctors[].wtePct` | |
| AL entitlement | `doctor_survey_responses.al_entitlement` | `validateFinalRotaInput` (pre-generation warning only) | [v2.8 — F5] Not in FinalRotaInput — entitlement is a data-quality check, not an algorithm scheduling input |
| LTFT patterns | `ltft_patterns` | `doctors[].ltft.daysOff` | [v2.8 — F5] `isLtft = daysOff.length > 0` [Bug 9]. Relational tables first, JSONB fallback. LTFT flexibility flags (`canStartNights`/`canEndNights`) now in `resolvedAvailability` rows — no separate join needed by algorithm. |
| Exemptions | `doctor_survey_responses` | `doctors[].constraints.hard.exempt*` | |
| Training preferences | `training_requests` | `doctors[].trainingPreferences[]` | [Bug 6] Informational only — v1 |
| Dual specialty | `dual_specialties` | `doctors[].dualSpecialty / dualSpecialtyTypes` | [Bug 6] Informational only — v1 |
| **Shift targets per doctor** | **`pre_rota_results.targets_data`** | **`doctors[].shiftTargets: DoctorShiftTarget[]`** | **[v2.8 — F5] Leave-adjusted, override-aware ceilings. Field name: `shiftTypeId` (not `shiftId`). Replaces `computeShiftTargets()` call.** |

---

## 15. PHASED BUILD PLAN

### Phase A: Availability Matrix + Pre-Filter + Demand Matrix + Leave
- Read `resolved_availability` for config — build base `canWork[doctorId][date][shiftKey]` grid [Bug 5]
- Apply status → canWork mapping (§5.1 table)
- Apply Structural Eligibility Pre-Filter (§5.4)
- Build demand from ShiftSlotEntry[] with per-day staffing + per-position slots
- Init doctor state templates
- Compute leave hours using UTC-safe date arithmetic [Bug 8]
- Run Phase 0 validation guards V1 and V2 (§5.0)
- **Validation test:** Given 3 doctors, 2-week period, known leave pattern including one coordinator override — verify Matrix output matches hand-calculated grid AND override is reflected. Verify night shift on D-1 of AL is excluded by pre-filter. Verify V1 fires correctly for a doctor with AL exceeding non-on-call bucket. Verify V2 fires for a zero-competency AND zero-grade-restriction on-call slot only (not for grade-restricted slots).

### Phase B: Dynamic Tiling Engine + Block Pre-Validation + LTFT + REST + Bridge
- Implement block dictionary + recursive tiling with penalty scoring
- Block-Level WTR Pre-Validation (§8 Check Sequence B)
- LTFT decision table from §9.3
- Block atomicity (E47)
- REST stamping, lieu for REST-on-LTFT/AL/SL per corrected A8 table [v2.8 — F1], ReturnedLeave
- **Validation test 1:** Doctor with 30h already assigned in prior 5 days. Propose 4N block (48h). Verify block fails A2 (168h window = 78h > 72h) and is rejected before any night is committed.
- **Validation test 2:** Doctor with 10h night ceiling remaining. Propose 4N block (48h). Verify block fails D33 ceiling check and is rejected.
- **Validation test 3:** Doctor A: AL Mon–Wed. Doctor B: LTFT Friday off (canStart=false, canEnd=true). Verify engine selects correct blocks with correct penalties and lieu generation.
- **Validation test 4 [v2.8 — F1]:** Doctor has AL on the 2nd day of their 46h REST window. Verify block is NOT rejected. Verify lieu obligation is staged and committed at Step 4. Verify G55 fires correctly (AL returned + lieu generated).
- **Validation test 5 [v2.8 — F1]:** Doctor has a committed shift on the 1st day of their 46h REST window. Verify block IS rejected with reason `A8_COMMITTED_SHIFT`.
- **Validation test 6 [v2.8 — F1]:** Doctor has PL on the 2nd day of their 46h REST window. Verify block is NOT rejected and no lieu is generated.

### Phase C: WTR Engine
- All 72 rules including A1/A2 leave inclusion/exclusion distinction, long evening category, minInterShiftRestH, cross-block checks
- Single-shift check sequence (Check Sequence A) for day shifts
- **Validation test:** Twilight overlap, leave-in-48h (included), leave-in-168h (excluded), NROC rule A14.

### Phase D: Day Shifts + Cascade + Slot Positions
- Per-position assignment (fill constrained slots first)
- Per-shift-type cascade debt engine (D35): carry-forward, backfill (including night backfill via tiling engine), cross-bucket transfer, deficit reporting
- Three-tier staffing reporting
- `DoctorMetrics.unallocatedContractualHours` populated at end of non-on-call cascade
- **Validation test 1 (carry-forward):** Doctor A has on-call night ceiling 100h, assigned 70h → 30h night debt. Verify effectiveCeiling for on-call day shifts is raised by 30h before Phase 3.
- **Validation test 2 (backfill — nights):** After on-call day allocation, doctor has 30h on-call day debt and 20h remaining night ceiling. Verify cascade backfill assigns a complete 2N block (20h), reducing debt to 10h. Verify staffingLevel and unfilledSlots updated identically to Phase 1/2 assignment.
- **Validation test 3 (cross-bucket transfer):** Doctor has 40h remaining on-call deficit after all on-call types exhausted. Department non-on-call has two shift types with target 60%/40%. Verify effectiveCeiling raised by 24h and 16h respectively.
- **Validation test 4 (deficit reporting):** Doctor cannot be assigned non-on-call hours due to WTR constraints. Verify `unallocatedContractualHours > 0` in DoctorMetrics and correctly quantified.

### Phase E: Monte Carlo Runner
- Wrap Phase A–D sequence in N-iteration loop with per-iteration state cloning
- Implement **lexicographic scoring** (A14): strict Tier 1 → Tier 2 → Tier 3 comparison
- Tier 3 uses percentage deviation formula with zero-guard [v2.7 — S4]
- Implement `buildFinalResult()` boundary projection (§4.3)
- **Validation tests [v2.9 — G8]:**
  1. Run 100 iterations on a known dataset. Verify best-score rota is lexicographically ≤ all other iterations.
  2. Verify `options.onProgress` callback fires at `PROGRESS_UPDATE_EVERY_ITERATIONS` cadence and at loop end.
  3. Pass `shouldCancel = () => iteration > 3` — verify loop short-circuits, returns `status: 'cancelled'`, and `FinalRotaResult` contains the best result found up to that point.
  4. Run `grep -r "from 'react'\|supabase\|window\." src/lib/finalRota*.ts` — must return zero matches. Algorithm files must be pure Node.js runnable.
  5. Execute `npx tsx scripts/testAlgorithm.ts` — full fixture test suite passes.

### Phase F: Weekend + BH + Lieu (G60 four-step)
- Weekend-day formula, BH shift rules, lieu escalation steps 1–4

### Phase G: Full Integration
- Wire to Dashboard + DB + output page. Full metrics with per-slot utilisation and `unallocatedContractualHours`.
- 15+ doctors, 13 weeks. Compare to manual rota.

### Phase H: Local Search Swap (Amendment A15 — patched v2.5)
- Implement `finalRotaSwap.ts` — multi-pass `while (swapsMadeThisPass > 0)` loop
- Validation tests H1–H5 as specified in previous versions.

### Phase I: Coordinator-Triggered 2-opt (v2.9)
- Implement `finalRotaLocalSearch2Opt.ts`
- UI button on `/admin/final-rota` — only shown when Phase 11 leaves residual critical gaps
- Full rule set, pseudo-code, and validation tests to be specified in v2.9

---

## 16. IMPLEMENTATION NOTES

1. **ALWAYS search GitHub repo before writing code** — input layer exists in `src/lib/rotaGenInput.ts`. DO NOT modify without running the pre-submission checklist.
2. **Existing helpers:** `shiftEligibility.ts`, `shiftTargets.ts` (computeShiftTargets, computeWeekendCap). Note: `computeShiftTargets` is no longer called by `buildFinalRotaInput` — targets are read from `pre_rota_results.targets_data`.
3. **Normalised tables are canonical:** `unavailability_blocks` and `ltft_patterns` are the source of truth. JSONB fields on `doctor_survey_responses` exist for backward compatibility only.
4. **`resolved_availability` is the algorithm's availability source** — NOT survey JSONB, NOT `unavailability_blocks` directly. [Bug 5]
5. **Competency flags:** Read from flat columns (`iac_achieved`, `iaoc_achieved`, `icu_achieved`, `transfer_achieved`) first. Fall back to `competencies_json` only when all flat columns are NULL. [Bug 1, v2.8]
6. **`contractedHoursPerWeek` and `fairnessTargets.targetTotalHours`:** Read from `pre_rota_results.targets_data` (`DoctorTargets.contractedHoursPerWeek` and `DoctorTargets.totalMaxHours`). Both are leave-adjusted and override-aware. [Bug 2, Bug 3, v2.8]
7. **`shiftTargets`:** Type is `DoctorShiftTarget[]` from `src/lib/preRotaTypes.ts`. Read from `pre_rota_results.targets_data`. Field name for lookup is `shiftTypeId` (not `shiftId`). [v2.8 — F5]
8. **ROT dates must be in `constraints.hard.rotationDates`:** Expand from `unavailability_blocks` reason='rotation'. Hard-block in Availability Matrix. [Bug 4, v2.8]
9. **`isLtft` flag:** Must be `daysOff.length > 0`, not `wtePct < 100`. LTFT days from `ltft_patterns` table. [Bug 9, v2.8]
10. **All date arithmetic must use UTC:** `d.setUTCDate(d.getUTCDate() + 1)` throughout. [Bug 8, v2.8]
11. **`shiftTargets` type is `DoctorShiftTarget[]`** from `src/lib/preRotaTypes.ts`. Never treat as `any[]`. [Spec Issue 4, v2.8]
12. **Fallback path:** If `shift_day_slots` is empty for a shift type, synthesise from `shift_types` defaults for backward compatibility.
13. **Block pre-validation is a simulation, not a commit:** Check Sequence B Step 2 simulates against a cloned doctor state, then discards. Only commit if all checks pass. Staged lieu obligations (from A8 REST window) are also discarded on reject. [E47, v2.8]
14. **A1 is not a runtime check.** Enforced structurally by target compliance (D33). Log any breach in `violations[]` for audit only.
15. **NROC is a distinct shift type.** A3 does NOT apply to NROC. A14–A18 apply ONLY to NROC. Check `isNonResOncall` before applying these rules.
16. **A8 post-block REST check uses both `resolved_availability` status and DoctorState:** The static matrix provides the status code; DoctorState provides committed assignments. Both must be checked per the A8 table in §7. [A8, v2.8]
17. **Monte Carlo iteration count** [v2.9 — G7] — Caller-supplied via `options.iterations` on `generateFinalRota(input, options)`. Not a module constant in `finalRotaGenerator.ts`. The default value (`DEFAULT_ITERATIONS = 1000`), the enforced bounds (`MIN_ITERATIONS = 100`, `MAX_ITERATIONS = 50000`), and the warning threshold (`WARN_ABOVE_ITERATIONS = 10000`) are exported from `src/lib/finalRotaRunner.ts`. The UI reads these constants to populate the iteration-count input and the warning banner.
18. **No deep cloning of the Availability Matrix** — it is read-only. Clone only doctor assignment state per iteration.
19. **A1 vs A2 leave rule:** This distinction is clinically significant. Do not collapse into a single leave-hours variable.
20. **Lexicographic scoring (A14):** Implement as a `compareRotas(a: RotaScore, b: RotaScore): -1 | 0 | 1` function in `finalRotaScoring.ts`. Never implement as a linear arithmetic combination.
21. **Local search swap phase (A15 — patched v2.5):** Runs outside and after the Monte Carlo loop. Three guards on surplus shift T: (a) bucket parity [A15-Fix1]; (b) no night badge [E47]; (c) BH/lieu exclusion [A15-Fix3]. Check Sequence A on destination date D only. A15-Fix2 removed.
22. **`swapLog` is part of the output contract:** Written to `FinalRotaResult.swapLog[]` and serialised to `swap_log` JSONB column. Empty array `[]` is valid.
23. **Before any Lovable prompt:** Ask Matteo to re-sync GitHub project knowledge.

24. **Immutability of survey-derived base data** [v2.6 — M6]

Any helper that derives state by merging coordinator overrides with survey base data must NOT persist the merged state back over the survey base. Merges happen in memory, transiently, for computation only. `pre_rota_results.calendar_data` is produced ONLY by `generatePreRota()` — never written by any other code path.

25. **Phase 11 swap REST recomputation** [v2.6 — C7]

After each committed swap, the swapping doctor's REST blocks and full WTR state must be recomputed from scratch over the entire rota period. Encapsulate in `recomputeDoctorState(doctorId, rotaPeriod)` called from Phase 11 after each committed swap.

26. **Phase 11 same-day collision guard** [v2.6 — C1, A0]

Phase 11 candidate selection must exclude doctors already assigned to ANY shift on target date D.

27. **Cascade debt is per-iteration ephemeral state** [v2.7 — S1]

`effectiveCeiling(D, T)` values computed during the cascade are cloned per-iteration working state — never written back to `DoctorShiftTarget.maxTargetHours` or any Phase 0 output. Phase 0 outputs remain immutable (notes 18 and 24). The cascade operates purely on DoctorState within each iteration's execution scope. Implement in `finalRotaCascade.ts`.

28. **Backfill night assignments are real allocations** [v2.7 — D35 Rule 2]

Night blocks assigned during cascade backfill must: (a) update `staffingLevel(shift, date)` in the iteration's working state; (b) remove or reduce the corresponding entry in `unfilledSlots`; (c) stamp REST blocks in DoctorState via E48. The cascade phase that triggered the backfill is irrelevant to the output — all assignments are equal regardless of which phase committed them.

29. **Backfill uses existing check sequences without modification** [v2.7 — D35 Rule 2]

Night backfill → Check Sequence B (§8), full block validation. Day backfill → Check Sequence A (§8), full single-shift validation. D33 ceiling check in both sequences naturally enforces remaining effective ceiling. No new check sequence variants are needed.

30. **Tier 3 zero-guard** [v2.7 — S4]

The percentage deviation formula divides by `targetTotalHours(D)`. Implement as:
```typescript
const contribution = targetTotalHours > 0
  ? Math.pow((actual - target) / target, 2)
  : 0;
```
Never divide by zero. A doctor with `targetTotalHours = 0` contributes zero to the fairness metric.

31. **V2 zero-competency warning requires explicit coordinator acknowledgement** [v2.7 — S3]

The warning modal must block generation until the coordinator actively dismisses it. Log the acknowledgement event with timestamp. If the coordinator navigates away without acknowledging, generation does not proceed.

32. **Bridge block week-boundary hour allocation** [v2.8 — F3]

The `3N Sun–Tue` bridge block (§9.1 Tier 2) spans the Sunday/Monday calendar week boundary. When the WTR validation engine computes rolling 168h windows (A2) and when any per-week hour accumulator processes this block, each shift's hours must be allocated strictly to the calendar week containing that shift's UTC start date.

Concretely: Sunday night hours belong to the calendar week ending that Sunday; Monday and Tuesday night hours belong to the following calendar week. A single shift's hours must never be split across two calendar weeks.

**Practical impact:** The 168h rolling window (A2) is immune to this by construction — it is anchored to clock times, not calendar weeks. The risk is in any auxiliary per-week accumulator used for audit reporting, per-week fairness breakdowns, or debug output. These accumulators must apply this rule. Incorrect allocation would corrupt per-week hour tallies for both adjacent weeks without affecting the primary allocation logic, creating misleading audit output.

33. **`long-evening` badge — deferred to DepartmentStep2** [v2.8 — F4]

The `long-evening` badge must be stored as a `badge_long_evening` boolean column on `shift_types` and set automatically by DepartmentStep2 when a shift's `startTime < "16:00"` AND `endTime > "23:00"` (accounting for cross-midnight shifts which are "night" not "long-evening"). A migration adding the column and a Lovable prompt updating DepartmentStep2 are required.

Until that prompt is built and deployed:
- `ShiftSlotEntry.badges[]` will never contain `"long-evening"`
- Rules A6 (max consecutive long-evening) and A11 (rest after long-evening block) will be permanently inactive
- This is an acceptable v1 gap — very few NHS anaesthetic departments run a shift with exactly this time profile

`buildPreRotaInput` must NOT attempt to derive this badge at runtime from shift times, as it would diverge from the DB-stored value once the DepartmentStep2 prompt is built. The badge must come from the DB only.

34. **`generateFinalRota` function contract** [v2.9 — G9]

The exported function signature is permanent and identical across the stub (Prompt 2) and the real algorithm (Prompt 3):

```typescript
export async function generateFinalRota(
  input: FinalRotaInput,
  options: {
    iterations: number;
    onProgress?: (progress: GenerationProgress) => void;
    shouldCancel?: () => boolean;
  }
): Promise<FinalRotaResult>
```

Never modify this signature. The worker harness (`finalRotaGenerator.worker.ts`) and the runner (`finalRotaRunner.ts`) depend on it. When the real algorithm replaces the stub, exactly one file changes — `finalRotaGenerator.ts`. The harness, UI, DB schema, and everything else remain untouched.

The function must be `async` even though the algorithm is CPU-bound. The `async` is required to yield to the event loop periodically so `shouldCancel()` checks and `postMessage` progress updates can actually fire inside the worker.

35. **Internal / public type boundary** [v2.9 — G9]

Two rules govern type imports across the algorithm code:

- **Algorithm internal files** (`finalRotaPhase0.ts`, `finalRotaWtr.ts`, `finalRotaConstruction.ts`, `finalRotaSwap.ts`, `finalRotaScoring.ts`, `finalRotaCascade.ts`, `finalRotaLieu.ts`, `finalRotaEligibility.ts`, `finalRotaNightBlocks.ts`, `finalRotaDemand.ts`, `finalRotaDoctorState.ts`) import working types from `@/lib/finalRotaTypes.ts` only. They may also import `FinalRotaInput` from `@/lib/rotaGenInput`. They must not import from `@/types/finalRota.ts` — working state should never be shaped by what the UI happens to render today.

- **Boundary files** (`finalRotaGenerator.ts`, `finalRotaGenerator.worker.ts`, `finalRotaRunner.ts`) import public types from `@/types/finalRota.ts`. `finalRotaGenerator.ts` additionally imports internal types because it composes the internal state and then projects it via `buildFinalResult()`. Everything else touches only the public types.

Verification: `grep -r "@/types/finalRota" src/lib/finalRota*.ts` should return matches only in `finalRotaGenerator.ts`, `finalRotaGenerator.worker.ts`, and `finalRotaRunner.ts`. Any other match is a boundary violation.

---

## 17. RUNTIME ARCHITECTURE — WEB WORKER EXECUTION [v2.9 — G10]

This section summarises the runtime decisions that sit between the algorithm and the UI. The authoritative document is **`ROTAGEN_WORKER_RUNTIME_SPEC_v1_0.md`**. When the two documents disagree, that one wins.

### 17.1 Execution model

The algorithm runs client-side in a dedicated Web Worker, spawned by `FinalRotaRunner.start()` from the main thread. The worker is a module worker (`{ type: 'module' }`) constructed from `finalRotaGenerator.worker.ts`. One worker per generation run. When a run completes, cancels, or errors, the worker is terminated and a fresh one is spawned for the next run.

Rationale: Web Worker is free, has no execution cap, has no queue or polling infrastructure, and works identically with the pure-TypeScript algorithm that runs in Node.js during testing. The function signature (Note 34) is compute-platform-agnostic — if measurement shows NHS hardware is too slow, the same function can move to a Trigger.dev or Railway endpoint with zero algorithm code changes. This decision is revisited via the Phase D measurement gate in the Worker Runtime Spec §15.

### 17.2 Message protocol

```
Main thread                          Worker
───────────                          ──────
  start(input, iterations)   ───►    { type: 'start', input, iterations }
                                        │
                                        ▼  generateFinalRota(input, options)
                                        │
                             ◄───    { type: 'progress', progress }  (repeated)
                                        │
  cancel()                   ───►    { type: 'cancel' }              (optional)
                                        │
                                        ▼  (loop exits on next check)
                             ◄───    { type: 'complete', result }
                                     OR
                             ◄───    { type: 'error', message }
```

`cancel` is received asynchronously. The worker sets a local flag; the algorithm's `shouldCancel` callback reads it. The loop exits at the next cancel check and returns a `FinalRotaResult` with `status: 'cancelled'` via the normal `'complete'` message.

### 17.3 Progress cadence

- `options.onProgress` fires every `PROGRESS_UPDATE_EVERY_ITERATIONS` (50) iterations and on final iteration. Values exported from `finalRotaRunner.ts`.
- `options.shouldCancel` checked every `CANCEL_CHECK_EVERY_ITERATIONS` (10) iterations. Finer-grained than progress because cancel UX needs to feel responsive.
- Additionally, the algorithm yields to the event loop (`await new Promise(r => setTimeout(r, 0))`) approximately every 100 iterations — otherwise the worker's message queue never drains and `cancel` is never seen.

### 17.4 UI state machine

`src/pages/admin/FinalRota.tsx` implements four states: `idle` → `running` → `result` → `error`.

| State | Entered on | Worker state | Exits via |
|---|---|---|---|
| `idle` | Route load, regenerate, error dismiss | No worker | Click Generate |
| `running` | `start()` called successfully | Worker active | `'complete'` → `result`, `'error'` → `error`, Stop click → still `running` until worker confirms cancel via `'complete'` with `status: 'cancelled'` |
| `result` | Worker posted `'complete'` | Worker terminated | Click Regenerate → `idle` |
| `error` | Worker posted `'error'`, OR pre-generation validation threw | Worker terminated | Dismiss → `idle`, Try Again → `running` |

`validateFinalRotaInput()` and `buildFinalRotaInput()` run on the main thread before the worker is spawned. If either throws, the page enters `error` state directly — the worker never starts. This keeps pre-generation validation errors surfaced cleanly.

### 17.5 Persistence

The UI writes the `FinalRotaResult` to `final_rota_results` from the main thread after the `'complete'` message is received. DB write failures are non-fatal — the result is still shown to the coordinator, and a console error is logged. This is deliberate: the algorithm succeeded, so the coordinator must see the output; a transient network failure should not destroy the work.

If the DB write must be made reliable in a future version, the pattern is: keep the `FinalRotaResult` in memory with a "Save" button that retries, OR move persistence into a `useMutation` with optimistic UI. Neither is needed in v1.

### 17.6 Runner lifecycle hazards

Three things to get right in `FinalRotaRunner`:

1. **Terminate on unmount.** `FinalRota.tsx` holds the runner in a ref and calls `runner.terminate()` in a `useEffect` cleanup. Without this, navigating away mid-generation leaks a worker.
2. **Terminate before restart.** `start()` must terminate any existing worker before spawning a new one. Otherwise repeated Generate clicks leak workers.
3. **Clear callbacks on terminate.** `terminate()` resets the callback arrays. Otherwise a stale closure from an abandoned run can fire after the component has unmounted and trigger React warnings.

All three are implemented in the deployed `finalRotaRunner.ts`.

---
