import { ReactNode, useLayoutEffect } from "react";
import { type LucideIcon } from "lucide-react";
import { useAdminShell } from "@/contexts/AdminShellContext";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  accentColor?: 'blue' | 'red' | 'yellow' | 'purple' | 'teal' | 'pink' | 'green';
  pageIcon?: LucideIcon;
}

export function AdminLayout({ children, title, subtitle, accentColor = 'blue', pageIcon }: AdminLayoutProps) {
  const { setPageInfo } = useAdminShell();

  useLayoutEffect(() => {
    setPageInfo(title, subtitle, accentColor, pageIcon);
  }, [title, subtitle, accentColor, pageIcon, setPageInfo]);

  return <>{children}</>;
}
