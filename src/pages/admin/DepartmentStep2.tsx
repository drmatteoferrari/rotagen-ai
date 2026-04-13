import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Pencil, Clock, Save, X, Info, AlertTriangle,
  ArrowLeft, ArrowRight, CalendarDays, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Building2, Copy,
} from "lucide-react";
import {
  useDepartmentSetup, detectBadges, mergedBadges, generateAbbreviation,
  getShiftColor,
  type ShiftType, type BadgeKey, type ShiftBadges,
  type DaySlot, type SlotRequirement, type ShiftStaffing,
} from "@/contexts/DepartmentSetupContext";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcDurationHours } from "@/lib/shiftUtils";
import type { ApplicableDays } from "@/lib/shiftUtils";
import { GRADE_OPTIONS, GRADE_DISPLAY_LABELS } from "@/lib/gradeOptions";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// Keep DAY_SHORT_LABELS and DAY_FULL_LABELS as aliases so existing code still compiles
const DAY_SHORT_LABELS = DAY_SHORT;
const DAY_FULL_LABELS  = DAY_FULL;

const SHIFT_TEMPLATES = [
  { label: "Standard Day", abbrev: "SD", start: "08:00", end: "17:30", isOncall: false },
  { label: "Long Day",     abbrev: "LD", start: "08:00", end: "20:30", isOncall: true  },
  { label: "Night",        abbrev: "N",  start: "20:00", end: "08:30", isOncall: true  },
  { label: "Twilight",     abbrev: "Tw", start: "16:00", end: "00:00", isOncall: true  },
] as const;

const BADGE_DEFS: { key: BadgeKey; label: string; emoji: string; activeClasses: string }[] = [
  { key: "night",  label: "NIGHT",   emoji: "🌙", activeClasses: "bg-slate-800 text-white"    },
  { key: "long",   label: "LONG",    emoji: "⏱",  activeClasses: "bg-amber-600 text-white"   },
  { key: "ooh",    label: "OOH",     emoji: "🌆", activeClasses: "bg-indigo-600 text-white"  },
  { key: "oncall", label: "ON-CALL", emoji: "📟", activeClasses: "bg-emerald-700 text-white" },
  { key: "nonres", label: "NON-RES", emoji: "🏠", activeClasses: "bg-teal-700 text-white"   },
];

type ShiftTemplate = typeof SHIFT_TEMPLATES[number];

/* ─── New helpers (day-slot model) ─── */

function makeDefaultDaySlot(dayKey: string, shift: ShiftType): DaySlot {
  return {
    dayKey,
    staffing: { min: shift.staffing.min, target: shift.staffing.target, max: shift.staffing.max },
    slots: [],
    isCustomised: false,
  };
}

function makeEmptySlot(index: number): SlotRequirement {
  return { slotIndex: index, label: null, permittedGrades: [], reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0 };
}

function slotHasRestrictions(s: SlotRequirement): boolean {
  return s.permittedGrades.length > 0 || s.reqIac > 0 || s.reqIaoc > 0 || s.reqIcu > 0 || s.reqTransfer > 0;
}

function computeIsCustomised(ds: DaySlot, shift: ShiftType): boolean {
  return (
    ds.staffing.min    !== shift.staffing.min    ||
    ds.staffing.target !== shift.staffing.target ||
    ds.staffing.max    !== shift.staffing.max    ||
    ds.slots.some(slotHasRestrictions)
  );
}

function getShiftIdentityErrors(shift: ShiftType, allShifts: ShiftType[]): string[] {
  const errors: string[] = [];
  if (!shift.name.trim()) errors.push("Name required.");
  if (!shift.abbreviation.trim()) errors.push("Abbreviation required.");
  if (shift.abbreviation.trim().length > 4) errors.push("Abbreviation max 4 chars.");
  if (shift.startTime === shift.endTime) errors.push("Start and end time cannot be equal.");
  const dupes = allShifts.filter(
    (s) => s.id !== shift.id &&
    s.abbreviation.trim().toUpperCase() === shift.abbreviation.trim().toUpperCase()
  );
  if (dupes.length > 0) errors.push(`Abbreviation "${shift.abbreviation}" already used.`);
  return errors;
}

/* ─── GradePill ─── */

interface GradePillProps {
  permittedGrades: string[];
  onChange: (grades: string[]) => void;
}

function GradePill({ permittedGrades, onChange }: GradePillProps) {
  const [open, setOpen] = useState(false);
  const restricted = permittedGrades.length > 0;
  const pillLabel = restricted
    ? permittedGrades.length <= 3
      ? permittedGrades.join(", ")
      : `${permittedGrades.length} grades`
    : "Any grade";

  const toggle = (grade: string) =>
    onChange(
      permittedGrades.includes(grade)
        ? permittedGrades.filter((g) => g !== grade)
        : [...permittedGrades, grade]
    );

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
          restricted
            ? "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
            : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
        }`}
      >
        {pillLabel}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Grade restriction</span>
            {restricted && (
              <button type="button" onClick={() => onChange([])} className="text-[10px] text-purple-600 hover:text-purple-800">Clear all</button>
            )}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {GRADE_OPTIONS.map((grade) => (
              <label key={grade} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                <Checkbox checked={permittedGrades.includes(grade)} onCheckedChange={() => toggle(grade)} className="h-3.5 w-3.5" />
                {GRADE_DISPLAY_LABELS[grade] ?? grade}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">No grades selected = any grade eligible.</p>
        </div>
      )}
    </div>
  );
}

/* ─── SlotRowEditor ─── */

interface SlotRowEditorProps {
  slot: SlotRequirement;
  slotNumber: number;
  onChange: (updated: SlotRequirement) => void;
}

function SlotRowEditor({ slot, slotNumber, onChange }: SlotRowEditorProps) {
  const upd = (patch: Partial<SlotRequirement>) => onChange({ ...slot, ...patch });
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Doctor {slotNumber}</span>
        <Input
          value={slot.label ?? ""}
          onChange={(e) => upd({ label: e.target.value.trim() || null })}
          placeholder="Label (optional)"
          className="h-7 text-xs"
        />
      </div>
      <GradePill permittedGrades={slot.permittedGrades} onChange={(g) => upd({ permittedGrades: g })} />
      <div className="flex flex-wrap gap-3">
        {(
          [
            { key: "reqIac"      as const, label: "IAC"      },
            { key: "reqIaoc"     as const, label: "IAOC"     },
            { key: "reqIcu"      as const, label: "ICU"      },
            { key: "reqTransfer" as const, label: "Transfer" },
          ]
        ).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={slot[key] > 0} onCheckedChange={(v) => upd({ [key]: v ? 1 : 0 })} className="h-3.5 w-3.5" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function getShiftErrors(shift: ShiftType, allShifts?: ShiftType[]): string[] {
  const errors: string[] = [];
  if (!shift.name.trim()) errors.push("Shift name is required.");
  if (!shift.abbreviation.trim()) errors.push("Abbreviation is required.");
  if (shift.abbreviation.trim().length > 4) errors.push("Abbreviation must be 4 characters or fewer.");
  if (shift.startTime === shift.endTime) errors.push("Start and end time cannot be the same.");
  if (!Object.values(shift.applicableDays).some(Boolean)) errors.push("At least one day must be selected.");
  if (shift.staffing.target < shift.staffing.min) errors.push("Target cannot be less than minimum.");
  if (shift.staffing.max !== null && shift.staffing.max < shift.staffing.target) errors.push("Maximum cannot be less than target.");
  if (allShifts && shift.abbreviation.trim()) {
    const dupes = allShifts.filter(s => s.id !== shift.id && s.abbreviation.trim().toUpperCase() === shift.abbreviation.trim().toUpperCase());
    if (dupes.length > 0) errors.push(`Abbreviation "${shift.abbreviation}" is already used by another shift.`);
  }
  return errors;
}

/* ─── AddShiftDialog ─── */

interface AddShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTemplate: (template: ShiftTemplate, days: Record<DayKey, boolean>) => void;
  onAddCustom: (days: Record<DayKey, boolean>) => void;
}

function AddShiftDialog({ open, onOpenChange, onAddTemplate, onAddCustom }: AddShiftDialogProps) {
  const [selectedDays, setSelectedDays] = useState<Record<DayKey, boolean>>({
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
  });

  const toggleDay = (key: DayKey) => {
    const next = { ...selectedDays, [key]: !selectedDays[key] };
    if (!Object.values(next).some(Boolean)) return;
    setSelectedDays(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Shift</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Day selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Apply to days</p>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_KEYS.map((key, i) => {
                const isWeekend = i >= 5;
                const isSelected = selectedDays[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[11px] font-semibold transition-colors ${
                      isSelected
                        ? isWeekend
                          ? "border-purple-400 bg-purple-600 text-white"
                          : "border-blue-400 bg-blue-600 text-white"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {DAY_SHORT_LABELS[i]}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">You can change days later in the shift editor.</p>
          </div>

          {/* Template picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choose a template</p>
            <div className="grid grid-cols-2 gap-2">
              {SHIFT_TEMPLATES.map((t) => (
                <button
                  key={t.abbrev}
                  type="button"
                  onClick={() => onAddTemplate(t, selectedDays)}
                  className="flex flex-col items-start gap-0.5 rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2.5 text-left hover:bg-purple-100 transition-colors"
                >
                  <span className="font-mono text-sm font-bold text-purple-700">{t.abbrev}</span>
                  <span className="text-xs font-medium text-foreground">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.start}–{t.end}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom or cancel */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onAddCustom(selectedDays)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-purple-300 px-3 py-2 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Custom shift
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── DayColumn ─── */

interface DayColumnProps {
  dayKey: DayKey;
  dayLabel: string;
  shifts: ShiftType[];
  isWeekend: boolean;
  openChipKey: string | null;
  setOpenChipKey: (key: string | null) => void;
  setShifts: React.Dispatch<React.SetStateAction<ShiftType[]>>;
  removeShiftFromDay: (shiftId: string, dayKey: keyof ApplicableDays) => void;
  dragOverDay: DayKey | null;
  setExpandedShiftId: (id: string | null) => void;
}

function DayColumn({
  dayKey, dayLabel, shifts, isWeekend,
  openChipKey, setOpenChipKey, setShifts,
  removeShiftFromDay, dragOverDay,
  setExpandedShiftId,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const dayShifts = shifts
    .map((s, index) => ({ shift: s, index }))
    .filter(({ shift }) => shift.applicableDays[dayKey as keyof ApplicableDays]);
  const isDropTarget = isOver || dragOverDay === dayKey;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 min-h-[240px] transition-all ${
        isDropTarget
          ? "ring-2 ring-purple-400 bg-purple-50/80 border-purple-300"
          : isWeekend
            ? "border-purple-200 bg-purple-50/60"
            : "border-border bg-card"
      }`}
    >
      <div className="mb-1 flex flex-col items-center">
        <h3 className={`text-sm font-semibold text-center ${isWeekend ? "text-purple-700" : "text-slate-600"}`}>
          {dayLabel}
        </h3>
        {dayShifts.length > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">—</span>
        )}
      </div>

      {dayShifts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-xs text-muted-foreground">
          <Plus className="h-4 w-4 mb-1 text-muted-foreground/40" />
          <span>Drop here</span>
        </div>
      )}

      {dayShifts.map(({ shift, index }) => {
        const chipKey = `${shift.id}-${dayKey}`;
        const color = getShiftColor(index);
        const isOpen = openChipKey === chipKey;

        return (
          <Popover
            key={chipKey}
            open={isOpen}
            onOpenChange={(open) => setOpenChipKey(open ? chipKey : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`group relative flex min-h-[36px] w-full items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold transition-all mb-2 hover:ring-1 hover:ring-purple-200 ${isOpen ? "ring-2 ring-purple-300 ring-offset-1" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenChipKey(isOpen ? null : chipKey);
                }}
              >
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest border"
                  style={{ backgroundColor: color.solid, color: "white", borderColor: color.solid }}
                >
                  {shift.abbreviation}
                </span>
                <span className="text-muted-foreground text-[11px]">×{shift.staffing.target}</span>
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-52 p-3 space-y-3"
              side="right"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {/* Header */}
              <p className="text-sm font-semibold text-foreground truncate">{shift.name}</p>

              {/* Staffing stepper */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Doctors/day</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm font-bold hover:bg-muted disabled:opacity-30"
                    disabled={shift.staffing.target <= shift.staffing.min}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTarget = Math.max(shift.staffing.min, shift.staffing.target - 1);
                      setShifts(prev => prev.map(s =>
                        s.id === shift.id ? { ...s, staffing: { ...s.staffing, target: newTarget } } : s
                      ));
                    }}
                  >−</button>
                  <span className="text-sm font-bold w-6 text-center">{shift.staffing.target}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm font-bold hover:bg-muted disabled:opacity-30"
                    disabled={shift.staffing.max !== null && shift.staffing.target >= shift.staffing.max}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTarget = shift.staffing.max !== null
                        ? Math.min(shift.staffing.max, shift.staffing.target + 1)
                        : shift.staffing.target + 1;
                      setShifts(prev => prev.map(s =>
                        s.id === shift.id ? { ...s, staffing: { ...s.staffing, target: newTarget } } : s
                      ));
                    }}
                  >+</button>
                </div>
              </div>

              <hr className="border-border" />

              {/* Edit */}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenChipKey(null);
                  setExpandedShiftId(shift.id);
                  setTimeout(() => {
                    const el = document.getElementById(`shift-card-${shift.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit shift details
              </button>

              {/* Remove from day */}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenChipKey(null);
                  removeShiftFromDay(shift.id, dayKey as keyof ApplicableDays);
                }}
              >
                <X className="h-3.5 w-3.5" /> Remove from {dayLabel}
              </button>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

/* ─── DraggableShiftChip ─── */

function DraggableShiftChip({ shift, index }: { shift: ShiftType; index: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: shift.id });
  const color = getShiftColor(index);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-shrink-0 cursor-grab items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${color.bg} ${color.text} ${color.border} ${isDragging ? "opacity-50" : ""}`}
      style={{ transform: CSS.Transform.toString(transform) }}
    >
      <span className="font-mono font-bold tracking-widest">{shift.abbreviation}</span>
    </div>
  );
}

/* ─── ExpandedCard ─── */

function ExpandedCard({
  shift: originalShift,
  onSave,
  onCancel,
  onRemove,
  onDraftChange,
  canRemove,
  index,
  allShifts,
}: {
  shift: ShiftType;
  onSave: (updated: ShiftType) => void;
  onCancel: (original: ShiftType) => void;
  onRemove: () => void;
  onDraftChange: (updated: ShiftType) => void;
  canRemove: boolean;
  index: number;
  allShifts: ShiftType[];
}) {
  const initialShiftRef = useRef(originalShift);
  const [draft, setDraft] = useState({
    ...originalShift,
    applicableDays: { ...originalShift.applicableDays },
    badges: { ...originalShift.badges },
    badgeOverrides: { ...originalShift.badgeOverrides },
    staffing: { ...originalShift.staffing },
    reqIac: originalShift.reqIac,
    reqIaoc: originalShift.reqIaoc,
    reqIcu: originalShift.reqIcu,
    reqTransfer: originalShift.reqTransfer,
    reqMinGrade: originalShift.reqMinGrade,
    abbreviation: originalShift.abbreviation,
  });
  const [abbrevManuallyEdited, setAbbrevManuallyEdited] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recalc = useCallback((d: ShiftType): ShiftType => {
    const dur = calcDurationHours(d.startTime, d.endTime);
    const auto = detectBadges(d.startTime, d.endTime, d.applicableDays, d.isOncall, d.isNonRes);

    let isOncall = d.isOncall;
    let isNonRes = d.isNonRes;
    if (!d.oncallManuallySet) {
      isOncall = auto.night || auto.long || auto.ooh;
    }

    const finalAuto = detectBadges(d.startTime, d.endTime, d.applicableDays, isOncall, isNonRes);
    const merged = mergedBadges(finalAuto, d.badgeOverrides);

    return { ...d, durationHours: dur, isOncall, isNonRes, badges: merged };
  }, []);

  const update = useCallback((updates: Partial<ShiftType>) => {
    setDraft((prev) => {
      const next = recalc({ ...prev, ...updates });
      onDraftChange(next);
      return next;
    });
  }, [onDraftChange, recalc]);

  const toggleDay = (key: keyof ApplicableDays) => {
    const newDays = { ...draft.applicableDays, [key]: !draft.applicableDays[key] };
    if (!Object.values(newDays).some(Boolean)) return;
    update({ applicableDays: newDays });
  };

  const toggleBadge = (key: BadgeKey) => {
    const isCurrentlyOverridden = draft.badgeOverrides[key] !== undefined;
    const newOverrides = { ...draft.badgeOverrides };

    if (isCurrentlyOverridden) {
      delete newOverrides[key];
    } else {
      const auto = detectBadges(draft.startTime, draft.endTime, draft.applicableDays, draft.isOncall, draft.isNonRes);
      newOverrides[key] = !auto[key];
    }

    let extraUpdates: Partial<ShiftType> = {};
    if (key === "oncall") {
      const effectiveVal = newOverrides.oncall !== undefined ? newOverrides.oncall : detectBadges(draft.startTime, draft.endTime, draft.applicableDays, draft.isOncall, draft.isNonRes).oncall;
      extraUpdates = { isOncall: effectiveVal, oncallManuallySet: true };
    }
    if (key === "nonres") {
      const effectiveVal = newOverrides.nonres !== undefined ? newOverrides.nonres : detectBadges(draft.startTime, draft.endTime, draft.applicableDays, draft.isOncall, draft.isNonRes).nonres;
      extraUpdates = { isNonRes: effectiveVal };
    }

    update({ badgeOverrides: newOverrides, ...extraUpdates });
  };

  return (
    <div className="space-y-5 rounded-xl border-2 border-purple-200 bg-card p-5 shadow-lg md:p-6" style={{ borderLeft: `4px solid ${getShiftColor(index).solid}` }}>

      {/* ROW 1 — Name + Abbreviation side by side */}
      <div className="grid grid-cols-[1fr_80px] gap-3 sm:grid-cols-[1fr_100px]">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shift Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => {
              const newName = e.target.value;
              update({ name: newName });
              if (!abbrevManuallyEdited) update({ abbreviation: generateAbbreviation(newName) });
            }}
            className="min-h-[40px]"
            placeholder="e.g. Standard Day"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Abbrev.</Label>
          <Input
            value={draft.abbreviation}
            maxLength={4}
            onChange={(e) => { setAbbrevManuallyEdited(true); update({ abbreviation: e.target.value.toUpperCase() }); }}
            className="min-h-[40px] font-mono text-center tracking-widest"
            placeholder="SD"
          />
        </div>
      </div>

      {/* ROW 2 — Start time, End time, Duration */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start</Label>
          <Input type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })} className="min-h-[40px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End</Label>
          <Input type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.target.value })} className="min-h-[40px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">&nbsp;</Label>
          <div className={`flex min-h-[40px] items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm font-medium ${draft.durationHours <= 13 ? "text-green-600" : "text-destructive"}`}>
            <Clock className="h-4 w-4" /> {draft.durationHours}h
          </div>
        </div>
      </div>

      {/* ROW 3 — Day toggles */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days</Label>
        <div className="flex flex-wrap gap-2">
          {DAY_KEYS.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleDay(k)}
              className={`h-9 w-9 rounded-full text-[11px] font-bold transition-colors ${
                draft.applicableDays[k]
                  ? 'bg-purple-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {DAY_SHORT_LABELS[i][0]}
            </button>
          ))}
        </div>
      </div>

      {/* ROW 4 — On-call + Non-resident inline toggle chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => update({ isOncall: !draft.isOncall, oncallManuallySet: true })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            draft.isOncall
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          📟 On-call {draft.isOncall ? '✓' : '✗'}
        </button>
        <button
          type="button"
          onClick={() => update({ isNonRes: !draft.isNonRes })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            draft.isNonRes
              ? 'border-teal-700 bg-teal-700 text-white'
              : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          🏠 Non-resident {draft.isNonRes ? '✓' : '✗'}
        </button>
      </div>

      {/* ROW 5 — Badges */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Badges</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Auto-detected · click to override · ✏️ = manually set</p>
        <div className="flex flex-wrap gap-1.5">
          {BADGE_DEFS.map(({ key, label, emoji, activeClasses }) => {
            const auto = detectBadges(draft.startTime, draft.endTime, draft.applicableDays, draft.isOncall, draft.isNonRes);
            const effective = mergedBadges(auto, draft.badgeOverrides);
            const isActive = effective[key];
            const isOverridden = draft.badgeOverrides[key] !== undefined;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleBadge(key)}
                title={isOverridden ? `${label} (manually overridden — click to reset to auto)` : `${label} (auto-detected)`}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 ${
                  isActive ? activeClasses : 'bg-muted text-muted-foreground/50 line-through'
                }`}
              >
                {emoji} {label}{isOverridden ? ' ✏️' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* ROW 6 — Staffing */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staffing</Label>
          <p className="mt-1 text-xs text-muted-foreground">Set the hard minimum, preferred target, and optional maximum for this shift.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Minimum</Label>
            <Input
              type="number"
              min={1}
              value={draft.staffing.min}
              className="min-h-[44px]"
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                const newTarget = Math.max(val, draft.staffing.target);
                const newMax = draft.staffing.max !== null ? Math.max(newTarget, draft.staffing.max) : null;
                update({ staffing: { min: val, target: newTarget, max: newMax } });
              }}
            />
            <p className="text-xs text-muted-foreground">Below this = invalid</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target</Label>
            <Input
              type="number"
              min={draft.staffing.min}
              value={draft.staffing.target}
              className="min-h-[44px]"
              onChange={(e) => {
                const val = Math.max(draft.staffing.min, parseInt(e.target.value) || draft.staffing.min);
                const newMax = draft.staffing.max !== null ? Math.max(val, draft.staffing.max) : null;
                update({ staffing: { ...draft.staffing, target: val, max: newMax } });
              }}
            />
            <p className="text-xs text-muted-foreground">Algorithm targets this</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Maximum (optional)</Label>
            <Input
              type="number"
              min={draft.staffing.target}
              value={draft.staffing.max ?? ""}
              className="min-h-[44px]"
              onChange={(e) => {
                const raw = e.target.value;
                update({ staffing: { ...draft.staffing, max: raw === "" ? null : Math.max(draft.staffing.target, parseInt(raw) || draft.staffing.target) } });
              }}
            />
            <p className="text-xs text-muted-foreground">Optional — leave blank for no maximum</p>
          </div>
        </div>
      </div>

      {/* ROW 7 — Competency Requirements */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Competency Requirements</Label>
          <p className="mt-1 text-xs text-muted-foreground">Minimum number of doctors with each competency required on this shift.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { key: "reqIac" as const,      label: "Min IAC",      desc: "Independent anaesthesia" },
            { key: "reqIaoc" as const,     label: "Min IAOC",     desc: "Obstetric anaesthesia" },
            { key: "reqIcu" as const,      label: "Min ICU",      desc: "Intensive care" },
            { key: "reqTransfer" as const, label: "Min Transfer", desc: "Transfer-trained" },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="space-y-1.5 rounded-lg border border-border p-3">
              <Label className="text-xs font-medium">{label}</Label>
              <Input type="number" min={0} value={draft[key]} className="min-h-[44px]" onChange={(e) => update({ [key]: Math.max(0, parseInt(e.target.value) || 0) } as any)} />
              <p className="text-[11px] text-muted-foreground">{desc}</p>
              {draft[key] > draft.staffing.min && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Exceeds minimum staffing
                </p>
              )}
            </div>
          ))}
        </div>
        {(() => {
          const compSum = draft.reqIac + draft.reqIaoc + draft.reqIcu + draft.reqTransfer;
          if (compSum > draft.staffing.min) {
            return (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Total competency requirements ({compSum}) exceed minimum staffing ({draft.staffing.min}). Some doctors would need multiple competencies.</span>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* ROW 8 — Grade requirement */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Min Grade Required</Label>
        <Select value={draft.reqMinGrade ?? "__none__"} onValueChange={(v) => update({ reqMinGrade: v === "__none__" ? null : v })}>
          <SelectTrigger className="min-h-[44px] w-full">
            <SelectValue placeholder="No requirement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— No requirement —</SelectItem>
            <SelectItem value="CT1">CT1+</SelectItem>
            <SelectItem value="CT2">CT2+</SelectItem>
            <SelectItem value="CT3">CT3+</SelectItem>
            <SelectItem value="ST4">ST4+</SelectItem>
            <SelectItem value="ST5">ST5+</SelectItem>
            <SelectItem value="ST7">ST7+</SelectItem>
            <SelectItem value="Consultant">Consultant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ROW 9 — Validation errors */}
      {getShiftErrors(draft, allShifts).length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          {getShiftErrors(draft, allShifts).map((err) => (
            <p key={err} className="text-sm text-destructive">
              • {err}
            </p>
          ))}
        </div>
      )}

      {/* ROW 10 — Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {canRemove ? (
          !confirmDelete ? (
            <Button variant="ghost" size="sm" className="min-h-[44px] text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">Remove this shift?</span>
              <Button variant="destructive" size="sm" className="min-h-[36px]" onClick={onRemove}>Yes, remove</Button>
              <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button variant="outline" className="min-h-[44px]" onClick={() => onCancel(initialShiftRef.current)}>
            Cancel
          </Button>
          <Button
            className="min-h-[44px] bg-purple-600 text-white hover:bg-purple-700"
            disabled={getShiftErrors(draft, allShifts).length > 0}
            onClick={() => onSave(draft)}
          >
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── CollapsedCard ─── */

function CollapsedCard({
  shift,
  index,
  onExpand,
  onRemove,
  canRemove,
}: {
  shift: ShiftType;
  index: number;
  onExpand: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { min, target, max } = shift.staffing;
  const staffingSummary = max !== null ? `Min ${min} · Target ${target} · Max ${max}` : `Exactly ${min} doctor${min !== 1 ? "s" : ""} per day`;
  const auto = detectBadges(shift.startTime, shift.endTime, shift.applicableDays, shift.isOncall, shift.isNonRes);
  const effective = mergedBadges(auto, shift.badgeOverrides);

  return (
    <div
      onClick={onExpand}
      className="cursor-pointer space-y-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md"
      style={{ borderLeft: '4px solid ' + getShiftColor(index).solid }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold tracking-widest border ${getShiftColor(index).bg} ${getShiftColor(index).text} ${getShiftColor(index).border}`}>{shift.abbreviation}</span>
            <h3 className="truncate text-sm font-semibold text-card-foreground">{shift.name}</h3>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)} <span className={shift.durationHours <= 13 ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>({shift.durationHours}h)</span>
          </p>
          <p className="text-xs text-muted-foreground">{staffingSummary}</p>
          <p className="text-xs font-medium tracking-widest text-muted-foreground">
            {DAY_KEYS.map((k, i) => (
              <span key={k} className={shift.applicableDays[k] ? "text-card-foreground" : "opacity-20"}>{DAY_SHORT_LABELS[i][0]}</span>
            ))}
          </p>
          <div className="flex flex-wrap gap-1">
            {BADGE_DEFS.map(({ key, emoji, activeClasses }) => {
              const isActive = effective[key];
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? activeClasses : "bg-muted text-muted-foreground/40 line-through"
                  }`}
                >
                  {emoji}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canRemove && (
            !confirmDelete ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-medium text-destructive">Remove?</span>
                <button type="button" onClick={() => onRemove()} className="text-xs font-bold text-destructive underline underline-offset-2">Yes</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground underline underline-offset-2">No</button>
              </div>
            )
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-purple-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function DepartmentStep2() {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [openChipKey, setOpenChipKey] = useState<string | null>(null);
  const [addShiftDialogOpen, setAddShiftDialogOpen] = useState(false);
  const [badgeMeaningsOpen, setBadgeMeaningsOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);

  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<DayKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 12 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedShiftId(event.active.id as string);
    setIsDragging(true);
    setOpenChipKey(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const over = event.over;
    if (over && DAY_KEYS.includes(over.id as DayKey)) {
      setDragOverDay(over.id as DayKey);
    } else {
      setDragOverDay(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedShiftId(null);
    setDragOverDay(null);
    setIsDragging(false);
    if (!over) return;
    const shiftId = active.id as string;
    const dayKey = over.id as DayKey;
    if (!DAY_KEYS.includes(dayKey)) return;
    setShifts(prev => prev.map(s => {
      if (s.id !== shiftId) return s;
      if (s.applicableDays[dayKey]) return s;
      return { ...s, applicableDays: { ...s.applicableDays, [dayKey]: true } };
    }));
  };

  const { shifts, setShifts, removeShift, expandedShiftId, setExpandedShiftId, isLoadingShifts, globalOncallPct, shiftTargetOverrides } = useDepartmentSetup();
  const { setDepartmentComplete } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  const removeShiftFromDay = useCallback((shiftId: string, dayKey: DayKey) => {
    setShifts(prev => prev.map(s => {
      if (s.id !== shiftId) return s;
      const newDays = { ...s.applicableDays, [dayKey]: false };
      if (!Object.values(newDays).some(Boolean)) return s;
      return { ...s, applicableDays: newDays };
    }));
  }, [setShifts]);

  const handleSaveCard = (updated: ShiftType) => {
    setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
    setExpandedShiftId(null);
  };

  const handleAddTemplate = (template: ShiftTemplate, days: Record<DayKey, boolean>) => {
    const id = String(Date.now());
    const dur = calcDurationHours(template.start, template.end);
    const autoBadges = detectBadges(template.start, template.end, days as ApplicableDays, template.isOncall, false);
    const newShift: ShiftType = {
      id,
      name: template.label,
      abbreviation: template.abbrev,
      startTime: template.start,
      endTime: template.end,
      durationHours: dur,
      applicableDays: days as ApplicableDays,
      isOncall: template.isOncall,
      isNonRes: false,
      staffing: { min: 1, target: 1, max: null },
      targetOverridePct: null,
      badges: autoBadges,
      badgeOverrides: {},
      oncallManuallySet: false,
      reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0, reqMinGrade: null,
      daySlots: [],
    };
    setShifts(prev => [...prev, newShift]);
    setExpandedShiftId(id);
    setAddShiftDialogOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`shift-card-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleAddCustom = (days: Record<DayKey, boolean>) => {
    const id = String(Date.now());
    const newShift: ShiftType = {
      id,
      name: "New Shift",
      abbreviation: "NS",
      startTime: "09:00",
      endTime: "17:00",
      durationHours: 8,
      applicableDays: days as ApplicableDays,
      isOncall: false,
      isNonRes: false,
      staffing: { min: 1, target: 1, max: null },
      targetOverridePct: null,
      badges: detectBadges("09:00", "17:00", days as ApplicableDays, false, false),
      badgeOverrides: {},
      oncallManuallySet: false,
      reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0, reqMinGrade: null,
      daySlots: [],
    };
    setShifts(prev => [...prev, newShift]);
    setExpandedShiftId(id);
    setAddShiftDialogOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`shift-card-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const pageErrors = shifts.flatMap((shift) => getShiftErrors(shift, shifts).map((error) => `${shift.name || shift.abbreviation || shift.id}: ${error}`));
  const canSavePage = shifts.length > 0 && pageErrors.length === 0 && !saving;

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      if (!user?.id) throw new Error("You must be signed in to save.");

      const nonOncallPct = 100 - globalOncallPct;
      let configId = currentRotaConfigId;

      if (!configId) {
        const { data, error } = await supabase
          .from("rota_configs")
          .insert({ global_oncall_pct: globalOncallPct, global_non_oncall_pct: nonOncallPct, owned_by: user?.id })
          .select("id").single();
        if (error) throw error;
        configId = data.id;
        setCurrentRotaConfigId(configId);
      } else {
        const { error } = await supabase
          .from("rota_configs")
          .update({ global_oncall_pct: globalOncallPct, global_non_oncall_pct: nonOncallPct, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      }

      // Fetch existing shift_types to preserve target_percentage
      const { data: existingShifts } = await supabase
        .from("shift_types")
        .select("shift_key, target_percentage")
        .eq("rota_config_id", configId);
      const existingPctMap: Record<string, number | null> = {};
      (existingShifts ?? []).forEach((row: any) => {
        existingPctMap[row.shift_key] = row.target_percentage;
      });

      // Delete shifts that no longer exist
      const currentShiftKeys = shifts.map(s => s.id);
      const existingKeys = (existingShifts ?? []).map((r: any) => r.shift_key as string);
      const keysToRemove = existingKeys.filter(k => !currentShiftKeys.includes(k));
      if (keysToRemove.length > 0) {
        for (const key of keysToRemove) {
          await supabase.from("shift_types").delete()
            .eq("rota_config_id", configId)
            .eq("shift_key", key);
        }
      }

      const shiftRows = shifts.map((s, idx) => {
        const merged = { ...s.badges };
        for (const key of Object.keys(s.badgeOverrides) as BadgeKey[]) {
          if (s.badgeOverrides[key] !== undefined) merged[key] = s.badgeOverrides[key]!;
        }
        return {
          rota_config_id: configId!,
          shift_key: s.id,
          name: s.name,
          start_time: s.startTime,
          end_time: s.endTime,
          duration_hours: s.durationHours,
          is_oncall: s.isOncall,
          is_non_res_oncall: s.isNonRes,
          applicable_mon: s.applicableDays.mon,
          applicable_tue: s.applicableDays.tue,
          applicable_wed: s.applicableDays.wed,
          applicable_thu: s.applicableDays.thu,
          applicable_fri: s.applicableDays.fri,
          applicable_sat: s.applicableDays.sat,
          applicable_sun: s.applicableDays.sun,
          badge_night: merged.night,
          badge_long: merged.long,
          badge_ooh: merged.ooh,
          badge_oncall: merged.oncall,
          badge_nonres: merged.nonres,
          badge_night_manual_override: s.badgeOverrides.night ?? null,
          badge_long_manual_override: s.badgeOverrides.long ?? null,
          badge_ooh_manual_override: s.badgeOverrides.ooh ?? null,
          badge_oncall_manual_override: s.badgeOverrides.oncall ?? null,
          badge_nonres_manual_override: s.badgeOverrides.nonres ?? null,
          oncall_manually_set: s.oncallManuallySet,
          min_doctors: s.staffing.min,
          target_doctors: s.staffing.target,
          max_doctors: s.staffing.max,
          target_percentage: existingPctMap[s.id] ?? null,
          sort_order: idx,
          req_iac: s.reqIac,
          req_iaoc: s.reqIaoc,
          req_icu: s.reqIcu,
          req_transfer: s.reqTransfer,
          req_min_grade: s.reqMinGrade,
          abbreviation: s.abbreviation,
        };
      });

      // Upsert by rota_config_id + shift_key to preserve target_percentage
      for (const row of shiftRows) {
        const isExisting = existingKeys.includes(row.shift_key);
        if (isExisting) {
          const { target_percentage, rota_config_id, shift_key, ...updateFields } = row;
          const { error } = await supabase.from("shift_types")
            .update({ ...updateFields, target_percentage, updated_at: new Date().toISOString() })
            .eq("rota_config_id", configId)
            .eq("shift_key", shift_key);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("shift_types").insert(row as any);
          if (error) throw error;
        }
      }

      toast.success("✓ Shift configuration saved");
      navigate("/admin/department/step-3");
    } catch (err: any) {
      console.error("Department save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Department Setup" subtitle="Step 2 of 3 — Shift design" accentColor="purple" pageIcon={Building2}
      navBar={
        <StepNavBar
          left={
            <Button variant="outline" size="lg" className="min-h-[44px]" onClick={() => navigate("/admin/department/step-1")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          }
          right={
            <Button size="lg" className="min-h-[44px] bg-purple-600 text-white hover:bg-purple-700" disabled={!canSavePage} onClick={handleSaveAndContinue}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <>Continue <ChevronRight className="ml-2 h-4 w-4" /></>}
            </Button>
          }
        />
      }
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp" onClick={() => { if (!isDragging) setOpenChipKey(null); }}>

          {/* Design Your Week Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                Design Your Week
              </CardTitle>
              <CardDescription>
                Drag shift chips onto day columns to assign them. Tap any chip to adjust staffing or remove it from a day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Palette row */}
              <div className="flex flex-wrap gap-2 pb-2">
                <span className="flex items-center text-[10px] font-medium text-muted-foreground mr-1">Drag onto columns →</span>
                {shifts.map((shift, index) => (
                  <DraggableShiftChip key={shift.id} shift={shift} index={index} />
                ))}
                <button
                  type="button"
                  onClick={() => setAddShiftDialogOpen(true)}
                  className="inline-flex min-h-[32px] flex-shrink-0 items-center gap-1 rounded-full border border-dashed border-purple-300 px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 active:bg-purple-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add shift
                </button>
              </div>

              <hr className="border-border" />

              {isLoadingShifts ? (
                <div className="flex min-h-[200px] items-center justify-center gap-3 rounded-xl border border-border bg-muted/20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading shift types…</span>
                </div>
              ) : (
                <>
                  {/* Mobile snap-scroll */}
                  <div
                    ref={scrollContainerRef}
                    className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const colWidth = el.scrollWidth / 7;
                      setActiveDayIndex(Math.min(6, Math.max(0, Math.round(el.scrollLeft / colWidth))));
                    }}
                    style={{
                      scrollbarWidth: 'none',
                      overscrollBehavior: 'contain',
                      touchAction: isDragging ? 'none' : 'pan-x',
                    } as React.CSSProperties}
                  >
                    {DAY_KEYS.map((dayKey, i) => (
                      <div
                        key={dayKey}
                        className={`snap-start ${
                          i >= 5 ? 'border-t-2 border-t-purple-400' : 'border-t-2 border-t-transparent'
                        }`}
                        style={{ minWidth: 'clamp(120px, calc((100vw - 3rem) / 2.3), 160px)' }}
                      >
                        <DayColumn
                          dayKey={dayKey}
                          dayLabel={DAY_FULL_LABELS[i]}
                          shifts={shifts}
                          isWeekend={i >= 5}
                          openChipKey={openChipKey}
                          setOpenChipKey={setOpenChipKey}
                          setShifts={setShifts}
                          removeShiftFromDay={removeShiftFromDay}
                          dragOverDay={dragOverDay}
                          setExpandedShiftId={setExpandedShiftId}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Mobile navigation row */}
                  <div className="flex items-center justify-center gap-2 md:hidden">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
                      disabled={activeDayIndex === 0}
                      onClick={() => {
                        const el = scrollContainerRef.current;
                        if (!el) return;
                        const colWidth = el.scrollWidth / 7;
                        const newIndex = Math.max(0, activeDayIndex - 1);
                        el.scrollTo({ left: newIndex * colWidth, behavior: 'smooth' });
                        setActiveDayIndex(newIndex);
                      }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    {DAY_KEYS.map((_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full transition-colors ${activeDayIndex === i ? "bg-purple-600" : "bg-purple-200"}`} />
                    ))}
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
                      disabled={activeDayIndex === 6}
                      onClick={() => {
                        const el = scrollContainerRef.current;
                        if (!el) return;
                        const colWidth = el.scrollWidth / 7;
                        const newIndex = Math.min(6, activeDayIndex + 1);
                        el.scrollTo({ left: newIndex * colWidth, behavior: 'smooth' });
                        setActiveDayIndex(newIndex);
                      }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-center text-[10px] text-muted-foreground md:hidden mt-1">Tap a chip to edit staffing or remove it</p>

                  {/* Desktop grid */}
                  <div className="hidden md:block">
                    {/* Section labels */}
                    <div className="grid grid-cols-7 gap-3 mb-1">
                      <div className="col-span-5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weekdays</span>
                        <hr className="mt-0.5 border-border" />
                      </div>
                      <div className="col-span-2">
                        <hr className="mt-0.5 border-purple-300" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Weekend</span>
                      </div>
                    </div>
                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-3">
                      {DAY_KEYS.map((dayKey, i) => (
                        <div key={dayKey} className={i === 5 ? "border-l-2 border-purple-200 pl-2" : ""}>
                          <DayColumn
                            dayKey={dayKey}
                            dayLabel={DAY_SHORT_LABELS[i]}
                            shifts={shifts}
                            isWeekend={i >= 5}
                            openChipKey={openChipKey}
                            setOpenChipKey={setOpenChipKey}
                            setShifts={setShifts}
                            removeShiftFromDay={removeShiftFromDay}
                            dragOverDay={dragOverDay}
                            setExpandedShiftId={setExpandedShiftId}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Shift Types Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                Shift Types
              </CardTitle>
              <CardDescription>Define each shift type. Changes to days sync instantly to the calendar above.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setBadgeMeaningsOpen(v => !v)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Badge meanings
                  </span>
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${badgeMeaningsOpen ? "rotate-90" : ""}`} />
                </button>
                {badgeMeaningsOpen && (
                  <div className="px-4 pb-3 pt-2 space-y-1 border-t border-border text-xs text-muted-foreground">
                    <p>🌙 <span className="font-semibold">NIGHT</span> — ≥3h between 23:00–06:00</p>
                    <p>⏱ <span className="font-semibold">LONG</span> — duration &gt;10h</p>
                    <p>🌆 <span className="font-semibold">OOH</span> — hours outside 07:00–19:00 or on weekends</p>
                    <p>📟 <span className="font-semibold">ON-CALL</span> — resident on-site</p>
                    <p>🏠 <span className="font-semibold">NON-RES OC</span> — on-call from home</p>
                  </div>
                )}
              </div>

              {pageErrors.length > 0 && (
                <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                  {pageErrors.map((error) => (
                    <p key={error} className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {shifts.map((shift, index) => (
                  <div key={shift.id} id={`shift-card-${shift.id}`}>
                    {expandedShiftId === shift.id ? (
                      <ExpandedCard
                        key={`${shift.id}-${Object.values(shift.applicableDays).join("")}-${shift.staffing.min}-${shift.staffing.target}-${shift.staffing.max ?? "x"}`}
                        shift={shift}
                        index={index}
                        allShifts={shifts}
                        onSave={handleSaveCard}
                        onCancel={(original) => {
                          setShifts(prev => prev.map(s => s.id === original.id ? original : s));
                          setExpandedShiftId(null);
                        }}
                        onDraftChange={(updated) => setShifts(prev => prev.map(s => s.id === updated.id ? updated : s))}
                        onRemove={() => { removeShift(shift.id); setExpandedShiftId(null); }}
                        canRemove={shifts.length > 1}
                      />
                    ) : (
                      <CollapsedCard
                        shift={shift}
                        index={index}
                        onExpand={() => setExpandedShiftId(shift.id)}
                        onRemove={() => removeShift(shift.id)}
                        canRemove={shifts.length > 1}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAddShiftDialogOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 p-3 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50 active:bg-purple-100"
              >
                <Plus className="h-4 w-4" /> Add shift type
              </button>
            </CardContent>
          </Card>

        </div>

        <AddShiftDialog
          open={addShiftDialogOpen}
          onOpenChange={setAddShiftDialogOpen}
          onAddTemplate={handleAddTemplate}
          onAddCustom={handleAddCustom}
        />

        <DragOverlay>
          {draggedShiftId ? (() => {
            const idx = shifts.findIndex(s => s.id === draggedShiftId);
            const shift = shifts[idx];
            if (!shift) return null;
            const color = getShiftColor(idx);
            return (
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-lg ${color.bg} ${color.text} ${color.border}`}>
                {shift.abbreviation}
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>
    </AdminLayout>
  );
}
