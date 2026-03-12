import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const ALLOWED_EMAILS = ["matteferro31@gmail.com"];

interface AuthUser {
  username: string;
  email: string;
  role: string;
  displayName: string;
}

interface AccountSettings {
  departmentName: string | null;
  trustName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: { field: "username" | "password"; message: string } }>;
  googleLogin: () => Promise<void>;
  logout: () => void;
  accountSettings: AccountSettings;
  setAccountSettings: (settings: AccountSettings) => void;
}

const HARDCODED_USER: AuthUser = {
  username: "developer1",
  email: "developer1@rotagen.com",
  role: "coordinator",
  displayName: "Developer 1",
};

const HARDCODED_PASSWORD = "developer1";

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = { departmentName: null, trustName: null };

export async function loadAccountSettings(
  username: string
): Promise<AccountSettings> {
  const { data, error } = await supabase
    .from("account_settings")
    .select("department_name, trust_name")
    .eq("owned_by", username)
    .maybeSingle();

  if (error) {
    console.error("Failed to load account settings:", error);
    return { departmentName: null, trustName: null };
  }

  if (!data) return { departmentName: null, trustName: null };

  return {
    departmentName: data.department_name || null,
    trustName: data.trust_name || null,
  };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(DEFAULT_ACCOUNT_SETTINGS);
  const { restoreForUser, clearSession } = useRotaContext();
  const navigate = useNavigate();
  const handledTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        // Deduplicate using access token
        const token = session.access_token;
        if (handledTokenRef.current === token) return;
        handledTokenRef.current = token;

        const email = session.user.email ?? "";
        if (!ALLOWED_EMAILS.includes(email)) {
          // Fire-and-forget sign out
          void supabase.auth.signOut();
          setUser(null);
          setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
          toast.error("Access denied. You are not authorised to use this application.");
          navigate("/login", { replace: true });
          return;
        }

        // Set user synchronously
        const mapped: AuthUser = {
          username: email,
          email,
          role: "coordinator",
          displayName: session.user.user_metadata?.full_name ?? email ?? "Coordinator",
        };
        setUser(mapped);

        // Fire-and-forget hydration
        void (async () => {
          try {
            const settings = await loadAccountSettings(email);
            setAccountSettings(settings);
            await restoreForUser(email);
          } catch (err) {
            console.error("Hydration error:", err);
          }
          navigate("/admin/dashboard", { replace: true });
        })();
      }

      if (event === "SIGNED_OUT") {
        handledTokenRef.current = null;
        setUser(null);
        setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
        clearSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const googleLogin = useCallback(async () => {
    const isPreview = window.location.hostname.includes("lovableproject.com");

    if (isPreview) {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account", access_type: "online" },
      });
      if (error) {
        console.error("Google sign-in error:", error);
        toast.error("Failed to start Google sign-in.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account", access_type: "online" },
        },
      });
      if (error) {
        console.error("Google sign-in error:", error);
        toast.error("Failed to start Google sign-in.");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    }
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const trimmed = usernameOrEmail.trim();

    if (!trimmed) {
      return { success: false, error: { field: "username" as const, message: "Please enter your username or email" } };
    }

    const matchesIdentity =
      trimmed.toLowerCase() === HARDCODED_USER.username.toLowerCase() ||
      trimmed.toLowerCase() === HARDCODED_USER.email.toLowerCase();

    if (!matchesIdentity) {
      return { success: false, error: { field: "username" as const, message: "No account found with that username or email" } };
    }

    if (password !== HARDCODED_PASSWORD) {
      return { success: false, error: { field: "password" as const, message: "Incorrect password" } };
    }

    setUser(HARDCODED_USER);

    const settings = await loadAccountSettings(HARDCODED_USER.username);
    setAccountSettings(settings);

    await restoreForUser(HARDCODED_USER.username);

    return { success: true };
  }, [restoreForUser]);

  const logout = useCallback(() => {
    handledTokenRef.current = null;
    setUser(null);
    setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
    clearSession();
    void supabase.auth.signOut();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, googleLogin, logout, accountSettings, setAccountSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// SECTION 1 COMPLETE
