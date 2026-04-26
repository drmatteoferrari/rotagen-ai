import { useEffect, useState, type MutableRefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Mail, ShieldCheck, Star, Wand2 } from "lucide-react";
import { useScrollReveal } from "@/lib/useScrollReveal";
import { useAuth } from "@/contexts/AuthContext";
import RotaGenLogo from "@/components/brand/RotaGenLogo";
import PublicTopBar from "@/components/PublicTopBar";
import screenshotDashboard from "@/assets/screenshot-dashboard.jpg";
import screenshotCalendar from "@/assets/screenshot-calendar.jpg";
import screenshotShifts from "@/assets/screenshot-shifts.jpg";

const APP_SCREENSHOTS = [
  { src: screenshotDashboard, alt: "RotaGen setup wizard dashboard" },
  { src: screenshotCalendar, alt: "Pre-rota calendar view" },
  { src: screenshotShifts, alt: "Shift type configuration" },
];

const featureCards = [
  {
    icon: Wand2,
    title: "Auto-generated, preference-aware rotas",
    description:
      "Your doctors' leave, NOC days, and scheduling preferences are built in from the start — not patched in afterwards.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance built in, not bolted on",
    description:
      "Every rota is validated against the Junior Doctor 2016 Contract and relevant Working Time rules before it leaves RotaGen. Breaches flagged before they reach a trainee.",
  },
  {
    icon: Mail,
    title: "No more chasing leave by email",
    description:
      "Doctors submit annual leave, study leave, LTFT patterns, and scheduling preferences via a simple link. You're notified when each response comes in.",
  },
  {
    icon: BarChart3,
    title: "Shift targets, transparent from the start",
    description:
      "See exactly how many nights, weekends, and on-calls each doctor is allocated before the rota is published. No uncomfortable conversations after the fact.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authLoading } = useAuth();

  const [pendingAutoLogin, setPendingAutoLogin] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Object.keys(localStorage).some(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
  });

  const [activeScreenshot, setActiveScreenshot] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScreenshot((prev) => (prev + 1) % APP_SCREENSHOTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  const step1Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const step2Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const step3Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature1Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature2Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature3Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature4Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const pricingRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const pricingMobileRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const ctaRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const timeout = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [location.hash]);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      navigate("/admin/dashboard", { replace: true });
    } else {
      setPendingAutoLogin(false);
    }
  }, [isAuthenticated, authLoading, navigate]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const footerLinks = (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-primary">
      <button type="button" onClick={() => navigate("/privacy")} className="hover:underline">
        Privacy Policy
      </button>
      <span className="text-muted-foreground">|</span>
      <button type="button" onClick={() => navigate("/terms")} className="hover:underline">
        Terms of Use
      </button>
      <span className="text-muted-foreground">|</span>
      <button type="button" onClick={() => navigate("/login")} className="hover:underline">
        Sign in
      </button>
    </div>
  );

  if (pendingAutoLogin || isAuthenticated) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#2563EB', zIndex: 9999 }} />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopBar
        menuItems={[
          { label: "How it works", onClick: () => scrollToSection("how-it-works") },
          { label: "Features", onClick: () => scrollToSection("features") },
          { label: "Pricing overview", onClick: () => scrollToSection("pricing") },
        ]}
      />

      <main>
        {/* Compressed padding for mobile and pushed higher up towards top bar for desktop/tablet */}
        <section id="hero" className="flex flex-col bg-blue-100 px-4 pt-4 pb-6 md:pt-6 md:pb-10 lg:pt-8 lg:pb-12">
          {/* 2-column layout on tablets/desktop. Flex column on mobile. 
              Added id="pricing" here so the navbar scrolling lands perfectly at the top of the grid. */}
          <div
            id="pricing"
            className="mx-auto w-full max-w-5xl flex flex-col md:grid md:grid-cols-2 gap-x-6 gap-y-4 lg:gap-x-12 md:items-center lg:items-start justify-items-center"
          >
            {/* --- LEFT COLUMN --- */}
            <div className="flex flex-col items-center md:gap-4 lg:gap-6 w-full">
              {/* 1. Logo & Tagline (fade-up-1 & fade-up-2 for both Mobile and Desktop) */}
              <div className="flex flex-col items-center text-center w-full max-w-sm mb-2 md:mb-0">
                <div className="fade-up-1 flex justify-center">
                  <RotaGenLogo size="lg" animated />
                </div>
                <div className="fade-up-2 mt-1.5 md:mt-3 text-base md:text-xl">
                  <p className="text-muted-foreground" style={{ lineHeight: 1.25 }}>
                    Your doctors' preferences.
                  </p>
                  <p className="text-muted-foreground" style={{ lineHeight: 1.25 }}>
                    Your department's rules.
                  </p>
                  <p style={{ lineHeight: 1.25 }}>
                    One{" "}
                    <span className="shimmer-text-dark" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700 }}>
                      ROTA
                    </span>
                    .{" "}
                    <span className="shimmer-text-blue" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700 }}>
                      GEN
                    </span>
                    erated for you.
                  </p>
                </div>
              </div>

              {/* Desktop Screenshot Carousel (Hidden on mobile) - Desktop Animation: fade-up-3 */}
              <div className="hidden md:block fade-up-3 float-anim w-full max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg mx-auto overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <div className="flex h-5 md:h-6 lg:h-8 items-center gap-1.5 lg:gap-2 px-2 md:px-3 lg:px-4 bg-slate-800">
                  <span className="h-1.5 w-1.5 md:h-2 md:w-2 lg:h-3 lg:w-3 rounded-full bg-red-400" />
                  <span className="h-1.5 w-1.5 md:h-2 md:w-2 lg:h-3 lg:w-3 rounded-full bg-amber-400" />
                  <span className="h-1.5 w-1.5 md:h-2 md:w-2 lg:h-3 lg:w-3 rounded-full bg-green-400" />
                  <span className="ml-1 md:ml-2 text-[7px] md:text-[9px] lg:text-xs text-slate-400 font-medium hidden sm:inline">
                    RotaGen
                  </span>
                  <div className="ml-auto flex gap-1">
                    {APP_SCREENSHOTS.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveScreenshot(i)}
                        className={`h-1.5 w-1.5 lg:h-2 lg:w-2 rounded-full transition-all duration-300 ${
                          i === activeScreenshot ? "bg-blue-400 scale-125" : "bg-slate-500 hover:bg-slate-400"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="relative w-full" style={{ aspectRatio: "800/520" }}>
                  {APP_SCREENSHOTS.map((shot, i) => (
                    <img
                      key={i}
                      src={shot.src}
                      alt={shot.alt}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                        i === activeScreenshot ? "opacity-100" : "opacity-0"
                      }`}
                      width={800}
                      height={520}
                      loading={i === 0 ? undefined : "lazy"}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* --- RIGHT COLUMN (DESKTOP) --- */}
            <div className="hidden md:flex flex-col items-center gap-4 lg:gap-6 w-full mt-2 md:mt-0">
              {/* Desktop Pricing Card - Desktop Animation: fade-up-4 */}
              <div
                ref={pricingRef}
                className="fade-up-4 w-full max-w-sm mx-auto rounded-2xl border-2 border-primary/20 bg-card p-3 md:p-5 lg:p-6 text-center shadow-lg"
              >
                <div className="inline-block rounded-full p-[2px] pricing-badge-shimmer">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold uppercase tracking-wider text-green-700">
                    <span className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-green-500 animate-pulse" />
                    Early Access — Free
                  </div>
                </div>

                <h3 className="mt-2 md:mt-4 text-lg md:text-xl font-bold text-foreground">
                  FREE for Founding Departments
                </h3>
                <p className="mt-1.5 md:mt-3 text-xs md:text-sm leading-snug text-muted-foreground">
                  Join our early testing group for anaesthetic departments. Zero cost. No commitment. Just your honest
                  feedback.
                </p>

                {/* Primary Button */}
                <div className="mt-3 md:mt-5 inline-block rounded-xl p-[2px] pricing-blue-shimmer w-full">
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="w-full rounded-[9px] bg-primary px-4 py-2 md:px-6 md:py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    Request early access
                  </button>
                </div>

                {/* Secondary Button */}
                <button
                  type="button"
                  onClick={() => navigate("/pricing")}
                  className="mt-2 md:mt-3 w-full rounded-xl bg-blue-50 border border-blue-200 px-4 py-1.5 md:px-6 md:py-2 text-xs md:text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100"
                >
                  Full pricing details
                </button>
              </div>

              {/* Desktop Feedback Card - Desktop Animation: fade-up-5 */}
              <div className="fade-up-5 w-full max-w-sm mx-auto rounded-2xl border border-border bg-card p-3 md:p-4 text-center shadow-md">
                <p className="text-xs md:text-sm font-semibold text-muted-foreground mb-1.5 md:mb-3">
                  Already using RotaGen?
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/feedback")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 md:py-2.5 text-xs md:text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "#16A34A" }}
                >
                  <span className="flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-md bg-white/20">
                    <Star className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  </span>
                  Give us your feedback
                </button>
              </div>
            </div>

            {/* --- RIGHT COLUMN (MOBILE) --- */}
            <div className="flex md:hidden flex-col items-center gap-4 w-full mt-2">
              {/* Mobile Pricing Card - Mobile Animation: fade-up-3 */}
              <div
                ref={pricingMobileRef}
                className="fade-up-3 w-full max-w-sm mx-auto rounded-2xl border-2 border-primary/20 bg-card p-3 md:p-5 lg:p-6 text-center shadow-lg"
              >
                <div className="inline-block rounded-full p-[2px] pricing-badge-shimmer">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold uppercase tracking-wider text-green-700">
                    <span className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-green-500 animate-pulse" />
                    Early Access — Free
                  </div>
                </div>

                <h3 className="mt-2 md:mt-4 text-lg md:text-xl font-bold text-foreground">
                  FREE for Founding Departments
                </h3>
                <p className="mt-1.5 md:mt-3 text-xs md:text-sm leading-snug text-muted-foreground">
                  Join our early testing group for anaesthetic departments. Zero cost. No commitment. Just your honest
                  feedback.
                </p>

                {/* Primary Button */}
                <div className="mt-3 md:mt-5 inline-block rounded-xl p-[2px] pricing-blue-shimmer w-full">
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="w-full rounded-[9px] bg-primary px-4 py-2 md:px-6 md:py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    Request early access
                  </button>
                </div>

                {/* Secondary Button */}
                <button
                  type="button"
                  onClick={() => navigate("/pricing")}
                  className="mt-2 md:mt-3 w-full rounded-xl bg-blue-50 border border-blue-200 px-4 py-1.5 md:px-6 md:py-2 text-xs md:text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100"
                >
                  Full pricing details
                </button>
              </div>

              {/* Mobile Feedback Card - Mobile Animation: fade-up-4 */}
              <div className="fade-up-4 w-full max-w-sm mx-auto rounded-2xl border border-border bg-card p-3 md:p-4 text-center shadow-md">
                <p className="text-xs md:text-sm font-semibold text-muted-foreground mb-1.5 md:mb-3">
                  Already using RotaGen?
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/feedback")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 md:py-2.5 text-xs md:text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "#16A34A" }}
                >
                  <span className="flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-md bg-white/20">
                    <Star className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  </span>
                  Give us your feedback
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* --- MOBILE ONLY: Screenshot Carousel Below the Fold --- */}
        <section className="md:hidden bg-blue-100 px-4 pb-12 pt-2">
          <div className="fade-up-5 float-anim w-full max-w-xs mx-auto overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex h-5 items-center gap-1.5 px-2 bg-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span className="ml-auto flex gap-1">
                {APP_SCREENSHOTS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveScreenshot(i)}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                      i === activeScreenshot ? "bg-blue-400 scale-125" : "bg-slate-500"
                    }`}
                  />
                ))}
              </span>
            </div>
            <div className="relative w-full" style={{ aspectRatio: "800/520" }}>
              {APP_SCREENSHOTS.map((shot, i) => (
                <img
                  key={i}
                  src={shot.src}
                  alt={shot.alt}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    i === activeScreenshot ? "opacity-100" : "opacity-0"
                  }`}
                  width={800}
                  height={520}
                  loading={i === 0 ? undefined : "lazy"}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold text-foreground md:text-4xl">
              Set the rules once. Let the rota build itself.
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div
                ref={step1Ref}
                className="scroll-reveal delay-100 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  1
                </div>
                <h3 className="text-lg font-semibold text-foreground">Set up your department</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Enter your shift types, staffing requirements, and rota period. RotaGen learns your specific rules —
                  grades, competencies, and less-than-full-time patterns.
                </p>
              </div>
              <div
                ref={step2Ref}
                className="scroll-reveal delay-200 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  2
                </div>
                <h3 className="text-lg font-semibold text-foreground">Collect doctor preferences</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Doctors receive a personalised survey link by email. They submit leave, availability, and scheduling
                  preferences. You get notified automatically when each response arrives.
                </p>
              </div>
              <div
                ref={step3Ref}
                className="scroll-reveal delay-300 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  3
                </div>
                <h3 className="text-lg font-semibold text-foreground">Generate and publish</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  RotaGen builds a fully allocated, legally validated rota from your doctors' preferences. Review the
                  allocation balance, then publish — no manual checking required.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-blue-100 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Features</p>
            <h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
              Built for anaesthetic departments, not generic rostering.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Every workflow is designed to remove admin overhead while keeping leave, compliance, and allocation
              fairness visible from the start.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {featureCards.map((feature, index) => {
                const Icon = feature.icon;
                const refs = [feature1Ref, feature2Ref, feature3Ref, feature4Ref];
                const delays = ["delay-100", "delay-200", "delay-300", "delay-400"];
                return (
                  <div
                    key={feature.title}
                    ref={refs[index]}
                    className={`scroll-reveal rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md ${delays[index]}`}
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-slate-800 px-6 py-20">
          <div ref={ctaRef} className="scroll-reveal mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Stop losing days to the rota.</h2>
            <p className="mt-4 text-base text-blue-300">
              Join the first NHS anaesthetic departments using RotaGen — free access in exchange for your feedback.
            </p>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="mt-8 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
            >
              Request early access
            </button>
            <p className="mt-3 text-xs text-blue-400">No payment details · No IT procurement · Cancel anytime</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white px-6 py-6 text-center">
        <p className="text-sm text-muted-foreground">RotaGen · NHS Rota Management · For authorised users only</p>
        {footerLinks}
      </footer>
    </div>
  );
}
