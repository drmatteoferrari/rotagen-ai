import { ReactNode, useLayoutEffect } from "react";
import { useAdminShell } from "@/contexts/AdminShellContext";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  accentColor?: 'blue' | 'red' | 'yellow' | 'purple' | 'teal' | 'pink' | 'green';
}

export function AdminLayout({ children, title, subtitle, accentColor = 'blue' }: AdminLayoutProps) {
  const { setPageInfo } = useAdminShell();

  useLayoutEffect(() => {
    setPageInfo(title, subtitle, accentColor);
  }, [title, subtitle, accentColor, setPageInfo]);

  return <>{children}</>;
}
