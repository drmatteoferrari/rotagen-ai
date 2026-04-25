import { NavLink } from "@/components/NavLink";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wand2,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminShell, AdminShellProvider } from "@/contexts/AdminShellContext";
import RotaGenLogo from "@/components/brand/RotaGenLogo";
import RotaGenIcon from "@/components/brand/RotaGenIcon";
import Dashboard from "@/pages/admin/Dashboard";

const navItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Setup",     url: "/admin/setup",     icon: Wand2 },
  { title: "Roster",    url: "/admin/roster",    icon: Users },
];

function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join("");
}

function PersistentDashboard() {
  const location = useLocation();
  const isActive = location.pathname === '/admin/dashboard';
  return <Dashboard isActive={isActive} />;
}

function AdminShellInner() {
  const { title, subtitle, accentColor, pageIcon } = useAdminShell();
  const bgColorMap: Record<string, string> = {
    blue:   '#eff6ff',
    red:    '#fff5f5',
    yellow: '#fefce8',
    purple: '#f5f3ff',
    teal:   '#f0fdfa',
    pink:   '#fdf4ff',
    green:  '#f0fdf4',
  };
  const bgColor = bgColorMap[accentColor] || '#eff6ff';

  const iconBgMap: Record<string, string> = {
    blue:   'bg-blue-100',
    red:    'bg-red-100',
    yellow: 'bg-amber-100',
    purple: 'bg-purple-100',
    teal:   'bg-teal-100',
    pink:   'bg-pink-100',
    green:  'bg-green-100',
  };
  const iconColorMap: Record<string, string> = {
    blue:   'text-blue-600',
    red:    'text-red-600',
    yellow: 'text-amber-600',
    purple: 'text-purple-600',
    teal:   'text-teal-600',
    pink:   'text-pink-600',
    green:  'text-green-600',
  };
  const PageIcon = pageIcon;

  const [collapsed, setCollapsed] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initials = user ? getInitials(user.displayName) : "?";

  // Mobile and tablet both use bottom nav bar layout
  if (isMobile || isTablet) {
    return (
      <div style={{ backgroundColor: bgColor }} className="flex h-dvh w-full flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBgMap[accentColor] || 'bg-blue-100'}`}>
              <PageIcon className={`h-3.5 w-3.5 ${iconColorMap[accentColor] || 'text-blue-600'}`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-card-foreground leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold uppercase">
                {initials}
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
        <main className="flex-1 overflow-hidden flex flex-col">
          <PersistentDashboard />
          <Outlet />
        </main>

        {/* Bottom Nav */}
        <nav className="shrink-0 w-full flex items-center justify-around border-t border-border bg-card py-2 shadow-[0_-2px_10px_hsl(var(--foreground)/0.05)]">
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
    <div style={{ backgroundColor: bgColor }} className="flex h-dvh w-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
          {collapsed
            ? <RotaGenIcon size={28} variant="light" />
            : <RotaGenLogo size="sm" variant="dark" showIcon={false} />
          }
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

        {/* Collapse toggle at bottom */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-12 items-center justify-center border-t border-sidebar-border text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBgMap[accentColor] || 'bg-blue-100'}`}>
              <PageIcon className={`h-4 w-4 ${iconColorMap[accentColor] || 'text-blue-600'}`} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold uppercase">
                  {initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-card-foreground font-medium leading-tight">{user.displayName}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{user.username}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-hidden flex flex-col">
          <PersistentDashboard />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminShell() {
  return (
    <AdminShellProvider>
      <AdminShellInner />
    </AdminShellProvider>
  );
}
