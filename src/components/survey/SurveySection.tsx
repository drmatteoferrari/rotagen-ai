import { ReactNode } from "react";

// ✅ Section 3 complete — SurveySection

interface SurveySectionProps {
  number: number;
  title: string;
  badge?: "high" | "medium" | "hard";
  children: ReactNode;
}

const badgeStyles = {
  high: "bg-[#0f766e]/10 text-[#0f766e]",
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
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
          {number}
        </div>
        <h3 className="text-white font-bold text-sm flex-1">{title}</h3>
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyles[badge]}`}>
            {badgeLabels[badge]}
          </span>
        )}
      </div>
      <div className="bg-white p-4">
        {children}
      </div>
    </div>
  );
}
