import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Code, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import RotaGenIcon from "@/components/brand/RotaGenIcon";
import RotaGenLogo from "@/components/brand/RotaGenLogo";
import RotaGenTagline from "@/components/brand/RotaGenTagline";

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.mustChangePassword) {
      navigate("/change-password", { replace: true });
    } else {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user?.mustChangePassword, navigate]);

  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    let emailToUse = identifier.trim();

    if (!emailToUse.includes("@")) {
      const { data: coordRow } = await (supabase
        .from("coordinator_accounts" as any)
        .select("email")
        .eq("username", emailToUse.toLowerCase())
        .maybeSingle() as any);

      if (!coordRow?.email) {
        setError("Username not found. Try signing in with your email address.");
        setLoading(false);
        return;
      }
      emailToUse = coordRow.email;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (signInError) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      setShowSplash(true);
    }
  };

  return (
    <>
      {showSplash && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary">
          <RotaGenLogo size="lg" variant="dark" />
          <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white"
              style={{ animation: "splashBar 1.8s ease-in-out forwards" }}
            />
          </div>
          <p className="mt-4 text-sm text-blue-100">Loading your rota…</p>
          <style>{`@keyframes splashBar { from { width: 0% } to { width: 100% } }`}</style>
        </div>
      )}

      {/* Main container: h-[100dvh] and overflow-hidden ensures no scrolling. bg-blue-100 matches landing page. */}
      <div className="relative flex h-[100dvh] w-full flex-col items-center justify-between overflow-hidden bg-blue-100 p-4 md:p-8">
        {/* Navigation back button - reduced top padding to move everything up */}
        <div className="flex w-full max-w-[420px] items-center justify-start pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>

        {/* Center Section: Main Branding + Login Card - Added negative margin to pull up */}
        <div className="flex w-full max-w-[420px] flex-col items-center gap-4 -mt-12 md:-mt-16">
          <div className="flex flex-col items-center gap-2 text-center animate-fadeSlideUp">
            <button onClick={() => navigate("/")} className="mb-4 group transition-transform active:scale-95">
              <div className="flex items-center gap-4">
                {/* Logo and Icon made even bigger */}
                <RotaGenIcon size={64} variant="light" />
                <span className="font-['Poppins'] font-bold text-[36px] flex tracking-tight">
                  <span className="shimmer-text-dark">ROTA</span>
                  <span className="shimmer-text">GEN</span>
                </span>
              </div>
            </button>
            <h2 className="text-base font-semibold text-slate-600 mb-2">Welcome back</h2>
          </div>

          <Card className="w-full border-none shadow-2xl shadow-blue-200/60">
            <CardContent className="p-5 md:p-6 pt-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="identifier"
                    className="text-[11px] font-bold uppercase tracking-widest text-slate-500"
                  >
                    Email or username
                  </Label>
                  <Input
                    ref={identifierRef}
                    id="identifier"
                    type="text"
                    placeholder="Email or username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError(null);
                    }}
                    className="h-10 bg-slate-50/50 border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      title="password"
                      className="text-[11px] font-bold uppercase tracking-widest text-slate-500"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      className="h-10 pr-10 bg-slate-50/50 border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[12px] font-medium text-destructive text-center animate-in fade-in zoom-in-95 duration-200">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold shadow-lg shadow-primary/20"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-slate-200 text-sm font-medium hover:bg-slate-50 text-slate-600"
                onClick={() => navigate("/signup")}
                disabled={loading}
              >
                Request access
              </Button>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  const result = await login("matteferro31@gmail.com", "matteferro31");
                  if (result.success) setShowSplash(true);
                  else {
                    setError(result.error ?? "Dev login failed");
                    setLoading(false);
                  }
                }}
                className="mt-5 w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
              >
                <Code className="h-3 w-3" />
                Quick login (Dev)
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Tagline + Footer links - Added extra padding bottom */}
        <div className="flex w-full flex-col items-center gap-4 pb-8 md:pb-12">
          <div className="animate-fadeSlideUp">
            <RotaGenTagline variant="short" />
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>RotaGen</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>NHS Rota Management</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-destructive/80 italic font-medium tracking-normal">Authorised users only</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <a
                href="/privacy"
                className="text-slate-500 hover:text-primary transition-colors underline decoration-slate-200 underline-offset-4"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="text-slate-500 hover:text-primary transition-colors underline decoration-slate-200 underline-offset-4"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
