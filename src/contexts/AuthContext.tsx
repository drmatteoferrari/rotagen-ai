import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// SECTION 4 — Login restores config; logout clears session
// SECTION 4 — Account settings in AuthContext

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
  logout: () => void;
  googleLogin: () => Promise<void>;
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

// Standalone utility — can be called from login and dashboard
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const email = session.user.email ?? '';
          const ALLOWED = ['matteferro31@gmail.com'];
          if (!ALLOWED.includes(email)) {
            await supabase.auth.signOut();
            toast.error('Access denied. You are not authorised to use this application.');
            return;
          }
          setUser({
            username: email,
            email,
            role: 'coordinator',
            displayName: session.user.user_metadata?.full_name ?? email,
          });
          const settings = await loadAccountSettings(email);
          setAccountSettings(settings);
          await restoreForUser(email);
        }
        if (event === 'SIGNED_OUT') {
          setUser(prev => {
            if (prev && prev.username !== 'developer1') {
              clearSession();
              return null;
            }
            return prev;
          });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [restoreForUser, clearSession]);

  const googleLogin = useCallback(async () => {
    const origin = window.location.origin;
    const isLovable = origin.includes('.lovable.app') || origin.includes('.lovableproject.com');
    const redirectTo = isLovable
      ? `${origin}/~oauth/callback`
      : origin;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account', access_type: 'online' },
        skipBrowserRedirect: false,
      },
    });
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

    // Load account settings before redirect
    const settings = await loadAccountSettings(HARDCODED_USER.username);
    setAccountSettings(settings);

    // Restore config from DB before redirect (silently)
    await restoreForUser(HARDCODED_USER.username);
    // SECTION 1 COMPLETE

    return { success: true };
  }, [restoreForUser]);

  const logout = useCallback(() => {
    setUser(null);
    setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, googleLogin, accountSettings, setAccountSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// SECTION 4 COMPLETE
// SECTION 1 COMPLETE
