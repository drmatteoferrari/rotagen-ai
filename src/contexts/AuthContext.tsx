import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthUser {
  username: string;
  email: string;
  role: string;
  displayName: string;
  mustChangePassword: boolean;
}

interface AccountSettings {
  departmentName: string | null;
  trustName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  accountSettings: AccountSettings;
  setAccountSettings: (settings: AccountSettings) => void;
}

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = { departmentName: null, trustName: null };

export async function loadAccountSettings(
  ownedBy: string
): Promise<AccountSettings> {
  const { data, error } = await supabase
    .from("account_settings")
    .select("department_name, trust_name")
    .eq("owned_by", ownedBy)
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

const MASTER_EMAIL = "matteferro31@gmail.com";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(DEFAULT_ACCOUNT_SETTINGS);
  const { restoreForUser, clearSession } = useRotaContext();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
            const email = session.user.email ?? "";
            const meta = session.user.user_metadata ?? {};

            const isMaster = email === MASTER_EMAIL;
            if (!isMaster) {
              // Run both checks in parallel for speed
              const [regResult, coordResult] = await Promise.all([
                (supabase
                  .from("registration_requests" as any)
                  .select("status")
                  .eq("email", email)
                  .maybeSingle() as any),
                (supabase
                  .from("coordinator_accounts" as any)
                  .select("status")
                  .eq("email", email)
                  .maybeSingle() as any),
              ]);

              const isApproved =
                regResult?.data?.status === "approved" ||
                coordResult?.data?.status === "active";

              if (!isApproved) {
                await supabase.auth.signOut();
                toast.error("Access denied. You are not authorised.");
                return;
              }
            }

            const displayName = meta.full_name ?? email;
            const username = meta.username ?? email.split("@")[0];

            setUser({
              username,
              email,
              role: "coordinator",
              displayName,
              mustChangePassword: meta.must_change_password ?? false,
            });

            // Fire and forget — do not await
            loadAccountSettings(session.user.id).then(setAccountSettings);
            restoreForUser(session.user.id);
          }

          if (event === "SIGNED_OUT") {
            setUser(null);
            setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
            clearSession();
          }
        } catch (err) {
          console.error("Auth state change error:", err);
        } finally {
          if (event === "INITIAL_SESSION") {
            setAuthLoading(false);
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [restoreForUser, clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, authLoading, login, logout, accountSettings, setAccountSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
