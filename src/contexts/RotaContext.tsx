import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRotaConfig, getCurrentRotaConfig, type RotaConfig } from "@/lib/rotaConfig";

// SECTION 3 + 4 + 6 — App context for config ID, restored config, sessionStorage

interface RotaContextType {
  currentRotaConfigId: string | null;
  setCurrentRotaConfigId: (id: string | null) => void;
  restoredConfig: RotaConfig | null;
  setRestoredConfig: (config: RotaConfig | null) => void;
  restoreForUser: (username: string) => Promise<RotaConfig | null>;
  clearSession: () => void;
}

const RotaContext = createContext<RotaContextType | undefined>(undefined);

const SESSION_KEY = "rotaConfigId";

export function RotaProvider({ children }: { children: ReactNode }) {
  const [currentRotaConfigId, setCurrentRotaConfigIdState] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY)
  );
  const [restoredConfig, setRestoredConfig] = useState<RotaConfig | null>(null);

  // SECTION 6 — Wrap setter to persist to sessionStorage
  const setCurrentRotaConfigId = useCallback((id: string | null) => {
    setCurrentRotaConfigIdState(id);
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // On mount, validate sessionStorage ID against DB
  useEffect(() => {
    const savedId = sessionStorage.getItem(SESSION_KEY);
    if (!savedId) return;
    (async () => {
      try {
        const config = await getRotaConfig(savedId);
        setRestoredConfig(config);
        setCurrentRotaConfigIdState(savedId);
      } catch {
        // Row no longer exists
        sessionStorage.removeItem(SESSION_KEY);
        setCurrentRotaConfigIdState(null);
        setRestoredConfig(null);
      }
    })();
  }, []);
  // SECTION 6 COMPLETE

  // SECTION 4 — restoreForUser: called from AuthContext on login
  const restoreForUser = useCallback(async (username: string): Promise<RotaConfig | null> => {
    try {
      const config = await getCurrentRotaConfig(username);
      if (config) {
        setCurrentRotaConfigId(config.id);
        setRestoredConfig(config);
      } else {
        setCurrentRotaConfigId(null);
        setRestoredConfig(null);
      }
      return config;
    } catch {
      return null;
    }
  }, [setCurrentRotaConfigId]);
  // SECTION 4 COMPLETE

  const clearSession = useCallback(() => {
    setCurrentRotaConfigIdState(null);
    setRestoredConfig(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <RotaContext.Provider value={{
      currentRotaConfigId,
      setCurrentRotaConfigId,
      restoredConfig,
      setRestoredConfig,
      restoreForUser,
      clearSession,
    }}>
      {children}
    </RotaContext.Provider>
  );
}

export function useRotaContext() {
  const ctx = useContext(RotaContext);
  if (!ctx) throw new Error("useRotaContext must be used within RotaProvider");
  return ctx;
}

// SECTION 3 + 4 + 6 COMPLETE
