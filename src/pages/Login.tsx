import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const usernameRef = useRef<HTMLInputElement>(null);

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

            {/* Forgot password */}
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
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

            {/* Google sign-in */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                await googleLogin();
                setLoading(false);
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>

            <div className="my-3" />

            {/* Create account */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate('/signup')}
              disabled={loading}
            >
              Create an account
            </Button>

            {/* Dev divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Dev quick login */}
            <button
              type="button"
              onClick={handleDevLogin}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code className="h-3 w-3" />
              Dev login (developer1)
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

// SECTION 2 COMPLETE
