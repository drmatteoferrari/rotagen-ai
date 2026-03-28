import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Star, Menu, X } from "lucide-react";
import RotaGenLogo from "@/components/brand/RotaGenLogo";

interface PublicTopBarProps {
  menuItems?: { label: string; onClick: () => void }[];
}

export default function PublicTopBar({ menuItems = [] }: PublicTopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shadow, setShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShadow(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register" || pathname === "/signup";
  const isFeedback = pathname === "/feedback";

  const defaultLinks = [
    { label: "Home", onClick: () => navigate("/") },
    { label: "Pricing", onClick: () => navigate("/pricing") },
    { label: "Privacy Policy", onClick: () => navigate("/privacy") },
    { label: "Terms of Use", onClick: () => navigate("/terms") },
  ];

  const allMenuLinks = [...menuItems, ...defaultLinks];

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 transition-shadow ${
          shadow ? "shadow-sm" : ""
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-6">
          {/* Left: Logo */}
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
            <RotaGenLogo size="sm" />
          </button>

          {/* Right: action buttons + hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* 1 & 2: Feedback - Accent Green, Responsive Label */}
            {!isFeedback && (
              <button
                type="button"
                onClick={() => navigate("/feedback")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                title="Give feedback"
              >
                <Star className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-semibold">Feedback</span>
              </button>
            )}

            {/* 3: Sign in - Accent Blue */}
            {!isLogin && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                Sign in
              </button>
            )}

            {/* 4: Request access - Accent Blue with Thick Shimmer Outline */}
            {!isRegister && (
              <div className="nav-cta-shimmer-wrap">
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="block shrink-0 rounded-[8px] bg-blue-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-[0.98] whitespace-nowrap"
                >
                  Request access
                </button>
              </div>
            )}

            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="border-t border-border bg-white px-4 pb-3 pt-2">
            <nav className="flex flex-col gap-1">
              {allMenuLinks.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    item.onClick();
                  }}
                  className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
