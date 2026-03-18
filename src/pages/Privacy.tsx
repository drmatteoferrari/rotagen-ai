import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  const navigate = useNavigate();
  const [navShadow, setNavShadow] = useState(false);

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
              onClick={() => navigate("/register")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
            >
              Request access
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-12 pt-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
          <button type="button" onClick={() => navigate("/login")} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>

          <h1 className="mt-6 text-2xl font-bold">RotaGen — Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: March 2026</p>

          <h2 className="mt-8 text-lg font-semibold">What RotaGen does</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            RotaGen is an NHS rota scheduling tool that helps anaesthetic department coordinators generate fair, WTR-compliant rotas for junior doctors.
          </p>

          <h2 className="mt-8 text-lg font-semibold">What data we collect</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <strong>For coordinators:</strong> name, email address, phone number, job title, hospital and department name.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <strong>For doctors:</strong> name, NHS email address, grade, working time percentage, annual leave dates, study leave dates, parental leave status, medical exemptions, clinical competencies, and scheduling preferences.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Why we collect it</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Coordinator data is collected to verify identity and manage access to the platform. Doctor data is collected solely for the purpose of generating a fair rota that meets NHS Working Time Regulations.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Who can see your data</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your data is visible only to your rota coordinator and the RotaGen platform owner. No other organisations, coordinators, or users can access your data.
          </p>

          <h2 className="mt-8 text-lg font-semibold">How long we keep it</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Data is retained for the duration of the rota period plus 12 months, after which it is deleted.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Your rights</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Under UK GDPR you have the right to access, correct, or request deletion of your data. To exercise these rights, email{" "}
            <a href="mailto:matteferro31@gmail.com" className="text-primary hover:underline">matteferro31@gmail.com</a>{" "}
            with the subject line "Data request".
          </p>

          <h2 className="mt-8 text-lg font-semibold">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            For any privacy questions contact{" "}
            <a href="mailto:matteferro31@gmail.com" className="text-primary hover:underline">matteferro31@gmail.com</a>.
          </p>
        </div>
      </main>

      <footer className="border-t border-border bg-white px-6 py-6 text-center">
        <p className="text-sm text-muted-foreground">RotaGen · NHS Rota Management · For authorised users only</p>
        {footerLinks}
      </footer>
    </div>
  );
}
