import { ReactNode } from "react";
import { Info, AlertTriangle, AlertOctagon } from "lucide-react";

interface InfoBoxProps {
  type?: "info" | "warn" | "danger";
  children: ReactNode;
}

const styles = {
  info: { bg: "bg-teal-50", border: "border-teal-200", icon: Info, iconColor: "text-teal-600" },
  warn: { bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle, iconColor: "text-amber-500" },
  danger: { bg: "bg-red-50", border: "border-red-200", icon: AlertOctagon, iconColor: "text-red-500" },
};

export function InfoBox({ type = "info", children }: InfoBoxProps) {
  const s = styles[type];
  const Icon = s.icon;
  return (
    <div className={`${s.bg} border ${s.border} rounded-lg p-3 flex gap-2.5 items-start`}>
      <Icon className={`h-4 w-4 ${s.iconColor} shrink-0 mt-0.5`} />
      <div className="text-sm text-card-foreground leading-relaxed">{children}</div>
    </div>
  );
}
