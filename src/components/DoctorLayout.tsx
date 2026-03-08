import { ReactNode } from "react";

interface DoctorLayoutProps {
  children: ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="relative flex h-[844px] w-full max-w-md flex-col overflow-hidden rounded-[2.5rem] border border-border bg-background shadow-2xl overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
