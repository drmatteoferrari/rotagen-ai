import { createContext, useContext, type ReactNode } from "react";

interface SurveyModeContextType {
  isAdminMode: boolean;
  doctorId?: string;
  doctorName?: string;
  doctorEmail?: string;
}

const SurveyModeContext = createContext<SurveyModeContextType>({ isAdminMode: false });

export function SurveyModeProvider({
  children,
  isAdminMode = false,
  doctorId,
  doctorName,
  doctorEmail,
}: SurveyModeContextType & { children: ReactNode }) {
  return (
    <SurveyModeContext.Provider value={{ isAdminMode, doctorId, doctorName, doctorEmail }}>
      {children}
    </SurveyModeContext.Provider>
  );
}

export function useSurveyMode() {
  return useContext(SurveyModeContext);
}
