import { ReactNode } from "react";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
      // bottom-16 = 64px, safely clears the ~57px bottom nav on all devices
      <div className={cn("fixed bottom-16 left-0 right-0 z-40 flex items-center justify-between border-t border-border bg-card px-4 py-3 shadow-[0_-2px_10px_hsl(var(--foreground)/0.05)]", className)}>
        <div>{left ?? <div />}</div>
        <div>{right ?? <div />}</div>
      </div>
    );
  }

  // Desktop: static, sits naturally at the bottom of content
  return (
    <div className={cn("flex items-center justify-between pt-2 pb-6", className)}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
