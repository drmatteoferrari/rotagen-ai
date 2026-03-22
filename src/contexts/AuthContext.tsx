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

export async function loadAccountSettings(ownedBy: string): Promise<AccountSettings> {
  try {
    const { data, error } = await supabase
      .from("account_settings")
      .select("department_name, trust_name")
      .eq("owned_by", ownedBy)
      .maybeSingle();

    if (error) throw error;
    if (!data) return DEFAULT_ACCOUNT_SETTINGS;

    return {
      departmentName: data.department_name || null,
      trustName: data.trust_name || null,
    };
  } catch (error) {
    console.error("Failed to load account settings:", error);
    return DEFAULT_ACCOUNT_SETTINGS;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);
const MASTER_EMAIL = "matteferro31@gmail.com";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(DEFAULT_ACCOUNT_SETTINGS);
  const { restoreForUser, clearSession } = useRotaContext();

  useEffect(() => {
    // Check initial session safely
    const initSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) {
          setAuthLoading(false);
        }
      } catch (err) {
        console.error("Failed to get initial session:", err);
        setAuthLoading(false);
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event, session?.user?.email);

      try {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
          const email = session.user.email ?? "";
          const meta = session.user.user_metadata ?? {};
          const isMaster = email === MASTER_EMAIL;

          if (!isMaster) {
            // Verify approval
            const [{ data: regData }, { data: coordData }] = await Promise.all([
              supabase
                .from("registration_requests")
                .select("status")
                .eq("email", email)
                .maybeSingle(),
              supabase
                .from("coordinator_accounts")
                .select("status")
                .eq("email", email)
                .maybeSingle(),
            ]);

            const isApproved = regData?.status === "approved" || coordData?.status === "active";

            if (!isApproved) {
              console.warn("User not approved, signing out:", email);
              await supabase.auth.signOut();
              toast.error("Access denied. Your account is not authorised yet.");
              setUser(null);
              setAuthLoading(false);
              return;
            }
          }

          // User is valid and approved
          setUser({
            id: session.user.id,
            username: meta.username ?? email.split("@")[0],
            email,
            role: "coordinator",
            displayName: meta.full_name ?? email,
            mustChangePassword: meta.must_change_password ?? false,
          });

          // Load background data safely without blocking the UI
          Promise.all([
            loadAccountSettings(session.user.id).then(setAccountSettings),
            restoreForUser(session.user.id),
          ]).catch((err) => console.error("Error loading user context:", err));
        }

        if (event === "SIGNED_OUT") {
          localStorage.removeItem("currentRotaConfigId");
          setUser(null);
          setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
          clearSession();
        }
      } catch (err) {
        console.error("Critical error during auth state change:", err);
        toast.error("Something went wrong verifying your session.");
      } finally {
        // ALWAYS turn off the loading spinner
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [restoreForUser, clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Login failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, authLoading, login, logout, accountSettings, setAccountSettings }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
