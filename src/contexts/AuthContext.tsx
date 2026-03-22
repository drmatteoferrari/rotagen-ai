import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthUser {
  id: string;
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

const MASTER_EMAIL = "admin@rotagen.com";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
              const { data: regApproved, error: regError } = await supabase
                .from("registration_requests" as any)
                .select("status")
                .eq("email", email)
                .maybeSingle() as any;

              if (regError) console.error("Registration check error:", regError);

              const { data: coordAccount, error: coordError } = await supabase
                .from("coordinator_accounts" as any)
                .select("status")
                .eq("email", email)
                .maybeSingle() as any;

              if (coordError) console.error("Coordinator check error:", coordError);

              const isApproved =
                regApproved?.status === "approved" ||
                coordAccount?.status === "active";

              if (!isApproved) {
                await supabase.auth.signOut();
                toast.error("Access denied. You are not authorised.");
                setAuthLoading(false);
                return;
              }
            }

            const displayName = meta.full_name ?? email;
            const username = meta.username ?? email.split("@")[0];

            setUser({
              id: session.user.id,
              username,
              email,
              role: "coordinator",
              displayName,
              mustChangePassword: meta.must_change_password ?? false,
            });

            loadAccountSettings(session.user.id).then(setAccountSettings);
            restoreForUser(session.user.id);
          }

          if (event === "SIGNED_OUT") {
            localStorage.removeItem("currentRotaConfigId");
            setUser(null);
            setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
            clearSession();
          }
        } catch (error) {
          console.error("Auth state change error:", error);
          toast.error("An error occurred while verifying your account.");
        } finally {
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
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
