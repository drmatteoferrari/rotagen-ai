export const GRADE_OPTIONS = [
  "CT1 (or ACCS)",
  "CT2 (or ACCS)",
  "CT3 (or ACCS)",
  "ST4",
  "ST5",
  "ST6",
  "ST7",
  "ST8",
  "ST9",
  "Staff Grade / Associate Specialist (SAS)",
  "Post-CCT Fellow",
  "Consultant",
  "Other",
] as const;

export type Grade = typeof GRADE_OPTIONS[number] | "";

export const GRADE_ORDER: Record<string, number> = Object.fromEntries(
  GRADE_OPTIONS.map((g, i) => [g, i])
);
