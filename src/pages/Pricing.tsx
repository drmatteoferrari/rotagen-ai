import { type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useScrollReveal } from "@/lib/useScrollReveal";
import RotaGenLogo from "@/components/brand/RotaGenLogo";
import PublicTopBar from "@/components/PublicTopBar";

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

  const accessRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const featuresRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const faqRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;
  const ctaRef = useScrollReveal() as MutableRefObject<HTMLDivElement | null>;

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
      <PublicTopBar
        menuItems={[
          { label: "How it works", onClick: () => navigate("/#how-it-works") },
          { label: "Features", onClick: () => navigate("/#features") },
        ]}
      />

      <main className="px-4 pb-16 pt-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="animate-in slide-in-from-bottom-4 fade-in mb-10 text-center duration-500">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm">
              <RotaGenLogo size="md" />
            </div>
          </div>

          {/* Early Access Card */}
          <div ref={accessRef} className="scroll-reveal mx-auto mb-12 max-w-2xl rounded-2xl border border-primary/20 bg-card p-8 shadow-xl">
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-foreground">Free</span>
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">Early Access</span>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Full product access during the early access period — no payment details required. In exchange, we ask for honest feedback on what works and what doesn't.
            </p>
            <div className="mb-6 flex flex-wrap gap-3">
              {trustSignals.map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Check className="h-3 w-3 text-primary" />
                  {t}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
            >
              Request early access →
            </button>
          </div>

          {/* What's included */}
          <div ref={featuresRef} className="scroll-reveal mx-auto mb-12 max-w-2xl">
            <h2 className="mb-6 text-xl font-bold">What's included</h2>
            <ul className="space-y-3">
              {includedFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ */}
          <div ref={faqRef} className="scroll-reveal mx-auto mb-12 max-w-2xl">
            <h2 className="mb-6 text-xl font-bold">Frequently asked questions</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-lg border border-border bg-card px-4 shadow-sm">
                  <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">{faq.question}</AccordionTrigger>
                  <AccordionContent className="pb-3 text-sm text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Bottom CTA */}
          <div ref={ctaRef} className="scroll-reveal mx-auto max-w-lg rounded-2xl border border-primary/20 bg-card p-6 text-center shadow-xl">
            <p className="mb-3 text-lg font-bold">Ready to try RotaGen?</p>
            <p className="mb-5 text-sm text-muted-foreground">No payment details required — get started in minutes.</p>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
            >
              Request early access →
            </button>
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
