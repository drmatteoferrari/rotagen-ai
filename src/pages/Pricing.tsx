import { useEffect, useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useScrollReveal } from "@/lib/useScrollReveal";
import RotaGenLogo from "@/components/brand/RotaGenLogo";

const trustSignals = ["No payment details", "No IT procurement", "Live within a week"];

const includedFeatures = [
  "Full draft rota built automatically from your doctors' own preferences — no manual allocation required",
  "Every rota is legally validated against the Junior Doctor 2016 Contract and relevant Working Time rules before it goes out",
  "Doctors submit availability and preferences via a simple email link — no chasing, no spreadsheets",
  "Annual leave, study leave, and less-than-full-time patterns built in from the start — not bolted on at the end",
  "Shift targets and allocation balance visible before the rota is finalised — full transparency before publishing",
  "Everything in one coordinator dashboard — department setup, rota generation, and doctor management",
  "Automatic notifications when doctors complete their surveys — no manual chasing required",
];

const faqs = [
  {
    question: "What's included in early access?",
    answer:
      "Everything — automated rota generation, validation, doctor preference surveys, leave management, and the full coordinator dashboard. No feature restrictions.",
  },
  {
    question: "Is it really free? What's the catch?",
    answer:
      "Free access in exchange for honest feedback — what works, what doesn't, and what's missing. No commitment and no payment details required.",
  },
  {
    question: "Do I need IT or trust procurement involvement?",
    answer:
      "No. RotaGen is a departmental tool. Sign up, configure your department, and start generating rotas — no trust-wide contract or IT project required.",
  },
  {
    question: "Is RotaGen compliant with the Junior Doctor 2016 Contract?",
    answer:
      "Yes. The compliance engine validates every rota against the 2016 Contract and relevant Working Time rules before it is published. Breaches are flagged before the rota goes out.",
  },
  {
    question: "How long does it take to get set up?",
    answer:
      "Most departments are set up and generating their first rota within a week. Setup involves department details, shift types, and inviting doctors to complete a short preference survey.",
  },
  {
    question: "Who is RotaGen built for?",
    answer:
      "Anaesthetic department rota coordinators in NHS trusts — typically a consultant or senior trainee managing 10–30 junior doctors across theatre, on-call, night, and ICU sessions.",
  },
  {
    question: "What happens after early access ends?",
    answer:
      "Early access departments will be first to hear about pricing and will receive preferential rates. There will be no sudden cut-off — plenty of notice before anything changes.",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [navShadow, setNavShadow] = useState(false);

  const accessRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const featuresRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const faqRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const ctaRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;

  useEffect(() => {
    const handleScroll = () => setNavShadow(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="min-h-screen bg-blue-100 text-foreground">
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
              <button type="button" onClick={() => navigate("/#how-it-works")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                How it works
              </button>
              <button type="button" onClick={() => navigate("/#features")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Features
              </button>
              <button type="button" onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Pricing
              </button>
            </div>
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

      <main className="px-4 pb-16 pt-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="animate-in slide-in-from-bottom-4 fade-in mb-10 text-center duration-500">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-sm font-black tracking-tighter text-primary shadow-sm">
                RE
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-foreground">RotaGen</p>
                <p className="text-sm text-muted-foreground">Fair NHS rotas in minutes, not hours</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div ref={accessRef} className="scroll-reveal-scale mx-auto w-full max-w-lg rounded-xl border-2 border-primary/20 bg-card p-7 shadow-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Early Access — Free
              </div>
              <h1 className="mt-5 text-2xl font-bold text-foreground">Free for founding departments</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We're onboarding a small group of anaesthetic departments to test RotaGen and shape its development.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                No cost. No commitment. <span className="font-semibold text-foreground">Just your honest feedback.</span>
              </p>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="mt-6 w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
              >
                Request early access →
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-3 w-full rounded-md border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Sign in to existing account
              </button>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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

            <div ref={featuresRef} className="scroll-reveal mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">What's included</p>
              <div className="mt-5 space-y-4">
                {includedFeatures.map((feature, index) => (
                  <div key={feature} className={`flex items-start gap-3 text-sm text-foreground ${["delay-100", "delay-200", "delay-300", "delay-400"][index % 4]}`}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="leading-relaxed">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div ref={faqRef} className="scroll-reveal mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Frequently asked questions</p>
              <Accordion type="single" collapsible className="mt-4 w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={faq.question} value={`item-${index + 1}`}>
                    <AccordionTrigger className="text-left text-sm text-foreground hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <div ref={ctaRef} className="scroll-reveal mx-auto w-full max-w-lg rounded-xl bg-slate-800 p-8 text-center">
              <h2 className="text-xl font-bold text-white">Stop losing days to the rota.</h2>
              <p className="mt-3 text-sm text-blue-300">
                Join the first departments using RotaGen — free access in exchange for your feedback.
              </p>
              <button
                type="button"
                onClick={() => navigate("/checkout")}
                className="mt-6 w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
              >
                View pricing plans →
              </button>
              <p className="mt-3 text-xs text-blue-400">No payment details · No procurement · Cancel anytime</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-white px-6 py-6 text-center">
        <p className="text-sm text-muted-foreground">RotaGen · NHS Rota Management · For authorised users only</p>
        {footerLinks}
      </footer>
    </div>
  );
}
