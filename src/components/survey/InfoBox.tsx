import { ReactNode } from "react";
import { Info, AlertTriangle, AlertOctagon } from "lucide-react";

// ✅ Section 3 complete — InfoBox

interface InfoBoxProps {
  type?: "info" | "warn" | "danger";
  children: ReactNode;
}

const styles = {
  info: { bg: "bg-blue-50", border: "border-l-blue-500", icon: Info, iconColor: "text-blue-500" },
  warn: { bg: "bg-amber-50", border: "border-l-amber-500", icon: AlertTriangle, iconColor: "text-amber-500" },
  danger: { bg: "bg-red-50", border: "border-l-red-500", icon: AlertOctagon, iconColor: "text-red-500" },
};

export function InfoBox({ type = "info", children }: InfoBoxProps) {
  const s = styles[type];
  const Icon = s.icon;
  return (
    <div className={`${s.bg} border-l-4 ${s.border} rounded-r-lg p-3 flex gap-2.5 items-start`}>
      <Icon className={`h-4 w-4 ${s.iconColor} shrink-0 mt-0.5`} />
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}
