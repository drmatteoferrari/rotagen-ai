// src/lib/finalRotaEligibility.ts
// Stage 3f — Shift eligibility (spec v2.9 §7 A19–A20, B22–B30, C31).
//
// Given a doctor, a specific ShiftSlotEntry (shift × day-key), a slot
// position index within that shift, and an ISO date, decide whether the
// doctor can fill that position on that date. Hard-cap, pre-cascade
// eligibility — consumed by the Monte Carlo construction loop (Stage 3g)
// before Check Sequences A/B are invoked.
//
// Rules enforced (evaluation order, cheapest-first):
//   1. B22–B26 via AvailabilityMatrix (AL / SL / PL / ROT / LTFT)
//   2. C31   — NOC dates (Pass 1 hard-block; spec §7 line 984)
//   3. B27   — exemptFromNights
//   4. B28   — exemptFromWeekends
//   5. B29   — exemptFromOncall
//   6. B30   — Night D+1 check (D+1 not hard-blocked, not NOC)
//   7. A20   — per-position grade restriction (permittedGrades[])
//   8. A19   — per-position competency (reqIac / reqIaoc / reqIcu / reqTransfer)
//
// Out of scope for Stage 3f — handled elsewhere:
//   - A21   — shift-level grade-floor / "at least one doctor" check is
//              composition-level, not per-slot; no `reqMinGrade` exists on
//              ShiftSlotEntry (grade is per-position via permittedGrades).
//              Deferred to the composition validator in a later stage.
//   - B26 night-start + B30 LTFT-canEnd flexibility (§7 F-rules, §9.3) —
//              the Dynamic Tiling Engine owns canStartNightsOnDay /
//              canEndNightsOnDay overrides. Stage 3f rejects LTFT-day
//              assignments strictly; Stage 3h/3i will relax for eligible
//              night blocks.
//   - A0..A18, C32, D/E/F/G/H/I rules — Stage 3e (WTR), Stage 3g (cascade),
//              Stage 3h (tiling), Stage 3i (integration).
//
// Boundary rules (carried forward from Stages 3d/3e):
//   - No imports from '@/types/finalRota' (Note 35 — internal module).
//   - No imports from React, Supabase, or browser/Node globals. Web
//     Worker at runtime.
//   - UTC-only date arithmetic; never setDate / getDate.
//   - Reuses `canonicalGrade` from '@/lib/gradeOptions' (pure string
//     helper — verified free of React/Supabase/globals). Does NOT import
//     from '@/lib/shiftEligibility' (UI helper, different boundary).

import type { FinalRotaInput, ShiftSlotEntry } from './rotaGenInput';
import type { AvailabilityMatrix, AvailabilityStatus } from './finalRotaTypes';
import { canonicalGrade } from './gradeOptions';

type Doctor = FinalRotaInput['doctors'][0];

// ─── Private: status classification ───────────────────────────
// Enumerates every value of AvailabilityStatus so future additions
// force a compile-time update here. Phase 0 currently emits
// available / annual_leave / study / parental / rotation / ltft_off /
// bank_holiday; sick / blocked / noc are declared in the union but
// not produced — handled defensively.

const HARD_BLOCK_STATUSES: ReadonlySet<AvailabilityStatus> = new Set<AvailabilityStatus>([
  'annual_leave',  // B22
  'study',         // B23
  'parental',      // B24
  'rotation',      // B25
  'ltft_off',      // B26 (strict; tiling engine relaxes for night blocks)
  'sick',          // defensive — not emitted by Phase 0
  'blocked',       // defensive — not emitted by Phase 0
  'noc',           // defensive — C31 upstream also catches via nocDates[]
]);

function isHardBlocked(status: AvailabilityStatus | undefined): boolean {
  // Missing entries (date outside period) are treated as hard-blocked
  // to fail closed; callers pass only in-period dates in practice.
  if (status === undefined) return true;
  return HARD_BLOCK_STATUSES.has(status);
}

// ─── Private: UTC day math ────────────────────────────────────

function addDaysUtc(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

function isWeekendUtc(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6; // Sun or Sat
}

// ─── isSlotEligible ───────────────────────────────────────────
// Returns true if the doctor may be assigned to slot position
// `slotIndex` within `slot` (a single ShiftSlotEntry — shift × day-key)
// on `date`. The five-arg signature matches the Stage 3f prompt; the
// rota-period end date is optional and defaults to reading from
// `input.preRotaInput.period.endDate` via a helper wrapper — Stage 3g
// will supply it explicitly.

export function isSlotEligible(
  doctor: Doctor,
  slot: ShiftSlotEntry,
  slotIndex: number,
  date: string,
  matrix: AvailabilityMatrix,
  periodEndIso?: string,
): boolean {
  const doctorMatrix = matrix[doctor.doctorId];
  if (!doctorMatrix) return false; // unknown doctor — fail closed.

  // ── Rule 1 — B22–B26 via AvailabilityMatrix ───────────────
  // AL / SL / PL / ROT / LTFT (+ defensive sick/blocked/noc).
  // 'available' and 'bank_holiday' permit — spec treats BH as a
  // workable day unless an explicit block is present.
  if (isHardBlocked(doctorMatrix[date])) return false;

  // ── Rule 2 — C31: NOC dates ───────────────────────────────
  // Phase 0's matrix does not encode NOC; it's a soft preference
  // treated as hard in Pass 1 (spec §7 line 984). Read the list
  // directly from the doctor's soft constraints.
  const nocSet = new Set(doctor.constraints.soft.nocDates);
  if (nocSet.has(date)) return false;

  const isNight = slot.badges.includes('night');

  // ── Rule 3 — B27: night exemption ─────────────────────────
  if (isNight && doctor.constraints.hard.exemptFromNights) return false;

  // ── Rule 4 — B28: weekend exemption ───────────────────────
  if (isWeekendUtc(date) && doctor.constraints.hard.exemptFromWeekends) return false;

  // ── Rule 5 — B29: on-call exemption ───────────────────────
  if (slot.isOncall && doctor.constraints.hard.exemptFromOncall) return false;

  // ── Rule 6 — B30: Night D+1 check ─────────────────────────
  // A night starting on D extends into D+1 morning. Spec §7 B30
  // requires D+1 to be not hard-blocked; NOC on D+1 is a Pass 1
  // block per C31. LTFT-canEnd flexibility for LTFT-off D+1 is
  // owned by the Dynamic Tiling Engine (§9.3) and is NOT relaxed
  // here — Stage 3f rejects strictly, Tiling Engine overrides
  // for eligible night blocks in a later stage.
  //
  // Period boundary: pre-stamping semantics apply within-period
  // only (spec §7 line 827). If D+1 is past periodEndIso, treat
  // as trivially compatible — no scheduling constraint exists.
  if (isNight) {
    const nextIso = addDaysUtc(date, 1);
    const withinPeriod = periodEndIso === undefined || nextIso <= periodEndIso;
    if (withinPeriod) {
      if (isHardBlocked(doctorMatrix[nextIso])) return false;
      if (nocSet.has(nextIso)) return false;
    }
  }

  // ── Rule 7 — A20: per-position grade restriction ──────────
  // `slot.slots[slotIndex]` may be undefined — the data model
  // allows fewer SlotRequirement entries than staffing.target,
  // leaving trailing positions unconstrained (rotaGenInput.ts
  // line 33). Undefined → no grade restriction, no competency
  // requirement → skip rules 7 and 8.
  const slotDef = slot.slots[slotIndex];
  if (slotDef === undefined) return true;

  if (slotDef.permittedGrades.length > 0) {
    const canonical = canonicalGrade(doctor.grade);
    if (!canonical || !slotDef.permittedGrades.includes(canonical)) return false;
  }

  // ── Rule 8 — A19: per-position competency ─────────────────
  // Spec §7 A19 cites reqIac/reqIaoc/reqIcu only; the data model
  // adds reqTransfer (spec wording omission, not a defect — the
  // existing UI helper treats all four identically). reqX > 0
  // means this position needs one X-competent doctor; for a
  // single slot, the doctor must have hasX.
  if (slotDef.reqIac > 0 && !doctor.hasIac) return false;
  if (slotDef.reqIaoc > 0 && !doctor.hasIaoc) return false;
  if (slotDef.reqIcu > 0 && !doctor.hasIcu) return false;
  if (slotDef.reqTransfer > 0 && !doctor.hasTransfer) return false;

  return true;
}
