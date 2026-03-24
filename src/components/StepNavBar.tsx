import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";

interface StepNavBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function StepNavBar({ left, right, className }: StepNavBarProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isSmall = isMobile || isTablet;

  if (isSmall) {
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

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-2px_10px_hsl(var(--foreground)/0.05)] px-4 py-3 flex items-center justify-between gap-3",
      className
    )}>
      <div>{left ?? <div />}</div>
      <div>{right ?? <div />}</div>
    </div>
  );
}
