import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.mustChangePassword) {
      navigate("/change-password", { replace: true });
    } else {
      navigate("/", { replace: true });
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

    // If no "@", treat as username and resolve email
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

    const result = await login(emailToUse, password);
    if (!result.success) {
      setError(result.error ?? "Sign in failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border shadow-sm">
            <span className="text-2xl font-black tracking-tighter text-primary">RE</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">RotaGen</h1>
          <p className="text-sm text-muted-foreground">Fair NHS rotas in minutes, not hours</p>
        </div>

        {/* Login card */}
        <Card className="w-full shadow-xl">
          <CardContent className="p-6 pt-6">
            <h2 className="mb-5 text-center text-lg font-semibold text-card-foreground">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email or username */}
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Email or username</Label>
                <Input
                  ref={identifierRef}
                  id="identifier"
                  type="text"
                  placeholder="Email address or username"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
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

              {/* Error */}
              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              {/* Sign in button */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            {/* Forgot password */}
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Request access */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/signup")}
              disabled={loading}
            >
              Request access
            </Button>

            {/* Dev divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Dev quick login */}
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                const result = await login("matteferro31@gmail.com", "matteferro31");
                if (result.success) navigate("/", { replace: true });
                else setError(result.error ?? "Dev login failed");
                setLoading(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code className="h-3 w-3" />
              Dev login (matteferro31@gmail.com)
            </button>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          RotaGen · NHS Rota Management · For authorised users only
        </p>
      </div>
    </div>
  );
}
