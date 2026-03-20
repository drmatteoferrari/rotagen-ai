import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRotaContext } from "@/contexts/RotaContext";
import type { RotaConfig } from "@/lib/rotaConfig";

export interface BankHolidayEntry {
  id: string;
  date: Date;
  name: string;
  isAutoAdded: boolean;
  isActive: boolean;
}

export interface BhShiftRule {
  shift_key: string;
  name: string;
  start_time: string;
  end_time: string;
  target_doctors: number;
  included: boolean;
}

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
  rotaStartTime: string;
  rotaEndTime: string;
  setRotaStartTime: (t: string) => void;
  setRotaEndTime: (t: string) => void;
  // Bank holidays working state (Step 2 temp memory)
  rotaBankHolidays: BankHolidayEntry[];
  setRotaBankHolidays: (v: BankHolidayEntry[]) => void;
  bhSameAsWeekend: boolean | null;
  setBhSameAsWeekend: (v: boolean | null) => void;
  bhShiftRules: BhShiftRule[];
  setBhShiftRules: (v: BhShiftRule[]) => void;
  periodWorkingStateLoaded: boolean;
  setPeriodWorkingStateLoaded: (v: boolean) => void;
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
  // WTR Step 4
  oncallContinuousRestStart: string;
  oncallContinuousRestEnd: string;
  oncallIfRestNotMetMaxHours: number;
  oncallBreakReferenceWeeks: number;
  oncallBreakFineThresholdPct: number;
  setOncallContinuousRestStart: (v: string) => void;
  setOncallContinuousRestEnd: (v: string) => void;
  setOncallIfRestNotMetMaxHours: (v: number) => void;
  setOncallBreakReferenceWeeks: (v: number) => void;
  setOncallBreakFineThresholdPct: (v: number) => void;
  // Source tracking
  restoredFromDb: boolean;
  // Reset
  resetWtr: () => void;
}

const AdminSetupContext = createContext<AdminSetupContextType | undefined>(undefined);

export function AdminSetupProvider({ children }: { children: ReactNode }) {
  const [isDepartmentComplete, setDepartmentComplete] = useState(false);
  const [isWtrComplete, setWtrComplete] = useState(false);
  const [isPeriodComplete, setPeriodComplete] = useState(false);
  const [areSurveysDone, setSurveysDone] = useState(false);
  const [rotaStartDate, setRotaStartDate] = useState<Date | undefined>();
  const [rotaEndDate, setRotaEndDate] = useState<Date | undefined>();
  const [rotaStartTime, setRotaStartTime] = useState("08:00");
  const [rotaEndTime, setRotaEndTime] = useState("08:00");
  const [restoredFromDb, setRestoredFromDb] = useState(false);

  // Bank holidays / Step 2 working state
  const [rotaBankHolidays, setRotaBankHolidays] = useState<BankHolidayEntry[]>([]);
  const [bhSameAsWeekend, setBhSameAsWeekend] = useState<boolean | null>(null);
  const [bhShiftRules, setBhShiftRules] = useState<BhShiftRule[]>([]);
  const [periodWorkingStateLoaded, setPeriodWorkingStateLoaded] = useState(false);

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
  // WTR Step 4
  const [oncallContinuousRestStart, setOncallContinuousRestStart] = useState("22:00");
  const [oncallContinuousRestEnd, setOncallContinuousRestEnd] = useState("07:00");
  const [oncallIfRestNotMetMaxHours, setOncallIfRestNotMetMaxHours] = useState(5);
  const [oncallBreakReferenceWeeks, setOncallBreakReferenceWeeks] = useState(4);
  const [oncallBreakFineThresholdPct, setOncallBreakFineThresholdPct] = useState(25);

  const { restoredConfig } = useRotaContext();

  useEffect(() => {
    if (!restoredConfig) return;
    const config = restoredConfig;

    if (config.rotaPeriod.startDate) {
      setRotaStartDate(new Date(config.rotaPeriod.startDate));
      setPeriodComplete(true);
    }
    if (config.rotaPeriod.endDate) {
      setRotaEndDate(new Date(config.rotaPeriod.endDate));
    }

    // Restore times
    if (config.rotaPeriod.startTime && config.rotaPeriod.startTime !== "08:00") {
      setRotaStartTime(config.rotaPeriod.startTime);
    }
    if (config.rotaPeriod.endTime && config.rotaPeriod.endTime !== "08:00") {
      setRotaEndTime(config.rotaPeriod.endTime);
    }

    // Restore bank holidays
    if (config.rotaPeriod.bankHolidays && config.rotaPeriod.bankHolidays.length > 0) {
      setRotaBankHolidays(
        config.rotaPeriod.bankHolidays.map((h: any, i: number) => ({
          id: h.id ?? `bh-${i}`,
          date: new Date(h.date + "T00:00:00"),
          name: h.name,
          isAutoAdded: h.isAutoAdded ?? true,
          isActive: h.isActive ?? true,
        }))
      );
    }

    // Restore BH settings
    if ((config as any).bhSameAsWeekend !== undefined) {
      setBhSameAsWeekend((config as any).bhSameAsWeekend ?? null);
    }
    if ((config as any).bhShiftRules && Array.isArray((config as any).bhShiftRules)) {
      setBhShiftRules((config as any).bhShiftRules);
    }
    setPeriodWorkingStateLoaded(true);

    if (config.shifts.length > 0) {
      setDepartmentComplete(true);
    }

    if (config.wtr) {
      const w = config.wtr;
      setMaxAvgWeekly(w.maxHoursPerWeek);
      setMaxIn7Days(w.maxHoursPer168h);
      setMaxConsecDays(w.maxConsecStandard);
      setMaxConsecLong(w.maxConsecLong);
      setMaxConsecNights(w.maxConsecNights);
      setRestPostNights(w.restAfterNightsH);
      setRestPostBlock(w.restAfterLongH);
      setRestAfter7(w.restAfterStandardH);
      setWeekendFreq(w.weekendFrequency);
      setOncallContinuousRestStart(w.oncall.continuousRestStart ?? "22:00");
      setOncallContinuousRestEnd(w.oncall.continuousRestEnd ?? "07:00");
      setOncallIfRestNotMetMaxHours(w.oncall.ifRestNotMetMaxHours ?? 5);
      setOncallBreakReferenceWeeks(w.oncall.breakReferenceWeeks ?? 4);
      setOncallBreakFineThresholdPct(w.oncall.breakFineThresholdPct ?? 25);
      setWtrComplete(true);
    }

    setRestoredFromDb(true);
  }, [restoredConfig]);

  const resetWtr = useCallback(() => {
    setMaxAvgWeekly(48);
    setMaxIn7Days(72);
    setMaxConsecDays(7);
    setMaxConsecLong(7);
    setMaxConsecNights(4);
    setRestPostNights(46);
    setRestPostBlock(48);
    setRestAfter7(48);
    setWeekendFreq(3);
    setOncallContinuousRestStart("22:00");
    setOncallContinuousRestEnd("07:00");
    setOncallIfRestNotMetMaxHours(5);
    setOncallBreakReferenceWeeks(4);
    setOncallBreakFineThresholdPct(25);
    setWtrComplete(false);
  }, []);

  return (
    <AdminSetupContext.Provider
      value={{
        isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone,
        setDepartmentComplete, setWtrComplete, setPeriodComplete, setSurveysDone,
        rotaStartDate, rotaEndDate, setRotaStartDate, setRotaEndDate,
        rotaStartTime, rotaEndTime, setRotaStartTime, setRotaEndTime,
        rotaBankHolidays, setRotaBankHolidays,
        bhSameAsWeekend, setBhSameAsWeekend,
        bhShiftRules, setBhShiftRules,
        periodWorkingStateLoaded, setPeriodWorkingStateLoaded,
        maxAvgWeekly, maxIn7Days, setMaxAvgWeekly, setMaxIn7Days,
        maxConsecDays, maxConsecLong, maxConsecNights, setMaxConsecDays, setMaxConsecLong, setMaxConsecNights,
        restPostNights, restPostBlock, restAfter7, weekendFreq, setRestPostNights, setRestPostBlock, setRestAfter7, setWeekendFreq,
        oncallContinuousRestStart, oncallContinuousRestEnd, oncallIfRestNotMetMaxHours, oncallBreakReferenceWeeks, oncallBreakFineThresholdPct,
        setOncallContinuousRestStart, setOncallContinuousRestEnd, setOncallIfRestNotMetMaxHours, setOncallBreakReferenceWeeks, setOncallBreakFineThresholdPct,
        restoredFromDb,
        resetWtr,
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
