import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StepNavBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function StepNavBar({ left, right, className }: StepNavBarProps) {
  return (
    <div className={cn("shrink-0 flex items-center justify-between border-t border-border bg-card px-4 py-3", className)}>
      <div>{left ?? <div />}</div>
      <div>{right ?? <div />}</div>
    </div>
  );
}
