import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { calcDurationHours, timeToMinutes, type ApplicableDays } from "@/lib/shiftUtils";
import { useRotaContext } from "@/contexts/RotaContext";
import type { RotaConfig } from "@/lib/rotaConfig";

// SECTION 5 — DepartmentSetupContext with restore from config

/* ─── Badge types ─── */
export interface ShiftBadges {
  night: boolean;
  long: boolean;
  ooh: boolean;
  weekend: boolean;
  oncall: boolean;
  nonres: boolean;
}

export type BadgeKey = keyof ShiftBadges;

export interface ShiftStaffing {
  min: number;
  max: number | null;
}

export interface ShiftType {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  applicableDays: ApplicableDays;
  isOncall: boolean;
  isNonRes: boolean;
  staffing: ShiftStaffing;
  targetOverridePct: number | null;
  badges: ShiftBadges;
  badgeOverrides: Partial<Record<BadgeKey, boolean>>;
  oncallManuallySet: boolean;
}

/* ─── Badge auto-detection (pure) ─── */
export function detectBadges(
  startTime: string,
  endTime: string,
  days: ApplicableDays,
  isOncall: boolean,
  isNonRes: boolean,
): ShiftBadges {
  const sm = timeToMinutes(startTime);
  const em = timeToMinutes(endTime);
  const dur = calcDurationHours(startTime, endTime);
  const hasSatSun = days.sat || days.sun;

  const nightStart = 23 * 60;
  const nightEnd = 6 * 60;
  let nightMinutes = 0;
  if (em > sm) {
    nightMinutes += Math.max(0, Math.min(em, 1440) - Math.max(sm, nightStart));
    nightMinutes += Math.max(0, Math.min(em, nightEnd) - Math.max(sm, 0));
  } else {
    const endAdjusted = sm + Math.round(dur * 60);
    const ns = nightStart;
    const ne = nightEnd + 1440;
    nightMinutes = Math.max(0, Math.min(endAdjusted, ne) - Math.max(sm, ns));
  }
  const night = nightMinutes >= 180;
  const long = dur > 10;

  let ooh = hasSatSun;
  if (!ooh) {
    if (em > sm) {
      ooh = sm < 7 * 60 || em > 19 * 60;
    } else {
      ooh = true;
    }
  }

  return { night, long, ooh, weekend: hasSatSun, oncall: isOncall, nonres: isNonRes };
}

/** Merge auto-detected badges with manual overrides */
export function mergedBadges(auto: ShiftBadges, overrides: Partial<Record<BadgeKey, boolean>>): ShiftBadges {
  const result = { ...auto };
  for (const key of Object.keys(overrides) as BadgeKey[]) {
    if (overrides[key] !== undefined) {
      result[key] = overrides[key]!;
    }
  }
  return result;
}

/* ─── Factory ─── */
function makeShift(
  id: string,
  name: string,
  startTime: string,
  endTime: string,
  days: ApplicableDays,
  isOncall: boolean,
): ShiftType {
  const dur = calcDurationHours(startTime, endTime);
  const autoBadges = detectBadges(startTime, endTime, days, isOncall, false);
  return {
    id, name, startTime, endTime, durationHours: dur,
    applicableDays: days, isOncall, isNonRes: false,
    staffing: { min: 3, max: null }, targetOverridePct: null,
    badges: autoBadges, badgeOverrides: {}, oncallManuallySet: false,
  };
}

const weekday: ApplicableDays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const weekend: ApplicableDays = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true };

const defaultShifts: ShiftType[] = [
  makeShift("1", "Standard Day — Weekday", "08:00", "17:30", weekday, false),
  makeShift("2", "Long Day — Weekday", "08:00", "20:30", weekday, false),
  makeShift("3", "Long Day — Weekend", "08:00", "20:30", weekend, false),
  makeShift("4", "Night Shift — Weekday", "20:00", "08:30", weekday, false),
  makeShift("5", "Night Shift — Weekend", "20:00", "08:30", weekend, false),
];

defaultShifts.forEach((s) => {
  const auto = detectBadges(s.startTime, s.endTime, s.applicableDays, false, false);
  const shouldBeOncall = auto.night || auto.long || auto.ooh || auto.weekend;
  s.isOncall = shouldBeOncall;
  s.badges = detectBadges(s.startTime, s.endTime, s.applicableDays, shouldBeOncall, false);
});

/* ─── Context ─── */
interface DepartmentSetupContextType {
  shifts: ShiftType[];
  setShifts: React.Dispatch<React.SetStateAction<ShiftType[]>>;
  addShift: () => string;
  removeShift: (id: string) => void;
  updateShift: (id: string, updates: Partial<ShiftType>) => void;
  expandedShiftId: string | null;
  setExpandedShiftId: (id: string | null) => void;
  globalOncallPct: number;
  setGlobalOncallPct: (v: number) => void;
  shiftTargetOverrides: Record<string, number | undefined>;
  setShiftTargetOverrides: React.Dispatch<React.SetStateAction<Record<string, number | undefined>>>;
}

const DepartmentSetupContext = createContext<DepartmentSetupContextType | undefined>(undefined);

export function DepartmentSetupProvider({ children }: { children: ReactNode }) {
  const [shifts, setShifts] = useState<ShiftType[]>(defaultShifts);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [globalOncallPct, setGlobalOncallPct] = useState(50);
  const [shiftTargetOverrides, setShiftTargetOverrides] = useState<Record<string, number | undefined>>({});

  // SECTION 5 — Restore shifts from config
  const { restoredConfig } = useRotaContext();

  useEffect(() => {
    if (!restoredConfig || restoredConfig.shifts.length === 0) return;

    const restored: ShiftType[] = restoredConfig.shifts.map((s) => {
      const days: ApplicableDays = s.applicableDays;
      const autoBadges = detectBadges(s.startTime, s.endTime, days, s.isOncall, s.isNonResOncall);
      const badgeOverrides: Partial<Record<BadgeKey, boolean>> = {};
      for (const key of Object.keys(s.badgeOverrides) as BadgeKey[]) {
        if (s.badgeOverrides[key] !== undefined) {
          badgeOverrides[key] = s.badgeOverrides[key];
        }
      }
      return {
        id: s.shiftKey,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        durationHours: s.durationHours,
        applicableDays: days,
        isOncall: s.isOncall,
        isNonRes: s.isNonResOncall,
        staffing: { min: s.minDoctors, max: s.maxDoctors },
        targetOverridePct: s.targetPercentage,
        badges: autoBadges,
        badgeOverrides,
        oncallManuallySet: s.oncallManuallySet,
      };
    });

    setShifts(restored);
    setGlobalOncallPct(restoredConfig.distribution.globalOncallPct);

    // Restore per-shift target overrides
    const overrides: Record<string, number | undefined> = {};
    restoredConfig.distribution.byShift.forEach((bs) => {
      overrides[bs.shiftKey] = bs.targetPct;
    });
    setShiftTargetOverrides(overrides);
  }, [restoredConfig]);
  // SECTION 5 COMPLETE

  const addShift = useCallback(() => {
    const id = String(Date.now());
    const days: ApplicableDays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
    const newShift = makeShift(id, "New Shift", "09:00", "17:00", days, false);
    setShifts((prev) => [...prev, newShift]);
    setExpandedShiftId(id);
    return id;
  }, []);

  const removeShift = useCallback((id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    setExpandedShiftId((prev) => (prev === id ? null : prev));
  }, []);

  const updateShift = useCallback((id: string, updates: Partial<ShiftType>) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        if (updates.startTime !== undefined || updates.endTime !== undefined) {
          updated.durationHours = calcDurationHours(updated.startTime, updated.endTime);
        }
        return updated;
      }),
    );
  }, []);

  return (
    <DepartmentSetupContext.Provider
      value={{
        shifts, setShifts, addShift, removeShift, updateShift,
        expandedShiftId, setExpandedShiftId,
        globalOncallPct, setGlobalOncallPct,
        shiftTargetOverrides, setShiftTargetOverrides,
      }}
    >
      {children}
    </DepartmentSetupContext.Provider>
  );
}

export function useDepartmentSetup() {
  const ctx = useContext(DepartmentSetupContext);
  if (!ctx) throw new Error("useDepartmentSetup must be used within DepartmentSetupProvider");
  return ctx;
}
