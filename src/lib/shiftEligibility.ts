// ✅ Section 7 complete

export interface EligibilityDoctor {
  id: string;
  hasIac: boolean;
  hasIaoc: boolean;
  hasIcu: boolean;
  grade: string | null;
}

export interface ShiftRequirements {
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqMinGrade: string | null;
  minDoctors: number;
  maxDoctors: number | null;
}

const GRADE_ORDER: Record<string, number> = {
  'CT1': 1,
  'CT2': 2,
  'CT3': 3,
  'ST4': 4,
  'ST5': 5,
  'ST6': 6,
  'ST7': 7,
  'ST8': 8,
  'ST9': 9,
  'SAS': 5,
  'Post-CCT Fellow': 8,
  'Consultant': 10,
  'Other': 1,
};

function gradeValue(grade: string | null): number {
  if (!grade) return 0;
  return GRADE_ORDER[grade] ?? 1;
}

export function isSlotCompositionValid(
  assignedDoctors: EligibilityDoctor[],
  requirements: ShiftRequirements
): boolean {
  const iacCount = assignedDoctors.filter((d) => d.hasIac).length;
  const iaocCount = assignedDoctors.filter((d) => d.hasIaoc).length;
  const icuCount = assignedDoctors.filter((d) => d.hasIcu).length;

  if (iacCount < requirements.reqIac) return false;
  if (iaocCount < requirements.reqIaoc) return false;
  if (icuCount < requirements.reqIcu) return false;

  if (requirements.reqMinGrade) {
    const requiredGradeValue = gradeValue(requirements.reqMinGrade);
    const maxGradeInSlot = Math.max(...assignedDoctors.map((d) => gradeValue(d.grade)));
    if (maxGradeInSlot < requiredGradeValue) return false;
  }

  return true;
}

export function getEligibleDoctors(
  availableDoctors: EligibilityDoctor[],
  requirements: ShiftRequirements
): EligibilityDoctor[] {
  const hasAnyRequirement =
    requirements.reqIac > 0 ||
    requirements.reqIaoc > 0 ||
    requirements.reqIcu > 0 ||
    requirements.reqMinGrade !== null;

  if (!hasAnyRequirement) return availableDoctors;

  return availableDoctors.filter((doctor) => {
    const meetsGrade = requirements.reqMinGrade
      ? gradeValue(doctor.grade) >= gradeValue(requirements.reqMinGrade)
      : true;
    const hasNeededCompetency =
      (requirements.reqIac > 0 && doctor.hasIac) ||
      (requirements.reqIaoc > 0 && doctor.hasIaoc) ||
      (requirements.reqIcu > 0 && doctor.hasIcu);
    return meetsGrade || hasNeededCompetency;
  });
}

export function canSlotBeFilled(
  availableDoctors: EligibilityDoctor[],
  requirements: ShiftRequirements
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

  if (availableIac < requirements.reqIac)
    return { possible: false, reason: `Need ${requirements.reqIac} IAC-competent doctor(s) — only ${availableIac} available` };
  if (availableIaoc < requirements.reqIaoc)
    return { possible: false, reason: `Need ${requirements.reqIaoc} IAOC-competent doctor(s) — only ${availableIaoc} available` };
  if (availableIcu < requirements.reqIcu)
    return { possible: false, reason: `Need ${requirements.reqIcu} ICU-competent doctor(s) — only ${availableIcu} available` };

  return { possible: true };
}
