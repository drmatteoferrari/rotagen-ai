import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Code, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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

      {/* Main container: h-screen and overflow-hidden ensures no scrolling */}
      <div className="relative flex h-screen w-full flex-col items-center justify-between overflow-hidden bg-blue-50/50 p-4 md:p-8">
        {/* Top Header: Navigation and Logo */}
        <div className="flex w-full max-w-[420px] items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <button onClick={() => navigate("/")} className="transition-transform active:scale-95">
            <RotaGenLogo size="sm" variant="light" />
          </button>
          <div className="w-[60px]" /> {/* Spacer to balance the back button */}
        </div>

        {/* Center Section: Branding + Login Card */}
        <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <button onClick={() => navigate("/")} className="mb-2">
              <div className="shimmer-text">
                <RotaGenLogo size="md" variant="light" />
              </div>
            </button>
            <h2 className="text-lg font-semibold text-foreground/90">Welcome back</h2>
          </div>

          <Card className="w-full border-none shadow-2xl shadow-blue-200/50">
            <CardContent className="p-5 pt-6">
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="identifier"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
                    className="h-10 bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      title="password"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-[11px] font-medium text-primary hover:underline"
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
                      className="h-10 pr-10 bg-slate-50/50"
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

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-slate-200 text-sm font-medium hover:bg-slate-50"
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
                className="mt-4 w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 hover:text-primary transition-colors"
              >
                <Code className="h-3 w-3" />
                Quick login (Dev)
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Tagline + Footer */}
        <div className="flex w-full flex-col items-center gap-3">
          <div className="animate-fadeSlideUp">
            <RotaGenTagline variant="short" />
          </div>

          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
              <span>RotaGen</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>NHS Rota Management</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-destructive/70 italic">Authorised users only</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <a
                href="/privacy"
                className="font-semibold text-slate-500 hover:text-primary transition-colors underline decoration-slate-300 underline-offset-2"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="font-semibold text-slate-500 hover:text-primary transition-colors underline decoration-slate-300 underline-offset-2"
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
