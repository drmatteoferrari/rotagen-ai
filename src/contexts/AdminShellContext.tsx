import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { type LucideIcon, Stethoscope } from "lucide-react";

interface AdminShellContextType {
  title: string;
  subtitle?: string;
  accentColor: string;
  pageIcon: LucideIcon;
  setPageInfo: (title: string, subtitle?: string, accentColor?: string, icon?: LucideIcon) => void;
}

const AdminShellContext = createContext<AdminShellContextType | null>(null);

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [accentColor, setAccentColor] = useState("blue");
  const [pageIcon, setPageIcon] = useState<LucideIcon>(() => Stethoscope);

  const setPageInfo = useCallback((t: string, s?: string, c?: string, icon?: LucideIcon) => {
    setTitle(t);
    setSubtitle(s);
    setAccentColor(c ?? "blue");
    setPageIcon(() => icon ?? Stethoscope);
  }, []);

  return (
    <AdminShellContext.Provider value={{ title, subtitle, accentColor, pageIcon, setPageInfo }}>
      {children}
    </AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext);
  if (!ctx) throw new Error("useAdminShell must be used within AdminShellProvider");
  return ctx;
}
