import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface AuthUser {
  username: string;
  email: string;
  role: string;
  displayName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => { success: boolean; error?: { field: "username" | "password"; message: string } };
  logout: () => void;
}

const HARDCODED_USER: AuthUser = {
  username: "developer1",
  email: "developer1@rotagen.com",
  role: "coordinator",
  displayName: "Developer 1",
};

const HARDCODED_PASSWORD = "developer1";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback((usernameOrEmail: string, password: string) => {
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
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
