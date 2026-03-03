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
  // WTR Step 1
  maxAvgWeekly: number;
  maxIn7Days: number;
  setMaxAvgWeekly: (v: number) => void;
  setMaxIn7Days: (v: number) => void;
  // WTR Step 2
  maxConsecDays: number;
  maxConsecLong: number;
  maxConsecNights: number;
  setMaxConsecDays: (v: number) => void;
  setMaxConsecLong: (v: number) => void;
  setMaxConsecNights: (v: number) => void;
  // WTR Step 3
  restPostNights: number;
  restPostBlock: number;
  restAfter7: number;
  weekendFreq: number;
  setRestPostNights: (v: number) => void;
  setRestPostBlock: (v: number) => void;
  setRestAfter7: (v: number) => void;
  setWeekendFreq: (v: number) => void;
}

const AdminSetupContext = createContext<AdminSetupContextType | undefined>(undefined);

export function AdminSetupProvider({ children }: { children: ReactNode }) {
  const [isDepartmentComplete, setDepartmentComplete] = useState(false);
  const [isWtrComplete, setWtrComplete] = useState(false);
  const [isPeriodComplete, setPeriodComplete] = useState(false);
  const [areSurveysDone, setSurveysDone] = useState(false);
  const [rotaStartDate, setRotaStartDate] = useState<Date | undefined>();
  const [rotaEndDate, setRotaEndDate] = useState<Date | undefined>();
  // WTR Step 1
  const [maxAvgWeekly, setMaxAvgWeekly] = useState(48);
  const [maxIn7Days, setMaxIn7Days] = useState(72);
  // WTR Step 2
  const [maxConsecDays, setMaxConsecDays] = useState(7);
  const [maxConsecLong, setMaxConsecLong] = useState(7);
  const [maxConsecNights, setMaxConsecNights] = useState(4);
  // WTR Step 3
  const [restPostNights, setRestPostNights] = useState(46);
  const [restPostBlock, setRestPostBlock] = useState(48);
  const [restAfter7, setRestAfter7] = useState(48);
  const [weekendFreq, setWeekendFreq] = useState(3);

  return (
    <AdminSetupContext.Provider
      value={{
        isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone,
        setDepartmentComplete, setWtrComplete, setPeriodComplete, setSurveysDone,
        rotaStartDate, rotaEndDate, setRotaStartDate, setRotaEndDate,
        maxAvgWeekly, maxIn7Days, setMaxAvgWeekly, setMaxIn7Days,
        maxConsecDays, maxConsecLong, maxConsecNights, setMaxConsecDays, setMaxConsecLong, setMaxConsecNights,
        restPostNights, restPostBlock, restAfter7, weekendFreq, setRestPostNights, setRestPostBlock, setRestAfter7, setWeekendFreq,
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
