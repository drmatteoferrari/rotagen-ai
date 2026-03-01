import { createContext, useContext, useState, type ReactNode } from "react";

export interface ShiftType {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  period: "Morning" | "Evening" | "Night";
  tags: string[];
  isOnCall: boolean;
  isNonResident: boolean;
  activeDays: boolean[];
  requiredStaff: number;
  distributionPercent: number;
}

const defaultShifts: ShiftType[] = [
  {
    id: "1",
    name: "Early Shift",
    startTime: "07:00",
    endTime: "15:00",
    period: "Morning",
    tags: [],
    isOnCall: false,
    isNonResident: false,
    activeDays: [true, true, true, true, true, false, false],
    requiredStaff: 4,
    distributionPercent: 25,
  },
  {
    id: "2",
    name: "Late Shift",
    startTime: "14:00",
    endTime: "22:00",
    period: "Evening",
    tags: [],
    isOnCall: false,
    isNonResident: false,
    activeDays: [true, true, true, true, true, false, false],
    requiredStaff: 3,
    distributionPercent: 25,
  },
  {
    id: "3",
    name: "Night Shift",
    startTime: "21:00",
    endTime: "07:00",
    period: "Night",
    tags: ["On-Call"],
    isOnCall: true,
    isNonResident: true,
    activeDays: [true, true, true, true, true, true, true],
    requiredStaff: 2,
    distributionPercent: 25,
  },
];

interface DepartmentSetupContextType {
  shifts: ShiftType[];
  addShift: () => void;
  updateShift: (id: string, updates: Partial<ShiftType>) => void;
  currentShiftIndex: number;
  setCurrentShiftIndex: (i: number) => void;
}

const DepartmentSetupContext = createContext<DepartmentSetupContextType | undefined>(undefined);

export function DepartmentSetupProvider({ children }: { children: ReactNode }) {
  const [shifts, setShifts] = useState<ShiftType[]>(defaultShifts);
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);

  const addShift = () => {
    const newShift: ShiftType = {
      id: String(Date.now()),
      name: "New Shift",
      startTime: "09:00",
      endTime: "17:00",
      period: "Morning",
      tags: [],
      isOnCall: false,
      isNonResident: false,
      activeDays: [true, true, true, true, true, false, false],
      requiredStaff: 1,
      distributionPercent: 0,
    };
    setShifts((prev) => [...prev, newShift]);
    setCurrentShiftIndex(shifts.length); // point to the new one
  };

  const updateShift = (id: string, updates: Partial<ShiftType>) => {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  return (
    <DepartmentSetupContext.Provider value={{ shifts, addShift, updateShift, currentShiftIndex, setCurrentShiftIndex }}>
      {children}
    </DepartmentSetupContext.Provider>
  );
}

export function useDepartmentSetup() {
  const ctx = useContext(DepartmentSetupContext);
  if (!ctx) throw new Error("useDepartmentSetup must be used within DepartmentSetupProvider");
  return ctx;
}
