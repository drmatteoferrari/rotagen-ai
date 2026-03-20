import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, type Dispatch, type SetStateAction } from "react";
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
  // Bank holidays working state (Step 2 temp memory)
  rotaBankHolidays: BankHolidayEntry[];
  setRotaBankHolidays: Dispatch<SetStateAction<BankHolidayEntry[]>>;
  bhSameAsWeekend: boolean | null;
  setBhSameAsWeekend: (v: boolean | null) => void;
  bhShiftRules: BhShiftRule[];
  setBhShiftRules: Dispatch<SetStateAction<BhShiftRule[]>>;
  periodWorkingStateLoaded: boolean;
  setPeriodWorkingStateLoaded: (v: boolean) => void;
  // WTR Step 1
  maxAvgWeekly: number;
  maxIn7Days: number;
  maxShiftLengthH: number;
  setMaxAvgWeekly: (v: number) => void;
  setMaxIn7Days: (v: number) => void;
  setMaxShiftLengthH: (v: number) => void;
  // WTR Step 2
  maxConsecDays: number;
  maxConsecLong: number;
  maxConsecNights: number;
  maxLongEveningConsec: number;
  setMaxConsecDays: (v: number) => void;
  setMaxConsecLong: (v: number) => void;
  setMaxConsecNights: (v: number) => void;
  setMaxLongEveningConsec: (v: number) => void;
  // WTR Step 3
  restPostNights: number;
  restPostBlock: number;
  restAfter7: number;
  weekendFreq: number;
  restAfterLongEveningH: number;
  minInterShiftRestH: number;
  setRestPostNights: (v: number) => void;
  setRestPostBlock: (v: number) => void;
  setRestAfter7: (v: number) => void;
  setWeekendFreq: (v: number) => void;
  setRestAfterLongEveningH: (v: number) => void;
  setMinInterShiftRestH: (v: number) => void;
  // WTR Step 4
  oncallMaxPer7Days: number;
  oncallLocalAgreementMaxConsec: number;
  oncallDayAfterMaxHours: number;
  oncallDayAfterLastConsecMaxH: number;
  oncallRestPer24h: number;
  oncallContinuousRestHours: number;
  oncallContinuousRestStart: string;
  oncallContinuousRestEnd: string;
  oncallIfRestNotMetMaxHours: number;
  oncallNoConsecExceptWknd: boolean;
  oncallNoSimultaneousShift: boolean;
  oncallBreakReferenceWeeks: number;
  oncallBreakFineThresholdPct: number;
  setOncallMaxPer7Days: (v: number) => void;
  setOncallLocalAgreementMaxConsec: (v: number) => void;
  setOncallDayAfterMaxHours: (v: number) => void;
  setOncallDayAfterLastConsecMaxH: (v: number) => void;
  setOncallRestPer24h: (v: number) => void;
  setOncallContinuousRestHours: (v: number) => void;
  setOncallContinuousRestStart: (v: string) => void;
  setOncallContinuousRestEnd: (v: string) => void;
  setOncallIfRestNotMetMaxHours: (v: number) => void;
  setOncallNoConsecExceptWknd: (v: boolean) => void;
  setOncallNoSimultaneousShift: (v: boolean) => void;
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
  const [restoredFromDb, setRestoredFromDb] = useState(false);

  // Bank holidays / Step 2 working state
  const [rotaBankHolidays, setRotaBankHolidays] = useState<BankHolidayEntry[]>([]);
  const [bhSameAsWeekend, setBhSameAsWeekend] = useState<boolean | null>(null);
  const [bhShiftRules, setBhShiftRules] = useState<BhShiftRule[]>([]);
  const [periodWorkingStateLoaded, setPeriodWorkingStateLoaded] = useState(false);

  // WTR Step 1
  const [maxAvgWeekly, setMaxAvgWeekly] = useState(48);
  const [maxIn7Days, setMaxIn7Days] = useState(72);
  const [maxShiftLengthH, setMaxShiftLengthH] = useState(13);
  // WTR Step 2
  const [maxConsecDays, setMaxConsecDays] = useState(7);
  const [maxConsecLong, setMaxConsecLong] = useState(4);
  const [maxConsecNights, setMaxConsecNights] = useState(4);
  const [maxLongEveningConsec, setMaxLongEveningConsec] = useState(4);
  // WTR Step 3
  const [restPostNights, setRestPostNights] = useState(46);
  const [restPostBlock, setRestPostBlock] = useState(48);
  const [restAfter7, setRestAfter7] = useState(48);
  const [weekendFreq, setWeekendFreq] = useState(3);
  const [restAfterLongEveningH, setRestAfterLongEveningH] = useState(48);
  const [minInterShiftRestH, setMinInterShiftRestH] = useState(11);
  // WTR Step 4
  const [oncallMaxPer7Days, setOncallMaxPer7Days] = useState(3);
  const [oncallLocalAgreementMaxConsec, setOncallLocalAgreementMaxConsec] = useState(7);
  const [oncallDayAfterMaxHours, setOncallDayAfterMaxHours] = useState(10);
  const [oncallDayAfterLastConsecMaxH, setOncallDayAfterLastConsecMaxH] = useState(10);
  const [oncallRestPer24h, setOncallRestPer24h] = useState(8);
  const [oncallContinuousRestHours, setOncallContinuousRestHours] = useState(5);
  const [oncallContinuousRestStart, setOncallContinuousRestStart] = useState("22:00");
  const [oncallContinuousRestEnd, setOncallContinuousRestEnd] = useState("07:00");
  const [oncallIfRestNotMetMaxHours, setOncallIfRestNotMetMaxHours] = useState(5);
  const [oncallNoConsecExceptWknd, setOncallNoConsecExceptWknd] = useState(true);
  const [oncallNoSimultaneousShift, setOncallNoSimultaneousShift] = useState(true);
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
    if (config.bhSameAsWeekend !== undefined) {
      setBhSameAsWeekend(config.bhSameAsWeekend ?? null);
    }
    if (config.bhShiftRules && Array.isArray(config.bhShiftRules)) {
      setBhShiftRules(config.bhShiftRules);
    }
    setPeriodWorkingStateLoaded(true);

    if (config.shifts.length > 0) {
      setDepartmentComplete(true);
    }

    if (config.wtr) {
      const w = config.wtr;
      setMaxAvgWeekly(w.maxHoursPerWeek);
      setMaxIn7Days(w.maxHoursPer168h);
      setMaxShiftLengthH(w.maxShiftLengthH ?? 13);
      setMaxConsecDays(w.maxConsecStandard);
      setMaxConsecLong(w.maxConsecLong);
      setMaxConsecNights(w.maxConsecNights);
      setMaxLongEveningConsec(w.maxLongEveningConsec ?? 4);
      setRestPostNights(w.restAfterNightsH);
      setRestPostBlock(w.restAfterLongH);
      setRestAfter7(w.restAfterStandardH);
      setWeekendFreq(w.weekendFrequency);
      setRestAfterLongEveningH(w.restAfterLongEveningH ?? 48);
      setMinInterShiftRestH(w.minInterShiftRestH ?? 11);
      setOncallContinuousRestStart(w.oncall.continuousRestStart ?? "22:00");
      setOncallContinuousRestEnd(w.oncall.continuousRestEnd ?? "07:00");
      setOncallIfRestNotMetMaxHours(w.oncall.ifRestNotMetMaxHours ?? 5);
      setOncallBreakReferenceWeeks(w.oncall.breakReferenceWeeks ?? 4);
      setOncallBreakFineThresholdPct(w.oncall.breakFineThresholdPct ?? 25);
      setOncallMaxPer7Days(w.oncall.maxPer7Days ?? 3);
      setOncallLocalAgreementMaxConsec(w.oncall.localAgreementMaxConsec ?? 7);
      setOncallDayAfterMaxHours(w.oncall.dayAfterMaxHours ?? 10);
      setOncallDayAfterLastConsecMaxH(w.oncall.dayAfterLastConsecMaxH ?? 10);
      setOncallRestPer24h(w.oncall.restPer24h ?? 8);
      setOncallContinuousRestHours(w.oncall.continuousRestHours ?? 5);
      setOncallNoConsecExceptWknd(w.oncall.noConsecExceptWknd ?? true);
      setOncallNoSimultaneousShift(w.oncall.noSimultaneousShift ?? true);
      setWtrComplete(true);
    }

    setRestoredFromDb(true);
  }, [restoredConfig]);

  const resetWtr = useCallback(() => {
    setMaxAvgWeekly(48);
    setMaxIn7Days(72);
    setMaxShiftLengthH(13);
    setMaxConsecDays(7);
    setMaxConsecLong(4);
    setMaxConsecNights(4);
    setMaxLongEveningConsec(4);
    setRestPostNights(46);
    setRestPostBlock(48);
    setRestAfter7(48);
    setWeekendFreq(3);
    setRestAfterLongEveningH(48);
    setMinInterShiftRestH(11);
    setOncallMaxPer7Days(3);
    setOncallLocalAgreementMaxConsec(7);
    setOncallDayAfterMaxHours(10);
    setOncallDayAfterLastConsecMaxH(10);
    setOncallRestPer24h(8);
    setOncallContinuousRestHours(5);
    setOncallContinuousRestStart("22:00");
    setOncallContinuousRestEnd("07:00");
    setOncallIfRestNotMetMaxHours(5);
    setOncallNoConsecExceptWknd(true);
    setOncallNoSimultaneousShift(true);
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
        rotaBankHolidays, setRotaBankHolidays,
        bhSameAsWeekend, setBhSameAsWeekend,
        bhShiftRules, setBhShiftRules,
        periodWorkingStateLoaded, setPeriodWorkingStateLoaded,
        maxAvgWeekly, maxIn7Days, maxShiftLengthH, setMaxAvgWeekly, setMaxIn7Days, setMaxShiftLengthH,
        maxConsecDays, maxConsecLong, maxConsecNights, maxLongEveningConsec,
        setMaxConsecDays, setMaxConsecLong, setMaxConsecNights, setMaxLongEveningConsec,
        restPostNights, restPostBlock, restAfter7, weekendFreq, restAfterLongEveningH, minInterShiftRestH,
        setRestPostNights, setRestPostBlock, setRestAfter7, setWeekendFreq, setRestAfterLongEveningH, setMinInterShiftRestH,
        oncallMaxPer7Days, oncallLocalAgreementMaxConsec, oncallDayAfterMaxHours, oncallDayAfterLastConsecMaxH,
        oncallRestPer24h, oncallContinuousRestHours, oncallContinuousRestStart, oncallContinuousRestEnd,
        oncallIfRestNotMetMaxHours, oncallNoConsecExceptWknd, oncallNoSimultaneousShift,
        oncallBreakReferenceWeeks, oncallBreakFineThresholdPct,
        setOncallMaxPer7Days, setOncallLocalAgreementMaxConsec, setOncallDayAfterMaxHours, setOncallDayAfterLastConsecMaxH,
        setOncallRestPer24h, setOncallContinuousRestHours, setOncallContinuousRestStart, setOncallContinuousRestEnd,
        setOncallIfRestNotMetMaxHours, setOncallNoConsecExceptWknd, setOncallNoSimultaneousShift,
        setOncallBreakReferenceWeeks, setOncallBreakFineThresholdPct,
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