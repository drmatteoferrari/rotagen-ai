import { ReactNode } from "react";

interface DoctorLayoutProps {
  children: ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-200 p-4">
      <div className="relative flex h-[844px] w-full max-w-md flex-col overflow-hidden rounded-[2.5rem] border border-slate-300 bg-[#f6f8f8] shadow-2xl">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
