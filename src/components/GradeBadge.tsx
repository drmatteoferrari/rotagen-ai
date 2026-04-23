import { canonicalGrade } from "@/lib/gradeOptions";
import { cn } from "@/lib/utils";

/**
 * Compact display labels for grade badges.
 * Designed to be space-efficient and visually scannable in tables/calendars.
 */
const GRADE_BADGE_LABEL: Record<string, string> = {
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
  "Post-CCT Fellow": "Post-CCT",
  Consultant: "Cons",
};

/**
 * Color tokens per grade family. Each badge uses a subtle tinted background
 * with matching foreground and border for a clinical, compact appearance.
 */
const GRADE_BADGE_STYLE: Record<string, string> = {
  // Core trainees — sky blue
  CT1: "bg-sky-50 text-sky-700 border-sky-200",
  CT2: "bg-sky-50 text-sky-700 border-sky-200",
  CT3: "bg-sky-50 text-sky-700 border-sky-200",
  // Specialty trainees — indigo
  ST4: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ST5: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ST6: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ST7: "bg-violet-50 text-violet-700 border-violet-200",
  ST8: "bg-violet-50 text-violet-700 border-violet-200",
  ST9: "bg-violet-50 text-violet-700 border-violet-200",
  // SAS — amber
  SAS: "bg-amber-50 text-amber-700 border-amber-200",
  // Post-CCT Fellow — teal
  "Post-CCT Fellow": "bg-teal-50 text-teal-700 border-teal-200",
  // Consultant — emerald
  Consultant: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const FALLBACK_STYLE = "bg-muted text-muted-foreground border-border";

export interface GradeBadgeProps {
  grade: string | null | undefined;
  className?: string;
  /** Render an em-dash placeholder when grade is empty. Default true. */
  showEmpty?: boolean;
  size?: "xs" | "sm";
}

export function GradeBadge({ grade, className, showEmpty = true, size = "sm" }: GradeBadgeProps) {
  const canonical = canonicalGrade(grade);

  if (!canonical) {
    if (!showEmpty) return null;
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const label = GRADE_BADGE_LABEL[canonical] ?? canonical;
  const colorClasses = GRADE_BADGE_STYLE[canonical] ?? FALLBACK_STYLE;
  const sizeClasses =
    size === "xs"
      ? "px-1.5 py-0 text-[9px] leading-[14px]"
      : "px-1.5 py-0.5 text-[10px] leading-[14px]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold tracking-tight whitespace-nowrap",
        sizeClasses,
        colorClasses,
        className,
      )}
    >
      {label}
    </span>
  );
}
