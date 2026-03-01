import { createContext, useContext, useState, type ReactNode } from "react";
import { calcDurationHours, getDaysForPreset, type ApplicableDays, type DaysPreset } from "@/lib/shiftUtils";

export interface ShiftBadges {
  night: boolean;
  long: boolean;
  ooh: boolean;
  weekend: boolean;
}

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
  daysPreset: DaysPreset;
  applicableDays: ApplicableDays;
  isOncall: boolean;
  isNonRes: boolean;
  staffing: ShiftStaffing;
  targetOverridePct: number | null;
  badges: ShiftBadges;
}

function makeShift(
  id: string,
  name: string,
  startTime: string,
  endTime: string,
  preset: DaysPreset,
  isOncall: boolean,
): ShiftType {
  return {
    id,
    name,
    startTime,
    endTime,
    durationHours: calcDurationHours(startTime, endTime),
    daysPreset: preset,
    applicableDays: getDaysForPreset(preset),
    isOncall,
    isNonRes: false,
    staffing: { min: 1, max: null },
    targetOverridePct: null,
    badges: { night: false, long: false, ooh: false, weekend: false },
  };
}

const defaultShifts: ShiftType[] = [
  makeShift("1", "Standard Day — Weekday", "08:00", "17:30", "weekday", false),
  makeShift("2", "Long Day — Weekday", "08:00", "20:30", "weekday", true),
  makeShift("3", "Long Day — Weekend", "08:00", "20:30", "weekend", true),
  makeShift("4", "Night Shift — Weekday", "20:00", "08:30", "weekday", true),
  makeShift("5", "Night Shift — Weekend", "20:00", "08:30", "weekend", true),
];

interface DepartmentSetupContextType {
  shifts: ShiftType[];
  addShift: () => void;
  removeShift: (id: string) => void;
  updateShift: (id: string, updates: Partial<ShiftType>) => void;
  /** Recalculate duration when times change */
  updateShiftTimes: (id: string, startTime: string, endTime: string) => void;
  /** Change preset and auto-fill applicableDays */
  updateShiftPreset: (id: string, preset: DaysPreset) => void;
  currentShiftIndex: number;
  setCurrentShiftIndex: (i: number) => void;
}

const DepartmentSetupContext = createContext<DepartmentSetupContextType | undefined>(undefined);

export function DepartmentSetupProvider({ children }: { children: ReactNode }) {
  const [shifts, setShifts] = useState<ShiftType[]>(defaultShifts);
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);

  const addShift = () => {
    const newShift = makeShift(
      String(Date.now()),
      "New Shift",
      "09:00",
      "17:00",
      "weekday",
      false,
    );
    setShifts((prev) => [...prev, newShift]);
    setCurrentShiftIndex(shifts.length);
  };

  const removeShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  };

  const updateShift = (id: string, updates: Partial<ShiftType>) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        // Recalc duration if times changed inline
        if (updates.startTime || updates.endTime) {
          updated.durationHours = calcDurationHours(updated.startTime, updated.endTime);
        }
        return updated;
      }),
    );
  };

  const updateShiftTimes = (id: string, startTime: string, endTime: string) => {
    updateShift(id, { startTime, endTime, durationHours: calcDurationHours(startTime, endTime) });
  };

  const updateShiftPreset = (id: string, preset: DaysPreset) => {
    updateShift(id, { daysPreset: preset, applicableDays: getDaysForPreset(preset) });
  };

  return (
    <DepartmentSetupContext.Provider
      value={{
        shifts,
        addShift,
        removeShift,
        updateShift,
        updateShiftTimes,
        updateShiftPreset,
        currentShiftIndex,
        setCurrentShiftIndex,
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
