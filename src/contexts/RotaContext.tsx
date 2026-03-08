// SECTION 9 COMPLETE
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRotaConfig, getCurrentRotaConfig, type RotaConfig } from "@/lib/rotaConfig";

interface RotaContextType {
  currentRotaConfigId: string | null;
  setCurrentRotaConfigId: (id: string | null) => void;
  restoredConfig: RotaConfig | null;
  setRestoredConfig: (config: RotaConfig | null) => void;
  restoreForUser: (username: string) => Promise<RotaConfig | null>;
  clearSession: () => void;
}

const RotaContext = createContext<RotaContextType | undefined>(undefined);

const STORAGE_KEY = "currentRotaConfigId";

export function RotaProvider({ children }: { children: ReactNode }) {
  const [currentRotaConfigId, setCurrentRotaConfigIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [restoredConfig, setRestoredConfig] = useState<RotaConfig | null>(null);

  const setCurrentRotaConfigId = useCallback((id: string | null) => {
    setCurrentRotaConfigIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // On mount, validate localStorage ID against DB
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;
    (async () => {
      try {
        const config = await getRotaConfig(savedId);
        setRestoredConfig(config);
        setCurrentRotaConfigIdState(savedId);
      } catch {
        // Row no longer exists — clear stale ID
        localStorage.removeItem(STORAGE_KEY);
        setCurrentRotaConfigIdState(null);
        setRestoredConfig(null);
      }
    })();
  }, []);

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

  const clearSession = useCallback(() => {
    setCurrentRotaConfigIdState(null);
    setRestoredConfig(null);
    localStorage.removeItem(STORAGE_KEY);
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
