import { createContext, useContext, useState, ReactNode, useCallback } from "react";
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
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: { field: "username" | "password"; message: string } }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  accountSettings: AccountSettings;
  setAccountSettings: (settings: AccountSettings) => void;
}

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

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const trimmed = usernameOrEmail.trim();

    if (!trimmed) {
      return { success: false, error: { field: "username" as const, message: "Please enter your username" } };
    }

    const { data: row, error } = await (supabase
      .from("coordinator_accounts" as any)
      .select("*")
      .ilike("username", trimmed)
      .eq("status", "active")
      .maybeSingle() as any);

    if (error) {
      console.error("Login query error:", error);
      return { success: false, error: { field: "username" as const, message: "Login failed — please try again" } };
    }

    if (!row) {
      return { success: false, error: { field: "username" as const, message: "No account found with that username" } };
    }

    if (row.password !== password) {
      return { success: false, error: { field: "password" as const, message: "Incorrect password" } };
    }

    const authUser: AuthUser = {
      username: row.username,
      email: row.email,
      role: "coordinator",
      displayName: row.display_name,
    };

    setUser(authUser);

    const settings = await loadAccountSettings(row.username);
    setAccountSettings(settings);

    await restoreForUser(row.username);

    return { success: true };
  }, [restoreForUser]);

  const logout = useCallback(() => {
    setUser(null);
    setAccountSettings(DEFAULT_ACCOUNT_SETTINGS);
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, accountSettings, setAccountSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
