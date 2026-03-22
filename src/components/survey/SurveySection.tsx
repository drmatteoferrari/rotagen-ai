import { ReactNode } from "react";

interface SurveySectionProps {
  number: number;
  title: string;
  badge?: "high" | "medium" | "hard";
  children: ReactNode;
}

const badgeStyles = {
  high: "bg-teal-50 text-teal-700 border border-teal-200",
  medium: "bg-blue-100 text-blue-700",
  hard: "bg-red-100 text-red-700",
};

const badgeLabels = {
  high: "HIGH PRIORITY",
  medium: "MEDIUM PRIORITY",
  hard: "HARD CONSTRAINT",
};

export function SurveySection({ number, title, badge, children }: SurveySectionProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {number}
        </div>
        <h3 className="text-xs sm:text-sm font-semibold text-card-foreground flex-1">{title}</h3>
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyles[badge]}`}>
            {badgeLabels[badge]}
          </span>
        )}
      </div>
      <div className="bg-card p-4">
        {children}
      </div>
    </div>
  );
}
