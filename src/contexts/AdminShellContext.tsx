import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface AdminShellContextType {
  title: string;
  subtitle?: string;
  accentColor: string;
  setPageInfo: (title: string, subtitle?: string, accentColor?: string) => void;
}

const AdminShellContext = createContext<AdminShellContextType | null>(null);

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [accentColor, setAccentColor] = useState("blue");

  const setPageInfo = useCallback((t: string, s?: string, c?: string) => {
    setTitle(t);
    setSubtitle(s);
    setAccentColor(c ?? "blue");
  }, []);

  return (
    <AdminShellContext.Provider value={{ title, subtitle, accentColor, setPageInfo }}>
      {children}
    </AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext);
  if (!ctx) throw new Error("useAdminShell must be used within AdminShellProvider");
  return ctx;
}
