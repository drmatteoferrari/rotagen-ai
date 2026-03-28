import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import type { CalendarData, CalendarDoctor, TargetsData, CellCode } from "@/lib/preRotaTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRotaContext } from "@/contexts/RotaContext";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ChevronDown,
  CalendarRange,
  ChevronUp,
  MonitorSmartphone,
  Search,
  ArrowUpDown,
} from "lucide-react";
import {
  getTodayISO,
  mapOverrideRow,
  mergeOverridesIntoAvailability,
  type CalendarOverride,
  type MergedCell,
} from "@/lib/calendarOverrides";
import { EventDetailPanel } from "@/components/calendar/EventDetailPanel";
import { AddEventModal } from "@/components/calendar/AddEventModal";
import { refreshResolvedAvailabilityForDoctor } from "@/lib/resolvedAvailability";
import {
  usePreRotaResultQuery,
  useCalendarShiftTypesQuery,
  useCalendarBankHolidaysQuery,
  useCalendarSurveysQuery,
} from "@/hooks/useAdminQueries";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const FULL_DAY_NAMES: Record<string, string> = {
  sun: "sunday",
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sunday: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
};

function normaliseDayName(raw: string): string {
  return FULL_DAY_NAMES[raw.toLowerCase()] ?? raw.toLowerCase();
}

function getDayNameFromISO(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return DAY_NAMES[d.getUTCDay()];
}

function getLtftDaysOff(doctor: any): string[] {
  const raw = doctor.ltftDaysOff ?? doctor.ltft_days_off ?? [];
  return (Array.isArray(raw) ? raw : []).map(normaliseDayName);
}

function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().split("T")[0];
}

interface ShiftTypeRow {
  id: string;
  name: string;
  min_doctors: number;
  badge_night: boolean;
  badge_oncall: boolean;
}

interface SurveyMap {
  ltftDaysOff: string[];
  ltftNightFlexibility: { day: string; canStart: boolean | null; canEnd: boolean | null }[];
}

function isDoctorEligible(
  doctor: CalendarDoctor,
  date: string,
  shift: { badge_night: boolean; badge_oncall: boolean },
  surveys: Record<string, SurveyMap>,
): boolean {
  const cell = doctor.availability[date];
  const primary = cell?.primary ?? "AVAILABLE";

  if (["AL", "SL", "ROT", "PL"].includes(primary)) return false;
  if (primary === "NOC") return shift.badge_oncall === false;

  const isNightShift = shift.badge_night === true;
  const survey = surveys[doctor.doctorId];
  const dayNameOfDate = getDayNameFromISO(date);
  const isLtftDayOff = getLtftDaysOff(doctor).includes(dayNameOfDate);

  if (!isNightShift) {
    return !isLtftDayOff;
  }

  if (isLtftDayOff) {
    if (!survey) return false;
    const flex = survey.ltftNightFlexibility.find((f) => normaliseDayName(f.day) === dayNameOfDate);
    return flex?.canStart === true;
  }

  const nextDate = addDays(date, 1);
  const dayNameOfNextDate = getDayNameFromISO(nextDate);
  const isNextDayLtftOff = getLtftDaysOff(doctor).includes(dayNameOfNextDate);

  if (isNextDayLtftOff) {
    if (!survey) return false;
    const nextCell = doctor.availability[nextDate];
    const nextPrimary = nextCell?.primary ?? "AVAILABLE";
    if (["AL", "SL", "ROT", "PL"].includes(nextPrimary)) return false;
    const flex = survey.ltftNightFlexibility.find((f) => normaliseDayName(f.day) === dayNameOfNextDate);
    return flex?.canEnd === true;
  }

  return true;
}

// ── Badge components ──────────────────────────────────────────

const BADGE_STYLES = {
  AL: { classes: "bg-green-600 text-white", label: "AL" },
  SL: { classes: "bg-blue-600 text-white", label: "SL" },
  ROT: { classes: "bg-orange-600 text-white", label: "ROT" },
  PL: { classes: "bg-violet-600 text-white", label: "PL" },
  NOC: { classes: "bg-pink-500 text-white", label: "NOC" },
  LTFT: { classes: "bg-yellow-100 text-yellow-800 border border-yellow-300", label: "LTFT" },
} as const;

function LeaveBadge({
  type,
  size = "small",
  short = false,
  className = "",
}: {
  type: keyof typeof BADGE_STYLES;
  size?: "small" | "large";
  short?: boolean;
  className?: string;
}) {
  const s = BADGE_STYLES[type];
  const sizeClasses =
    size === "large"
      ? "px-2 py-1 text-[11px] sm:text-xs"
      : short
        ? "w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] flex items-center justify-center text-[8px] sm:text-[9px]"
        : "px-1 sm:px-1.5 py-[1px] text-[8px] sm:text-[9px]";

  const shortLabels: Record<string, string> = { AL: "A", SL: "S", ROT: "R", PL: "P", NOC: "N", LTFT: "L" };
  const label = short ? shortLabels[type] : s.label;

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold tracking-tighter sm:tracking-wider leading-none shrink-0 ${sizeClasses} ${s.classes} ${className}`}
    >
      {label}
    </span>
  );
}

// ── Cell background logic ─────────────────────────────────────

function getMergedCellBackground(mergedCell: MergedCell | undefined, isLtftDay: boolean): string {
  if (!mergedCell) return "bg-card";
  const primary = mergedCell.isDeleted ? "AVAILABLE" : mergedCell.primary;
  if (primary === "ROT") return "bg-orange-50";
  if (primary === "PL") return "bg-violet-50";
  if (isLtftDay) return "bg-yellow-50";
  return "bg-card";
}

// ── Legend components ─────────────────────────────────────────

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-muted-foreground bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <LeaveBadge type="AL" /> <span>Annual Leave</span>
      </div>
      <div className="flex items-center gap-1.5">
        <LeaveBadge type="SL" /> <span>Study Leave</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-5 flex items-center justify-center rounded bg-orange-50 border border-orange-200">
          <LeaveBadge type="ROT" className="text-[9px] px-1 py-0" />
        </div>
        <span>Rotation</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-5 flex items-center justify-center rounded bg-violet-50 border border-violet-200">
          <LeaveBadge type="PL" className="text-[9px] px-1 py-0" />
        </div>
        <span>Parental Leave</span>
      </div>
      <div className="flex items-center gap-1.5">
        <LeaveBadge type="NOC" /> <span>Not On-Call</span>
      </div>
      <div className="w-px h-4 bg-border mx-0.5" />
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-5 flex items-center justify-center rounded bg-yellow-50 border border-yellow-200">
          <LeaveBadge type="LTFT" className="text-[9px] px-1 py-0 border-none" />
        </div>
        <span>LTFT day off</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-0.5">
          <LeaveBadge type="SL" className="text-[9px] px-1 py-0" />
          <RotaOverrideDot />
        </span>
        <span>Coordinator override</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-200 shrink-0" /> <span>Today</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-200 shrink-0" /> <span>Bank Holiday</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-muted border border-border shrink-0" /> <span>Weekend</span>
      </div>
    </div>
  );
}

// ── Override helpers ──────────────────────────────────────────

function RotaOverrideDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 ml-0.5 shrink-0" />;
}

function WeekCellContent({
  mergedCell,
  isLtftDay,
  primary,
}: {
  mergedCell: MergedCell | undefined;
  isLtftDay: boolean;
  primary: string;
}) {
  const isNoc = primary === "NOC";
  const hasOverrideDot = mergedCell?.overrideAction === "add" || mergedCell?.overrideAction === "modify";

  if (mergedCell?.isDeleted && mergedCell.deletedCode) {
    return (
      <span className="bg-muted text-muted-foreground text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded line-through">
        {mergedCell.deletedCode}
      </span>
    );
  }

  return (
    <>
      {(["AL", "SL", "ROT", "PL"] as const)
        .filter((e) => primary === e)
        .map((event) => (
          <span key={event} className="inline-flex items-center max-w-full overflow-hidden shrink-0">
            <LeaveBadge type={event} size="small" />
            {hasOverrideDot && <RotaOverrideDot />}
          </span>
        ))}
      {isNoc && (
        <span className="inline-flex items-center max-w-full overflow-hidden shrink-0">
          <LeaveBadge type="NOC" size="small" />
          {hasOverrideDot && <RotaOverrideDot />}
        </span>
      )}
      {isLtftDay && <LeaveBadge type="LTFT" size="small" />}
    </>
  );
}

const MONTH_DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_EVENT_COLOURS: Record<string, string> = {
  AL: "#16a34a",
  SL: "#2563eb",
  NOC: "#ec4899",
  ROT: "#ea580c",
  PL: "#7c3aed",
  LTFT: "#ca8a04",
};

function buildMonthGrid(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  const dow = firstDay.getUTCDay();
  const monday = new Date(firstDay);
  monday.setUTCDate(firstDay.getUTCDate() - ((dow + 6) % 7));
  const lastStr = lastDay.toISOString().split("T")[0];
  const dates: string[] = [];
  const cur = new Date(monday);
  while (cur.toISOString().split("T")[0] <= lastStr) {
    for (let i = 0; i < 7; i++) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return dates;
}

// ── View Toggle ───────────────────────────────────────────────

function ViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: "day" | "week" | "month";
  setViewMode: (v: "day" | "week" | "month") => void;
}) {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-border shadow-sm shrink-0">
      {(["day", "week", "month"] as const).map((v, i) => (
        <button
          key={v}
          onClick={() => setViewMode(v)}
          className={`px-3 py-1.5 text-xs capitalize transition-colors ${i < 2 ? "border-r border-border" : ""} ${
            viewMode === v
              ? "bg-blue-600 text-white font-semibold"
              : "bg-card text-muted-foreground hover:bg-muted/50 font-medium"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export default function PreRotaCalendarPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const todayISO = getTodayISO();

  // Set accurate defaults depending on screen size
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "day";
    return "week";
  });

  const { currentRotaConfigId: rotaConfigId } = useRotaContext();
  const { data: cachedPreRota } = usePreRotaResultQuery();
  const { data: cachedShiftTypes } = useCalendarShiftTypesQuery();
  const { data: cachedBankHolidays } = useCalendarBankHolidaysQuery();
  const { data: cachedSurveys } = useCalendarSurveysQuery();

  const embeddedCacheReady =
    embedded &&
    !!cachedPreRota &&
    cachedPreRota.status !== "blocked" &&
    cachedShiftTypes !== undefined &&
    cachedBankHolidays !== undefined &&
    cachedSurveys !== undefined;

  const [loading, setLoading] = useState(!embeddedCacheReady);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeRow[]>([]);
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [surveysMap, setSurveysMap] = useState<Record<string, SurveyMap>>({});
  const [eligibility, setEligibility] = useState<Record<string, Record<string, number>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState("");
  const [deptName, setDeptName] = useState("");
  const [hospitalName, setHospitalName] = useState("");

  const [showBreakdown, setShowBreakdown] = useState(false);
  const [groupAvailability, setGroupAvailability] = useState(false);
  const [collapsePartial, setCollapsePartial] = useState(true);
  const [collapseUnavailable, setCollapseUnavailable] = useState(true);

  const [overrides, setOverrides] = useState<CalendarOverride[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ doctorId: string; date: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{
    eventType: string;
    startDate: string;
    endDate: string;
    note: string;
    overrideId: string;
    originalEventType: string | null;
  } | null>(null);
  const [modalCopyFrom, setModalCopyFrom] = useState<{
    eventType: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | null>(null);

  // Sorting and Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: "name" | "grade"; direction: "asc" | "desc" }>({
    key: "name",
    direction: "asc",
  });

  const lastTapRef = useRef<{ doctorId: string; date: string; time: number } | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const navRef = useRef<{ goPrev: () => void; goNext: () => void }>({
    goPrev: () => {},
    goNext: () => {},
  });
  const dateInputDesktopRef = useRef<HTMLInputElement>(null);
  const dateInputMobileRef = useRef<HTMLInputElement>(null);
  const embeddedInitialisedRef = useRef(false);

  // Fallback if resizing window to mobile while on month view
  useEffect(() => {
    if (isMobile === true && viewMode === "month") {
      setViewMode("day");
    }
  }, [isMobile, viewMode]);

  // Data Loading Logic
  useEffect(() => {
    const load = async () => {
      if (embedded && embeddedInitialisedRef.current) return;
      setLoadError(null);

      if (
        embedded &&
        !embeddedInitialisedRef.current &&
        cachedPreRota &&
        cachedPreRota.status !== "blocked" &&
        cachedShiftTypes !== undefined &&
        cachedBankHolidays !== undefined &&
        cachedSurveys !== undefined
      ) {
        embeddedInitialisedRef.current = true;
        const cd = cachedPreRota.calendarData as CalendarData;
        const td = cachedPreRota.targetsData as TargetsData;
        setTargetsData(td);

        const shifts: ShiftTypeRow[] = (cachedShiftTypes ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          min_doctors: s.min_doctors ?? 1,
          badge_night: s.badge_night ?? false,
          badge_oncall: s.badge_oncall ?? false,
        }));
        setShiftTypes(shifts);

        const bhSet = new Set(
          (cachedBankHolidays ?? []).filter((r: any) => r.is_active !== false).map((r: any) => r.date as string),
        );
        setBankHolidays(bhSet);

        const sMap: Record<string, SurveyMap> = {};
        for (const s of cachedSurveys ?? []) {
          sMap[(s as any).doctor_id] = {
            ltftDaysOff: ((s as any).ltft_days_off ?? []).map(normaliseDayName),
            ltftNightFlexibility: ((s as any).ltft_night_flexibility ?? []).map((f: any) => ({
              ...f,
              day: normaliseDayName(f.day ?? ""),
            })),
          };
        }
        setSurveysMap(sMap);

        setDeptName(cd.departmentName ?? "Department");
        setHospitalName(cd.hospitalName ?? "Trust");

        const mergedDoctors = (cd.doctors ?? []).map((doc: any) => ({
          ...doc,
          ltftDaysOff: (doc.ltftDaysOff ?? doc.ltft_days_off ?? sMap[doc.doctorId]?.ltftDaysOff ?? []).map(
            normaliseDayName,
          ),
        }));
        const mergedCd = { ...cd, doctors: mergedDoctors };
        setCalendarData(mergedCd);

        const initialDate =
          todayISO >= mergedCd.rotaStartDate && todayISO <= mergedCd.rotaEndDate ? todayISO : mergedCd.rotaStartDate;
        const initialWeekIdx = mergedCd.weeks.findIndex((w) => w.startDate <= initialDate && initialDate <= w.endDate);
        setCurrentWeekIndex(initialWeekIdx >= 0 ? initialWeekIdx : 0);
        const allDatesFlat = mergedCd.weeks.flatMap((w) => w.dates);
        const initialDayIdx = allDatesFlat.indexOf(initialDate);
        setCurrentDayIndex(initialDayIdx >= 0 ? initialDayIdx : 0);
        setCurrentMonthKey(initialDate.slice(0, 7));

        if (mergedCd.doctors && mergedCd.weeks) {
          const allDates: string[] = [];
          for (const w of mergedCd.weeks) allDates.push(...w.dates);
          const elig: Record<string, Record<string, number>> = {};
          for (const shift of shifts) {
            elig[shift.id] = {};
            for (const date of allDates) {
              let count = 0;
              for (const doctor of mergedCd.doctors) {
                if (isDoctorEligible(doctor, date, shift, sMap)) count++;
              }
              elig[shift.id][date] = count;
            }
          }
          setEligibility(elig);
        }

        setLoading(false);

        if (rotaConfigId) {
          supabase
            .from("coordinator_calendar_overrides")
            .select("*")
            .eq("rota_config_id", rotaConfigId)
            .then(({ data }) => setOverrides((data ?? []).map(mapOverrideRow)));
        }
        return;
      }

      if (!rotaConfigId) {
        return;
      }

      try {
        const { data: preRota } = await supabase
          .from("pre_rota_results")
          .select("*")
          .eq("rota_config_id", rotaConfigId)
          .maybeSingle();

        if (!preRota) {
          setErrorMsg("No pre-rota generated yet. Go back to the dashboard and generate the pre-rota first.");
          setLoading(false);
          return;
        }
        const pr = preRota as any;
        if (pr.status === "blocked") {
          setErrorMsg(
            "Pre-rota is blocked due to critical issues. Resolve them on the dashboard before viewing the calendar.",
          );
          setLoading(false);
          return;
        }

        const cd = pr.calendar_data as CalendarData;
        const td = pr.targets_data as TargetsData;
        setTargetsData(td);

        const { data: stRows } = await supabase
          .from("shift_types")
          .select("id, name, min_doctors, badge_night, badge_oncall")
          .eq("rota_config_id", rotaConfigId);
        const shifts: ShiftTypeRow[] = (stRows ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          min_doctors: s.min_doctors ?? 1,
          badge_night: s.badge_night ?? false,
          badge_oncall: s.badge_oncall ?? false,
        }));
        setShiftTypes(shifts);

        const { data: bhRows } = await supabase
          .from("bank_holidays")
          .select("date, is_active")
          .eq("rota_config_id", rotaConfigId);
        const bhSet = new Set(
          (bhRows ?? []).filter((r: any) => r.is_active !== false).map((r: any) => r.date as string),
        );
        setBankHolidays(bhSet);

        const { data: surveyRows } = await supabase
          .from("doctor_survey_responses")
          .select("doctor_id, ltft_days_off, ltft_night_flexibility")
          .eq("rota_config_id", rotaConfigId);
        const sMap: Record<string, SurveyMap> = {};
        for (const s of surveyRows ?? []) {
          sMap[(s as any).doctor_id] = {
            ltftDaysOff: ((s as any).ltft_days_off ?? []).map(normaliseDayName),
            ltftNightFlexibility: ((s as any).ltft_night_flexibility ?? []).map((f: any) => ({
              ...f,
              day: normaliseDayName(f.day ?? ""),
            })),
          };
        }
        setSurveysMap(sMap);

        const { data: config } = await supabase.from("rota_configs").select("owned_by").eq("id", rotaConfigId).single();
        if (config) {
          const { data: acct } = await supabase
            .from("account_settings")
            .select("department_name, trust_name")
            .eq("owned_by", (config as any).owned_by)
            .maybeSingle();
          setDeptName((acct as any)?.department_name ?? cd.departmentName ?? "Department");
          setHospitalName((acct as any)?.trust_name ?? cd.hospitalName ?? "Trust");
        }

        const mergedDoctors = (cd.doctors ?? []).map((doc: any) => ({
          ...doc,
          ltftDaysOff: (doc.ltftDaysOff ?? doc.ltft_days_off ?? sMap[doc.doctorId]?.ltftDaysOff ?? []).map(
            normaliseDayName,
          ),
        }));
        const mergedCd = { ...cd, doctors: mergedDoctors };
        setCalendarData(mergedCd);

        const initialDate =
          todayISO >= mergedCd.rotaStartDate && todayISO <= mergedCd.rotaEndDate ? todayISO : mergedCd.rotaStartDate;
        const initialWeekIdx = mergedCd.weeks.findIndex((w) => w.startDate <= initialDate && initialDate <= w.endDate);
        setCurrentWeekIndex(initialWeekIdx >= 0 ? initialWeekIdx : 0);
        const allDatesFlat = mergedCd.weeks.flatMap((w) => w.dates);
        const initialDayIdx = allDatesFlat.indexOf(initialDate);
        setCurrentDayIndex(initialDayIdx >= 0 ? initialDayIdx : 0);
        setCurrentMonthKey(initialDate.slice(0, 7));

        if (mergedCd?.doctors && mergedCd?.weeks) {
          const allDates: string[] = [];
          for (const w of mergedCd.weeks) allDates.push(...w.dates);
          const elig: Record<string, Record<string, number>> = {};
          for (const shift of shifts) {
            elig[shift.id] = {};
            for (const date of allDates) {
              let count = 0;
              for (const doctor of mergedCd.doctors) {
                if (isDoctorEligible(doctor, date, shift, sMap)) count++;
              }
              elig[shift.id][date] = count;
            }
          }
          setEligibility(elig);
        }

        const { data: overrideRows } = await supabase
          .from("coordinator_calendar_overrides")
          .select("*")
          .eq("rota_config_id", rotaConfigId);
        setOverrides((overrideRows ?? []).map(mapOverrideRow));
      } catch (err) {
        console.error("Failed to load calendar data:", err);
        setLoadError("Failed to load data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rotaConfigId, embedded, cachedPreRota]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navRef.current.goPrev();
      if (e.key === "ArrowRight") navRef.current.goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleDownload = useCallback(() => {
    if (!calendarData || !targetsData) return;
    const blob = generatePreRotaExcel(calendarData, targetsData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RotaGen_PreRota_${calendarData.rotaStartDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [calendarData, targetsData]);

  // Touch handlers for mobile swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) < 50 || Math.abs(dx) < dy) return;
    dx < 0 ? navRef.current.goNext() : navRef.current.goPrev();
  };

  const reloadOverrides = async () => {
    if (!rotaConfigId) return;
    const { data } = await supabase
      .from("coordinator_calendar_overrides")
      .select("*")
      .eq("rota_config_id", rotaConfigId);
    setOverrides((data ?? []).map(mapOverrideRow));
  };

  const handleSaveOverride = async (payload: {
    eventType: string;
    startDate: string;
    endDate: string;
    note: string;
    overrideId: string | null;
    originalEventType: string | null;
  }) => {
    if (!selectedCell || !rotaConfigId) return;
    const doctorId = selectedCell.doctorId;
    setModalSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setModalSaving(false);
        return;
      }

      if (payload.overrideId) {
        await supabase.from("coordinator_calendar_overrides").delete().eq("id", payload.overrideId);
        await supabase.from("coordinator_calendar_overrides").insert({
          rota_config_id: rotaConfigId,
          doctor_id: doctorId,
          event_type: payload.eventType,
          start_date: payload.startDate,
          end_date: payload.endDate,
          action: "modify",
          original_event_type: payload.originalEventType,
          note: payload.note || null,
          created_by: user.id,
        });
      } else {
        await supabase.from("coordinator_calendar_overrides").insert({
          rota_config_id: rotaConfigId,
          doctor_id: doctorId,
          event_type: payload.eventType,
          start_date: payload.startDate,
          end_date: payload.endDate,
          action: "add",
          note: payload.note || null,
          created_by: user.id,
        });
      }
      await reloadOverrides();
      setModalOpen(false);
      setModalPrefill(null);
      setModalCopyFrom(null);
      setModalInitialDate(null);
      setPanelOpen(false);
      setSelectedCell(null);
      refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId).catch((err) =>
        console.error("refreshResolvedAvailability failed:", err),
      );
    } catch (err) {
      console.error("Failed to save override:", err);
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteOverride = async (override: CalendarOverride) => {
    if (!rotaConfigId || !selectedCell) return;
    const doctorId = selectedCell.doctorId;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("coordinator_calendar_overrides").delete().eq("id", override.id);
      await reloadOverrides();
      setPanelOpen(false);
      setSelectedCell(null);
      refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId).catch((err) =>
        console.error("refreshResolvedAvailability failed:", err),
      );
    } catch (err) {
      console.error("Failed to delete override:", err);
    }
  };

  const handleRemoveSurveyEvent = async () => {
    if (!selectedCell || !calendarData || !rotaConfigId) return;
    const doctorId = selectedCell.doctorId;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const cellCode = mergedAvailabilityByDoctor[doctorId]?.[selectedCell.date]?.primary ?? "AVAILABLE";
      if (cellCode === "AVAILABLE") return;
      await supabase.from("coordinator_calendar_overrides").insert({
        rota_config_id: rotaConfigId,
        doctor_id: doctorId,
        event_type: cellCode,
        start_date: selectedCell.date,
        end_date: selectedCell.date,
        action: "delete",
        original_event_type: cellCode,
        original_start_date: selectedCell.date,
        original_end_date: selectedCell.date,
        note: null,
        created_by: user.id,
      });
      await reloadOverrides();
      setPanelOpen(false);
      setSelectedCell(null);
      refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId).catch((err) =>
        console.error("refreshResolvedAvailability failed:", err),
      );
    } catch (err) {
      console.error("Failed to remove survey event:", err);
    }
  };

  const handleCellTap = (doctorId: string, date: string) => {
    const now = Date.now();
    const last = lastTapRef.current;

    // Check if double-tap happened
    if (last && last.doctorId === doctorId && last.date === date && now - last.time < 500) {
      lastTapRef.current = null;
      navigate(`/admin/doctor-calendar/${doctorId}?date=${date}&view=day`);
      return;
    }

    lastTapRef.current = { doctorId, date, time: now };

    if (selectedCell?.doctorId === doctorId && selectedCell?.date === date && panelOpen) {
      setPanelOpen(false);
      setSelectedCell(null);
    } else {
      setSelectedCell({ doctorId, date });
      setPanelOpen(true);
      setModalOpen(false);
    }
  };

  const allDates = useMemo(() => calendarData?.weeks.flatMap((w) => w.dates) ?? [], [calendarData]);
  const maxMinDoctors = useMemo(() => Math.max(...shiftTypes.map((s) => s.min_doctors), 1), [shiftTypes]);

  const mergedAvailabilityByDoctor = useMemo<Record<string, Record<string, MergedCell>>>(() => {
    if (!calendarData) return {};
    const result: Record<string, Record<string, MergedCell>> = {};
    for (const doctor of calendarData.doctors) {
      const doctorOverrides = overrides.filter((o) => o.doctorId === doctor.doctorId);
      result[doctor.doctorId] = mergeOverridesIntoAvailability(
        doctor.availability,
        doctorOverrides,
        calendarData.rotaStartDate,
        calendarData.rotaEndDate,
      );
    }
    return result;
  }, [calendarData, overrides]);

  // Apply Search & Sort
  const sortedAndFilteredDoctors = useMemo(() => {
    if (!calendarData?.doctors) return [];
    let docs = [...calendarData.doctors];

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      docs = docs.filter((d) => d.doctorName.toLowerCase().includes(lowerQuery));
    }

    docs.sort((a, b) => {
      const valA = sortConfig.key === "name" ? a.doctorName : a.grade || "";
      const valB = sortConfig.key === "name" ? b.doctorName : b.grade || "";

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return docs;
  }, [calendarData, searchQuery, sortConfig]);

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => (
        <AdminLayout
          title="Availability Calendar"
          subtitle={`${deptName}${deptName && hospitalName ? " · " : ""}${hospitalName}`}
          accentColor="blue"
          pageIcon={CalendarRange}
        >
          {children}
        </AdminLayout>
      );

  if (loading) {
    return (
      <Wrapper>
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading calendar…</span>
        </div>
      </Wrapper>
    );
  }

  if (loadError || errorMsg || !calendarData) {
    return (
      <Wrapper>
        <div className="mx-auto max-w-lg mt-12">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-foreground">{loadError ?? errorMsg ?? "No calendar data available."}</p>
            <Button variant="outline" onClick={() => navigate("/admin/pre-rota")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Pre-rota
            </Button>
          </div>
        </div>
      </Wrapper>
    );
  }

  const { weeks, doctors } = calendarData;
  const currentWeek = weeks[currentWeekIndex];
  const currentDate = allDates[currentDayIndex] ?? allDates[0];

  // Sync unmanaged date inputs securely safely inside an effect to prevent rendering loops
  useEffect(() => {
    if (dateInputDesktopRef.current && dateInputDesktopRef.current.value !== currentDate) {
      dateInputDesktopRef.current.value = currentDate;
    }
    if (dateInputMobileRef.current && dateInputMobileRef.current.value !== currentDate) {
      dateInputMobileRef.current.value = currentDate;
    }
  }, [currentDate]);

  const weekLabel = currentWeek
    ? `Wk ${currentWeek.weekNumber} · ${new Date(currentWeek.dates[0] + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })}–${new Date(currentWeek.dates[currentWeek.dates.length - 1] + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })}`
    : "";
  const dayLabel = currentDate
    ? new Date(currentDate + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
  const MONTH_NAMES_LONG = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthLabel = currentMonthKey
    ? `${MONTH_NAMES_LONG[Number(currentMonthKey.split("-")[1]) - 1]} ${currentMonthKey.split("-")[0]}`
    : "Month view";
  const navLabel = viewMode === "week" ? weekLabel : viewMode === "day" ? dayLabel : monthLabel;

  const prevDisabled =
    viewMode === "week"
      ? currentWeekIndex === 0
      : viewMode === "day"
        ? currentDayIndex === 0
        : !currentMonthKey || currentMonthKey <= (calendarData?.rotaStartDate.slice(0, 7) ?? "");
  const nextDisabled =
    viewMode === "week"
      ? currentWeekIndex >= weeks.length - 1
      : viewMode === "day"
        ? currentDayIndex >= allDates.length - 1
        : !currentMonthKey || currentMonthKey >= (calendarData?.rotaEndDate.slice(0, 7) ?? "");

  const goPrev = () => {
    if (viewMode === "week") setCurrentWeekIndex((i) => Math.max(0, i - 1));
    else if (viewMode === "day") setCurrentDayIndex((i) => Math.max(0, i - 1));
    else if (viewMode === "month" && currentMonthKey) {
      const [y, m] = currentMonthKey.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 2, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (calendarData && key >= calendarData.rotaStartDate.slice(0, 7)) setCurrentMonthKey(key);
    }
  };
  const goNext = () => {
    if (viewMode === "week") setCurrentWeekIndex((i) => Math.min(weeks.length - 1, i + 1));
    else if (viewMode === "day") setCurrentDayIndex((i) => Math.min(allDates.length - 1, i + 1));
    else if (viewMode === "month" && currentMonthKey) {
      const [y, m] = currentMonthKey.split("-").map(Number);
      const d = new Date(Date.UTC(y, m, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (calendarData && key <= calendarData.rotaEndDate.slice(0, 7)) setCurrentMonthKey(key);
    }
  };

  navRef.current.goPrev = goPrev;
  navRef.current.goNext = goNext;

  const handleDateChange = (iso: string) => {
    const wIdx = weeks.findIndex((w) => w.startDate <= iso && iso <= w.endDate);
    if (wIdx >= 0) setCurrentWeekIndex(wIdx);
    const dIdx = allDates.indexOf(iso);
    if (dIdx >= 0) setCurrentDayIndex(dIdx);
    setCurrentMonthKey(iso.slice(0, 7));
  };

  // Pre-computed general availability bounds across ALL doctors
  const totalAvailable = doctors.filter((doc) => {
    const mc = mergedAvailabilityByDoctor[doc.doctorId]?.[currentDate];
    const p = mc?.isDeleted ? "AVAILABLE" : (mc?.primary ?? "AVAILABLE");
    return !["AL", "SL", "ROT", "PL", "NOC"].includes(p);
  }).length;

  const nocOnlyCount = doctors.filter((doc) => {
    const mc = mergedAvailabilityByDoctor[doc.doctorId]?.[currentDate];
    const p = mc?.isDeleted ? "AVAILABLE" : (mc?.primary ?? "AVAILABLE");
    return p === "NOC";
  }).length;

  const getAvailabilityColorClass = (count: number, min: number) => {
    if (count < min) return "bg-red-600";
    if (count === min) return "bg-amber-500";
    return "bg-green-600";
  };

  // Group Availability Logic
  const fullyAvailableDocs: CalendarDoctor[] = [];
  const partiallyAvailableDocs: CalendarDoctor[] = [];
  const unavailableDocs: CalendarDoctor[] = [];

  sortedAndFilteredDoctors.forEach((doc) => {
    const mergedCell = mergedAvailabilityByDoctor[doc.doctorId]?.[currentDate];
    const primary = mergedCell?.isDeleted ? "AVAILABLE" : (mergedCell?.primary ?? "AVAILABLE");
    const isLtftDay = getLtftDaysOff(doc).includes(getDayNameFromISO(currentDate));

    if (["AL", "SL", "ROT", "PL"].includes(primary)) {
      unavailableDocs.push(doc);
    } else if (primary === "NOC" || isLtftDay) {
      partiallyAvailableDocs.push(doc);
    } else {
      fullyAvailableDocs.push(doc);
    }
  });

  // Renderer for Day Doctor Card
  const renderDayDoctorCard = (doctor: CalendarDoctor) => {
    const mergedCell = mergedAvailabilityByDoctor[doctor.doctorId]?.[currentDate];
    const primary = mergedCell?.isDeleted ? "AVAILABLE" : (mergedCell?.primary ?? "AVAILABLE");
    const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(currentDate));
    const cellBg = getMergedCellBackground(mergedCell, isLtftDay);
    const isUnavailable = ["AL", "SL", "ROT", "PL"].includes(primary);
    const isSelected = selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === currentDate;
    const nameColor = isUnavailable ? "text-gray-500" : "text-blue-600";

    const nameParts = doctor.doctorName.replace("Dr ", "").trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    const activeBadges: (keyof typeof BADGE_STYLES)[] = [];
    if (primary === "AL") activeBadges.push("AL");
    if (primary === "SL") activeBadges.push("SL");
    if (primary === "ROT") activeBadges.push("ROT");
    if (primary === "PL") activeBadges.push("PL");
    if (primary === "NOC") activeBadges.push("NOC");
    if (isLtftDay) activeBadges.push("LTFT");

    const hasDeleted = !!(mergedCell?.isDeleted && mergedCell.deletedCode);
    const hasOverride = !!(mergedCell?.overrideAction === "add" || mergedCell?.overrideAction === "modify");
    const totalItems = activeBadges.length + (hasDeleted ? 1 : 0);

    let layoutClass = "flex flex-row flex-wrap items-center justify-end gap-[2px]";
    if (totalItems === 2) layoutClass = "flex flex-col items-end justify-center gap-[2px]";
    else if (totalItems >= 3) layoutClass = "grid grid-cols-2 gap-[2px] items-center justify-items-end";

    const useShort = totalItems >= 2;
    const isSingleEvent = totalItems === 1;

    return (
      <div
        key={doctor.doctorId}
        onClick={() => handleCellTap(doctor.doctorId, currentDate)}
        className={`flex flex-row items-center justify-between px-2 py-1.5 rounded-md border border-border/50 cursor-pointer transition-colors hover:bg-muted/50 ${
          isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-500 z-10 relative" : cellBg
        } ${isUnavailable ? "opacity-70 grayscale-[20%]" : ""}`}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/doctor-calendar/${doctor.doctorId}?date=${currentDate}&view=day`);
          }}
          className={`flex flex-col min-w-0 pr-1 shrink cursor-pointer hover:underline ${nameColor}`}
          title={doctor.doctorName}
        >
          <div className="font-semibold text-xs truncate w-full">{firstName}</div>
          {lastName && <div className="font-semibold text-[11px] truncate w-full">{lastName}</div>}
        </div>

        <div className={`${layoutClass} shrink-0 relative`}>
          {hasDeleted && (
            <span
              className={`bg-muted text-muted-foreground font-bold rounded line-through flex items-center justify-center ${useShort ? "text-[8px] w-4 h-4 sm:w-[16px] sm:h-[16px]" : "text-[9px] px-1.5 py-0.5"}`}
            >
              {useShort ? mergedCell.deletedCode.charAt(0) : mergedCell.deletedCode}
            </span>
          )}
          {activeBadges.map((b) => (
            <LeaveBadge
              key={b}
              type={b}
              size={isSingleEvent ? "large" : "small"}
              short={useShort}
              className={useShort ? "" : ""}
            />
          ))}
          {hasOverride && (
            <span className="absolute -top-[3px] -right-[3px] w-1.5 h-1.5 rounded-full bg-orange-500 border border-white" />
          )}
        </div>
      </div>
    );
  };

  // Renderer for Week Table Row
  const renderWeekRow = (doctor: CalendarDoctor, i: number) => {
    const rowBg = i % 2 === 0 ? "bg-card" : "bg-muted/20";
    const ltftDays = getLtftDaysOff(doctor);
    return (
      <tr key={doctor.doctorId} className={`border-b border-border/50 ${rowBg}`}>
        <td className={`p-0.5 sm:p-1 border-r border-border align-middle overflow-hidden`}>
          <div className="flex flex-row items-center gap-1 sm:gap-1.5 w-full pr-1">
            <div
              onClick={() => navigate(`/admin/doctor-calendar/${doctor.doctorId}?date=${currentDate}&view=week`)}
              className="font-semibold text-blue-600 truncate cursor-pointer hover:underline text-[9px] sm:text-[10px] shrink-0 max-w-[45%]"
              title={doctor.doctorName}
            >
              {doctor.doctorName.replace("Dr ", "")}
            </div>
            <div className="text-[7px] sm:text-[8px] text-muted-foreground truncate shrink-0">
              {doctor.grade}·{doctor.wte}%
            </div>
            {ltftDays.length > 0 && (
              <span className="inline-block text-[7px] sm:text-[8px] font-semibold text-yellow-800 bg-yellow-100 border border-yellow-200 rounded px-1 truncate shrink-0">
                LTFT
              </span>
            )}
          </div>
        </td>
        {currentWeek.dates.map((date) => {
          const mergedCell = mergedAvailabilityByDoctor[doctor.doctorId]?.[date];
          const primary = mergedCell?.primary ?? "AVAILABLE";
          const isLtftDay = ltftDays.includes(getDayNameFromISO(date));
          const cellBg = getMergedCellBackground(mergedCell, isLtftDay);
          const isSelected = selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === date;

          return (
            <td
              key={date}
              onClick={() => handleCellTap(doctor.doctorId, date)}
              className={`border-l border-border/50 p-0.5 text-center align-middle cursor-pointer transition-colors hover:bg-muted/50 ${cellBg} ${
                isSelected ? "ring-2 ring-inset ring-blue-500 z-10 relative" : ""
              }`}
            >
              <div className="flex flex-row flex-wrap items-center justify-center gap-[1px] min-h-[18px] sm:min-h-[22px] overflow-hidden w-full">
                <WeekCellContent mergedCell={mergedCell} isLtftDay={isLtftDay} primary={primary} />
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Renderer for Month Table Row
  const renderMonthRow = (doctor: CalendarDoctor, i: number, gridDates: string[]) => {
    const rowBg = i % 2 === 0 ? "bg-card" : "bg-muted/10";
    return (
      <tr key={doctor.doctorId} className={`border-b border-border/50 ${rowBg}`}>
        <td
          onClick={() => navigate(`/admin/doctor-calendar/${doctor.doctorId}?date=${currentDate}&view=month`)}
          className={`p-1 sm:p-1.5 border-r border-border text-left align-middle cursor-pointer hover:underline overflow-hidden`}
          title={doctor.doctorName}
        >
          <div className="font-semibold text-[10px] sm:text-[11px] text-blue-600 truncate w-full">
            {doctor.doctorName.replace("Dr ", "")}
          </div>
          <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate mt-0.5 hidden sm:block">
            {doctor.grade} · {doctor.wte}%
          </div>
        </td>
        {gridDates.map((date, idx) => {
          const inRota = date >= calendarData.rotaStartDate && date <= calendarData.rotaEndDate;
          const inMonth = date.startsWith(currentMonthKey);
          const mergedCell = inRota ? mergedAvailabilityByDoctor[doctor.doctorId]?.[date] : undefined;
          const primary = mergedCell?.isDeleted ? "AVAILABLE" : (mergedCell?.primary ?? "AVAILABLE");
          const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(date));
          const bg = inRota ? getMergedCellBackground(mergedCell, isLtftDay) : "bg-card";
          const hasOverride = !!mergedCell?.overrideId;
          const isSelected = selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === date;

          const eventChar = primary === "NOC" ? "N" : primary === "ROT" ? "R" : primary.charAt(0);

          return (
            <td
              key={`${doctor.doctorId}-${idx}`}
              onClick={() => {
                if (inRota && inMonth) handleCellTap(doctor.doctorId, date);
              }}
              className={`border-l border-border/50 p-0 sm:p-0.5 text-center cursor-default h-6 sm:h-8 ${bg} ${
                !inRota || !inMonth ? "opacity-20" : inRota && inMonth ? "cursor-pointer hover:bg-muted/50" : ""
              } ${isSelected ? "ring-2 ring-inset ring-blue-500 z-10 relative" : ""}`}
            >
              {inRota &&
                inMonth &&
                (mergedCell?.isDeleted && mergedCell.deletedCode ? (
                  <span className="text-[6px] sm:text-[8px] font-bold text-muted-foreground line-through block truncate">
                    {mergedCell.deletedCode.charAt(0)}
                  </span>
                ) : primary !== "AVAILABLE" && primary !== "BH" ? (
                  <div className="flex justify-center items-center relative w-full h-full">
                    <span
                      className="flex items-center justify-center rounded shadow-sm"
                      style={{
                        width: "16px",
                        height: "16px",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#fff",
                        background: MONTH_EVENT_COLOURS[primary] ?? "#6b7280",
                        lineHeight: 1,
                      }}
                      title={primary}
                    >
                      {eventChar}
                    </span>
                    {hasOverride && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-500 border border-white hidden sm:inline-block" />
                    )}
                  </div>
                ) : isLtftDay ? (
                  <span className="text-[9px] sm:text-[10px] font-bold text-yellow-800">L</span>
                ) : null)}
            </td>
          );
        })}
      </tr>
    );
  };

  // Dynamic Content logic for Collapsible Summary Table
  const renderSummaryContent = () => {
    if (viewMode === "day") {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 border-t border-border bg-card">
          <div className="col-span-full flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/50 mb-2">
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded text-white font-bold shadow-sm ${getAvailabilityColorClass(totalAvailable, maxMinDoctors)}`}
            >
              {totalAvailable}
            </span>
            <span className="text-sm font-semibold">Total Available (All Shifts)</span>
            {nocOnlyCount > 0 && <span className="text-xs font-bold text-pink-500 ml-auto">+{nocOnlyCount} NOC</span>}
          </div>
          {shiftTypes.map((shift) => {
            const count = eligibility[shift.id]?.[currentDate] ?? 0;
            return (
              <div
                key={shift.id}
                className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border/50"
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded text-white font-bold text-xs shadow-sm ${getAvailabilityColorClass(count, shift.min_doctors)}`}
                >
                  {count}
                </span>
                <span className="text-xs text-muted-foreground font-medium truncate">{shift.name}</span>
              </div>
            );
          })}
        </div>
      );
    }

    const summaryDates =
      viewMode === "week"
        ? currentWeek.dates
        : buildMonthGrid(currentMonthKey).filter(
            (d) => d >= calendarData.rotaStartDate && d <= calendarData.rotaEndDate && d.startsWith(currentMonthKey),
          );

    return (
      <div className="border-t border-border bg-card overflow-x-auto w-full">
        <table className="w-full text-xs border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground sticky left-0 bg-muted/30 border-r border-border">
                Shift Type
              </th>
              {summaryDates.map((date) => {
                const d = new Date(date + "T00:00:00");
                return (
                  <th key={date} className="py-2 px-1 text-center font-medium border-l border-border/50">
                    <div className="text-[9px] uppercase tracking-tighter">
                      {d.toLocaleDateString("en-GB", { weekday: "short" })}
                    </div>
                    <div className="text-[10px] font-bold">
                      {d.getDate()} {d.toLocaleDateString("en-GB", { month: "short" })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50 bg-card">
              <td className="py-2 px-3 font-semibold sticky left-0 bg-card border-r border-border">
                All Available <span className="font-normal text-[9px] text-muted-foreground block">(Total Pool)</span>
              </td>
              {summaryDates.map((date) => {
                const availableAll = doctors.filter(
                  (doc) =>
                    !["AL", "SL", "ROT", "PL", "NOC"].includes(
                      mergedAvailabilityByDoctor[doc.doctorId]?.[date]?.isDeleted
                        ? "AVAILABLE"
                        : (mergedAvailabilityByDoctor[doc.doctorId]?.[date]?.primary ?? "AVAILABLE"),
                    ),
                ).length;
                const availableNocOnly = doctors.filter(
                  (doc) =>
                    (mergedAvailabilityByDoctor[doc.doctorId]?.[date]?.isDeleted
                      ? "AVAILABLE"
                      : (mergedAvailabilityByDoctor[doc.doctorId]?.[date]?.primary ?? "AVAILABLE")) === "NOC",
                ).length;
                const bgClass = getAvailabilityColorClass(availableAll, maxMinDoctors);
                return (
                  <td key={date} className="py-2 px-1 border-l border-border/50 text-center align-middle">
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-white font-bold text-[10px] shadow-sm ${bgClass}`}
                      >
                        {availableAll}
                      </span>
                      {availableNocOnly > 0 && (
                        <span className="text-[7px] text-pink-500 font-bold mt-[1px]">+{availableNocOnly} NOC</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
            {shiftTypes.map((shift, i) => (
              <tr key={shift.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/10" : "bg-card"}`}>
                <td
                  className={`py-2 px-3 text-muted-foreground sticky left-0 border-r border-border truncate max-w-[150px] ${i % 2 === 0 ? "bg-muted/10" : "bg-card"}`}
                >
                  {shift.name}
                </td>
                {summaryDates.map((date) => {
                  const count = eligibility[shift.id]?.[date] ?? 0;
                  const bgClass =
                    count < shift.min_doctors
                      ? "text-red-600"
                      : count === shift.min_doctors
                        ? "text-amber-500"
                        : "text-green-600";
                  return (
                    <td key={date} className="py-2 px-1 border-l border-border/50 text-center align-middle">
                      <span className={`font-bold text-[11px] ${bgClass}`}>{count}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Wrapper>
      <div className="space-y-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Top bar — non-embedded only */}
        {!embedded && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/pre-rota")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Pre-rota
            </button>
            <Button variant="outline" size="sm" onClick={handleDownload} type="button">
              <Download className="h-4 w-4 mr-2" /> Export Calendar
            </Button>
          </div>
        )}

        {/* Info strip */}
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
          <CalendarRange className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {isMobile
              ? "Double-tap a cell to view doctor details. Switch to week view for context."
              : "Double-click any cell to jump to that doctor's calendar. Use the navigation to change dates."}
          </span>
        </div>

        {/* Unified Nav Bar */}
        <div className="flex flex-col gap-3 p-3 bg-card rounded-xl border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto">
              <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
              {isMobile && (
                <input
                  ref={dateInputMobileRef}
                  type="date"
                  min={allDates[0]}
                  max={allDates[allDates.length - 1]}
                  onChange={(e) => {
                    if (e.target.value && e.target.value.length === 10) handleDateChange(e.target.value);
                  }}
                  className="text-xs px-2 py-1.5 border border-border rounded-md bg-card text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 h-[34px]"
                />
              )}
            </div>

            <div className="flex items-center justify-center gap-2 flex-1">
              <button
                type="button"
                onClick={goPrev}
                disabled={prevDisabled}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">{navLabel}</span>
              <button
                type="button"
                onClick={goNext}
                disabled={nextDisabled}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {!isMobile && (
              <input
                ref={dateInputDesktopRef}
                type="date"
                min={allDates[0]}
                max={allDates[allDates.length - 1]}
                onChange={(e) => {
                  if (e.target.value && e.target.value.length === 10) handleDateChange(e.target.value);
                }}
                className="ml-auto text-xs px-3 py-1.5 border border-border rounded-md bg-card text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 h-[34px]"
              />
            )}
          </div>

          {/* Search and Sort Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-muted/30 p-2 border border-border/60 rounded-lg">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search doctors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3 justify-between sm:justify-end flex-wrap w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setGroupAvailability(!groupAvailability)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all shadow-sm ${
                  groupAvailability
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${groupAvailability ? "bg-white" : "bg-muted-foreground"}`}
                />
                Availability
              </button>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">Sort:</span>
                <select
                  value={`${sortConfig.key}-${sortConfig.direction}`}
                  onChange={(e) => {
                    const [k, d] = e.target.value.split("-");
                    setSortConfig({ key: k as "name" | "grade", direction: d as "asc" | "desc" });
                  }}
                  className="text-xs px-2 py-1.5 border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="grade-asc">Grade (A-Z)</option>
                  <option value="grade-desc">Grade (Z-A)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── WEEK VIEW ── */}
        {viewMode === "week" && currentWeek && (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full">
            <table className="w-full table-fixed text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="bg-card py-2 px-1 sm:px-2 font-medium text-muted-foreground border-r border-border w-[25%] sm:w-[20%] align-bottom">
                    Doctor
                  </th>
                  {currentWeek.dates.map((date) => {
                    const dd = new Date(date + "T00:00:00");
                    const isWknd = dd.getDay() === 0 || dd.getDay() === 6;
                    const isBH = bankHolidays.has(date);
                    const isToday = date === todayISO;

                    const hdrBg = isToday ? "bg-blue-100" : isBH ? "bg-red-100" : isWknd ? "bg-muted" : "bg-card";
                    const hdrColor = isToday
                      ? "text-blue-800"
                      : isBH
                        ? "text-red-800"
                        : isWknd
                          ? "text-muted-foreground"
                          : "text-foreground";

                    return (
                      <th
                        key={date}
                        className={`py-1 px-0.5 sm:px-1 text-center font-medium border-l border-border w-[10.7%] md:w-[11.4%] ${hdrBg} ${hdrColor}`}
                      >
                        <div className="text-[8px] sm:text-[10px] uppercase tracking-tighter sm:tracking-wider truncate">
                          {dd.toLocaleDateString("en-GB", { weekday: "short" })}
                        </div>
                        <div className={`text-[9px] sm:text-[10px] truncate ${isToday ? "font-bold" : "font-normal"}`}>
                          {dd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </div>
                        {isBH && (
                          <span className="inline-block bg-red-700 text-white text-[8px] font-bold px-0.5 rounded mt-0.5 tracking-tighter">
                            BH
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {groupAvailability ? (
                  <>
                    {fullyAvailableDocs.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={currentWeek.dates.length + 1}
                            className="bg-muted/30 px-2 py-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/50"
                          >
                            Fully Available ({fullyAvailableDocs.length})
                          </td>
                        </tr>
                        {fullyAvailableDocs.map((doc, i) => renderWeekRow(doc, i))}
                      </>
                    )}
                    {partiallyAvailableDocs.length > 0 && (
                      <>
                        <tr
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                          onClick={() => setCollapsePartial(!collapsePartial)}
                        >
                          <td colSpan={currentWeek.dates.length + 1} className="px-2 py-1.5">
                            <div className="flex items-center justify-between font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                              <span>Partially Available ({partiallyAvailableDocs.length})</span>
                              {collapsePartial ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronUp className="h-4 w-4" />
                              )}
                            </div>
                          </td>
                        </tr>
                        {!collapsePartial && partiallyAvailableDocs.map((doc, i) => renderWeekRow(doc, i))}
                      </>
                    )}
                    {unavailableDocs.length > 0 && (
                      <>
                        <tr
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                          onClick={() => setCollapseUnavailable(!collapseUnavailable)}
                        >
                          <td colSpan={currentWeek.dates.length + 1} className="px-2 py-1.5">
                            <div className="flex items-center justify-between font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                              <span>Unavailable ({unavailableDocs.length})</span>
                              {collapseUnavailable ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronUp className="h-4 w-4" />
                              )}
                            </div>
                          </td>
                        </tr>
                        {!collapseUnavailable && unavailableDocs.map((doc, i) => renderWeekRow(doc, i))}
                      </>
                    )}
                  </>
                ) : (
                  sortedAndFilteredDoctors.map((doc, i) => renderWeekRow(doc, i))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DAY VIEW ── */}
        {viewMode === "day" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden p-2 sm:p-3">
              <div className="flex items-center gap-2 px-2 py-2 mb-2 border-b border-border/50">
                <CalendarRange className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Doctors Availability
                </span>
                <span className="text-xs text-muted-foreground ml-auto">{sortedAndFilteredDoctors.length} found</span>
              </div>

              {groupAvailability ? (
                <div className="space-y-4">
                  {/* Group 1: Fully Available */}
                  <div>
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                      Fully Available ({fullyAvailableDocs.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                      {fullyAvailableDocs.map(renderDayDoctorCard)}
                    </div>
                  </div>

                  {/* Group 2: Partially Available */}
                  <div className="border-t border-border/50 pt-3">
                    <div
                      className="flex items-center justify-between cursor-pointer mb-2 px-1 hover:bg-muted/30 rounded transition-colors"
                      onClick={() => setCollapsePartial(!collapsePartial)}
                    >
                      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Partially Available ({partiallyAvailableDocs.length})
                      </h3>
                      {collapsePartial ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {!collapsePartial && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                        {partiallyAvailableDocs.map(renderDayDoctorCard)}
                      </div>
                    )}
                  </div>

                  {/* Group 3: Unavailable */}
                  <div className="border-t border-border/50 pt-3">
                    <div
                      className="flex items-center justify-between cursor-pointer mb-2 px-1 hover:bg-muted/30 rounded transition-colors"
                      onClick={() => setCollapseUnavailable(!collapseUnavailable)}
                    >
                      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Unavailable ({unavailableDocs.length})
                      </h3>
                      {collapseUnavailable ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {!collapseUnavailable && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                        {unavailableDocs.map(renderDayDoctorCard)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Un-grouped standard view */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                  {sortedAndFilteredDoctors.map(renderDayDoctorCard)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {viewMode === "month" &&
          (isMobile ? (
            <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center border border-border rounded-xl bg-card shadow-sm min-h-[40vh]">
              <MonitorSmartphone className="h-14 w-14 text-muted-foreground/30 mb-4" strokeWidth={1.5} />
              <p className="font-bold text-foreground text-lg sm:text-xl mb-2">Monthly View Unavailable</p>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                The monthly view is too large for a mobile phone screen. Please use a tablet or desktop device to see
                the full month overview.
              </p>
            </div>
          ) : calendarData && currentMonthKey ? (
            (() => {
              const gridDates = buildMonthGrid(currentMonthKey);
              return (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full">
                  <table className="w-full table-fixed text-[10px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="bg-muted/30 py-1 sm:py-2 px-1 font-medium text-muted-foreground border-r border-border w-[12%] sm:w-[15%] truncate align-bottom">
                          Doctor
                        </th>
                        {gridDates.map((date, idx) => {
                          const inRota = date >= calendarData.rotaStartDate && date <= calendarData.rotaEndDate;
                          const inMonth = date.startsWith(currentMonthKey);
                          const d = new Date(date + "T00:00:00Z");
                          const dow = d.getUTCDay();
                          const isWknd = dow === 0 || dow === 6;
                          const isBH = bankHolidays.has(date);
                          const isToday = date === todayISO;

                          const hdrBg = isToday ? "bg-blue-100" : isBH ? "bg-red-100" : isWknd ? "bg-muted" : "bg-card";
                          const hdrColor =
                            !inRota || !inMonth
                              ? "text-muted-foreground/40"
                              : isToday
                                ? "text-blue-800"
                                : isBH
                                  ? "text-red-800"
                                  : isWknd
                                    ? "text-muted-foreground"
                                    : "text-foreground";

                          return (
                            <th
                              key={`h${idx}`}
                              style={{ width: `${85 / gridDates.length}%` }}
                              className={`py-1 px-0 text-center font-medium border-l border-border/50 overflow-hidden ${hdrBg} ${hdrColor} ${
                                !inRota || !inMonth ? "opacity-50" : ""
                              }`}
                            >
                              <div className="text-[7px] sm:text-[9px] uppercase tracking-tighter truncate">
                                {MONTH_DAY_ABBR[(dow + 6) % 7][0]}
                              </div>
                              <div className={`text-[8px] sm:text-[10px] ${isToday ? "font-bold" : "font-normal"}`}>
                                {d.getUTCDate()}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {groupAvailability ? (
                        <>
                          {fullyAvailableDocs.length > 0 && (
                            <>
                              <tr>
                                <td
                                  colSpan={gridDates.length + 1}
                                  className="bg-muted/30 px-2 py-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/50"
                                >
                                  Fully Available ({fullyAvailableDocs.length})
                                </td>
                              </tr>
                              {fullyAvailableDocs.map((doc, i) => renderMonthRow(doc, i, gridDates))}
                            </>
                          )}
                          {partiallyAvailableDocs.length > 0 && (
                            <>
                              <tr
                                className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                                onClick={() => setCollapsePartial(!collapsePartial)}
                              >
                                <td colSpan={gridDates.length + 1} className="px-2 py-1.5">
                                  <div className="flex items-center justify-between font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                                    <span>Partially Available ({partiallyAvailableDocs.length})</span>
                                    {collapsePartial ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronUp className="h-4 w-4" />
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {!collapsePartial &&
                                partiallyAvailableDocs.map((doc, i) => renderMonthRow(doc, i, gridDates))}
                            </>
                          )}
                          {unavailableDocs.length > 0 && (
                            <>
                              <tr
                                className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                                onClick={() => setCollapseUnavailable(!collapseUnavailable)}
                              >
                                <td colSpan={gridDates.length + 1} className="px-2 py-1.5">
                                  <div className="flex items-center justify-between font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                                    <span>Unavailable ({unavailableDocs.length})</span>
                                    {collapseUnavailable ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronUp className="h-4 w-4" />
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {!collapseUnavailable &&
                                unavailableDocs.map((doc, i) => renderMonthRow(doc, i, gridDates))}
                            </>
                          )}
                        </>
                      ) : (
                        sortedAndFilteredDoctors.map((doc, i) => renderMonthRow(doc, i, gridDates))
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : null)}

        {/* Global Collapsible Summary Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mt-6 mb-2">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors border-none cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <CalendarRange className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">Availability Breakdown & Targets</span>
            </div>
            {showBreakdown ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showBreakdown && renderSummaryContent()}
        </div>

        {/* Full legend — always shown */}
        <CalendarLegend />

        {/* Detail/Action Panel (renders below legend) */}
        {panelOpen &&
          selectedCell &&
          calendarData &&
          (() => {
            const selDoctor = calendarData.doctors.find((d) => d.doctorId === selectedCell.doctorId);
            const mergedCell = mergedAvailabilityByDoctor[selectedCell.doctorId]?.[selectedCell.date];
            if (!selDoctor || !mergedCell) return null;
            return (
              <div className="mt-4 pb-4">
                <EventDetailPanel
                  mergedCell={mergedCell}
                  date={selectedCell.date}
                  doctorName={selDoctor.doctorName}
                  overrides={overrides.filter((o) => o.doctorId === selectedCell.doctorId)}
                  onEdit={(override) => {
                    setModalPrefill({
                      eventType: override.eventType,
                      startDate: override.startDate,
                      endDate: override.endDate,
                      note: override.note ?? "",
                      overrideId: override.id,
                      originalEventType: override.originalEventType,
                    });
                    setModalCopyFrom(null);
                    setModalInitialDate(null);
                    setModalOpen(true);
                  }}
                  onDelete={handleDeleteOverride}
                  onCopy={(override) => {
                    setModalCopyFrom({
                      eventType: override.eventType,
                      startDate: override.startDate,
                      endDate: override.endDate,
                    });
                    setModalPrefill(null);
                    setModalInitialDate(null);
                    setModalOpen(true);
                  }}
                  onAddNew={() => {
                    setModalPrefill(null);
                    setModalCopyFrom(null);
                    setModalInitialDate(selectedCell.date);
                    setModalOpen(true);
                  }}
                  onRemoveSurveyEvent={handleRemoveSurveyEvent}
                  onGoToDate={() => {
                    navigate(`/admin/doctor-calendar/${selectedCell!.doctorId}?date=${selectedCell.date}&view=day`);
                  }}
                  onClose={() => {
                    setPanelOpen(false);
                    setSelectedCell(null);
                  }}
                />
              </div>
            );
          })()}
      </div>

      {/* Floating Modal Layer */}
      {modalOpen &&
        calendarData &&
        selectedCell &&
        (() => {
          const selDoctor = calendarData.doctors.find((d) => d.doctorId === selectedCell.doctorId);
          if (!selDoctor) return null;
          return (
            <AddEventModal
              prefill={modalPrefill ?? undefined}
              copyFrom={modalCopyFrom ?? undefined}
              initialDate={modalInitialDate ?? undefined}
              doctorName={selDoctor.doctorName}
              rotaStartDate={calendarData.rotaStartDate}
              rotaEndDate={calendarData.rotaEndDate}
              saving={modalSaving}
              onSave={handleSaveOverride}
              onClose={() => {
                setModalOpen(false);
                setModalPrefill(null);
                setModalCopyFrom(null);
                setModalInitialDate(null);
              }}
            />
          );
        })()}
    </Wrapper>
  );
}
