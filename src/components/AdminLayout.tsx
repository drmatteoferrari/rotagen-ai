import { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  CalendarDays,
  Users,
  LayoutDashboard,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Rota Period", url: "/admin/rota-period/step-1", icon: CalendarDays },
  { title: "Department", url: "/admin/department/step-1", icon: Settings },
  { title: "WTR", url: "/admin/wtr/step-1", icon: Stethoscope },
  { title: "Roster", url: "/admin/roster", icon: Users },
];

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (isMobile) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Stethoscope className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-card-foreground leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold uppercase">
                {user.username?.charAt(0) || "?"}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-3 w-3" />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20">{children}</main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card py-2 shadow-[0_-2px_10px_hsl(var(--foreground)/0.05)]">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.url.replace(/\/step-\d+$/, ""));
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end
                className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground transition-colors"
                activeClassName="text-primary"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Stethoscope className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-sidebar-accent-foreground tracking-tight">
              RotaGen
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-12 items-center justify-center border-t border-sidebar-border text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div>
            <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {user && (
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span>{user.username}</span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">Sign out <LogOut className="h-3.5 w-3.5" /></span>
            </button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
