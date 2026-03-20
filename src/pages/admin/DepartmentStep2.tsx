import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Clock, Save, X, Info, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Loader2 } from "lucide-react";
import {
  useDepartmentSetup, detectBadges, mergedBadges,
  generateAbbreviation, getShiftColor,
  type ShiftType, type BadgeKey, type ShiftBadges,
} from "@/contexts/DepartmentSetupContext";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcDurationHours } from "@/lib/shiftUtils";
import type { ApplicableDays } from "@/lib/shiftUtils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_SHORT_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL_LABELS  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const BADGE_DEFS = [
  { key: "night"  as BadgeKey, label: "NIGHT",     emoji: "🌙", activeClasses: "bg-slate-800 text-white" },
  { key: "long"   as BadgeKey, label: "LONG",       emoji: "⏱",  activeClasses: "bg-amber-600 text-white" },
  { key: "ooh"    as BadgeKey, label: "OOH",        emoji: "🌆", activeClasses: "bg-indigo-600 text-white" },
  { key: "oncall" as BadgeKey, label: "ON-CALL",    emoji: "📟", activeClasses: "bg-emerald-700 text-white" },
  { key: "nonres" as BadgeKey, label: "NON-RES OC", emoji: "🏠", activeClasses: "bg-teal-700 text-white" },
] as const;

function getShiftErrors(shift: ShiftType): string[] {
  const errors: string[] = [];
  if (!shift.name.trim()) errors.push("Shift name is required.");
  if (!shift.abbreviation.trim()) errors.push("Abbreviation is required.");
  if (shift.abbreviation.trim().length > 4) errors.push("Abbreviation must be 4 characters or fewer.");
  if (shift.startTime === shift.endTime) errors.push("Start and end time cannot be the same.");
  if (!Object.values(shift.applicableDays).some(Boolean)) errors.push("At least one day must be selected.");
  if (shift.staffing.target < shift.staffing.min) errors.push("Target cannot be less than minimum.");
  if (shift.staffing.max !== null && shift.staffing.max < shift.staffing.target) errors.push("Maximum cannot be less than target.");
  return errors;
}

interface DayColumnProps {
  dayKey: DayKey;
  dayLabel: string;
  shifts: ShiftType[];
  isWeekend: boolean;
  activeChipId: string | null;
  setActiveChipId: (id: string | null) => void;
  longPressRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  removeShiftFromDay: (shiftId: string, dayKey: keyof ApplicableDays) => void;
  dragOverDay: DayKey | null;
  setExpandedShiftId: (id: string | null) => void;
}

function DayColumn({
  dayKey, dayLabel, shifts, isWeekend,
  activeChipId, setActiveChipId,
  longPressRef, removeShiftFromDay, dragOverDay,
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
      className={`rounded-xl border p-3 min-h-[200px] transition-all ${
        isDropTarget
          ? "ring-2 ring-purple-400 bg-purple-50/80 border-purple-300"
          : isWeekend
            ? "border-purple-200 bg-purple-50/60"
            : "border-border bg-card"
      }`}
    >
      <div className="mb-3 flex items-center justify-center">
        <h3 className={`text-sm font-semibold text-center ${isWeekend ? "text-purple-700" : "text-slate-600"}`}>
          {dayLabel}
        </h3>
      </div>

      {dayShifts.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
          Drop here
        </div>
      )}

      {dayShifts.map(({ shift, index }) => {
        const chipKey = `${shift.id}-${dayKey}`;
        const color = getShiftColor(index);
        const isActive = activeChipId === chipKey;
        const { min, max } = shift.staffing;
        const countLabel = max === null ? `×${min}` : `×${min}–${max}`;

        return (
          <div
            key={chipKey}
            className={`group relative flex min-h-[36px] items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold transition-all mb-2 ${isActive ? "ring-2 ring-purple-300 ring-offset-1" : ""}`}
            onTouchStart={() => { longPressRef.current = setTimeout(() => setActiveChipId(chipKey), 250); }}
            onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
            onTouchMove={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
          >
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest ${color.bg} ${color.text} ${color.border} border`}>
              {shift.abbreviation}
            </span>
            <span className="text-muted-foreground text-[11px]">{countLabel}</span>

            {/* Desktop: CSS group-hover — stays visible when moving cursor toward button */}
            <button
              type="button"
              className="ml-auto hidden md:inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
              onClick={(e) => {
                e.stopPropagation();
                removeShiftFromDay(shift.id, dayKey as keyof ApplicableDays);
              }}
              aria-label={`Remove ${shift.abbreviation} from ${dayLabel}`}
            >
              <X className="h-3 w-3" />
            </button>

            {/* Touch: long-press reveals edit + remove */}
            {isActive && (
              <div className="ml-auto flex items-center gap-1 md:hidden">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveChipId(null);
                    setExpandedShiftId(shift.id);
                    setTimeout(() => {
                      const el = document.getElementById(`shift-card-${shift.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }, 100);
                  }}
                  aria-label={`Edit ${shift.abbreviation}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeShiftFromDay(shift.id, dayKey as keyof ApplicableDays);
                    setActiveChipId(null);
                  }}
                  aria-label={`Remove ${shift.abbreviation} from ${dayLabel}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

function ExpandedCard({
  shift: originalShift,
  onSave,
  onCancel,
  onRemove,
  onDraftChange,
  canRemove,
  index,
}: {
  shift: ShiftType;
  onSave: (updated: ShiftType) => void;
  onCancel: (original: ShiftType) => void;
  onRemove: () => void;
  onDraftChange: (updated: ShiftType) => void;
  canRemove: boolean;
  index: number;
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
          <div className="flex min-h-[40px] items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
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

      {/* ROW 5 — Badges: flex-wrap, no horizontal scroll */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Badges (auto-detected · click to override)
        </Label>
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
        <p className="text-[10px] text-muted-foreground">⚡ = auto-detected · ✏️ = manually overridden · click any badge to toggle</p>
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
            <p className="text-xs text-muted-foreground">Rota invalid below this</p>
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
            <p className="text-xs text-muted-foreground">Algorithm aims for exactly this</p>
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
            <p className="text-xs text-muted-foreground">Leave blank = the algorithm allocates exactly {draft.staffing.min} doctor{draft.staffing.min !== 1 ? "s" : ""} — no more, no less. Set a number to allow a flexible range.</p>
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
      </div>

      {/* ROW 8 — Grade requirement */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Min grade required (optional)</Label>
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
      {getShiftErrors(draft).length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          {getShiftErrors(draft).map((err) => (
            <p key={err} className="text-sm text-destructive">
              • {err}
            </p>
          ))}
        </div>
      )}

      {/* ROW 10 — Actions: delete left, save/cancel right, single row */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {canRemove ? (
          <Button variant="ghost" size="sm" className="min-h-[44px] text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button variant="outline" className="min-h-[44px]" onClick={() => onCancel(initialShiftRef.current)}>
            Cancel
          </Button>
          <Button
            className="min-h-[44px] bg-purple-600 text-white hover:bg-purple-700"
            disabled={getShiftErrors(draft).length > 0}
            onClick={() => onSave(draft)}
          >
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

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
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-muted-foreground">{shift.abbreviation}</span>
            <h3 className="truncate text-sm font-semibold text-card-foreground">{shift.name}</h3>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {shift.startTime} – {shift.endTime} ({shift.durationHours}h)
          </p>
          <p className="text-xs text-muted-foreground">{staffingSummary}</p>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {DAY_KEYS.filter((k) => shift.applicableDays[k]).map((k) => DAY_SHORT_LABELS[DAY_KEYS.indexOf(k)]).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-1">
            {BADGE_DEFS.map(({ key, label, emoji, activeClasses }) => {
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
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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

export default function DepartmentStep2() {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeChipId, setActiveChipId] = useState<string | null>(null);
  const [badgeMeaningsOpen, setBadgeMeaningsOpen] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const SHIFT_TEMPLATES = [
    { label: "Standard Day", abbrev: "SD", start: "08:00", end: "17:30", isOncall: false },
    { label: "Long Day",     abbrev: "LD", start: "08:00", end: "20:30", isOncall: true  },
    { label: "Night",        abbrev: "N",  start: "20:00", end: "08:30", isOncall: true  },
    { label: "Twilight",     abbrev: "Tw", start: "16:00", end: "00:00", isOncall: true  },
  ] as const;
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const { shifts, setShifts, addShift, removeShift, expandedShiftId, setExpandedShiftId, isLoadingShifts, globalOncallPct, shiftTargetOverrides } = useDepartmentSetup();
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

  const pageErrors = shifts.flatMap((shift) => getShiftErrors(shift).map((error) => `${shift.name || shift.abbreviation || shift.id}: ${error}`));
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

      await supabase.from("shift_types").delete().eq("rota_config_id", configId);

      const oncallShiftIds = shifts.filter(s => s.isOncall).map(s => s.id);
      const nonOncallShiftIds = shifts.filter(s => !s.isOncall).map(s => s.id);
      const oncallOverrides: Record<string, number | undefined> = {};
      const nonOncallOverrides: Record<string, number | undefined> = {};
      Object.entries(shiftTargetOverrides).forEach(([id, pct]) => {
        if (oncallShiftIds.includes(id)) oncallOverrides[id] = pct;
        else nonOncallOverrides[id] = pct;
      });

      const getTargetPct = (shiftId: string, groupIds: string[], overrides: Record<string, number | undefined>) => {
        const overriddenTotal = groupIds.filter(id => overrides[id] !== undefined).reduce((sum, id) => sum + (overrides[id] ?? 0), 0);
        const nonOverriddenCount = groupIds.filter(id => overrides[id] === undefined).length;
        const remaining = Math.max(0, 100 - overriddenTotal);
        const autoShare = nonOverriddenCount > 0 ? remaining / nonOverriddenCount : 0;
        return overrides[shiftId] ?? autoShare;
      };

      const shiftRows = shifts.map((s, idx) => {
        const groupIds = s.isOncall ? oncallShiftIds : nonOncallShiftIds;
        const overrides = s.isOncall ? oncallOverrides : nonOncallOverrides;
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
          target_percentage: null,
          sort_order: idx,
          req_iac: s.reqIac,
          req_iaoc: s.reqIaoc,
          req_icu: s.reqIcu,
          req_transfer: s.reqTransfer,
          req_min_grade: s.reqMinGrade,
          abbreviation: s.abbreviation,
        };
      });

      const { error: insertError } = await supabase.from("shift_types").insert(shiftRows as any);
      if (insertError) throw insertError;

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
    <AdminLayout title="Department Setup" subtitle="Step 2 of 3 — Design your week" accentColor="purple">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp" onClick={() => { if (activeChipId && !draggedShiftId) setActiveChipId(null); }}>

          {/* Merged Calendar + Palette Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                Design Your Week
              </CardTitle>
              <CardDescription>Drag chips onto columns to assign shifts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Palette row */}
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                {shifts.map((shift, index) => (
                  <DraggableShiftChip key={shift.id} shift={shift} index={index} />
                ))}
                <button
                  type="button"
                  onClick={() => { setShowTemplatePicker(true); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 150); }}
                  className="inline-flex min-h-[32px] flex-shrink-0 items-center gap-1 rounded-full border border-dashed border-purple-300 px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add shift type
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
                      setActiveDayIndex(Math.min(6, Math.max(0, Math.round(el.scrollLeft / 140))));
                    }}
                    style={{ scrollbarWidth: 'none', overscrollBehavior: 'contain', touchAction: 'pan-x pan-y' } as React.CSSProperties}
                  >
                    {DAY_KEYS.map((dayKey, i) => (
                      <div key={dayKey} className={`min-w-[132px] snap-start ${i >= 5 ? 'border-t-2 border-t-purple-400' : 'border-t-2 border-t-border'}`}>
                        <DayColumn
                          dayKey={dayKey}
                          dayLabel={DAY_FULL_LABELS[i]}
                          shifts={shifts}
                          isWeekend={i >= 5}
                          activeChipId={activeChipId} setActiveChipId={setActiveChipId}
                          longPressRef={longPressRef} removeShiftFromDay={removeShiftFromDay}
                          dragOverDay={dragOverDay}
                          setExpandedShiftId={setExpandedShiftId}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Dot indicator */}
                  <div className="flex justify-center gap-1 md:hidden">
                    {DAY_KEYS.map((_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full transition-colors ${activeDayIndex === i ? "bg-purple-600" : "bg-purple-200"}`} />
                    ))}
                  </div>

                  <p className="text-center text-[10px] text-muted-foreground md:hidden mt-1">Hold a chip in a column to edit or remove it</p>

                  {/* Desktop grid */}
                  <div className="hidden grid-cols-7 gap-3 md:grid">
                    {DAY_KEYS.map((dayKey, i) => (
                      <DayColumn
                        key={dayKey}
                        dayKey={dayKey}
                        dayLabel={DAY_SHORT_LABELS[i]}
                        shifts={shifts}
                        isWeekend={i >= 5}
                        activeChipId={activeChipId} setActiveChipId={setActiveChipId}
                        longPressRef={longPressRef} removeShiftFromDay={removeShiftFromDay}
                        dragOverDay={dragOverDay}
                        setExpandedShiftId={setExpandedShiftId}
                      />
                    ))}
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
              <CardDescription>Define each shift type. Days sync to the calendar above.</CardDescription>
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
                onClick={() => { const newId = addShift(); setExpandedShiftId(newId); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 150); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 p-3 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50"
              >
                <Plus className="h-4 w-4" /> Add shift type
              </button>
            </CardContent>
          </Card>

          <div className="flex flex-row justify-between gap-3">
            <Button variant="outline" size="lg" className="min-h-[44px]" onClick={() => navigate("/admin/department/step-1")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button size="lg" className="min-h-[44px] bg-purple-600 text-white hover:bg-purple-700" disabled={!canSavePage} onClick={handleSaveAndContinue}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <>Continue <ChevronRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
        </div>

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
