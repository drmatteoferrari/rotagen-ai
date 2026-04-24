import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import type { CalendarData, CalendarDoctor, TargetsData, CellCode } from "@/lib/preRotaTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRotaContext } from "@/contexts/RotaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GradeBadge } from "@/components/GradeBadge";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertTriangle,
  ChevronDown,
  CalendarRange,
  ChevronUp,
  Search,
  ArrowUpDown,
  Plus,
  Edit2,
  Copy,
  Trash2,
  User,
  CalendarDays as CalendarIcon,
} from "lucide-react";
import {
  getTodayISO,
  mapOverrideRow,
  mergeOverridesIntoAvailability,
  type CalendarOverride,
  type MergedCell,
} from "@/lib/calendarOverrides";
import { AddEventModal } from "@/components/calendar/AddEventModal";
import { refreshResolvedAvailabilityForDoctor, refreshPreRotaTargets } from "@/lib/resolvedAvailability";
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

// Legend accepts viewMode to show letter/short badge variants for week and month views
function CalendarLegend({ viewMode }: { viewMode: "day" | "week" | "month" }) {
  // Show the compact letter dot in both week view (short square badges) and month view (coloured dots)
  const showLetterVariant = viewMode === "month" || viewMode === "week";

  // Helper: renders the full badge plus optional compact letter variant used in week/month views
  const LegendBadge = ({ type, label }: { type: keyof typeof BADGE_STYLES; label: string }) => {
    const letterMap: Record<string, string> = { AL: "A", SL: "S", ROT: "R", PL: "P", NOC: "N", LTFT: "L" };
    const colour = MONTH_EVENT_COLOURS[type] ?? "#6b7280";
    return (
      <div className="flex items-center gap-1.5">
        <LeaveBadge type={type} />
        {showLetterVariant && (
          <span
            className="inline-flex items-center justify-center rounded font-bold text-white text-[9px] shrink-0"
            style={{ width: 14, height: 14, background: colour, lineHeight: 1 }}
          >
            {letterMap[type]}
          </span>
        )}
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-muted-foreground bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
      <LegendBadge type="AL" label="Annual Leave" />
      <LegendBadge type="SL" label="Study Leave" />
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-5 flex items-center justify-center rounded bg-orange-50 border border-orange-200">
          <LeaveBadge type="ROT" className="text-[9px] px-1 py-0" />
        </div>
        {showLetterVariant && (
          <span
            className="inline-flex items-center justify-center rounded font-bold text-white text-[9px] shrink-0"
            style={{ width: 14, height: 14, background: MONTH_EVENT_COLOURS["ROT"], lineHeight: 1 }}
          >
            R
          </span>
        )}
        <span>Rotation</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-5 flex items-center justify-center rounded bg-violet-50 border border-violet-200">
          <LeaveBadge type="PL" className="text-[9px] px-1 py-0" />
        </div>
        {showLetterVariant && (
          <span
            className="inline-flex items-center justify-center rounded font-bold text-white text-[9px] shrink-0"
            style={{ width: 14, height: 14, background: MONTH_EVENT_COLOURS["PL"], lineHeight: 1 }}
          >
            P
          </span>
        )}
        <span>Parental Leave</span>
      </div>
      <LegendBadge type="NOC" label="Not On-Call" />
      <div className="w-px h-4 bg-border mx-0.5" />
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-5 flex items-center justify-center rounded bg-yellow-50 border border-yellow-200">
          <LeaveBadge type="LTFT" className="text-[9px] px-1 py-0 border-none" />
        </div>
        {showLetterVariant && (
          <span
            className="inline-flex items-center justify-center rounded font-bold text-yellow-800 text-[9px] shrink-0 bg-yellow-50 border border-yellow-300"
            style={{ width: 14, height: 14, lineHeight: 1 }}
          >
            L
          </span>
        )}
        <span>LTFT day off</span>
      </div>
      <div className="flex items-center gap-1.5">
        <RotaOverrideDot />
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
      // Use short square format so deleted cells stay same height as normal cells
      <span className="inline-flex items-center justify-center w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] bg-muted text-muted-foreground text-[8px] sm:text-[9px] font-bold rounded line-through">
        {mergedCell.deletedCode.charAt(0)}
      </span>
    );
  }

  return (
    // Use short=true for ALL week-cell badges so they render as compact 14×16px squares,
    // ensuring consistent row height regardless of how many badges appear (max realistic: 3).
    <>
      {(["AL", "SL", "ROT", "PL"] as const)
        .filter((e) => primary === e)
        .map((event) => (
          <span key={event} className="inline-flex items-center shrink-0">
            <LeaveBadge type={event} size="small" short={true} />
            {hasOverrideDot && <RotaOverrideDot />}
          </span>
        ))}
      {isNoc && (
        <span className="inline-flex items-center shrink-0">
          <LeaveBadge type="NOC" size="small" short={true} />
          {hasOverrideDot && <RotaOverrideDot />}
        </span>
      )}
      {isLtftDay && <LeaveBadge type="LTFT" size="small" short={true} />}
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

// CHANGE 10: disable month button on mobile so it can never be selected
function ViewToggle({
  viewMode,
  setViewMode,
  isMobile,
}: {
  viewMode: "day" | "week" | "month";
  setViewMode: (v: "day" | "week" | "month") => void;
  isMobile: boolean;
}) {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-border shadow-sm shrink-0">
      {(["day", "week", "month"] as const).map((v, i) => {
        const disabled = v === "month" && isMobile;
        return (
          <button
            key={v}
            onClick={() => !disabled && setViewMode(v)}
            disabled={disabled}
            className={`px-3 py-1.5 text-xs capitalize transition-colors ${i < 2 ? "border-r border-border" : ""} ${
              disabled
                ? "bg-card text-muted-foreground/40 cursor-not-allowed font-medium"
                : viewMode === v
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-card text-muted-foreground hover:bg-muted/50 font-medium"
            }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

// ── ActionButtonsPopover — extracted to file top level ────────
// FIX: was previously defined inside PreRotaCalendarPage's render body,
// causing React to treat it as a new component type on every state change,
// which forced a full DOM remount and reset scroll position to top.

interface ActionButtonsPopoverProps {
  doctorId: string;
  date: string;
  mergedCell: MergedCell | undefined;
  doctorName: string;
  onAdd: (doctorId: string, date: string) => void;
  onTriggerAction: (
    action: 'edit' | 'copy' | 'delete',
    doctorId: string,
    date: string
  ) => void;
  onGoToDate: (doctorId: string, date: string) => void;
  onNavigateProfile: (doctorId: string) => void;
}

function ActionButtonsPopover({
  doctorId,
  date,
  mergedCell,
  doctorName,
  onAdd,
  onTriggerAction,
  onGoToDate,
  onNavigateProfile,
}: ActionButtonsPopoverProps) {
  const eventsExist =
    mergedCell && !mergedCell.isDeleted && mergedCell.primary !== "AVAILABLE" && mergedCell.primary !== "BH";

  return (
    <PopoverContent
      className="w-52 p-1 z-50 shadow-xl border-border/50"
      side="bottom"
      align="center"
      sideOffset={4}
      collisionPadding={12}
      avoidCollisions={true}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border/50 mb-1">
        <p className="text-[11px] font-semibold text-foreground truncate">{doctorName}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-8 text-xs font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(doctorId, date);
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
                onTriggerAction('edit', doctorId, date);
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
                onTriggerAction('copy', doctorId, date);
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
                onTriggerAction('delete', doctorId, date);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2 text-red-500" /> Remove Event
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
            onGoToDate(doctorId, date);
          }}
        >
          <CalendarIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> View Doctor Calendar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-8 text-xs font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateProfile(doctorId);
          }}
        >
          <User className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> View Doctor Profile
        </Button>
      </div>
    </PopoverContent>
  );
}

// ── PickerModal — multi-select checkbox picker for cells with multiple events ──
// Used when a day has multiple coordinator overrides and/or LTFT day-off,
// so the coordinator can choose exactly which event(s) the action applies to.

interface PickerItem {
  kind: 'override' | 'ltft';
  id: string;
  label: string;
  subLabel: string;
}

function PickerModal({
  doctorName,
  items,
  actionVerb,
  singleSelect,
  onCancel,
  onConfirm,
}: {
  doctorName: string;
  items: PickerItem[];
  actionVerb: string;
  singleSelect: boolean;
  onCancel: () => void;
  onConfirm: (selectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (singleSelect) {
        next.clear();
        if (!prev.has(id)) next.add(id);
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const canConfirm = selected.size > 0 && (!singleSelect || selected.size === 1);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: '#fff', borderRadius: '14px',
          padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          {doctorName}
        </p>
        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
          {singleSelect
            ? `Select an event to ${actionVerb}:`
            : `Select event(s) to ${actionVerb}:`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item) => {
            const isChecked = selected.has(item.id);
            const isLtft = item.kind === 'ltft';
            return (
              <div
                key={item.id}
                onClick={() => toggle(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  background: isChecked ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 600, color: '#1e293b',
                    margin: 0,
                  }}>
                    {item.label}
                    {isLtft && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, fontWeight: 500,
                        color: '#a16207',
                        background: '#fef3c7',
                        padding: '1px 6px', borderRadius: 4,
                      }}>
                        recurring
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0' }}>
                    {item.subLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '8px',
              fontSize: 12, fontWeight: 500,
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 8, cursor: 'pointer', color: '#64748b',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(Array.from(selected))}
            disabled={!canConfirm}
            style={{
              flex: 1, padding: '8px',
              fontSize: 12, fontWeight: 600,
              background: canConfirm ? '#2563eb' : '#cbd5e1',
              border: 'none',
              borderRadius: 8,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              color: '#fff',
            }}
          >
            Confirm{selected.size > 1 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>
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
  const [pickerAction, setPickerAction] = useState<
    'edit' | 'copy' | 'delete' | null
  >(null);
  const [pickerCell, setPickerCell] = useState<{
    doctorId: string;
    date: string;
  } | null>(null);
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

  useEffect(() => {
    const effectiveMode = isMobile && viewMode === "month" ? "day" : viewMode;
    if (effectiveMode !== "day") {
      setSortConfig((prev) => prev.key === "grade" ? { key: "name", direction: prev.direction } : prev);
      setGroupAvailability(false);
    }
  }, [viewMode, isMobile]);

  const lastTapRef = useRef<{ doctorId: string; date: string; time: number } | null>(null);
  // singleTapTimerRef removed — no debounce needed with popover pattern
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const navRef = useRef<{ goPrev: () => void; goNext: () => void }>({
    goPrev: () => {},
    goNext: () => {},
  });
  const embeddedInitialisedRef = useRef(false);
  // standalone cache-first ref
  const standaloneInitialisedRef = useRef(false);

  // CHANGE 1: Remove the useEffect that redirected month→day on mobile.
  // Instead, ViewToggle disables the month button on mobile (change 10),
  // and effectiveViewMode below prevents month rendering even if state is stale.

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

      // CHANGE 7: cache-first branch for standalone route
      if (
        !embedded &&
        !standaloneInitialisedRef.current &&
        cachedPreRota &&
        cachedPreRota.status !== "blocked" &&
        cachedShiftTypes !== undefined &&
        cachedBankHolidays !== undefined &&
        cachedSurveys !== undefined
      ) {
        standaloneInitialisedRef.current = true;
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

      // Guard: don't re-run the DB fetch if standalone cache branch already ran
      if (!embedded && standaloneInitialisedRef.current) return;

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
      refreshPreRotaTargets(rotaConfigId).catch((err) =>
        console.error("refreshPreRotaTargets failed:", err),
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
      refreshPreRotaTargets(rotaConfigId).catch((err) =>
        console.error("refreshPreRotaTargets failed:", err),
      );
    } catch (err) {
      console.error("Failed to delete override:", err);
    }
  };

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

  // CHANGE 5: Four action handlers for popover buttons
  const handleActionAdd = useCallback((doctorId: string, date: string) => {
    setSelectedCell({ doctorId, date });
    setModalPrefill(null);
    setModalCopyFrom(null);
    setModalInitialDate(date);
    setModalOpen(true);
    setPanelOpen(false);
  }, []);

  const handleActionEdit = useCallback(
    (doctorId: string, date: string, mergedCell: MergedCell) => {
      setSelectedCell({ doctorId, date });
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
      setModalCopyFrom(null);
      setModalInitialDate(null);
      setModalOpen(true);
      setPanelOpen(false);
    },
    [overrides],
  );

  const handleActionCopy = useCallback(
    (doctorId: string, date: string, mergedCell: MergedCell) => {
      setSelectedCell({ doctorId, date });
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
    },
    [overrides],
  );

  const handleActionDelete = useCallback(
    (doctorId: string, date: string, mergedCell: MergedCell) => {
      setSelectedCell({ doctorId, date });
      const dayOverride = overrides.find((o) => o.id === mergedCell.overrideId);
      if (dayOverride) {
        // Call delete directly — selectedCell is set above so handleDeleteOverride will read it
        if (!rotaConfigId) return;
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          supabase
            .from("coordinator_calendar_overrides")
            .delete()
            .eq("id", dayOverride.id)
            .then(() => {
              reloadOverrides();
              setPanelOpen(false);
              setSelectedCell(null);
              refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId).catch(console.error);
            });
        });
      } else {
        // Survey event removal — call inline with explicit params, no state dependency
        if (!rotaConfigId) return;
        const cellCode = mergedAvailabilityByDoctor[doctorId]?.[date]?.primary ?? "AVAILABLE";
        if (cellCode === "AVAILABLE") {
          setPanelOpen(false);
          return;
        }
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          supabase
            .from("coordinator_calendar_overrides")
            .insert({
              rota_config_id: rotaConfigId,
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
            })
            .then(() => {
              reloadOverrides();
              setPanelOpen(false);
              setSelectedCell(null);
              refreshResolvedAvailabilityForDoctor(rotaConfigId, doctorId).catch(console.error);
            });
        });
      }
      setPanelOpen(false);
    },
    [overrides, rotaConfigId, mergedAvailabilityByDoctor],
  );

  const handleTriggerAction = useCallback(
    (action: 'edit' | 'copy' | 'delete', doctorId: string, date: string) => {
      const activeOverrides = overrides.filter(
        (o) =>
          o.doctorId === doctorId &&
          (o.action === 'add' || o.action === 'modify') &&
          o.startDate <= date && date <= o.endDate
      );
      const doctor = calendarData?.doctors.find((d) => d.doctorId === doctorId);
      const isLtftDay = !!doctor && getLtftDaysOff(doctor).includes(getDayNameFromISO(date));
      // Total selectable items = overrides + (1 if LTFT applies on this day)
      const totalSelectable = activeOverrides.length + (isLtftDay ? 1 : 0);
      if (totalSelectable > 1) {
        setPanelOpen(false);
        setSelectedCell(null);
        setPickerAction(action);
        setPickerCell({ doctorId, date });
      } else {
        const mergedCell = mergedAvailabilityByDoctor[doctorId]?.[date];
        if (!mergedCell) return;
        setPanelOpen(false);
        setSelectedCell(null);
        if (action === 'edit') handleActionEdit(doctorId, date, mergedCell);
        if (action === 'copy') handleActionCopy(doctorId, date, mergedCell);
        if (action === 'delete') handleActionDelete(doctorId, date, mergedCell);
      }
    },
    [overrides, mergedAvailabilityByDoctor, calendarData, handleActionEdit, handleActionCopy, handleActionDelete],
  );

  // CHANGE 6: Immediate open on click; double-tap/double-click navigates to doctor calendar
  // No debounce timer. Uses timestamp comparison for touch double-tap.
  const handleCellTap = useCallback(
    (doctorId: string, date: string) => {
      const now = Date.now();
      const last = lastTapRef.current;

      // Double-tap on touch (within 400ms on same cell) → navigate
      if (last && last.doctorId === doctorId && last.date === date && now - last.time < 400) {
        lastTapRef.current = null;
        setPanelOpen(false);
        setSelectedCell(null);
        navigate(`/admin/doctor-calendar/${doctorId}?date=${date}&view=day`);
        return;
      }

      lastTapRef.current = { doctorId, date, time: now };

      // Toggle: if same cell already open, close it; otherwise open
      if (selectedCell?.doctorId === doctorId && selectedCell?.date === date && panelOpen) {
        setPanelOpen(false);
        setSelectedCell(null);
      } else {
        setSelectedCell({ doctorId, date });
        setPanelOpen(true);
        setModalOpen(false);
      }
    },
    [selectedCell, panelOpen, navigate],
  );

  // CHANGE 3/6: double-click handler for desktop — navigates directly
  const handleDoubleTap = useCallback(
    (doctorId: string, date: string) => {
      lastTapRef.current = null;
      setPanelOpen(false);
      setSelectedCell(null);
      navigate(`/admin/doctor-calendar/${doctorId}?date=${date}&view=day`);
    },
    [navigate],
  );

  const allDates = useMemo(() => calendarData?.weeks.flatMap((w) => w.dates) ?? [], [calendarData]);
  const maxMinDoctors = useMemo(() => Math.max(...shiftTypes.map((s) => s.min_doctors), 1), [shiftTypes]);

  const handleGoToDate = useCallback(
    (doctorId: string, date: string) => {
      setPanelOpen(false);
      setSelectedCell(null);
      navigate(`/admin/doctor-calendar/${doctorId}?date=${date}&view=day`);
    },
    [navigate],
  );

  const handlePopoverNavigateProfile = useCallback(
    (doctorId: string) => {
      setPanelOpen(false);
      setSelectedCell(null);
      navigate(`/admin/doctor/${doctorId}`);
    },
    [navigate],
  );

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

  const currentDateForSync = allDates[currentDayIndex] ?? allDates[0] ?? "";

  // FIX: Wrapper const removed — was defined inside render body, causing React to
  // treat it as a new component type on every state change, unmounting the entire
  // page tree and resetting scroll to top. Replaced with inline conditional JSX below.

  if (loading) {
    const loadingContent = (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading calendar…</span>
      </div>
    );
    return embedded ? (
      <>{loadingContent}</>
    ) : (
      <AdminLayout title="Availability Calendar" subtitle="" accentColor="blue" pageIcon={CalendarRange}>
        {loadingContent}
      </AdminLayout>
    );
  }

  if (loadError || errorMsg || !calendarData) {
    const errorContent = (
      <div className="mx-auto max-w-lg mt-12">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="text-sm text-foreground">{loadError ?? errorMsg ?? "No calendar data available."}</p>
          <Button variant="outline" onClick={() => navigate("/admin/pre-rota")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Pre-rota
          </Button>
        </div>
      </div>
    );
    return embedded ? (
      <>{errorContent}</>
    ) : (
      <AdminLayout title="Availability Calendar" subtitle="" accentColor="blue" pageIcon={CalendarRange}>
        {errorContent}
      </AdminLayout>
    );
  }

  const { weeks, doctors } = calendarData;
  const currentWeek = weeks[currentWeekIndex];
  const currentDate = allDates[currentDayIndex] ?? allDates[0];

  // CHANGE 1: effectiveViewMode prevents month view rendering on mobile
  // even if viewMode state is momentarily stale (eliminates flash)
  const effectiveViewMode: "day" | "week" | "month" = isMobile && viewMode === "month" ? "day" : viewMode;

  const weekLabel = currentWeek
    ? `Wk ${currentWeek.weekNumber} · ${new Date(currentWeek.startDate + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })}–${new Date(currentWeek.endDate + "T00:00:00").toLocaleDateString("en-GB", {
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
  // Use effectiveViewMode for nav label too
  const navLabel = effectiveViewMode === "week" ? weekLabel : effectiveViewMode === "day" ? dayLabel : monthLabel;

  const prevDisabled =
    effectiveViewMode === "week"
      ? currentWeekIndex === 0
      : effectiveViewMode === "day"
        ? currentDayIndex === 0
        : !currentMonthKey || currentMonthKey <= (calendarData?.rotaStartDate.slice(0, 7) ?? "");
  const nextDisabled =
    effectiveViewMode === "week"
      ? currentWeekIndex >= weeks.length - 1
      : effectiveViewMode === "day"
        ? currentDayIndex >= allDates.length - 1
        : !currentMonthKey || currentMonthKey >= (calendarData?.rotaEndDate.slice(0, 7) ?? "");

  const goPrev = () => {
    if (effectiveViewMode === "week") setCurrentWeekIndex((i) => Math.max(0, i - 1));
    else if (effectiveViewMode === "day") setCurrentDayIndex((i) => Math.max(0, i - 1));
    else if (effectiveViewMode === "month" && currentMonthKey) {
      const [y, m] = currentMonthKey.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 2, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (calendarData && key >= calendarData.rotaStartDate.slice(0, 7)) setCurrentMonthKey(key);
    }
  };
  const goNext = () => {
    if (effectiveViewMode === "week") setCurrentWeekIndex((i) => Math.min(weeks.length - 1, i + 1));
    else if (effectiveViewMode === "day") setCurrentDayIndex((i) => Math.min(allDates.length - 1, i + 1));
    else if (effectiveViewMode === "month" && currentMonthKey) {
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
  // CHANGE 4: wrapped with Popover; double-click navigates
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
      <Popover
        key={doctor.doctorId}
        modal={false}
        open={isSelected && panelOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPanelOpen(false);
            setSelectedCell(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <div
            onClick={() => handleCellTap(doctor.doctorId, currentDate)}
            onDoubleClick={() => handleDoubleTap(doctor.doctorId, currentDate)}
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
              {lastName && <div className="font-semibold text-xs truncate w-full uppercase">{lastName}</div>}
              <div className="font-semibold text-[11px] truncate w-full">{firstName}</div>
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
        </PopoverTrigger>
        <ActionButtonsPopover
          doctorId={doctor.doctorId}
          date={currentDate}
          mergedCell={mergedCell}
          doctorName={doctor.doctorName.replace("Dr ", "")}
          onAdd={handleActionAdd}
          onTriggerAction={handleTriggerAction}
          onGoToDate={handleGoToDate}
          onNavigateProfile={handlePopoverNavigateProfile}
        />
      </Popover>
    );
  };

  // Renderer for Week Table Row
  // CHANGE 2: fix isDeleted in primary; CHANGE 4: wrap cells in Popover
  const renderWeekRow = (doctor: CalendarDoctor, i: number) => {
    const rowBg = i % 2 === 0 ? "bg-card" : "bg-muted/20";
    const ltftDays = getLtftDaysOff(doctor);
    // Build the full 7-day Mon–Sun span from week startDate/endDate (Change 5)
    const weekAllDates = Array.from({ length: 7 }, (_, idx) => addDays(currentWeek.startDate, idx));
    const nameParts = doctor.doctorName.replace("Dr ", "").trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
    return (
      <tr key={doctor.doctorId} className={`border-b border-border/50 ${rowBg}`}>
        <td className={`p-0.5 sm:p-1 border-r border-border align-middle overflow-hidden`}>
          {/* Mobile (<sm): SURNAME / Name stacked, no extra info.
              Tablet (sm..<lg): Row 1 = SURNAME + Name; Row 2 = grade · wte · LTFT.
              Desktop (lg+): single row with SURNAME, Name, grade, wte, LTFT. */}
          <div
            onClick={() => navigate(`/admin/doctor-calendar/${doctor.doctorId}?date=${currentDate}&view=week`)}
            className="cursor-pointer hover:underline text-blue-600 min-w-0 w-full pr-1"
            title={doctor.doctorName}
          >
            {/* Mobile: stacked SURNAME / Name */}
            <div className="flex flex-col sm:hidden min-w-0">
              {lastName && (
                <span className="font-semibold text-[10px] leading-tight truncate uppercase mx-[5px]">{lastName}</span>
              )}
              <span className="font-semibold text-[9px] leading-tight truncate mx-[5px]">{firstName}</span>
            </div>

            {/* Tablet + Desktop: name row (and on desktop, info inline) */}
            <div className="hidden sm:flex flex-row flex-wrap items-center gap-1 lg:gap-1.5 min-w-0">
              {lastName && (
                <span className="font-semibold text-[10px] truncate uppercase">{lastName}</span>
              )}
              <span className="font-semibold text-[10px] truncate">{firstName}</span>
              {/* Desktop only: inline info */}
              <span className="hidden lg:inline-flex items-center gap-1 shrink-0">
                <GradeBadge grade={doctor.grade} size="xs" />
                <span className="text-[8px] text-muted-foreground">{doctor.wte}%</span>
                {ltftDays.length > 0 && (
                  <span className="text-[8px] font-semibold text-yellow-800 bg-yellow-100 border border-yellow-200 rounded px-1 truncate">
                    LTFT
                  </span>
                )}
              </span>
            </div>

            {/* Tablet only: second row with info */}
            <div className="hidden sm:flex lg:hidden flex-row items-center gap-1 mt-0.5 min-w-0">
              <GradeBadge grade={doctor.grade} size="xs" />
              <span className="text-[8px] text-muted-foreground">{doctor.wte}%</span>
              {ltftDays.length > 0 && (
                <span className="text-[8px] font-semibold text-yellow-800 bg-yellow-100 border border-yellow-200 rounded px-1 truncate shrink-0">
                  LTFT
                </span>
              )}
            </div>
          </div>
        </td>
        {/* Change 5: iterate full Mon–Sun 7-day span; Change 6: darken out-of-rota cells */}
        {weekAllDates.map((date) => {
          const inRota = date >= calendarData.rotaStartDate && date <= calendarData.rotaEndDate;

          // Change 6: out-of-rota cell — darkened, no interaction
          if (!inRota) {
            return (
              <td
                key={date}
                className="border-l border-border/30 p-0 text-center align-middle h-[28px] sm:h-[34px] bg-muted/50 cursor-not-allowed"
              />
            );
          }

          const mergedCell = mergedAvailabilityByDoctor[doctor.doctorId]?.[date];
          // Correctly respect isDeleted flag
          const primary = mergedCell?.isDeleted ? "AVAILABLE" : (mergedCell?.primary ?? "AVAILABLE");
          const isLtftDay = ltftDays.includes(getDayNameFromISO(date));
          const cellBg = getMergedCellBackground(mergedCell, isLtftDay);
          const isSelected = selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === date;

          return (
            // Change 3: modal={false} prevents Radix scroll-lock/focus-trap that causes page scroll-to-top
            <td
              key={date}
              onDoubleClick={() => handleDoubleTap(doctor.doctorId, date)}
              className={`border-l border-border/50 p-0 text-center align-middle cursor-pointer transition-colors ${cellBg}`}
            >
              <Popover
                modal={false}
                open={isSelected && panelOpen}
                onOpenChange={(o) => {
                  if (!o) {
                    setPanelOpen(false);
                    setSelectedCell(null);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <div
                    className="w-full flex flex-row flex-wrap items-center justify-center gap-[1px] min-h-[28px] sm:min-h-[34px] overflow-hidden p-0.5 hover:bg-muted/50 transition-colors"
                    onClick={() => handleCellTap(doctor.doctorId, date)}
                  >
                    <WeekCellContent mergedCell={mergedCell} isLtftDay={isLtftDay} primary={primary} />
                  </div>
                </PopoverTrigger>
                <ActionButtonsPopover
                  doctorId={doctor.doctorId}
                  date={date}
                  mergedCell={mergedCell}
                  doctorName={doctor.doctorName.replace("Dr ", "")}
                  onAdd={handleActionAdd}
                  onTriggerAction={handleTriggerAction}
                  onGoToDate={handleGoToDate}
                  onNavigateProfile={handlePopoverNavigateProfile}
                />
              </Popover>
            </td>
          );
        })}
      </tr>
    );
  };

  // Renderer for Month Table Row
  // CHANGE 4: wrap active cells in Popover; onDoubleClick navigates
  const renderMonthRow = (doctor: CalendarDoctor, i: number, gridDates: string[]) => {
    const rowBg = i % 2 === 0 ? "bg-card" : "bg-muted/10";
    return (
      <tr key={doctor.doctorId} className={`border-b border-border/50 ${rowBg}`}>
        <td
          onClick={() => navigate(`/admin/doctor-calendar/${doctor.doctorId}?date=${currentDate}&view=month`)}
          className={`p-1 sm:p-1.5 border-r border-border text-left align-middle cursor-pointer hover:underline overflow-hidden`}
          title={doctor.doctorName}
        >
          <div className="font-semibold text-[10px] sm:text-[11px] text-blue-600 break-words whitespace-normal w-full">
            {doctor.doctorName.replace("Dr ", "")}
          </div>
          <div className="hidden sm:flex items-center gap-1 mt-0.5">
            <GradeBadge grade={doctor.grade} size="xs" />
            <span className="text-[8px] sm:text-[9px] text-muted-foreground">· {doctor.wte}%</span>
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

          if (!inRota || !inMonth) {
            return (
              <td
                key={`${doctor.doctorId}-${idx}`}
                className={`border-l border-border/50 p-0 sm:p-0.5 text-center cursor-default h-6 sm:h-8 ${bg} opacity-20`}
              />
            );
          }

          return (
            <td
              key={`${doctor.doctorId}-${idx}`}
              onDoubleClick={() => handleDoubleTap(doctor.doctorId, date)}
              className={`border-l border-border/50 p-0 text-center cursor-pointer h-6 sm:h-8 ${bg}`}
            >
              <Popover
                modal={false}
                open={isSelected && panelOpen}
                onOpenChange={(o) => {
                  if (!o) {
                    setPanelOpen(false);
                    setSelectedCell(null);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <div
                    className="w-full h-full flex items-center justify-center hover:bg-muted/50 transition-colors overflow-hidden relative"
                    onClick={() => handleCellTap(doctor.doctorId, date)}
                  >
                    {mergedCell?.isDeleted && mergedCell.deletedCode ? (
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
                    ) : null}
                  </div>
                </PopoverTrigger>
                <ActionButtonsPopover
                  doctorId={doctor.doctorId}
                  date={date}
                  mergedCell={mergedCell}
                  doctorName={doctor.doctorName.replace("Dr ", "")}
                  onAdd={handleActionAdd}
                  onTriggerAction={handleTriggerAction}
                  onGoToDate={handleGoToDate}
                  onNavigateProfile={handlePopoverNavigateProfile}
                />
              </Popover>
            </td>
          );
        })}
      </tr>
    );
  };

  // Dynamic Content logic for Collapsible Summary Table
  const renderSummaryContent = () => {
    if (effectiveViewMode === "day") {
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
      effectiveViewMode === "week"
        ? currentWeek.dates
        : buildMonthGrid(currentMonthKey).filter(
            (d) => d >= calendarData.rotaStartDate && d <= calendarData.rotaEndDate && d.startsWith(currentMonthKey),
          );

    return (
      <div className="border-t border-border bg-card w-full overflow-hidden">
        <table className="w-full table-fixed text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground sticky left-0 bg-muted/30 border-r border-border w-[18%]">
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
              <td className="py-2 px-3 font-semibold sticky left-0 bg-card border-r border-border w-[18%]">
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
                  className={`py-2 px-3 text-muted-foreground sticky left-0 border-r border-border w-[18%] truncate ${i % 2 === 0 ? "bg-muted/10" : "bg-card"}`}
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

  const pageContent = (
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

      {/* CHANGE 9: info strip removed */}

      {/* Unified Nav Bar — compact */}
      <div className="flex flex-col gap-2 p-2 bg-card rounded-xl border border-border shadow-sm">
        {/* Row 1: View toggle + date picker */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap sm:flex-nowrap">
          <ViewToggle viewMode={effectiveViewMode} setViewMode={setViewMode} isMobile={isMobile} />

          <input
            type="date"
            value={currentDateForSync}
            min={calendarData?.rotaStartDate ?? allDates[0]}
            max={calendarData?.rotaEndDate ?? allDates[allDates.length - 1]}
            onChange={(e) => {
              if (e.target.value && e.target.value.length === 10) handleDateChange(e.target.value);
            }}
            className="ml-auto text-[11px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 border border-border rounded-md bg-card text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 h-[28px] sm:h-[34px] shrink-0"
          />
        </div>

        {/* Row 2: Search + Availability + Sort — single row on all sizes */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-muted/30 p-1.5 sm:p-2 border border-border/60 rounded-lg">
          <div className="relative flex-1 min-w-0">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1 sm:py-1.5 text-[11px] sm:text-xs border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-blue-500 h-[28px] sm:h-auto"
            />
          </div>

          {effectiveViewMode === "day" && (
            <button
              type="button"
              onClick={() => setGroupAvailability(!groupAvailability)}
              title="Group by availability"
              className={`flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border font-medium transition-all shadow-sm shrink-0 ${
                groupAvailability
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${groupAvailability ? "bg-white" : "bg-muted-foreground"}`}
              />
              <span className="hidden sm:inline">Availability</span>
              <span className="sm:hidden">Avail</span>
            </button>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortConfig.key}
              onChange={(e) =>
                setSortConfig((prev) => ({ ...prev, key: e.target.value as "name" | "grade" }))
              }
              className="text-[11px] sm:text-xs px-1.5 sm:px-2 py-1 sm:py-1.5 border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[28px] sm:h-auto"
            >
              <option value="name">Name</option>
              {effectiveViewMode === "day" && <option value="grade">Grade</option>}
            </select>
            <button
              type="button"
              onClick={() =>
                setSortConfig((prev) => ({
                  ...prev,
                  direction: prev.direction === "asc" ? "desc" : "asc",
                }))
              }
              className="p-1 sm:p-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors text-muted-foreground"
              title={sortConfig.direction === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
            >
              {sortConfig.direction === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Period navigator — directly above calendar */}
      <div className="flex items-center justify-center gap-2 px-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={prevDisabled}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs sm:text-sm font-semibold text-foreground text-center truncate min-w-[150px]">
          {navLabel}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── WEEK VIEW ── */}
      {effectiveViewMode === "week" && currentWeek && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full">
          <table className="w-full table-fixed text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="bg-card py-2 px-1 sm:px-2 font-medium text-muted-foreground border-r border-border w-[25%] sm:w-[20%] align-bottom">
                  Doctor
                </th>
                {/* Change 5: iterate full Mon–Sun 7-day span so week always starts Mon and ends Sun */}
                {/* Change 6: out-of-rota date columns are clearly dimmed/unavailable */}
                {Array.from({ length: 7 }, (_, idx) => addDays(currentWeek.startDate, idx)).map((date) => {
                  const dd = new Date(date + "T00:00:00");
                  const isWknd = dd.getDay() === 0 || dd.getDay() === 6;
                  const isBH = bankHolidays.has(date);
                  const isToday = date === todayISO;
                  const inRota = date >= calendarData.rotaStartDate && date <= calendarData.rotaEndDate;

                  // Out-of-rota columns: muted header, no BH/today highlighting
                  const hdrBg = !inRota
                    ? "bg-muted/50"
                    : isToday
                      ? "bg-blue-100"
                      : isBH
                        ? "bg-red-100"
                        : isWknd
                          ? "bg-muted"
                          : "bg-card";
                  const hdrColor = !inRota
                    ? "text-muted-foreground/30"
                    : isToday
                      ? "text-blue-800"
                      : isBH
                        ? "text-red-800"
                        : isWknd
                          ? "text-muted-foreground"
                          : "text-foreground";

                  return (
                    <th
                      key={date}
                      className={`py-2 px-0 text-center font-medium border-l border-border/50 overflow-hidden ${hdrBg} ${hdrColor} ${
                        !inRota ? "opacity-40" : ""
                      }`}
                      style={{ width: `${75 / 7}%` }}
                    >
                      <div className="text-[8px] sm:text-[9px] uppercase tracking-tighter truncate">
                        {MONTH_DAY_ABBR[(dd.getDay() + 6) % 7].slice(0, 2)}
                      </div>
                      <div className={`text-[9px] sm:text-[10px] ${isToday ? "font-bold" : "font-normal"}`}>
                        {dd.getDate()}
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
                          colSpan={8}
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
                        <td colSpan={8} className="px-2 py-1.5">
                          <div className="flex items-center justify-between font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                            <span>Partially Available ({partiallyAvailableDocs.length})</span>
                            {collapsePartial ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
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
                        <td colSpan={8} className="px-2 py-1.5">
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
      {effectiveViewMode === "day" && (
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
      {/* CHANGE 1: effectiveViewMode === "month" — isMobile can never reach this branch
            because effectiveViewMode collapses "month" to "day" when isMobile is true */}
      {effectiveViewMode === "month" &&
        (calendarData && currentMonthKey
          ? (() => {
              const gridDates = buildMonthGrid(currentMonthKey);
              return (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto w-full">
                  <table className="w-full table-fixed text-[10px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="bg-muted/30 py-1 sm:py-2 px-1 font-medium text-muted-foreground border-r border-border w-[12%] sm:w-[15%] align-bottom">
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
          : null)}

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

      {/* CHANGE 8: legend now receives viewMode to show letter variants in month view */}
      <CalendarLegend viewMode={effectiveViewMode} />

      {/* Bottom EventDetailPanel removed entirely — replaced by cell popovers */}
    </div>
  );

  // FIX: Wrapper const removed — replaced with inline conditional below.
  // AdminLayout is now a stable, always-present component identity.
  // The modal is rendered outside pageContent so it sits above the layout.
  return (
    <>
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
      {pickerAction !== null && pickerCell !== null && (() => {
        const { doctorId, date } = pickerCell;
        const activeOverrides = overrides.filter(
          (o) =>
            o.doctorId === doctorId &&
            (o.action === 'add' || o.action === 'modify') &&
            o.startDate <= date && date <= o.endDate
        );
        const doctor = calendarData?.doctors.find((d) => d.doctorId === doctorId);
        const isLtftDay = !!doctor && getLtftDaysOff(doctor).includes(getDayNameFromISO(date));
        const doctorName = doctor?.doctorName.replace('Dr ', '') ?? '';
        // Build list of selectable items: overrides first, then synthetic LTFT entry
        type PickerItem =
          | { kind: 'override'; id: string; label: string; subLabel: string }
          | { kind: 'ltft'; id: string; label: string; subLabel: string };
        const items: PickerItem[] = [
          ...activeOverrides.map((ov) => ({
            kind: 'override' as const,
            id: ov.id,
            label: ov.eventType,
            subLabel:
              ov.startDate === ov.endDate
                ? ov.startDate
                : `${ov.startDate} \u2013 ${ov.endDate}`,
          })),
          ...(isLtftDay
            ? [{
                kind: 'ltft' as const,
                id: 'ltft',
                label: 'LTFT day off',
                subLabel: getDayNameFromISO(date),
              }]
            : []),
        ];

        const isEdit = pickerAction === 'edit';
        const actionVerb = pickerAction === 'edit' ? 'edit' : pickerAction === 'copy' ? 'copy' : 'remove';

        return (
          <PickerModal
            doctorName={doctorName}
            items={items}
            actionVerb={actionVerb}
            singleSelect={isEdit}
            onCancel={() => { setPickerAction(null); setPickerCell(null); }}
            onConfirm={(selectedIds) => {
              const action = pickerAction;
              setPickerAction(null);
              setPickerCell(null);
              for (const id of selectedIds) {
                if (id === 'ltft') {
                  const syntheticCell: MergedCell = {
                    primary: 'LTFT' as CellCode,
                    secondary: null,
                    label: 'LTFT',
                    overrideId: null,
                    overrideAction: null,
                    isDeleted: false,
                    deletedCode: null,
                  };
                  if (action === 'edit') handleActionEdit(doctorId, date, syntheticCell);
                  if (action === 'copy') handleActionCopy(doctorId, date, syntheticCell);
                  if (action === 'delete') handleActionDelete(doctorId, date, syntheticCell);
                } else {
                  const ov = activeOverrides.find((o) => o.id === id);
                  if (!ov) continue;
                  const syntheticCell: MergedCell = {
                    primary: ov.eventType,
                    secondary: null,
                    label: ov.eventType,
                    overrideId: ov.id,
                    overrideAction: ov.action as 'add' | 'modify',
                    isDeleted: false,
                    deletedCode: null,
                  };
                  if (action === 'edit') handleActionEdit(doctorId, date, syntheticCell);
                  if (action === 'copy') handleActionCopy(doctorId, date, syntheticCell);
                  if (action === 'delete') handleActionDelete(doctorId, date, syntheticCell);
                }
              }
            }}
          />
        );
      })()}
      {embedded ? (
        pageContent
      ) : (
        <AdminLayout
          title="Availability Calendar"
          subtitle={`${deptName}${deptName && hospitalName ? " · " : ""}${hospitalName}`}
          accentColor="blue"
          pageIcon={CalendarRange}
        >
          {pageContent}
        </AdminLayout>
      )}
    </>
  );
}
