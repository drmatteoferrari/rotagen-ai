import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import {
  getTodayISO,
  mapOverrideRow,
  mergeOverridesIntoAvailability,
  type CalendarOverride,
  type MergedCell,
} from "@/lib/calendarOverrides";
import type { CalendarData, CalendarDoctor } from "@/lib/preRotaTypes";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  Plus,
  Edit2,
  Copy,
  Trash2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddEventModal } from "@/components/calendar/AddEventModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { refreshResolvedAvailabilityForDoctor } from "@/lib/resolvedAvailability";

// ─── Constants ────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  AL: "Annual leave",
  SL: "Study leave",
  NOC: "Not on-call",
  ROT: "Rotation",
  PL: "Parental leave",
  LTFT: "LTFT day off",
};

const SKIP_CODES = new Set(["AVAILABLE", "BH"]);

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BADGE_STYLES = {
  AL: { classes: "bg-green-600 text-white", label: "AL" },
  SL: { classes: "bg-blue-600 text-white", label: "SL" },
  ROT: { classes: "bg-orange-600 text-white", label: "ROT" },
  PL: { classes: "bg-violet-600 text-white", label: "PL" },
  NOC: { classes: "bg-pink-500 text-white", label: "NOC" },
  LTFT: { classes: "bg-yellow-100 text-yellow-800 border border-yellow-300", label: "LTFT" },
} as const;

const MONTH_EVENT_COLOURS: Record<string, string> = {
  AL: "#16a34a",
  SL: "#2563eb",
  NOC: "#ec4899",
  ROT: "#ea580c",
  PL: "#7c3aed",
  LTFT: "#ca8a04",
};

// ─── Date helpers ─────────────────────────────────────────────
function isoToUTCDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysISO(iso: string, n: number): string {
  const d = isoToUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function getMondayOfWeek(iso: string): string {
  const d = isoToUTCDate(iso);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split("T")[0];
}

function getISOWeekNumber(iso: string): number {
  const d = isoToUTCDate(iso);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  return Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 86400000)) + 1;
}

function getMonthWeekRows(yearMonth: string): string[][] {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  const monday = getMondayOfWeek(firstDay.toISOString().split("T")[0]);
  const rows: string[][] = [];
  let cursor = monday;
  while (cursor <= lastDay.toISOString().split("T")[0]) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) week.push(addDaysISO(cursor, i));
    rows.push(week);
    cursor = addDaysISO(cursor, 7);
  }
  return rows;
}

function fmtShort(iso: string): string {
  const d = isoToUTCDate(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function fmtFull(iso: string): string {
  return isoToUTCDate(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ─── UI Helpers ───────────────────────────────────────────────
function LeaveBadge({
  type,
  size = "small",
  short = false,
  className = "",
}: {
  type: string;
  size?: "small" | "large";
  short?: boolean;
  className?: string;
}) {
  const s = BADGE_STYLES[type as keyof typeof BADGE_STYLES];
  if (!s) return null;
  const sizeClasses =
    size === "large"
      ? "px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs"
      : short
        ? "w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center text-[7px] sm:text-[9px]"
        : "px-1 sm:px-1.5 py-[1px] sm:py-[2px] text-[8px] sm:text-[10px]";

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

function RotaOverrideDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 ml-0.5 shrink-0" />;
}

function getMergedCellBackground(mergedCell: MergedCell | undefined, isLtftDay: boolean): string {
  if (!mergedCell) return "bg-card";
  const primary = mergedCell.isDeleted ? "AVAILABLE" : mergedCell.primary;
  if (primary === "ROT") return "bg-orange-50";
  if (primary === "PL") return "bg-violet-50";
  if (isLtftDay) return "bg-yellow-50";
  return "bg-card";
}

function ViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: "day" | "week" | "month";
  setViewMode: (v: "day" | "week" | "month") => void;
}) {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-border shadow-sm shrink-0 w-full sm:w-auto">
      {(["day", "week", "month"] as const).map((v, i) => (
        <button
          key={v}
          onClick={() => setViewMode(v)}
          className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs capitalize transition-colors ${i < 2 ? "border-r border-border" : ""} ${
            viewMode === v
              ? "bg-teal-600 text-white font-semibold"
              : "bg-card text-muted-foreground hover:bg-muted/50 font-medium"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export default function DoctorCalendarPage() {
  const navigate = useNavigate();
  const { doctorId } = useParams<{ doctorId: string }>();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("date");
  const requestedView = searchParams.get("view");
  const { currentRotaConfigId } = useRotaContext();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const todayISO = getTodayISO();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [doctor, setDoctor] = useState<CalendarDoctor | null>(null);
  const [bankHolidaySet, setBankHolidaySet] = useState<Set<string>>(new Set());

  const [viewMode, setViewMode] = useState<"day" | "week" | "month">(
    () => {
      if (requestedView === "day" || requestedView === "week") return requestedView;
      return "month";
    }
  );
  const [currentDateISO, setCurrentDateISO] = useState("");
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState("");
  const [overrides, setOverrides] = useState<CalendarOverride[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
  const lastTapRef = useRef<{ date: string; time: number } | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    if (isMobile === true) setViewMode("day");
  }, [isMobile]);

  // ─── Data load ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      if (!currentRotaConfigId || !doctorId) {
        setErrorMsg("Missing configuration. Go back to the calendar.");
        setLoading(false);
        return;
      }
      try {
        const { data: pr } = await supabase
          .from("pre_rota_results")
          .select("calendar_data, status")
          .eq("rota_config_id", currentRotaConfigId)
          .maybeSingle();

        if (!pr) {
          setErrorMsg("No pre-rota generated yet. Go back and generate it first.");
          setLoading(false);
          return;
        }
        if (pr.status === "blocked") {
          setErrorMsg("Pre-rota is blocked. Resolve issues on the dashboard first.");
          setLoading(false);
          return;
        }

        const cd = pr.calendar_data as unknown as CalendarData;
        const found = cd.doctors.find((d) => d.doctorId === doctorId) ?? null;
        if (!found) {
          setErrorMsg("Doctor not found in this rota.");
          setLoading(false);
          return;
        }

        setCalendarData(cd);
        setDoctor(found);
        setBankHolidaySet(new Set(cd.bankHolidays));

        // Honour ?date= query param if present and within rota bounds;
        // otherwise fall back to today → rota start.
        const fallbackDate =
          todayISO >= cd.rotaStartDate && todayISO <= cd.rotaEndDate
            ? todayISO
            : cd.rotaStartDate;
        const initialDate =
          requestedDate &&
          requestedDate >= cd.rotaStartDate &&
          requestedDate <= cd.rotaEndDate
            ? requestedDate
            : fallbackDate;
        setCurrentDateISO(initialDate);
        setCurrentMonthKey(initialDate.slice(0, 7));
        const wIdx = cd.weeks.findIndex((w) => w.startDate <= initialDate && initialDate <= w.endDate);
        setCurrentWeekIndex(wIdx >= 0 ? wIdx : 0);

        // Load coordinator overrides
        const { data: overrideRows } = await supabase
          .from("coordinator_calendar_overrides")
          .select("*")
          .eq("rota_config_id", currentRotaConfigId)
          .eq("doctor_id", doctorId);
        setOverrides((overrideRows ?? []).map(mapOverrideRow));
      } catch (err) {
        console.error("DoctorCalendarPage load error:", err);
        setErrorMsg("Failed to load data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentRotaConfigId, doctorId]);

  // ─── Navigation ─────────────────────────────────────────────
  function navigateToDate(iso: string) {
    if (!calendarData) return;
    const clamped =
      iso < calendarData.rotaStartDate
        ? calendarData.rotaStartDate
        : iso > calendarData.rotaEndDate
          ? calendarData.rotaEndDate
          : iso;
    setCurrentDateISO(clamped);
    setCurrentMonthKey(clamped.slice(0, 7));
    const wIdx = calendarData.weeks.findIndex((w) => w.startDate <= clamped && clamped <= w.endDate);
    setCurrentWeekIndex(wIdx >= 0 ? wIdx : 0);
  }

  function goPrev() {
    if (!calendarData) return;
    if (viewMode === "day") {
      navigateToDate(addDaysISO(currentDateISO, -1));
    } else if (viewMode === "week") {
      const newIdx = Math.max(0, currentWeekIndex - 1);
      const newDate = calendarData.weeks[newIdx].dates[0];
      setCurrentWeekIndex(newIdx);
      setCurrentDateISO(newDate);
      setCurrentMonthKey(newDate.slice(0, 7));
    } else {
      const [y, m] = currentMonthKey.split("-").map(Number);
      const prev = new Date(Date.UTC(y, m - 2, 1));
      const key = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
      if (key >= calendarData.rotaStartDate.slice(0, 7)) setCurrentMonthKey(key);
    }
  }

  function goNext() {
    if (!calendarData) return;
    if (viewMode === "day") {
      navigateToDate(addDaysISO(currentDateISO, 1));
    } else if (viewMode === "week") {
      const newIdx = Math.min(calendarData.weeks.length - 1, currentWeekIndex + 1);
      const newDate = calendarData.weeks[newIdx].dates[0];
      setCurrentWeekIndex(newIdx);
      setCurrentDateISO(newDate);
      setCurrentMonthKey(newDate.slice(0, 7));
    } else {
      const [y, m] = currentMonthKey.split("-").map(Number);
      const next = new Date(Date.UTC(y, m, 1));
      const key = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
      if (key <= calendarData.rotaEndDate.slice(0, 7)) setCurrentMonthKey(key);
    }
  }

  // ─── Swipe + keyboard ──────────────────────────────────────
  const navRef = useRef({ goPrev, goNext });
  useEffect(() => {
    navRef.current = { goPrev, goNext };
  });

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
    if (!currentRotaConfigId || !doctorId) return;
    const { data } = await supabase
      .from("coordinator_calendar_overrides")
      .select("*")
      .eq("rota_config_id", currentRotaConfigId)
      .eq("doctor_id", doctorId);
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
    setModalSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !currentRotaConfigId || !doctorId) {
        setModalSaving(false);
        return;
      }

      if (payload.overrideId) {
        await supabase.from("coordinator_calendar_overrides").delete().eq("id", payload.overrideId);
        await supabase.from("coordinator_calendar_overrides").insert({
          rota_config_id: currentRotaConfigId,
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
          rota_config_id: currentRotaConfigId,
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
      setSelectedDate(null);
      refreshResolvedAvailabilityForDoctor(currentRotaConfigId, doctorId!).catch((err) =>
        console.error("refreshResolvedAvailability failed:", err),
      );
    } catch (err) {
      console.error("Failed to save override:", err);
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteOverride = async (override: CalendarOverride) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !currentRotaConfigId || !doctorId) return;
      await supabase.from("coordinator_calendar_overrides").delete().eq("id", override.id);
      await reloadOverrides();
      setPanelOpen(false);
      setSelectedDate(null);
      refreshResolvedAvailabilityForDoctor(currentRotaConfigId!, doctorId!).catch((err) =>
        console.error("refreshResolvedAvailability failed:", err),
      );
    } catch (err) {
      console.error("Failed to delete override:", err);
    }
  };

  const handleRemoveSurveyEvent = async (date: string) => {
    if (!calendarData) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !currentRotaConfigId || !doctorId) return;
      const cellCode = mergedAvailability[date]?.primary ?? "AVAILABLE";
      if (cellCode === "AVAILABLE") return;
      await supabase.from("coordinator_calendar_overrides").insert({
        rota_config_id: currentRotaConfigId,
        doctor_id: doctorId,
        event_type: cellCode,
        start_date: date,
        end_date: date,
        action: "delete",
        original_event_type: cellCode,
        original_start_date: date,
        original_end_date: date,
        note: null,
        created_by: user.id,
      });
      await reloadOverrides();
      setPanelOpen(false);
      setSelectedDate(null);
      refreshResolvedAvailabilityForDoctor(currentRotaConfigId!, doctorId!).catch((err) =>
        console.error("refreshResolvedAvailability failed:", err),
      );
    } catch (err) {
      console.error("Failed to remove survey event:", err);
    }
  };

  // Cell clicking now handles single open vs double tap
  const handleCellClick = (date: string, e: React.MouseEvent) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.date === date && now - last.time < 350) {
      e.preventDefault();
      lastTapRef.current = null;
      navigateToDate(date);
      setViewMode("day");
      setPanelOpen(false);
      setSelectedDate(null);
      return true; // Was double tap
    }
    lastTapRef.current = { date, time: now };
    return false; // Was single tap
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navRef.current.goPrev();
      if (e.key === "ArrowRight") navRef.current.goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const mergedAvailability = useMemo<Record<string, MergedCell>>(() => {
    if (!doctor || !calendarData) return {};
    return mergeOverridesIntoAvailability(
      doctor.availability,
      overrides,
      calendarData.rotaStartDate,
      calendarData.rotaEndDate,
    );
  }, [doctor, overrides, calendarData]);

  // ─── Actions Handlers ───────────────────────────────────────
  const handleActionEdit = (date: string, mergedCell: MergedCell | undefined) => {
    if (!mergedCell) return;
    const dayOverride = overrides.find((o) => o.id === mergedCell.overrideId);
    if (dayOverride) {
      setModalPrefill({
        eventType: dayOverride.eventType,
        startDate: dayOverride.startDate,
        endDate: dayOverride.endDate,
        note: dayOverride.note ?? "",
        overrideId: dayOverride.id,
        originalEventType: dayOverride.originalEventType,
      });
    } else {
      setModalPrefill({
        eventType: mergedCell.primary ?? "AVAILABLE",
        startDate: date,
        endDate: date,
        note: "",
        overrideId: "",
        originalEventType: mergedCell.primary ?? "AVAILABLE",
      });
    }
    setModalInitialDate(null);
    setModalCopyFrom(null);
    setModalOpen(true);
    setPanelOpen(false);
  };

  const handleActionCopy = (date: string, mergedCell: MergedCell | undefined) => {
    if (!mergedCell) return;
    const dayOverride = overrides.find((o) => o.id === mergedCell.overrideId);
    if (dayOverride) {
      setModalCopyFrom({
        eventType: dayOverride.eventType,
        startDate: dayOverride.startDate,
        endDate: dayOverride.endDate,
      });
    } else {
      setModalCopyFrom({
        eventType: mergedCell.primary ?? "AVAILABLE",
        startDate: date,
        endDate: date,
      });
    }
    setModalPrefill(null);
    setModalInitialDate(null);
    setModalOpen(true);
    setPanelOpen(false);
  };

  const handleActionDelete = (date: string, mergedCell: MergedCell | undefined) => {
    if (!mergedCell) return;
    const dayOverride = overrides.find((o) => o.id === mergedCell.overrideId);
    if (dayOverride) {
      handleDeleteOverride(dayOverride);
    } else {
      handleRemoveSurveyEvent(date);
    }
    setPanelOpen(false);
  };

  const handleActionAdd = (date: string) => {
    setModalPrefill(null);
    setModalCopyFrom(null);
    setModalInitialDate(date);
    setModalOpen(true);
    setPanelOpen(false);
  };

  const ActionButtonsPopover = ({ date, mergedCell }: { date: string; mergedCell?: MergedCell }) => {
    const eventsExist =
      mergedCell && mergedCell.primary !== "AVAILABLE" && mergedCell.primary !== "BH" && !mergedCell.isDeleted;

    return (
      <PopoverContent className="w-48 p-1 z-50 shadow-xl border-border/50" side="bottom" align="center">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-8 text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation();
              handleActionAdd(date);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Add Event
          </Button>
          {eventsExist && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start h-8 text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionEdit(date, mergedCell);
                }}
              >
                <Edit2 className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Edit Event
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start h-8 text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionCopy(date, mergedCell);
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Copy Event
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start h-8 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionDelete(date, mergedCell);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2 text-red-500" /> Delete Event
              </Button>
            </>
          )}
          <div className="h-px bg-border my-1" />
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-8 text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation();
              navigateToDate(date);
              setViewMode("day");
              setPanelOpen(false);
              setSelectedDate(null);
            }}
          >
            <CalendarIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Go to Day View
          </Button>
        </div>
      </PopoverContent>
    );
  };

  function DayActionButtons({ date, mergedCell }: { date: string; mergedCell?: MergedCell }) {
    const eventsExist =
      mergedCell && mergedCell.primary !== "AVAILABLE" && mergedCell.primary !== "BH" && !mergedCell.isDeleted;

    return (
      <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 w-full sm:w-auto mt-2 sm:mt-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-700 flex-1 sm:flex-none"
          onClick={() => handleActionAdd(date)}
        >
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
        {eventsExist && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 flex-1 sm:flex-none"
              onClick={() => handleActionEdit(date, mergedCell)}
            >
              <Edit2 className="w-3 h-3 mr-1" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 flex-1 sm:flex-none"
              onClick={() => handleActionCopy(date, mergedCell)}
            >
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 flex-1 sm:flex-none"
              onClick={() => handleActionDelete(date, mergedCell)}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </>
        )}
      </div>
    );
  }

  // ─── Loading / error ───────────────────────────────────────
  if (loading)
    return (
      <AdminLayout title="Doctor Calendar" accentColor="teal" pageIcon={CalendarDays}>
        <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Loading calendar…</span>
        </div>
      </AdminLayout>
    );

  if (errorMsg || !calendarData || !doctor)
    return (
      <AdminLayout title="Doctor Calendar" accentColor="teal" pageIcon={CalendarDays}>
        <div className="mx-auto max-w-lg mt-12">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-foreground">{errorMsg ?? "Could not load calendar."}</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/pre-rota-calendar")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to calendar
            </Button>
          </div>
        </div>
      </AdminLayout>
    );

  // ─── Nav label ─────────────────────────────────────────────
  const currentWeek = calendarData.weeks[currentWeekIndex];
  const currentLabel =
    viewMode === "day"
      ? fmtFull(currentDateISO)
      : viewMode === "week" && currentWeek
        ? `Wk ${currentWeek.weekNumber} · ${fmtShort(currentWeek.dates[0])}–${fmtShort(currentWeek.dates[currentWeek.dates.length - 1])}`
        : `${MONTH_NAMES[Number(currentMonthKey.split("-")[1]) - 1]} ${currentMonthKey.split("-")[0]}`;

  const prevDisabled =
    viewMode === "month"
      ? currentMonthKey <= calendarData.rotaStartDate.slice(0, 7)
      : viewMode === "week"
        ? currentWeekIndex === 0
        : currentDateISO <= calendarData.rotaStartDate;

  const nextDisabled =
    viewMode === "month"
      ? currentMonthKey >= calendarData.rotaEndDate.slice(0, 7)
      : viewMode === "week"
        ? currentWeekIndex >= calendarData.weeks.length - 1
        : currentDateISO >= calendarData.rotaEndDate;

  // ─── Sub-components ────────────────────────────────────────
  function MonthView() {
    const rows = getMonthWeekRows(currentMonthKey);
    return (
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full flex flex-col">
        <table className="w-full h-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="bg-muted/30 py-1 px-0.5 sm:px-1 font-medium text-muted-foreground border-r border-border w-[10%] sm:w-[8%] truncate text-center align-middle text-[9px] sm:text-xs">
                Wk
              </th>
              {DAY_ABBR.map((d) => (
                <th
                  key={d}
                  className="bg-muted/30 py-1 px-0.5 sm:px-1 font-medium text-muted-foreground border-l border-border/50 text-center uppercase tracking-tighter text-[9px] sm:text-xs"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="h-full">
            {rows.map((week, ri) => (
              <tr key={ri} className="border-b border-border/50 bg-card">
                <td className="p-0.5 border-r border-border text-center align-middle text-muted-foreground/70 font-medium text-[9px] sm:text-xs">
                  {getISOWeekNumber(week[0])}
                </td>
                {week.map((date) => {
                  const inRota = date >= calendarData!.rotaStartDate && date <= calendarData!.rotaEndDate;
                  const inMonth = date.startsWith(currentMonthKey);
                  const isToday = date === todayISO;
                  const isBH = inRota && bankHolidaySet.has(date);
                  const dow = isoToUTCDate(date).getUTCDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const mergedCell = inRota ? mergedAvailability[date] : undefined;
                  const primary = mergedCell?.isDeleted ? "AVAILABLE" : (mergedCell?.primary ?? "AVAILABLE");

                  const rawLtftDays = Array.isArray(doctor?.ltftDaysOff) ? doctor.ltftDaysOff : [];
                  const isLtftDay =
                    rawLtftDays.includes(DAY_ABBR[(dow + 6) % 7].toLowerCase()) ||
                    rawLtftDays.includes(new Date(date).toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase());
                  const cellBg = inRota ? getMergedCellBackground(mergedCell, isLtftDay) : "bg-card";
                  const isSelected = selectedDate === date;
                  const hasOverride = !!mergedCell?.overrideId;
                  const eventChar = primary === "NOC" ? "N" : primary === "ROT" ? "R" : primary.charAt(0);

                  const hdrColor =
                    !inRota || !inMonth
                      ? "text-muted-foreground/40"
                      : isToday
                        ? "text-teal-700 font-bold"
                        : isBH
                          ? "text-red-800 font-bold"
                          : isWeekend
                            ? "text-muted-foreground"
                            : "text-foreground";

                  return (
                    <td
                      key={date}
                      className={`border-l border-border/50 p-0 align-top ${cellBg} ${
                        !inRota || !inMonth ? "opacity-30" : ""
                      } ${isSelected ? "ring-2 ring-inset ring-teal-500 z-10 relative" : ""}`}
                    >
                      {!inRota || !inMonth ? (
                        <div className="w-full h-full p-0.5 sm:p-1 flex flex-col justify-between overflow-hidden">
                          <div className={`text-[8px] sm:text-xs text-right shrink-0 ${hdrColor}`}>
                            {isoToUTCDate(date).getUTCDate()}
                          </div>
                        </div>
                      ) : (
                        <Popover
                          open={selectedDate === date && panelOpen}
                          onOpenChange={(o) => {
                            if (!o) {
                              setPanelOpen(false);
                              setSelectedDate(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <div
                              className="w-full h-full p-0.5 sm:p-1 flex flex-col justify-between cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                              onClick={(e) => {
                                if (handleCellClick(date, e)) return;
                                if (!panelOpen || selectedDate !== date) {
                                  setSelectedDate(date);
                                  setPanelOpen(true);
                                }
                              }}
                            >
                              <div className={`text-[8px] sm:text-xs text-right shrink-0 ${hdrColor}`}>
                                {isoToUTCDate(date).getUTCDate()}
                              </div>
                              <div className="flex flex-col items-center justify-center flex-1 w-full relative min-h-0 overflow-hidden">
                                {mergedCell?.isDeleted && mergedCell.deletedCode ? (
                                  <span className="text-[7px] sm:text-[10px] font-bold text-muted-foreground line-through block truncate">
                                    {mergedCell.deletedCode.charAt(0)}
                                  </span>
                                ) : primary !== "AVAILABLE" && primary !== "BH" ? (
                                  <div className="flex justify-center items-center relative">
                                    <span
                                      className="flex items-center justify-center rounded shadow-sm w-4 h-4 sm:w-5 sm:h-5 text-[8px] sm:text-[10px]"
                                      style={{
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
                                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500 border border-white" />
                                    )}
                                  </div>
                                ) : isLtftDay ? (
                                  <span className="text-[9px] sm:text-xs font-bold text-yellow-800">L</span>
                                ) : null}
                              </div>
                            </div>
                          </PopoverTrigger>
                          <ActionButtonsPopover date={date} mergedCell={mergedCell} />
                        </Popover>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function WeekView() {
    const week = calendarData!.weeks[currentWeekIndex];
    if (!week) return null;
    return (
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full flex flex-col">
        <table className="w-full h-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              {week.dates.map((date) => {
                const dd = isoToUTCDate(date);
                const isWknd = dd.getUTCDay() === 0 || dd.getUTCDay() === 6;
                const isBH = bankHolidaySet.has(date);
                const isToday = date === todayISO;

                const hdrBg = isToday ? "bg-teal-100" : isBH ? "bg-red-100" : isWknd ? "bg-muted" : "bg-card";
                const hdrColor = isToday
                  ? "text-teal-800"
                  : isBH
                    ? "text-red-800"
                    : isWknd
                      ? "text-muted-foreground"
                      : "text-foreground";

                return (
                  <th
                    key={date}
                    className={`py-1.5 sm:py-2 px-0.5 sm:px-2 text-center font-medium border-l border-border first:border-l-0 ${hdrBg} ${hdrColor}`}
                  >
                    <div className="text-[9px] sm:text-xs uppercase tracking-tighter sm:tracking-wider truncate">
                      {dd.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                    </div>
                    <div className={`text-[10px] sm:text-sm truncate mt-0.5 ${isToday ? "font-bold" : "font-normal"}`}>
                      {dd.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
                    </div>
                    {isBH && (
                      <span className="inline-block bg-red-700 text-white text-[7px] sm:text-[9px] font-bold px-1 rounded mt-0.5 sm:mt-1 tracking-tighter">
                        BH
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="h-full">
            <tr className="bg-card h-full">
              {week.dates.map((date) => {
                const mergedCell = mergedAvailability[date];
                const primary = mergedCell?.primary ?? "AVAILABLE";
                const dow = isoToUTCDate(date).getUTCDay();
                const rawLtftDays = Array.isArray(doctor?.ltftDaysOff) ? doctor.ltftDaysOff : [];
                const isLtftDay =
                  rawLtftDays.includes(DAY_ABBR[(dow + 6) % 7].toLowerCase()) ||
                  rawLtftDays.includes(new Date(date).toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase());
                const cellBg = getMergedCellBackground(mergedCell, isLtftDay);
                const isSelected = selectedDate === date;

                const isNoc = primary === "NOC";
                const hasOverrideDot = mergedCell?.overrideAction === "add" || mergedCell?.overrideAction === "modify";

                return (
                  <td
                    key={date}
                    className={`border-l border-border/50 first:border-l-0 p-0 align-top h-full ${cellBg} ${
                      isSelected ? "ring-2 ring-inset ring-teal-500 z-10 relative" : ""
                    }`}
                  >
                    <Popover
                      open={selectedDate === date && panelOpen}
                      onOpenChange={(o) => {
                        if (!o) {
                          setPanelOpen(false);
                          setSelectedDate(null);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <div
                          className="w-full h-full p-1 sm:p-2 flex flex-col gap-1 sm:gap-1.5 items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                          onClick={(e) => {
                            if (handleCellClick(date, e)) return;
                            if (!panelOpen || selectedDate !== date) {
                              setSelectedDate(date);
                              setPanelOpen(true);
                            }
                          }}
                        >
                          {mergedCell?.isDeleted && mergedCell.deletedCode ? (
                            <span className="bg-muted text-muted-foreground text-[8px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded line-through">
                              {mergedCell.deletedCode}
                            </span>
                          ) : (
                            <>
                              {(["AL", "SL", "ROT", "PL"] as const)
                                .filter((e) => primary === e)
                                .map((event) => (
                                  <span key={event} className="inline-flex items-center">
                                    <LeaveBadge type={event} size="large" />
                                    {hasOverrideDot && <RotaOverrideDot />}
                                  </span>
                                ))}
                              {isNoc && (
                                <span className="inline-flex items-center">
                                  <LeaveBadge type="NOC" size="large" />
                                  {hasOverrideDot && <RotaOverrideDot />}
                                </span>
                              )}
                              {isLtftDay && <LeaveBadge type="LTFT" size="large" />}
                            </>
                          )}
                        </div>
                      </PopoverTrigger>
                      <ActionButtonsPopover date={date} mergedCell={mergedCell} />
                    </Popover>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function DayView() {
    const inRota = currentDateISO >= calendarData!.rotaStartDate && currentDateISO <= calendarData!.rotaEndDate;
    const mergedCell = mergedAvailability[currentDateISO];
    const showDeleted = mergedCell?.isDeleted && !!mergedCell?.deletedCode;

    // Deduplicate LTFT by merging it directly into the general codes structure for DayView
    const baseCodes =
      !mergedCell?.isDeleted && mergedCell
        ? ([mergedCell.primary, mergedCell.secondary] as (string | null)[]).filter(
            (c): c is string => !!c && !SKIP_CODES.has(c),
          )
        : [];

    const dow = isoToUTCDate(currentDateISO).getUTCDay();
    const rawLtftDays = Array.isArray(doctor?.ltftDaysOff) ? doctor.ltftDaysOff : [];
    const isLtftDay =
      rawLtftDays.includes(DAY_ABBR[(dow + 6) % 7].toLowerCase()) ||
      rawLtftDays.includes(new Date(currentDateISO).toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase());

    const codesSet = new Set(baseCodes);
    if (isLtftDay && !showDeleted) {
      codesSet.add("LTFT");
    }
    const finalCodes = Array.from(codesSet);

    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-5 h-full overflow-y-auto flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-border/50 shrink-0">
          <p className="text-[15px] sm:text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarRange className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" />
            {fmtFull(currentDateISO)}
          </p>
          {inRota && <DayActionButtons date={currentDateISO} mergedCell={mergedCell} />}
        </div>
        <div className="flex-1 min-h-0">
          {!inRota ? (
            <p className="text-xs sm:text-sm text-muted-foreground italic text-center py-4">
              This date is outside the rota period.
            </p>
          ) : showDeleted ? (
            <div
              className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 flex items-center gap-3"
              style={{ borderLeft: `4px solid #d1d5db` }}
            >
              <span
                className="inline-block rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold"
                style={{ backgroundColor: "#d1d5db", color: "#6b7280", textDecoration: "line-through" }}
              >
                {EVENT_LABELS[mergedCell!.deletedCode!] ?? mergedCell!.deletedCode}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground font-medium">Removed by coordinator</span>
            </div>
          ) : finalCodes.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted-foreground italic text-center py-4">
              No events scheduled. Fully available.
            </p>
          ) : (
            <div className="space-y-3">
              {finalCodes.map((code) => {
                const isExplicitOverride =
                  (code === mergedCell?.primary || code === mergedCell?.secondary) &&
                  (mergedCell?.overrideAction === "add" || mergedCell?.overrideAction === "modify");

                return (
                  <div
                    key={code}
                    className={`rounded-lg border border-border bg-card p-3 sm:p-4 flex items-center justify-between transition-colors`}
                    style={{ borderLeftWidth: "4px", borderLeftColor: MONTH_EVENT_COLOURS[code] ?? "#6b7280" }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <LeaveBadge type={code} size="large" />
                      <span className="text-xs sm:text-sm font-semibold">{EVENT_LABELS[code] ?? code}</span>
                    </div>
                    {isExplicitOverride && (
                      <span className="text-[9px] sm:text-xs text-orange-600 font-bold bg-orange-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-orange-200 flex items-center gap-1 sm:gap-1.5">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500"></span>
                        Override
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────
  return (
    <AdminLayout title="Doctor Calendar" subtitle={doctor?.doctorName} accentColor="teal" pageIcon={CalendarDays}>
      <div
        className="flex flex-col gap-2 sm:gap-3 h-[calc(100dvh-8rem)] sm:h-[calc(100dvh-9rem)] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header / Nav Container */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => navigate("/admin/pre-rota-calendar")}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Back to Pre-rota
          </button>
        </div>

        {/* Doctor Info Block */}
        <div className="flex items-center justify-between p-2 sm:p-3 rounded-xl border border-border bg-card shadow-sm shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{doctor.doctorName}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
              {doctor.grade} · {doctor.wte}% WTE
            </p>
          </div>
          {doctor.ltftDaysOff && Array.isArray(doctor.ltftDaysOff) && doctor.ltftDaysOff.length > 0 && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">LTFT Days:</span>
              <div className="flex gap-1">
                {doctor.ltftDaysOff.map((d: string) => (
                  <span
                    key={d}
                    className="uppercase text-[8px] sm:text-[9px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 px-1 sm:px-1.5 py-0.5 rounded"
                  >
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Unified Nav Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-card rounded-xl border border-border shadow-sm shrink-0">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />

          <div className="flex items-center justify-between sm:justify-center gap-1 sm:gap-2 flex-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={prevDisabled}
              className="p-1 sm:p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[11px] sm:text-sm font-semibold text-foreground min-w-[100px] sm:min-w-[140px] text-center truncate">
              {currentLabel}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={nextDisabled}
              className="p-1 sm:p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <input
            type="date"
            min={calendarData.rotaStartDate}
            max={calendarData.rotaEndDate}
            value={currentDateISO}
            onChange={(e) => {
              if (e.target.value) navigateToDate(e.target.value);
            }}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 border border-border rounded-md bg-card text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 h-8 sm:h-[34px] sm:ml-auto w-full sm:w-auto"
          />
        </div>

        {/* View content */}
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {viewMode === "month" && <MonthView />}
          {viewMode === "week" && <WeekView />}
          {viewMode === "day" && <DayView />}
        </div>

        {modalOpen && calendarData && doctor && (
          <AddEventModal
            prefill={modalPrefill ?? undefined}
            copyFrom={modalCopyFrom ?? undefined}
            initialDate={modalInitialDate ?? undefined}
            doctorName={doctor.doctorName}
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
        )}
      </div>
    </AdminLayout>
  );
}
