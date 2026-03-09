import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary/8 p-4">
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
            <h2 className="mb-5 text-center text-lg font-semibold text-card-foreground">Reset your password</h2>

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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            {success && (
              <p className="mt-3 text-xs text-emerald-600 text-center">
                Check your email for a reset link.
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
              Back to sign in
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
