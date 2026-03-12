import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMatchError(false);

    if (password !== confirmPassword) {
      setMatchError(true);
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      // Fire webhook (non-blocking)
      const username = email.split("@")[0];
      fetch("https://drmatteoferrari.app.n8n.cloud/webhook-test/new-user-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          signupDate: new Date().toISOString(),
          productName: "RotaGen",
        }),
      }).catch(console.error);

      setSuccess(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border shadow-sm">
            <span className="text-2xl font-black tracking-tighter text-primary">RE</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">RotaGen</h1>
          <p className="text-sm text-muted-foreground">Fair NHS rotas in minutes, not hours</p>
        </div>

        <Card className="w-full shadow-xl">
          <CardContent className="p-6 pt-6">
            <h2 className="mb-5 text-center text-lg font-semibold text-card-foreground">Create your account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@nhs.net"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setMatchError(false); setError(null); }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setMatchError(false); setError(null); }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {matchError && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Google sign-up */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              disabled={loading}
              onClick={async () => {
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) console.error("Google sign-in error:", error);
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign up with Google
            </Button>

            {success && (
              <p className="mt-3 text-xs text-emerald-600 text-center">
                Account created! Check your email to confirm before signing in.
              </p>
            )}
            {error && (
              <p className="mt-3 text-xs text-destructive text-center">{error}</p>
            )}

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-xs text-primary hover:underline w-full text-center mt-4 block"
            >
              Already have an account? Sign in
            </button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          RotaGen · NHS Rota Management · For authorised users only
        </p>
      </div>
    </div>
  );
}
