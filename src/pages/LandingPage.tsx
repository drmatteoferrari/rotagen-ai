import { useEffect, useState, type MutableRefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Check, Mail, ShieldCheck, Star, Wand2 } from "lucide-react";
import { useScrollReveal } from "@/lib/useScrollReveal";

const trustSignals = ["No payment details", "No IT procurement", "Live within a week"];

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
  const [navShadow, setNavShadow] = useState(false);

  const step1Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const step2Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const step3Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature1Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature2Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature3Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const feature4Ref = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const pricingRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const ctaRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;

  useEffect(() => {
    const handleScroll = () => setNavShadow(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const timeout = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [location.hash]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className={`sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 ${
          navShadow ? "shadow-sm" : ""
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-xs font-black tracking-tighter text-primary shadow-sm">
              RE
            </div>
            <span className="text-base font-bold text-foreground">RotaGen</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-5 md:flex">
              <button type="button" onClick={() => scrollToSection("how-it-works")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                How it works
              </button>
              <button type="button" onClick={() => scrollToSection("features")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Features
              </button>
              <button type="button" onClick={() => scrollToSection("pricing")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Pricing
              </button>
            </div>
            <button type="button" onClick={() => navigate("/feedback")}
              className="hidden md:block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Give feedback
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
            >
              Request access
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="hero" className="flex min-h-screen items-center bg-blue-100 px-6 py-16">
          <div className="mx-auto w-full max-w-6xl">
            <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Early Access — Free
              </div>

              <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
                <span className="block">Your doctors' preferences.</span>
                <span className="block">Your department's rules.</span>
                <span className="block shimmer-text">One compliant rota, automatically.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                RotaGen is an AI-powered rota scheduler built for NHS anaesthetic departments. It collects your doctors' preferences, applies your department's rules, and generates a fully allocated rota in minutes — not days.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
                >
                  Request early access →
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("how-it-works")}
                  className="w-full rounded-md border border-primary/30 px-6 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/5 sm:w-auto"
                >
                  See how it works
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                {trustSignals.map((signal) => (
                  <div key={signal} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{signal}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl float-anim">
              <div className="flex h-8 items-center gap-2 bg-slate-800 px-4">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-5 gap-2 text-[11px] font-semibold text-muted-foreground">
                  <div>Doctor</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                </div>
                {[
                  ["Dr Patel", "Long Day", "Short Day", "On-Call", "Night"],
                  ["Dr Khan", "Short Day", "Long Day", "Night", "Short Day"],
                  ["Dr Smith", "On-Call", "Short Day", "Long Day", "Long Day"],
                ].map((row) => (
                  <div key={row[0]} className="grid grid-cols-5 gap-2">
                    <div className="flex items-center rounded-lg bg-muted px-3 py-3 text-sm font-medium text-foreground">
                      {row[0]}
                    </div>
                    {row.slice(1).map((shift) => {
                      const badgeClass =
                        shift === "Long Day"
                          ? "bg-green-100 text-green-700"
                          : shift === "Night"
                            ? "bg-red-100 text-red-700"
                            : shift === "On-Call"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700";

                      return (
                        <div key={`${row[0]}-${shift}`} className="rounded-lg bg-muted px-2 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClass}`}>
                            {shift}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold text-foreground md:text-4xl">Set the rules once. Let the rota build itself.</h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div ref={step1Ref} className="scroll-reveal delay-100 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">1</div>
                <h3 className="text-lg font-semibold text-foreground">Set up your department</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Enter your shift types, staffing requirements, and rota period. RotaGen learns your specific rules — grades, competencies, and less-than-full-time patterns.
                </p>
              </div>
              <div ref={step2Ref} className="scroll-reveal delay-200 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">2</div>
                <h3 className="text-lg font-semibold text-foreground">Collect doctor preferences</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Doctors receive a personalised survey link by email. They submit leave, availability, and scheduling preferences. You get notified automatically when each response arrives.
                </p>
              </div>
              <div ref={step3Ref} className="scroll-reveal delay-300 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">3</div>
                <h3 className="text-lg font-semibold text-foreground">Generate and publish</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  RotaGen builds a fully allocated, legally validated rota from your doctors' preferences. Review the allocation balance, then publish — no manual checking required.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-blue-100 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Features</p>
            <h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">Built for anaesthetic departments, not generic rostering.</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Every workflow is designed to remove admin overhead while keeping leave, compliance, and allocation fairness visible from the start.
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

        <section id="pricing" className="bg-white px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">Free while we're building it with you.</h2>
            <div ref={pricingRef} className="scroll-reveal-scale mx-auto mt-10 max-w-md rounded-2xl border-2 border-primary/20 bg-card p-8 text-center shadow-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Early Access — Free
              </div>
              <h3 className="mt-5 text-2xl font-bold text-foreground">Free for founding departments</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We're onboarding a small group of anaesthetic departments to test RotaGen. No cost, no commitment — just your honest feedback.
              </p>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="mt-6 w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
              >
                Request early access →
              </button>
              <button type="button" onClick={() => navigate("/pricing")} className="mt-4 text-sm font-medium text-primary hover:underline">
                Full pricing details →
              </button>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground mb-2">Already using RotaGen?</p>
                <button type="button" onClick={() => navigate("/feedback")}
                  style={{ borderColor: '#34E0A1', color: '#34E0A1' }}
                  className="w-full rounded-md border-2 bg-transparent px-6 py-2.5 text-sm font-semibold transition-all hover:opacity-80">
                  ⭐ Give us your feedback
                </button>
              </div>
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
              Request early access →
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
