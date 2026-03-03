import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// SECTION 3 — App context for config ID

interface RotaContextType {
  currentRotaConfigId: string | null;
  setCurrentRotaConfigId: (id: string | null) => void;
}

const RotaContext = createContext<RotaContextType | undefined>(undefined);

export function RotaProvider({ children }: { children: ReactNode }) {
  const [currentRotaConfigId, setCurrentRotaConfigId] = useState<string | null>(null);

  // On mount, restore most recent draft/complete config ID
  useEffect(() => {
    async function restore() {
      const { data } = await supabase
        .from("rota_configs")
        .select("id")
        .in("status", ["draft", "complete"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setCurrentRotaConfigId(data.id);
    }
    restore();
  }, []);

  return (
    <RotaContext.Provider value={{ currentRotaConfigId, setCurrentRotaConfigId }}>
      {children}
    </RotaContext.Provider>
  );
}

export function useRotaContext() {
  const ctx = useContext(RotaContext);
  if (!ctx) throw new Error("useRotaContext must be used within RotaProvider");
  return ctx;
}

// SECTION 3 COMPLETE
