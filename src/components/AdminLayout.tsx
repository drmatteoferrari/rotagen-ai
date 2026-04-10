import { ReactNode, useLayoutEffect } from "react";
import { type LucideIcon } from "lucide-react";
import { useAdminShell } from "@/contexts/AdminShellContext";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  accentColor?: 'blue' | 'red' | 'yellow' | 'purple' | 'teal' | 'pink' | 'green';
  pageIcon?: LucideIcon;
  navBar?: ReactNode;
  fillHeight?: boolean;
}

export function AdminLayout({ children, title, subtitle, accentColor = 'blue', pageIcon, navBar, fillHeight }: AdminLayoutProps) {
  const { setPageInfo } = useAdminShell();

  useLayoutEffect(() => {
    setPageInfo(title, subtitle, accentColor, pageIcon);
  }, [title, subtitle, accentColor, pageIcon, setPageInfo]);

  if (navBar) {
    // Step pages: full-height flex column — content scrolls, nav bar pinned at bottom
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-6">
          {children}
        </div>
        {navBar}
      </div>
    );
  }

  // Non-step pages (Dashboard, Roster, Setup etc): scrollable with padding.
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-6">
      {children}
    </div>
  );
}
