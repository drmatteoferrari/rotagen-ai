import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { calcDurationHours, timeToMinutes, type ApplicableDays } from "@/lib/shiftUtils";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";

// SECTION 5 — DepartmentSetupContext with restore from config

/* ─── Badge types ─── */
export interface ShiftBadges {
  night: boolean;
  long: boolean;
  ooh: boolean;
  oncall: boolean;
  nonres: boolean;
  longEvening: boolean;
}

export type BadgeKey = keyof ShiftBadges;

export interface ShiftStaffing {
  min: number;
  target: number;
  max: number | null;
}

export interface SlotRequirement {
  slotIndex: number;
  label: string | null;
  permittedGrades: string[];
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqTransfer: number;
}

export interface DaySlot {
  dayKey: string;
  staffing: ShiftStaffing;
  slots: SlotRequirement[];
  isCustomised: boolean;
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
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqMinGrade: string | null;
  reqTransfer: number;
  abbreviation: string;
  daySlots: DaySlot[];
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
  // long-evening: starts before 16:00, ends after 23:00, does not cross midnight, not already night
  const longEvening = !night && em > sm && sm < 16 * 60 && em > 23 * 60;

  let ooh = hasSatSun;
  if (!ooh) {
    if (em > sm) {
      ooh = sm < 7 * 60 || em > 19 * 60;
    } else {
      ooh = true;
    }
  }

  return { night, long, ooh, oncall: isOncall, nonres: isNonRes, longEvening };
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

export function generateAbbreviation(name: string): string {
  const base = name.split(/\s[—\-]\s/)[0].trim();
  const initials = base.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 4);
  return initials || name.slice(0, 2).toUpperCase();
}

export const SHIFT_COLORS = [
  { bg: "bg-purple-600", text: "text-white", border: "border-purple-700", solid: "#9333ea" },
  { bg: "bg-teal-600",   text: "text-white", border: "border-teal-700",   solid: "#0d9488" },
  { bg: "bg-amber-500",  text: "text-white", border: "border-amber-600",  solid: "#d97706" },
  { bg: "bg-rose-600",   text: "text-white", border: "border-rose-700",   solid: "#e11d48" },
  { bg: "bg-blue-600",   text: "text-white", border: "border-blue-700",   solid: "#2563eb" },
  { bg: "bg-green-600",  text: "text-white", border: "border-green-700",  solid: "#16a34a" },
] as const;

export function getShiftColor(index: number) {
  return SHIFT_COLORS[index % SHIFT_COLORS.length];
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
    staffing: { min: 3, target: 3, max: null },
    abbreviation: generateAbbreviation(name),
    targetOverridePct: null,
    badges: autoBadges, badgeOverrides: {}, oncallManuallySet: false,
    reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0, reqMinGrade: null,
    daySlots: [],
  };
}

const allDays: ApplicableDays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true };
const weekday: ApplicableDays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };

const defaultShifts: ShiftType[] = [
  { ...makeShift("1", "Standard Day", "08:00", "17:30", allDays, false), abbreviation: "SD", staffing: { min: 3, target: 3, max: null } },
  { ...makeShift("2", "Long Day",     "08:00", "20:30", allDays, true),  abbreviation: "LD", staffing: { min: 2, target: 2, max: null } },
  { ...makeShift("3", "Night",        "20:00", "08:30", allDays, true),  abbreviation: "N",  staffing: { min: 1, target: 1, max: null } },
  { ...makeShift("4", "Twilight",     "16:00", "00:00", weekday, true),  abbreviation: "Tw", staffing: { min: 1, target: 1, max: null } },
];
defaultShifts.forEach((s) => {
  s.badges = detectBadges(s.startTime, s.endTime, s.applicableDays, s.isOncall, s.isNonRes);
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
  isLoadingShifts: boolean;
  resetDepartment: () => void;
}

const DepartmentSetupContext = createContext<DepartmentSetupContextType | undefined>(undefined);

export function DepartmentSetupProvider({ children }: { children: ReactNode }) {
  const [shifts, setShifts] = useState<ShiftType[]>(defaultShifts);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [globalOncallPct, setGlobalOncallPct] = useState(50);
  const [shiftTargetOverrides, setShiftTargetOverrides] = useState<Record<string, number | undefined>>({});

  const { restoredConfig, currentRotaConfigId } = useRotaContext();
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);
  const hasLoadedShiftsFromDB = useRef(false);

  // Reset ref when config changes
  useEffect(() => {
    hasLoadedShiftsFromDB.current = false;
  }, [currentRotaConfigId]);

  // Re-hydrate shift types from DB
  useEffect(() => {
    if (!currentRotaConfigId) return;
    if (hasLoadedShiftsFromDB.current) return;

    const loadFromDb = async () => {
      setIsLoadingShifts(true);
      try {
        const [shiftsRes, daySlotsRes, slotReqsRes] = await Promise.all([
          supabase
            .from('shift_types')
            .select('*')
            .eq('rota_config_id', currentRotaConfigId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('shift_day_slots')
            .select('*')
            .eq('rota_config_id', currentRotaConfigId),
          supabase
            .from('shift_slot_requirements')
            .select('*')
            .eq('rota_config_id', currentRotaConfigId),
        ]);

        if (shiftsRes.error || !shiftsRes.data || shiftsRes.data.length === 0) {
          return;
        }

        const rawSlotReqs = slotReqsRes.data ?? [];
        const reqsByDaySlotId = new Map<string, SlotRequirement[]>();
        for (const req of rawSlotReqs) {
          const sid: string = req.shift_day_slot_id;
          if (!reqsByDaySlotId.has(sid)) reqsByDaySlotId.set(sid, []);
          reqsByDaySlotId.get(sid)!.push({
            slotIndex:       req.slot_index        as number,
            label:           req.label             as string | null,
            permittedGrades: (req.permitted_grades as string[]) ?? [],
            reqIac:          (req.req_iac          as number)  ?? 0,
            reqIaoc:         (req.req_iaoc         as number)  ?? 0,
            reqIcu:          (req.req_icu          as number)  ?? 0,
            reqTransfer:     (req.req_transfer     as number)  ?? 0,
          });
        }
        for (const reqs of reqsByDaySlotId.values()) {
          reqs.sort((a, b) => a.slotIndex - b.slotIndex);
        }

        const rawDaySlots = daySlotsRes.data ?? [];
        const daySlotsByShiftTypeUuid = new Map<string, DaySlot[]>();
        for (const ds of rawDaySlots) {
          const shiftTypeUuid: string = ds.shift_type_id;
          if (!daySlotsByShiftTypeUuid.has(shiftTypeUuid)) {
            daySlotsByShiftTypeUuid.set(shiftTypeUuid, []);
          }
          const daySlotReqs = reqsByDaySlotId.get(ds.id as string) ?? [];
          const staffing: ShiftStaffing = {
            min:    (ds.min_doctors    as number) ?? 1,
            target: (ds.target_doctors as number) ?? 1,
            max:    (ds.max_doctors    as number | null) ?? null,
          };
          daySlotsByShiftTypeUuid.get(shiftTypeUuid)!.push({
            dayKey:       ds.day_key as string,
            staffing,
            slots:        daySlotReqs,
            isCustomised: false,
          });
        }

        const restored: ShiftType[] = shiftsRes.data.map((row: any) => {
          const days: ApplicableDays = {
            mon: row.applicable_mon ?? false, tue: row.applicable_tue ?? false,
            wed: row.applicable_wed ?? false, thu: row.applicable_thu ?? false,
            fri: row.applicable_fri ?? false, sat: row.applicable_sat ?? false,
            sun: row.applicable_sun ?? false,
          };
          const isOncall = row.is_oncall ?? false;
          const isNonRes = row.is_non_res_oncall ?? false;
          const autoBadges = detectBadges(row.start_time, row.end_time, days, isOncall, isNonRes);
          const badgeOverrides: Partial<Record<BadgeKey, boolean>> = {};
          if (row.badge_night_manual_override  != null) badgeOverrides.night  = row.badge_night  as boolean;
          if (row.badge_long_manual_override   != null) badgeOverrides.long   = row.badge_long   as boolean;
          if (row.badge_ooh_manual_override    != null) badgeOverrides.ooh    = row.badge_ooh    as boolean;
          if (row.badge_oncall_manual_override != null) badgeOverrides.oncall = row.badge_oncall as boolean;
          if (row.badge_nonres_manual_override != null) badgeOverrides.nonres = row.badge_nonres as boolean;

          const shiftDefaultMin:    number      = row.min_doctors    ?? 1;
          const shiftDefaultTarget: number      = row.target_doctors ?? row.min_doctors ?? 1;
          const shiftDefaultMax:    number|null = row.max_doctors    ?? null;

          const shiftTypeUuid: string = row.id;
          const rawDaySlotGroup = daySlotsByShiftTypeUuid.get(shiftTypeUuid) ?? [];
          const daySlots: DaySlot[] = rawDaySlotGroup.map((ds) => ({
            ...ds,
            isCustomised: (
              ds.staffing.min    !== shiftDefaultMin    ||
              ds.staffing.target !== shiftDefaultTarget ||
              ds.staffing.max    !== shiftDefaultMax    ||
              ds.slots.length     > 0
            ),
          }));

          return {
            id:               row.shift_key ?? row.id,
            name:             row.name,
            startTime:        row.start_time,
            endTime:          row.end_time,
            durationHours:    row.duration_hours,
            applicableDays:   days,
            isOncall,
            isNonRes,
            staffing: {
              min:    shiftDefaultMin,
              target: shiftDefaultTarget,
              max:    shiftDefaultMax,
            },
            abbreviation:      row.abbreviation ?? generateAbbreviation(row.name),
            targetOverridePct: row.target_percentage ?? null,
            badges:            mergedBadges(autoBadges, badgeOverrides),
            badgeOverrides,
            oncallManuallySet: row.oncall_manually_set ?? false,
            reqIac:            row.req_iac      ?? 0,
            reqIaoc:           row.req_iaoc     ?? 0,
            reqIcu:            row.req_icu      ?? 0,
            reqTransfer:       row.req_transfer ?? 0,
            reqMinGrade:       row.req_min_grade ?? null,
            daySlots,
          };
        });
        setShifts(restored);
        hasLoadedShiftsFromDB.current = true;
      } catch (err) {
        console.error('Failed to load shift types from DB:', err);
      } finally {
        setIsLoadingShifts(false);
      }
    };
    loadFromDb();
  }, [currentRotaConfigId]);

  useEffect(() => {
    if (!restoredConfig || restoredConfig.shifts.length === 0) return;
    setGlobalOncallPct(restoredConfig.distribution.globalOncallPct);
    const overrides: Record<string, number | undefined> = {};
    restoredConfig.distribution.byShift.forEach((bs) => {
      overrides[bs.shiftKey] = bs.targetPct;
    });
    setShiftTargetOverrides(overrides);
  }, [restoredConfig]);

  const resetDepartment = useCallback(() => {
    setShifts(defaultShifts);
    setExpandedShiftId(null);
    setGlobalOncallPct(50);
    setShiftTargetOverrides({});
    hasLoadedShiftsFromDB.current = false;
  }, []);

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
        isLoadingShifts,
        resetDepartment,
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
