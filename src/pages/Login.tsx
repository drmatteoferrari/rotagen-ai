import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Code, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import RotaGenIcon from "@/components/brand/RotaGenIcon";
import RotaGenLogo from "@/components/brand/RotaGenLogo";
import PublicTopBar from "@/components/PublicTopBar";

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.mustChangePassword) {
      navigate("/change-password", { replace: true });
    } else {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user?.mustChangePassword, navigate]);

  // Removed the autofocus useEffect to prevent aggressive keyboard popup on mobile devices.

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
      {/* Loading Splash Screen */}
      {showSplash && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary animate-in fade-in duration-300">
          <RotaGenLogo size="lg" variant="dark" />
          <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white"
              style={{ animation: "splashBar 1.8s ease-in-out forwards" }}
            />
          </div>
          <p className="mt-4 text-sm font-medium text-blue-100 animate-pulse">Loading your rota…</p>
          <style>{`@keyframes splashBar { from { width: 0% } to { width: 100% } }`}</style>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="relative flex min-h-[100dvh] w-full flex-col bg-slate-50 overflow-hidden font-sans">
        {/* Soft Ambient Background Blobs for Visual Aesthetics */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/20 blur-[100px] pointer-events-none" />

        <PublicTopBar />

        {/* Center Section */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 z-10">
          <div className="w-full max-w-[420px] flex flex-col items-center">
            {/* Header / Logo - Staggered Animation 1 */}
            <div className="flex flex-col items-center gap-3 text-center mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <button
                onClick={() => navigate("/")}
                className="group relative flex flex-col items-center gap-4 transition-transform active:scale-95"
              >
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl group-hover:bg-primary/20 transition-colors duration-500" />
                  <RotaGenIcon
                    size={68}
                    variant="light"
                    className="relative z-10 transition-transform group-hover:scale-105 duration-300"
                  />
                </div>
                <span className="font-['Poppins'] font-bold text-[38px] flex tracking-tight items-center shadow-sm">
                  <span className="text-slate-800 dark:text-slate-100">ROTA</span>
                  <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-[length:200%_auto] animate-[pulse_3s_ease-in-out_infinite] bg-clip-text text-transparent ml-0.5">
                    GEN
                  </span>
                </span>
              </button>
              <h2 className="text-[15px] sm:text-base font-medium text-slate-500 animate-in fade-in duration-700 delay-150 fill-mode-both">
                Welcome back to your workspace
              </h2>
            </div>

            {/* Login Card - Staggered Animation 2 */}
            <Card className="w-full border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl shadow-blue-900/5 sm:rounded-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
              <CardContent className="p-5 sm:p-7">
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="identifier"
                      className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1"
                    >
                      Email or username
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="name@nhs.net"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setError(null);
                      }}
                      className="h-12 sm:h-11 px-4 rounded-xl bg-slate-50/50 border-slate-200 text-base sm:text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <Label
                        htmlFor="password"
                        title="password"
                        className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-[11px] sm:text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Forgot password?
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
                        className="h-12 sm:h-11 px-4 pr-11 rounded-xl bg-slate-50/50 border-slate-200 text-base sm:text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-md"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-[18px] w-[18px]" />
                        ) : (
                          <Eye className="h-[18px] w-[18px]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[13px] font-medium text-red-600 text-center">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 sm:h-11 mt-2 text-sm sm:text-base font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] group"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                    {!loading && (
                      <ArrowRight className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                    )}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 sm:h-10 rounded-xl border-slate-200 text-[13px] sm:text-sm font-medium hover:bg-slate-50 transition-colors"
                    onClick={() => navigate("/signup")}
                    disabled={loading}
                  >
                    Request organization access
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
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Code className="h-3.5 w-3.5" />
                    Quick login (Dev)
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 pb-8 sm:pb-6 text-center z-10 animate-in fade-in duration-1000 delay-700 fill-mode-both">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span>RotaGen</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>NHS Rota Management</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-red-400/80 italic">Authorised users only</span>
          </div>
        </div>
      </div>
    </>
  );
}
