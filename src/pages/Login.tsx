import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;

    setLoading(true);
    setTimeout(async () => {
      const result = await login(username, password);
      if (result.success) {
        navigate("/", { replace: true });
      } else if (result.error) {
        setErrors({ [result.error.field]: result.error.message });
      }
      setLoading(false);
    }, 600);
  };

  const handleDevLogin = () => {
    setUsername("developer1");
    setPassword("developer1");
    setErrors({});
    setTimeout(() => {
      setLoading(true);
      setTimeout(async () => {
        const result = await login("developer1", "developer1");
        if (result.success) {
          navigate("/", { replace: true });
        }
        setLoading(false);
      }, 600);
    }, 400);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(213,94%,48%)] to-[hsl(260,60%,50%)] p-4">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <span className="text-2xl font-black tracking-tighter">RE</span>
          </div>
          <h1 className="text-3xl font-bold text-white">RotaGen</h1>
          <p className="text-sm text-white/70">Fair NHS rotas in minutes, not hours</p>
        </div>

        {/* Login card */}
        <Card className="w-full shadow-xl">
          <CardContent className="p-6 pt-6">
            <h2 className="mb-5 text-center text-lg font-semibold text-card-foreground">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username / email */}
              <div className="space-y-1.5">
                <Label htmlFor="username">Username or email</Label>
                <Input
                  ref={usernameRef}
                  id="username"
                  type="text"
                  placeholder="e.g. developer1"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: undefined })); }}
                />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
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
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
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
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              {/* Sign in button */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Dev quick login */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={handleDevLogin}
              disabled={loading}
            >
              <Code className="h-4 w-4" />
              Developer login — developer1
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-white/50">
          RotaGen · NHS Rota Management · For authorised users only
        </p>
      </div>
    </div>
  );
}
