import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StepNavBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function StepNavBar({ left, right, className }: StepNavBarProps) {
  return (
    <div className={cn(
      "shrink-0 w-full bg-card border-t border-border shadow-[0_-2px_10px_hsl(var(--foreground)/0.05)] px-4 py-3 flex items-center justify-between gap-3",
      className
    )}>
      <div>{left ?? <div />}</div>
      <div>{right ?? <div />}</div>
    </div>
  );
}
