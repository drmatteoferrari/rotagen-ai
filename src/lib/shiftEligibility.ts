import { canonicalGrade, GRADE_ORDER } from "@/lib/gradeOptions";

// ─── Doctor interface ─────────────────────────────────────────

export interface EligibilityDoctor {
  id: string;
  hasIac: boolean;
  hasIaoc: boolean;
  hasIcu: boolean;
  hasTransfer: boolean;
  grade: string | null;
}

// ─── Slot requirement (per individual doctor position) ────────

export interface SlotRequirement {
  slotIndex: number;
  label: string | null;
  permittedGrades: string[]; // [] = no restriction
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqTransfer: number;
}

// ─── Shift-level requirements (legacy + aggregate use) ────────
// Used by preRotaValidation for team-level feasibility checks.
// minDoctors / maxDoctors refer to the day-slot total, not per-slot.

export interface ShiftRequirements {
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqTransfer: number;
  minDoctors: number;
  maxDoctors: number | null;
  // Legacy — kept for backward compat with preRotaValidation.
  // Algorithm uses SlotRequirement.permittedGrades instead.
  reqMinGrade: string | null;
}

// ─── Core eligibility check: one doctor, one slot ────────────

export function isDoctorEligibleForSlot(doctor: EligibilityDoctor, slot: SlotRequirement): boolean {
  // Grade check — empty permittedGrades means no restriction
  if (slot.permittedGrades.length > 0) {
    const canonical = canonicalGrade(doctor.grade);
    if (!canonical || !slot.permittedGrades.includes(canonical)) return false;
  }

  // Competency check — doctor must satisfy ALL required competencies
  if (slot.reqIac > 0 && !doctor.hasIac) return false;
  if (slot.reqIaoc > 0 && !doctor.hasIaoc) return false;
  if (slot.reqIcu > 0 && !doctor.hasIcu) return false;
  if (slot.reqTransfer > 0 && !doctor.hasTransfer) return false;

  return true;
}

// ─── Eligible doctors for a slot ─────────────────────────────

export function getEligibleDoctorsForSlot(
  availableDoctors: EligibilityDoctor[],
  slot: SlotRequirement,
): EligibilityDoctor[] {
  return availableDoctors.filter((d) => isDoctorEligibleForSlot(d, slot));
}

// ─── Aggregate eligibility (legacy shift-level check) ────────
// Used by preRotaValidation team-level feasibility warnings.
// Checks whether a doctor is eligible for ANY slot in a shift
// given flat shift-level requirements (not per-slot).

export function getEligibleDoctors(
  availableDoctors: EligibilityDoctor[],
  requirements: ShiftRequirements,
): EligibilityDoctor[] {
  const hasAnyRequirement =
    requirements.reqIac > 0 ||
    requirements.reqIaoc > 0 ||
    requirements.reqIcu > 0 ||
    requirements.reqTransfer > 0 ||
    requirements.reqMinGrade !== null;

  if (!hasAnyRequirement) return availableDoctors;

  return availableDoctors.filter((doctor) => {
    const canonical = canonicalGrade(doctor.grade);
    const meetsGrade = requirements.reqMinGrade
      ? (GRADE_ORDER[canonical] ?? 0) >= (GRADE_ORDER[requirements.reqMinGrade] ?? 0)
      : true;
    const hasNeededCompetency =
      (requirements.reqIac > 0 && doctor.hasIac) ||
      (requirements.reqIaoc > 0 && doctor.hasIaoc) ||
      (requirements.reqIcu > 0 && doctor.hasIcu) ||
      (requirements.reqTransfer > 0 && doctor.hasTransfer);
    return meetsGrade || hasNeededCompetency;
  });
}

// ─── Slot composition validity ────────────────────────────────
// Checks whether a set of assigned doctors satisfies a slot's requirements.
// Used by the algorithm after assignment to verify correctness.

export function isSlotCompositionValid(assignedDoctors: EligibilityDoctor[], slot: SlotRequirement): boolean {
  // Grade check for each assigned doctor
  if (slot.permittedGrades.length > 0) {
    for (const doctor of assignedDoctors) {
      const canonical = canonicalGrade(doctor.grade);
      if (!canonical || !slot.permittedGrades.includes(canonical)) return false;
    }
  }

  // Competency aggregate check
  const iacCount = assignedDoctors.filter((d) => d.hasIac).length;
  const iaocCount = assignedDoctors.filter((d) => d.hasIaoc).length;
  const icuCount = assignedDoctors.filter((d) => d.hasIcu).length;
  const transferCount = assignedDoctors.filter((d) => d.hasTransfer).length;

  if (iacCount < slot.reqIac) return false;
  if (iaocCount < slot.reqIaoc) return false;
  if (icuCount < slot.reqIcu) return false;
  if (transferCount < slot.reqTransfer) return false;

  return true;
}

// ─── Feasibility check for a full day-slot ───────────────────
// Given available doctors and a list of slot requirements,
// checks whether all slots can theoretically be filled.
// Used by preRotaValidation and UI validation.

export function canDaySlotBeFilled(
  availableDoctors: EligibilityDoctor[],
  slots: SlotRequirement[],
  totalTarget: number,
): { possible: boolean; reason?: string } {
  // Check team size
  if (availableDoctors.length < totalTarget) {
    return {
      possible: false,
      reason: `Only ${availableDoctors.length} doctor(s) available — need ${totalTarget}`,
    };
  }

  // Check each constrained slot independently
  for (const slot of slots) {
    const eligible = getEligibleDoctorsForSlot(availableDoctors, slot);
    if (eligible.length === 0) {
      const label = slot.label ? `"${slot.label}"` : `slot ${slot.slotIndex + 1}`;
      const gradeDesc = slot.permittedGrades.length > 0 ? ` (grades: ${slot.permittedGrades.join(", ")})` : "";
      return {
        possible: false,
        reason: `No eligible doctor for ${label}${gradeDesc}`,
      };
    }
  }

  return { possible: true };
}

// ─── Legacy canSlotBeFilled ───────────────────────────────────
// Kept for backward compatibility with any existing callers.
// New code should use canDaySlotBeFilled instead.

export function canSlotBeFilled(
  availableDoctors: EligibilityDoctor[],
  requirements: ShiftRequirements,
): { possible: boolean; reason?: string } {
  const eligible = getEligibleDoctors(availableDoctors, requirements);

  if (eligible.length < requirements.minDoctors) {
    return {
      possible: false,
      reason: `Only ${eligible.length} eligible doctor(s) available — need ${requirements.minDoctors}`,
    };
  }

  const availableIac = availableDoctors.filter((d) => d.hasIac).length;
  const availableIaoc = availableDoctors.filter((d) => d.hasIaoc).length;
  const availableIcu = availableDoctors.filter((d) => d.hasIcu).length;
  const availableTransfer = availableDoctors.filter((d) => d.hasTransfer).length;

  if (availableIac < requirements.reqIac)
    return {
      possible: false,
      reason: `Need ${requirements.reqIac} IAC-competent doctor(s) — only ${availableIac} available`,
    };
  if (availableIaoc < requirements.reqIaoc)
    return {
      possible: false,
      reason: `Need ${requirements.reqIaoc} IAOC-competent doctor(s) — only ${availableIaoc} available`,
    };
  if (availableIcu < requirements.reqIcu)
    return {
      possible: false,
      reason: `Need ${requirements.reqIcu} ICU-competent doctor(s) — only ${availableIcu} available`,
    };
  if (availableTransfer < requirements.reqTransfer)
    return {
      possible: false,
      reason: `Need ${requirements.reqTransfer} transfer-trained doctor(s) — only ${availableTransfer} available`,
    };

  return { possible: true };
}
