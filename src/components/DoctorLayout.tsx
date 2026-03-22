import { ReactNode } from "react";

interface DoctorLayoutProps {
  children: ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  return (
    <div className="min-h-screen bg-teal-50 flex flex-col">
      <div className="w-full flex-1 flex flex-col mx-auto max-w-2xl">
        {children}
      </div>
    </div>
  );
}
