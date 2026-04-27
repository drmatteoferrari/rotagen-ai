import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthUser {
  id: string; // Supabase auth UUID — use this for all DB queries
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
      (event, session) => {
        // Defer all async Supabase calls outside the GoTrue lock context.
        // onAuthStateChange fires while the GoTrue Web Lock is held — awaiting
        // Supabase queries inside it without deferral causes lock contention.
        setTimeout(async () => {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
            const email = session.user.email ?? "";
            const meta = session.user.user_metadata ?? {};
            const isMaster = email === MASTER_EMAIL;

            if (!isMaster) {
              // Use .limit(1) array queries — never throws on multiple rows.
              // A coordinator may have multiple registration_requests rows
              // (e.g. submitted access more than once) — this is valid and expected.
              // We only need to know if at least one approved row exists.
              const { data: regRows } = await (supabase
                .from("registration_requests" as any)
                .select("id")
                .eq("email", email)
                .eq("status", "approved")
                .limit(1) as any);

              const { data: coordRows } = await (supabase
                .from("coordinator_accounts" as any)
                .select("id")
                .eq("email", email)
                .eq("status", "active")
                .limit(1) as any);

              const isApproved =
                (regRows?.length ?? 0) > 0 ||
                (coordRows?.length ?? 0) > 0;

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

          // If the refresh token is rejected by the server (rotated, revoked,
          // or expired), GoTrue emits TOKEN_REFRESHED with a null session.
          // Force a clean signOut so the user is taken back to /login instead
          // of being stuck in a stale-session loop.
          if (event === "TOKEN_REFRESHED" && !session) {
            await supabase.auth.signOut();
          }

          if (event === "INITIAL_SESSION") {
            setAuthLoading(false);
          }
        }, 0);
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
