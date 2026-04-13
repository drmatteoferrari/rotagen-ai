export const GRADE_OPTIONS = [
  "CT1",
  "CT2",
  "CT3",
  "ST4",
  "ST5",
  "ST6",
  "ST7",
  "ST8",
  "ST9",
  "SAS",
  "Post-CCT Fellow",
  "Consultant",
] as const;

export type Grade = (typeof GRADE_OPTIONS)[number] | "";

export const GRADE_DISPLAY_LABELS: Record<string, string> = {
  CT1: "CT1 (or ACCS CT1)",
  CT2: "CT2 (or ACCS CT2)",
  CT3: "CT3 (or ACCS CT3)",
  ST4: "ST4",
  ST5: "ST5",
  ST6: "ST6",
  ST7: "ST7",
  ST8: "ST8",
  ST9: "ST9",
  SAS: "Staff Grade / Associate Specialist (SAS)",
  "Post-CCT Fellow": "Post-CCT Fellow",
  Consultant: "Consultant",
};

export const GRADE_CANONICAL: Record<string, string> = {
  CT1: "CT1",
  CT2: "CT2",
  CT3: "CT3",
  ST4: "ST4",
  ST5: "ST5",
  ST6: "ST6",
  ST7: "ST7",
  ST8: "ST8",
  ST9: "ST9",
  SAS: "SAS",
  "Post-CCT Fellow": "Post-CCT Fellow",
  Consultant: "Consultant",
  // Long-form legacy variants from old gradeOptions
  "CT1 (or ACCS)": "CT1",
  "CT2 (or ACCS)": "CT2",
  "CT3 (or ACCS)": "CT3",
  "Staff Grade / Associate Specialist (SAS)": "SAS",
  // Legacy Other — map to null sentinel so algorithm treats as ungraded
  Other: "",
};

export const GRADE_ORDER: Record<string, number> = {
  CT1: 1,
  CT2: 2,
  CT3: 3,
  ST4: 4,
  ST5: 5,
  ST6: 6,
  ST7: 7,
  ST8: 8,
  ST9: 9,
  SAS: 5,
  "Post-CCT Fellow": 8,
  Consultant: 10,
};

export function canonicalGrade(grade: string | null | undefined): string {
  if (!grade) return "";
  return GRADE_CANONICAL[grade] ?? grade;
}

export function gradeDisplayLabel(grade: string | null | undefined): string {
  if (!grade) return "";
  return GRADE_DISPLAY_LABELS[canonicalGrade(grade)] ?? grade;
}
