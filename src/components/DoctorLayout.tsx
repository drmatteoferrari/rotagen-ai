import { ReactNode } from "react";

interface DoctorLayoutProps {
  children: ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  return (
    <div className="h-dvh bg-teal-50 flex flex-col overflow-hidden">
      <div className="w-full flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}
