import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Star, Menu } from "lucide-react";
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
  const isLanding = pathname === "/";
  const isPricing = pathname === "/pricing";

  const defaultLinks: { label: string; onClick: () => void }[] = [];

  if (!isLanding) {
    defaultLinks.push({ label: "Home", onClick: () => navigate("/") });
  }

  if (!isPricing) {
    defaultLinks.push({ label: "Pricing & plans", onClick: () => navigate("/pricing") });
  }

  if (!isLogin) {
    defaultLinks.push({ label: "Sign in", onClick: () => navigate("/login") });
  }

  if (!isRegister) {
    defaultLinks.push({ label: "Request access", onClick: () => navigate("/register") });
  }

  defaultLinks.push({ label: "Privacy Policy", onClick: () => navigate("/privacy") });
  defaultLinks.push({ label: "Terms of Use", onClick: () => navigate("/terms") });

  const allMenuLinks = [...menuItems, ...defaultLinks];

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 transition-shadow relative ${
          shadow ? "shadow-sm" : ""
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0 min-w-0">
            <RotaGenLogo size="sm" />
          </button>

          <div className="flex items-center gap-1 sm:gap-3">
            {!isFeedback && (
              <button
                type="button"
                onClick={() => navigate("/feedback")}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                title="Give feedback"
              >
                <Star className="h-4 w-4 fill-green-700/20" />
                <span className="text-sm font-semibold">Feedback</span>
              </button>
            )}

            {!isLogin && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="shrink-0 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-sm font-bold text-blue-700 bg-blue-50 border border-blue-400 hover:bg-blue-100 transition-colors"
              >
                Sign in
              </button>
            )}

            {!isRegister && (
              <div className="hidden sm:inline-block nav-cta-shimmer-wrap">
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="block shrink-0 rounded-[8px] bg-blue-600 px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] whitespace-nowrap"
                >
                  Request access
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span
                  className={`absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-in-out ${
                    menuOpen ? "top-1/2 -translate-y-1/2 rotate-45" : "top-1"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-all duration-300 ease-in-out ${
                    menuOpen ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
                  }`}
                />
                <span
                  className={`absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-in-out ${
                    menuOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-1"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="absolute right-3 top-full z-50 mt-1 w-56 rounded-md border border-border bg-white shadow-lg sm:right-6 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <nav className="flex flex-col gap-1 px-2 py-2">
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
              {!isRegister && (
                <div className="px-1 pt-1 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/register");
                    }}
                    className="w-full rounded-md px-3 py-2.5 text-left text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Request access
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
