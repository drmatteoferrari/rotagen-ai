import { createContext, useContext, useState, type ReactNode } from "react";

interface AdminSetupContextType {
  isDepartmentComplete: boolean;
  isWtrComplete: boolean;
  isPeriodComplete: boolean;
  areSurveysDone: boolean;
  setDepartmentComplete: (v: boolean) => void;
  setWtrComplete: (v: boolean) => void;
  setPeriodComplete: (v: boolean) => void;
  setSurveysDone: (v: boolean) => void;
  rotaStartDate: Date | undefined;
  rotaEndDate: Date | undefined;
  setRotaStartDate: (d: Date | undefined) => void;
  setRotaEndDate: (d: Date | undefined) => void;
}

const AdminSetupContext = createContext<AdminSetupContextType | undefined>(undefined);

export function AdminSetupProvider({ children }: { children: ReactNode }) {
  const [isDepartmentComplete, setDepartmentComplete] = useState(false);
  const [isWtrComplete, setWtrComplete] = useState(false);
  const [isPeriodComplete, setPeriodComplete] = useState(false);
  const [areSurveysDone, setSurveysDone] = useState(false);
  const [rotaStartDate, setRotaStartDate] = useState<Date | undefined>();
  const [rotaEndDate, setRotaEndDate] = useState<Date | undefined>();

  return (
    <AdminSetupContext.Provider
      value={{
        isDepartmentComplete,
        isWtrComplete,
        isPeriodComplete,
        areSurveysDone,
        setDepartmentComplete,
        setWtrComplete,
        setPeriodComplete,
        setSurveysDone,
        rotaStartDate,
        rotaEndDate,
        setRotaStartDate,
        setRotaEndDate,
      }}
    >
      {children}
    </AdminSetupContext.Provider>
  );
}

export function useAdminSetup() {
  const ctx = useContext(AdminSetupContext);
  if (!ctx) throw new Error("useAdminSetup must be used within AdminSetupProvider");
  return ctx;
}
