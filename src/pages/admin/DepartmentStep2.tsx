import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Clock, Save, Info, AlertTriangle,
  ArrowLeft, ArrowRight, CalendarDays, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Building2, Copy, Eye,
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
    closestCenter,
    type DragStartEvent, type DragEndEvent, type DragOverEvent,
  } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;


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
    <div className="inline-block">
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
        <div className="mt-1 w-56 rounded-lg border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Grade restriction
            </span>
            {restricted && (
              <button type="button" onClick={() => onChange([])}
                className="text-[10px] text-purple-600 hover:text-purple-800">
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {GRADE_OPTIONS.map((grade) => (
              <label key={grade} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                <Checkbox checked={permittedGrades.includes(grade)} onCheckedChange={() => toggle(grade)}
                  className="h-3.5 w-3.5"
                />
                {GRADE_DISPLAY_LABELS[grade] ?? grade}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            No grades selected = any grade eligible.
          </p>
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

/* ─── AddShiftModal ─── */

interface AddShiftModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (shift: ShiftType) => void;
}

function AddShiftModal({ open, onOpenChange, onConfirm }: AddShiftModalProps) {
  const [page, setPage]                 = useState<1 | 2 | 3>(1);
  const [name, setName]                 = useState("");
  const [abbrev, setAbbrev]             = useState("");
  const [abbrevManual, setAbbrevManual] = useState(false);
  const [startTime, setStartTime]       = useState("08:00");
  const [endTime, setEndTime]           = useState("17:30");
  const [isOncall, setIsOncall]         = useState(false);
  const [oncallManual, setOncallManual] = useState(false);
  const [badgeOverrides, setBadgeOverrides] = useState<Partial<Record<BadgeKey, boolean>>>({});
  const [selectedDays, setSelectedDays] = useState<Record<DayKey, boolean>>({
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
  });
  const [totalDoctors, setTotalDoctors] = useState(2);
  const [slots, setSlots]               = useState<SlotRequirement[]>([makeEmptySlot(0), makeEmptySlot(1)]);

  const duration   = calcDurationHours(startTime, endTime);
  const autoBadges = detectBadges(startTime, endTime, selectedDays as ApplicableDays, isOncall, false);
  const effBadges  = mergedBadges(autoBadges, badgeOverrides);

  const reset = () => {
    setPage(1); setName(""); setAbbrev(""); setAbbrevManual(false);
    setStartTime("08:00"); setEndTime("17:30");
    setIsOncall(false); setOncallManual(false); setBadgeOverrides({});
    setSelectedDays({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });
    setTotalDoctors(2); setSlots([makeEmptySlot(0), makeEmptySlot(1)]);
  };

  const close = () => { reset(); onOpenChange(false); };

  useEffect(() => {
    if (!abbrevManual && name.trim()) setAbbrev(generateAbbreviation(name));
  }, [name, abbrevManual]);

  useEffect(() => {
    if (!oncallManual) setIsOncall(autoBadges.night || autoBadges.long || autoBadges.ooh);
  }, [autoBadges.night, autoBadges.long, autoBadges.ooh, oncallManual]);

  useEffect(() => {
    setSlots((prev) => {
      if (totalDoctors > prev.length) {
        return [...prev, ...Array.from({ length: totalDoctors - prev.length }, (_, i) => makeEmptySlot(prev.length + i))];
      }
      return prev.slice(0, totalDoctors).map((s, i) => ({ ...s, slotIndex: i }));
    });
  }, [totalDoctors]);

  const applyTemplate = (t: typeof SHIFT_TEMPLATES[number]) => {
    setName(t.label); setAbbrev(t.abbrev); setAbbrevManual(true);
    setStartTime(t.start); setEndTime(t.end);
    setIsOncall(t.isOncall); setOncallManual(true); setBadgeOverrides({});
  };

  const toggleBadgeOverride = (key: BadgeKey) => {
    setBadgeOverrides((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) { delete next[key]; } else { next[key] = !autoBadges[key]; }
      return next;
    });
  };

  const toggleDay = (key: DayKey) => {
    setSelectedDays((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };

  const page1Valid = name.trim().length > 0 && abbrev.trim().length >= 1 && abbrev.trim().length <= 4 && startTime !== endTime;
  const page2Valid = Object.values(selectedDays).some(Boolean);

  const handleConfirm = () => {
    const id          = String(Date.now());
    const days        = selectedDays as ApplicableDays;
    const finalSlots  = slots.map((s, i) => ({ ...s, slotIndex: i }));
    const staffing: ShiftStaffing = { min: totalDoctors, target: totalDoctors, max: null };
    const finalBadges = mergedBadges(detectBadges(startTime, endTime, days, isOncall, false), badgeOverrides);
    const hasRestriction = finalSlots.some(slotHasRestrictions);
    const selectedDayKeys = DAY_KEYS.filter((k) => selectedDays[k]);
    const daySlots: DaySlot[] = selectedDayKeys.map((dayKey) => ({
      dayKey,
      staffing: { ...staffing },
      slots:    finalSlots,
      isCustomised: hasRestriction,
    }));

    const newShift: ShiftType = {
      id,
      name:              name.trim(),
      abbreviation:      abbrev.trim().toUpperCase(),
      startTime, endTime,
      durationHours:     duration,
      applicableDays:    days,
      isOncall,
      isNonRes:          false,
      staffing,
      targetOverridePct: null,
      badges:            finalBadges,
      badgeOverrides,
      oncallManuallySet: oncallManual,
      reqIac: 0, reqIaoc: 0, reqIcu: 0, reqTransfer: 0, reqMinGrade: null,
      daySlots,
    };
    onConfirm(newShift);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Shift Type — Step {page} of 3</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1.5 mb-4">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= page ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {page === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick templates</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHIFT_TEMPLATES.map((t) => (
                  <button key={t.abbrev} type="button" onClick={() => applyTemplate(t)}
                    className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent ${name === t.label ? "border-primary bg-accent" : "border-border"}`}>
                    <span className="font-mono text-sm font-bold text-primary">{t.abbrev}</span>
                    <span className="text-xs font-medium">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">{t.start}–{t.end}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Shift name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Day" className="min-h-[40px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Abbrev. *</Label>
                <Input value={abbrev} maxLength={4}
                  onChange={(e) => { setAbbrevManual(true); setAbbrev(e.target.value.toUpperCase()); }}
                  className="min-h-[40px] font-mono text-center" placeholder="SD" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="min-h-[40px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="min-h-[40px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">&nbsp;</Label>
                <div className={`flex min-h-[40px] items-center gap-1.5 rounded-md border bg-muted px-3 text-sm font-medium ${duration <= 13 ? "text-green-600" : "text-destructive"}`}>
                  <Clock className="h-3.5 w-3.5" />{duration}h
                </div>
              </div>
            </div>
            <button type="button"
              onClick={() => { setIsOncall((v) => !v); setOncallManual(true); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isOncall ? "border-emerald-700 bg-emerald-700 text-white" : "border-border bg-muted text-muted-foreground"}`}>
              📟 On-call {isOncall ? "✓" : "✗"}
            </button>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Badges <span className="font-normal normal-case">(auto · click to override)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_DEFS.map(({ key, label, emoji, activeClasses }) => (
                  <button key={key} type="button" onClick={() => toggleBadgeOverride(key)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${effBadges[key] ? activeClasses : "bg-muted text-muted-foreground/50 line-through"}`}>
                    {emoji} {label}{badgeOverrides[key] !== undefined ? " ✏️" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button disabled={!page1Valid} onClick={() => setPage(2)}>Next <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Which days does this shift run?</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_KEYS.map((key, i) => (
                  <button key={key} type="button" onClick={() => toggleDay(key)}
                    className={`flex flex-col items-center rounded-lg border py-2 text-[11px] font-semibold transition-colors ${
                      selectedDays[key]
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {DAY_SHORT[i]}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" className="text-xs text-primary hover:text-primary/80"
                  onClick={() => setSelectedDays({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false })}>
                  Weekdays only
                </button>
                <span className="text-muted-foreground">·</span>
                <button type="button" className="text-xs text-primary hover:text-primary/80"
                  onClick={() => setSelectedDays({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true })}>
                  All days
                </button>
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setPage(1)}><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back</Button>
              <Button disabled={!page2Valid} onClick={() => setPage(3)}>Next <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}

        {page === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Set defaults for this shift. These apply to all selected days. Override per day in the grid.</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctors per shift</Label>
              <div className="flex items-center gap-3">
                <button type="button" disabled={totalDoctors <= 1}
                  onClick={() => setTotalDoctors((v) => Math.max(1, v - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold hover:bg-muted disabled:opacity-30">−</button>
                <span className="w-8 text-center text-lg font-bold">{totalDoctors}</span>
                <button type="button" onClick={() => setTotalDoctors((v) => v + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold hover:bg-muted">+</button>
                <span className="text-xs text-muted-foreground">doctor{totalDoctors !== 1 ? "s" : ""} per shift</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eligibility per position</Label>
              <p className="text-[10px] text-muted-foreground">Optionally restrict each position by grade or competency.</p>
              {slots.map((slot, i) => (
                <SlotRowEditor key={i} slot={slot} slotNumber={i + 1}
                  onChange={(updated) => setSlots((prev) => prev.map((s, idx) => idx === i ? updated : s))} />
              ))}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setPage(2)}><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back</Button>
              <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={handleConfirm}>Add Shift</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── DaySlotModal ─── */

interface DaySlotModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shift: ShiftType | null;
  dayKey: DayKey | null;
  onSave:          (shiftId: string, dayKey: DayKey, updated: DaySlot) => void;
  onCopyToDays:    (shiftId: string, sourceDayKey: DayKey, targets: DayKey[], source: DaySlot) => void;
  onRemoveFromDay: (shiftId: string, dayKey: DayKey) => void;
  isReadOnly?: boolean;
}

function DaySlotModal({ open, onOpenChange, shift, dayKey, onSave, onCopyToDays, onRemoveFromDay, isReadOnly }: DaySlotModalProps) {
  const [draft, setDraft]         = useState<DaySlot | null>(null);
  const [showCopy, setShowCopy]   = useState(false);
  const [copyTargets, setCopyTargets] = useState<Record<DayKey, boolean>>({
    mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false,
  });

  useEffect(() => {
    if (!open || !shift || !dayKey) return;
    const existing = shift.daySlots.find((ds) => ds.dayKey === dayKey);
    setDraft(
      existing
        ? { ...existing, staffing: { ...existing.staffing }, slots: existing.slots.map((s) => ({ ...s })) }
        : makeDefaultDaySlot(dayKey, shift)
    );
    setShowCopy(false);
    setCopyTargets({ mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false });
  }, [open, shift?.id, dayKey]);

  if (!shift || !dayKey || !draft) return null;

  const dayIdx   = DAY_KEYS.indexOf(dayKey);
  const dayLabel = DAY_FULL[dayIdx] ?? dayKey;

  const displaySlots: SlotRequirement[] = Array.from(
    { length: Math.max(draft.staffing.target, draft.slots.length) },
    (_, i) => draft.slots[i] ?? makeEmptySlot(i)
  );

  const syncCount = (n: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const cur = prev.slots;
      const next = n > cur.length
        ? [...cur, ...Array.from({ length: n - cur.length }, (_, i) => makeEmptySlot(cur.length + i))]
        : cur.slice(0, n).map((s, i) => ({ ...s, slotIndex: i }));
      return { ...prev, staffing: { ...prev.staffing, min: n, target: n }, slots: next };
    });
  };

  const handleSlotChange = (i: number, updated: SlotRequirement) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const grown = Array.from(
        { length: Math.max(prev.staffing.target, prev.slots.length, i + 1) },
        (_, idx) => prev.slots[idx] ?? makeEmptySlot(idx)
      );
      grown[i] = updated;
      return { ...prev, slots: grown };
    });
  };

  const saveAndClose = () => {
    if (!draft) return;
    const hasAnyRestriction = draft.slots.some(slotHasRestrictions);
    const slotsToSave = hasAnyRestriction ? draft.slots : [];
    const finalDraft: DaySlot = {
      ...draft,
      slots: slotsToSave,
      isCustomised: computeIsCustomised({ ...draft, slots: slotsToSave }, shift),
    };
    onSave(shift.id, dayKey, finalDraft);
    onOpenChange(false);
  };

  const copyAndClose = () => {
    const targets = DAY_KEYS.filter((k) => copyTargets[k] && k !== dayKey);
    if (targets.length === 0) return;
    onCopyToDays(shift.id, dayKey, targets, { ...draft, isCustomised: computeIsCustomised(draft, shift) });
    onOpenChange(false);
  };

  const removeAndClose = () => { onRemoveFromDay(shift.id, dayKey); onOpenChange(false); };
  const isDefault = !computeIsCustomised(draft, shift);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col p-0" style={{ maxHeight: "min(85vh, 620px)" }}>

        {/* Fixed header */}
        <div className="shrink-0 border-b px-5 py-4">
          <DialogHeader>
            <DialogTitle>{shift.name} — {dayLabel}</DialogTitle>
          </DialogHeader>
          <div className="mt-1 flex items-center text-xs text-muted-foreground">
            <span>
              Defaults: {shift.staffing.target} doctor{shift.staffing.target !== 1 ? "s" : ""} · {shift.startTime}–{shift.endTime} · {shift.durationHours}h
            </span>
            {!isDefault && (
              <button type="button" onClick={() => setDraft(makeDefaultDaySlot(dayKey, shift))}
                className="ml-3 shrink-0 text-purple-600 hover:text-purple-800">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body — two columns */}
        <div className="flex min-h-0 flex-1 divide-x divide-border overflow-hidden">

          {/* Left column: doctors stepper + copy */}
          <div className={`flex w-[200px] shrink-0 flex-col gap-4 overflow-y-auto p-4 ${isReadOnly ? "pointer-events-none opacity-60" : ""}`}>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Doctors
              </Label>
              <div className="flex items-center gap-3">
                <button type="button" disabled={isReadOnly || draft.staffing.target <= 1}
                  onClick={() => syncCount(Math.max(1, draft.staffing.target - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold hover:bg-muted disabled:opacity-30">
                  −
                </button>
                <span className="w-8 text-center text-lg font-bold">{draft.staffing.target}</span>
                <button type="button" disabled={isReadOnly} onClick={() => syncCount(draft.staffing.target + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold hover:bg-muted">
                  +
                </button>
              </div>
            </div>

            {!isReadOnly && (
            <div className="space-y-2">
              <button type="button" onClick={() => setShowCopy((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800">
                <Copy className="h-3.5 w-3.5" /> Copy to days…
              </button>
              {showCopy && (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1">
                    {DAY_KEYS.map((k, i) => {
                      const isSelf = k === dayKey;
                      return (
                        <button key={k} type="button" disabled={isSelf}
                          onClick={() => setCopyTargets((prev) => ({ ...prev, [k]: !prev[k] }))}
                          className={`rounded border py-1 text-[10px] font-semibold transition-colors ${
                            isSelf
                              ? "border-purple-200 bg-purple-100 text-purple-400 cursor-default"
                              : copyTargets[k]
                                ? "border-purple-400 bg-purple-600 text-white"
                                : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}>
                          {DAY_SHORT[i]}
                        </button>
                      );
                    })}
                  </div>
                  <Button size="sm"
                    disabled={!DAY_KEYS.some((k) => copyTargets[k] && k !== dayKey)}
                    onClick={copyAndClose}
                    className="w-full h-7 text-xs bg-purple-600 text-white hover:bg-purple-700">
                    Copy
                  </Button>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Right column: slot rows (scrollable) */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Eligibility per position
              </Label>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Restrict each position by grade or competency. Leave blank for no restriction.
              </p>
            </div>
            <div className="space-y-2">
              {displaySlots.map((slot, i) => (
                <SlotRowEditor key={i} slot={slot} slotNumber={i + 1}
                  onChange={(updated) => handleSlotChange(i, updated)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex shrink-0 items-center justify-between border-t px-5 py-3">
          <button type="button" onClick={removeAndClose}
            className="text-xs font-medium text-destructive hover:text-destructive/80">
            Remove from {DAY_SHORT[dayIdx]}
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={saveAndClose}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

/* ─── ShiftIdentityCard ─── */
function ShiftIdentityCard({
  shift, index, expanded, onToggleExpand, onSave, onRemove, canRemove, allShifts,
}: {
  shift: ShiftType; index: number; expanded: boolean;
  onToggleExpand: () => void; onSave: (u: ShiftType) => void;
  onRemove: () => void; canRemove: boolean; allShifts: ShiftType[];
}) {
  const color = getShiftColor(index);
  const [draft, setDraft] = useState<ShiftType>({ ...shift, badgeOverrides: { ...shift.badgeOverrides } });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (expanded) {
      setDraft({ ...shift, badgeOverrides: { ...shift.badgeOverrides } });
      setConfirmDelete(false);
    }
  }, [expanded]);

  const recalc = (d: ShiftType): ShiftType => {
    const dur = calcDurationHours(d.startTime, d.endTime);
    const auto = detectBadges(d.startTime, d.endTime, d.applicableDays, d.isOncall, d.isNonRes);
    const resolvedOncall = d.oncallManuallySet ? d.isOncall : (auto.night || auto.long || auto.ooh);
    const finalAuto = detectBadges(d.startTime, d.endTime, d.applicableDays, resolvedOncall, d.isNonRes);
    return { ...d, durationHours: dur, isOncall: resolvedOncall, badges: mergedBadges(finalAuto, d.badgeOverrides) };
  };

  const upd = (patch: Partial<ShiftType>) => setDraft((prev) => recalc({ ...prev, ...patch }));

  const toggleBadge = (key: BadgeKey) => {
    const auto = detectBadges(draft.startTime, draft.endTime, draft.applicableDays, draft.isOncall, draft.isNonRes);
    const next = { ...draft.badgeOverrides };
    if (next[key] !== undefined) { delete next[key]; } else { next[key] = !auto[key]; }
    upd({ badgeOverrides: next });
  };

  const errors = getShiftIdentityErrors(draft, allShifts);

  if (!expanded) {
    return (
      <div
        className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md"
        style={{ borderLeft: `4px solid ${color.solid}` }}
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 font-mono text-xs font-bold tracking-widest ${color.bg} ${color.text} ${color.border}`}>
                {shift.abbreviation}
              </span>
              <h3 className="truncate text-sm font-semibold">{shift.name}</h3>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />{shift.startTime}–{shift.endTime} · {shift.durationHours}h
            </p>
            <div className="flex flex-wrap gap-1">
              {BADGE_DEFS.filter(({ key }) => shift.badges[key]).map(({ key, emoji, label }) => (
                <span key={key} className="text-[10px] text-muted-foreground">{emoji} {label}</span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{shift.daySlots.length}d · {shift.staffing.target} drs</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border-2 border-purple-200 bg-card p-5 shadow-md" style={{ borderLeft: `4px solid ${color.solid}` }}>
      {/* Collapse header */}
      <div className="flex cursor-pointer items-center justify-between" onClick={onToggleExpand}>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 font-mono text-xs font-bold tracking-widest ${color.bg} ${color.text} ${color.border}`}>
            {draft.abbreviation || shift.abbreviation}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">{draft.name || shift.name}</span>
        </div>
        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Shift name</Label>
          <Input value={draft.name} onChange={(e) => upd({ name: e.target.value })} className="min-h-[40px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Abbrev.</Label>
          <Input value={draft.abbreviation} maxLength={4} onChange={(e) => upd({ abbreviation: e.target.value.toUpperCase() })} className="min-h-[40px] font-mono text-center" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Start</Label>
          <Input type="time" value={draft.startTime} onChange={(e) => upd({ startTime: e.target.value })} className="min-h-[40px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End</Label>
          <Input type="time" value={draft.endTime} onChange={(e) => upd({ endTime: e.target.value })} className="min-h-[40px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">&nbsp;</Label>
          <div className={`flex min-h-[40px] items-center gap-1.5 rounded-md border bg-muted px-3 text-sm font-medium ${draft.durationHours <= 13 ? "text-green-600" : "text-destructive"}`}>
            <Clock className="h-3.5 w-3.5" />{draft.durationHours}h
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => upd({ isOncall: !draft.isOncall, oncallManuallySet: true })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${draft.isOncall ? "border-emerald-700 bg-emerald-700 text-white" : "border-border bg-muted text-muted-foreground"}`}>
          📟 On-call {draft.isOncall ? "✓" : "✗"}
        </button>
        <button type="button" onClick={() => upd({ isNonRes: !draft.isNonRes })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${draft.isNonRes ? "border-teal-700 bg-teal-700 text-white" : "border-border bg-muted text-muted-foreground"}`}>
          🏠 Non-resident {draft.isNonRes ? "✓" : "✗"}
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Badges <span className="font-normal normal-case">(auto · click to override · ✏️ = manual)</span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {BADGE_DEFS.map(({ key, label, emoji, activeClasses }) => {
            const auto = detectBadges(draft.startTime, draft.endTime, draft.applicableDays, draft.isOncall, draft.isNonRes);
            const eff = mergedBadges(auto, draft.badgeOverrides);
            return (
              <button key={key} type="button" onClick={() => toggleBadge(key)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${eff[key] ? activeClasses : "bg-muted text-muted-foreground/50 line-through"}`}>
                {emoji} {label}{draft.badgeOverrides[key] !== undefined ? " ✏️" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Default staffing: {shift.staffing.target} doctor{shift.staffing.target !== 1 ? "s" : ""} · Active on {shift.daySlots.length} day{shift.daySlots.length !== 1 ? "s" : ""}. Configure staffing and eligibility per day in the grid above.
      </div>

      {errors.length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          {errors.map((e) => (
            <p key={e} className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {e}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        {canRemove
          ? !confirmDelete
            ? <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80">
                <Trash2 className="h-3.5 w-3.5" /> Delete shift
              </button>
            : <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-destructive">Remove?</span>
                <Button variant="destructive" size="sm" onClick={onRemove}>Yes</Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
              </div>
          : <div />
        }
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToggleExpand}>Cancel</Button>
          <Button size="sm" className="bg-purple-600 text-white hover:bg-purple-700"
            disabled={errors.length > 0}
            onClick={() => { onSave(draft); onToggleExpand(); }}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── DraggableShiftChipNew ─── */
function DraggableShiftChipNew({ shift, index }: { shift: ShiftType; index: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: shift.id });
  const color = getShiftColor(index);
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`flex shrink-0 cursor-grab items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity ${color.bg} ${color.text} ${color.border} ${isDragging ? "opacity-0 pointer-events-none" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), touchAction: 'none' }}>
      <span className="font-mono font-bold tracking-widest">{shift.abbreviation}</span>
    </div>
  );
}

/* ─── DayColumnNew ─── */
function DayColumnNew({
  dayKey, dayIndex, isWeekend, shifts, dragOverDay, onCellClick, onAssignShift, onOpenAssignDialog,
}: {
  dayKey: DayKey; dayIndex: number; isWeekend: boolean;
  shifts: ShiftType[]; dragOverDay: DayKey | null;
  onCellClick: (shiftId: string, dayKey: DayKey) => void;
  onAssignShift: (shiftId: string, dayKey: DayKey) => void;
  onOpenAssignDialog: (dayKey: DayKey) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const highlighted = isOver || dragOverDay === dayKey;

  const active = shifts
    .map((s, i) => ({ shift: s, idx: i, ds: s.daySlots.find((d) => d.dayKey === dayKey) }))
    .filter((x): x is typeof x & { ds: DaySlot } => x.ds !== undefined);

  return (
    <div ref={setNodeRef}
      className={`min-h-[180px] rounded-xl border p-2 transition-all ${
        highlighted ? "border-purple-300 bg-purple-50/80 ring-2 ring-purple-400"
          : isWeekend ? "border-purple-200 bg-purple-50/40"
          : "border-border bg-card"
      }`}>
      <div className="mb-2 text-center">
        <p className={`text-xs font-semibold ${isWeekend ? "text-purple-700" : "text-slate-600"}`}>{DAY_SHORT[dayIndex]}</p>
        <p className="text-[10px] text-muted-foreground">
          {active.length > 0 ? `${active.length} shift${active.length !== 1 ? "s" : ""}` : "—"}
        </p>
      </div>

      {active.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center">
          <Plus className="mb-1 h-4 w-4 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Drop here</span>
        </div>
      )}

      {active.map(({ shift, idx: si, ds }) => {
        const color = getShiftColor(si);
        const hasIac = ds.slots.some((s) => s.reqIac > 0);
        const hasIaoc = ds.slots.some((s) => s.reqIaoc > 0);
        const hasIcu = ds.slots.some((s) => s.reqIcu > 0);
        const hasTx = ds.slots.some((s) => s.reqTransfer > 0);
        const hasGrade = ds.slots.some((s) => s.permittedGrades.length > 0);

        return (
          <button key={shift.id} type="button" onClick={() => onCellClick(shift.id, dayKey)}
            className="mb-1.5 flex w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold transition-all hover:ring-1 hover:ring-purple-200"
            style={{ backgroundColor: color.solid + "20", borderColor: color.solid + "60" }}>
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: color.solid, color: "white" }}>
              {shift.abbreviation}
            </span>
            <span className="text-[10px] text-muted-foreground">×{ds.staffing.target}</span>
            {ds.isCustomised && <span className="text-[9px]">✏️</span>}
            <div className="ml-auto flex gap-0.5">
              {hasIac && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              {hasIaoc && <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />}
              {hasIcu && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
              {hasTx && <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />}
              {hasGrade && <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
            </div>
          </button>
        );
      })}
      {/* Add-shift button — always shown, opens popup */}
      <div className="mt-1">
        <button type="button" onClick={() => onOpenAssignDialog(dayKey)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-[10px] font-medium text-muted-foreground hover:border-purple-300 hover:text-purple-600 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  );
}

/* ─── AssignShiftDialog ─── */
interface AssignShiftDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dayKey: DayKey;
  shifts: ShiftType[];
  onAssign: (shiftId: string) => void;
  onNewShift: () => void;
}
function AssignShiftDialog({ open, onOpenChange, dayKey, shifts, onAssign, onNewShift }: AssignShiftDialogProps) {
  const dayIdx   = DAY_KEYS.indexOf(dayKey);
  const dayLabel = DAY_FULL[dayIdx] ?? dayKey;
  const unassigned = shifts.filter((s) => !s.daySlots.some((ds) => ds.dayKey === dayKey));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Add shift — {dayLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-1">
          {unassigned.length === 0 ? (
            <p className="text-xs text-muted-foreground">All shift types are already assigned to this day.</p>
          ) : (
            unassigned.map((s) => {
              const color = getShiftColor(shifts.indexOf(s));
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onAssign(s.id); onOpenChange(false); }}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted/50 hover:ring-1 hover:ring-purple-200"
                  style={{ borderColor: color.solid + "40" }}
                >
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white"
                    style={{ backgroundColor: color.solid }}
                  >
                    {s.abbreviation}
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.startTime}–{s.endTime} · {s.durationHours}h</p>
                  </div>
                </button>
              );
            })
          )}
          <button
            type="button"
            onClick={() => { onOpenChange(false); onNewShift(); }}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-purple-300 px-3 py-2.5 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-purple-300 bg-purple-50">
              <Plus className="h-3.5 w-3.5" />
            </span>
            New shift type…
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ─── */

export default function DepartmentStep2() {
  const navigate = useNavigate();
  const { shifts, setShifts, removeShift, isLoadingShifts } = useDepartmentSetup();
  const { setDepartmentComplete }                           = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId }     = useRotaContext();
  const { user }                                            = useAuth();

  const [addModalOpen,      setAddModalOpen]      = useState(false);
  const [daySlotModal,      setDaySlotModal]      = useState<{ shiftId: string; dayKey: DayKey } | null>(null);
  const [assignDialog,      setAssignDialog]      = useState<DayKey | null>(null);
  const [expandedShiftId,   setExpandedShiftId]   = useState<string | null>(null);
  const [badgeMeaningsOpen, setBadgeMeaningsOpen] = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [showPreRotaWarn,   setShowPreRotaWarn]   = useState(false);
  const [draggedShiftId,    setDraggedShiftId]    = useState<string | null>(null);
  const [dragOverDay,       setDragOverDay]       = useState<DayKey | null>(null);
  const [activeDayIndex,    setActiveDayIndex]    = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 12 } })
  );

  const handleDragStart = (e: DragStartEvent) => setDraggedShiftId(e.active.id as string);

  const handleDragOver = (e: DragOverEvent) => {
    const over = e.over;
    setDragOverDay(over && DAY_KEYS.includes(over.id as DayKey) ? over.id as DayKey : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setDraggedShiftId(null); setDragOverDay(null);
    if (!over) return;
    const shiftId = active.id as string;
    const dayKey  = over.id  as DayKey;
    if (!DAY_KEYS.includes(dayKey)) return;
    setShifts((prev) => prev.map((s) => {
      if (s.id !== shiftId) return s;
      if (s.daySlots.some((ds) => ds.dayKey === dayKey)) return s;
      return {
        ...s,
        applicableDays: { ...s.applicableDays, [dayKey]: true },
        daySlots: [...s.daySlots, makeDefaultDaySlot(dayKey, s)],
      };
    }));
  };

  const handleCellClick = useCallback((shiftId: string, dayKey: DayKey) => {
    setDaySlotModal({ shiftId, dayKey });
  }, []);

  const handleAssignShift = useCallback((shiftId: string, dayKey: DayKey) => {
    setShifts((prev) => prev.map((s) => {
      if (s.id !== shiftId) return s;
      if (s.daySlots.some((ds) => ds.dayKey === dayKey)) return s;
      return {
        ...s,
        applicableDays: { ...s.applicableDays, [dayKey]: true },
        daySlots: [...s.daySlots, makeDefaultDaySlot(dayKey, s)],
      };
    }));
  }, [setShifts]);

  const handleDaySlotSave = useCallback((shiftId: string, dayKey: DayKey, updated: DaySlot) => {
    setShifts((prev) => prev.map((s) => {
      if (s.id !== shiftId) return s;
      const exists = s.daySlots.find((ds) => ds.dayKey === dayKey);
      const newSlots = exists
        ? s.daySlots.map((ds) => ds.dayKey === dayKey ? updated : ds)
        : [...s.daySlots, updated];
      return { ...s, applicableDays: { ...s.applicableDays, [dayKey]: true }, daySlots: newSlots };
    }));
  }, [setShifts]);

  const handleCopyToDays = useCallback((shiftId: string, _src: DayKey, targets: DayKey[], source: DaySlot) => {
    setShifts((prev) => prev.map((s) => {
      if (s.id !== shiftId) return s;
      let slots = [...s.daySlots]; let applicable = { ...s.applicableDays };
      for (const t of targets) {
        const copied: DaySlot = { ...source, dayKey: t, staffing: { ...source.staffing }, slots: source.slots.map((sl) => ({ ...sl })) };
        const idx = slots.findIndex((ds) => ds.dayKey === t);
        slots      = idx >= 0 ? slots.map((ds, i) => i === idx ? copied : ds) : [...slots, copied];
        applicable = { ...applicable, [t]: true };
      }
      return { ...s, applicableDays: applicable, daySlots: slots };
    }));
  }, [setShifts]);

  const handleRemoveFromDay = useCallback((shiftId: string, dayKey: DayKey) => {
    setShifts((prev) => prev.map((s) => {
      if (s.id !== shiftId) return s;
      return {
        ...s,
        applicableDays: { ...s.applicableDays, [dayKey]: false },
        daySlots: s.daySlots.filter((ds) => ds.dayKey !== dayKey),
      };
    }));
  }, [setShifts]);

  const handleAddConfirm = useCallback((newShift: ShiftType) => {
    setShifts((prev) => [...prev, newShift]);
    setExpandedShiftId(newShift.id);
  }, [setShifts]);

  const handleIdentitySave = useCallback((updated: ShiftType) => {
    setShifts((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  }, [setShifts]);

  const identityErrors = shifts.flatMap((s) =>
    getShiftIdentityErrors(s, shifts).map((e) => `${s.name || s.abbreviation}: ${e}`)
  );
  const canSave = shifts.length > 0 && identityErrors.length === 0 && !saving;

  const handleSaveCheck = async () => {
    if (currentRotaConfigId) {
      const { data } = await supabase
        .from("pre_rota_results").select("id, status")
        .eq("rota_config_id", currentRotaConfigId).maybeSingle();
      if (data && data.status !== "blocked") { setShowPreRotaWarn(true); return; }
    }
    await executeSave();
  };

  const executeSave = async () => {
    setSaving(true); setShowPreRotaWarn(false);
    try {
      if (!user?.id) throw new Error("Not signed in.");
      let configId = currentRotaConfigId;
      if (!configId) {
        const { data, error } = await supabase.from("rota_configs")
          .insert({ global_oncall_pct: 50, global_non_oncall_pct: 50, owned_by: user.id })
          .select("id").single();
        if (error) throw error;
        configId = data.id; setCurrentRotaConfigId(configId);
      } else {
        const { error } = await supabase.from("rota_configs")
          .update({ updated_at: new Date().toISOString() }).eq("id", configId);
        if (error) throw error;
      }

      const { data: existing } = await supabase.from("shift_types")
        .select("shift_key, target_percentage").eq("rota_config_id", configId);
      const pctMap: Record<string, number | null> = {};
      (existing ?? []).forEach((r: any) => { pctMap[r.shift_key] = r.target_percentage; });

      const currentKeys  = shifts.map((s) => s.id);
      const existingKeys = (existing ?? []).map((r: any) => r.shift_key as string);
      for (const key of existingKeys.filter((k) => !currentKeys.includes(k))) {
        await supabase.from("shift_types").delete()
          .eq("rota_config_id", configId).eq("shift_key", key);
      }

      for (const [idx, s] of shifts.entries()) {
        const mb = { ...s.badges };
        for (const key of Object.keys(s.badgeOverrides) as BadgeKey[]) {
          if (s.badgeOverrides[key] !== undefined) mb[key as keyof ShiftBadges] = s.badgeOverrides[key]!;
        }
        const row = {
          rota_config_id: configId, shift_key: s.id, name: s.name,
          start_time: s.startTime, end_time: s.endTime, duration_hours: s.durationHours,
          is_oncall: s.isOncall, is_non_res_oncall: s.isNonRes,
          applicable_mon: s.applicableDays.mon, applicable_tue: s.applicableDays.tue,
          applicable_wed: s.applicableDays.wed, applicable_thu: s.applicableDays.thu,
          applicable_fri: s.applicableDays.fri, applicable_sat: s.applicableDays.sat,
          applicable_sun: s.applicableDays.sun,
          badge_night: mb.night, badge_long: mb.long, badge_ooh: mb.ooh, badge_oncall: mb.oncall, badge_nonres: mb.nonres,
          badge_night_manual_override:  s.badgeOverrides.night  ?? null,
          badge_long_manual_override:   s.badgeOverrides.long   ?? null,
          badge_ooh_manual_override:    s.badgeOverrides.ooh    ?? null,
          badge_oncall_manual_override: s.badgeOverrides.oncall ?? null,
          badge_nonres_manual_override: s.badgeOverrides.nonres ?? null,
          oncall_manually_set: s.oncallManuallySet,
          min_doctors: s.staffing.min, target_doctors: s.staffing.target, max_doctors: s.staffing.max,
          target_percentage: pctMap[s.id] ?? null, sort_order: idx,
          req_iac: s.reqIac, req_iaoc: s.reqIaoc, req_icu: s.reqIcu,
          req_transfer: s.reqTransfer, req_min_grade: s.reqMinGrade, abbreviation: s.abbreviation,
        };
        if (existingKeys.includes(s.id)) {
          const { shift_key, rota_config_id, target_percentage, ...fields } = row;
          const { error } = await supabase.from("shift_types")
            .update({ ...fields, target_percentage, updated_at: new Date().toISOString() })
            .eq("rota_config_id", configId).eq("shift_key", s.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("shift_types").insert(row as any);
          if (error) throw error;
        }
      }

      // Delete all shift_day_slots (cascades to shift_slot_requirements via FK)
      const { error: delErr } = await supabase.from("shift_day_slots").delete().eq("rota_config_id", configId);
      if (delErr) throw delErr;

      for (const s of shifts) {
        if (s.daySlots.length === 0) continue;
        const { data: stRow, error: stErr } = await supabase.from("shift_types")
          .select("id").eq("rota_config_id", configId).eq("shift_key", s.id).single();
        if (stErr || !stRow) { console.error("shift_types row not found for:", s.id); continue; }
        const shiftTypeUuid = stRow.id as string;

        for (const ds of s.daySlots) {
          const { data: newSlot, error: slotErr } = await supabase.from("shift_day_slots")
            .insert({
              shift_type_id: shiftTypeUuid, rota_config_id: configId,
              day_key: ds.dayKey, min_doctors: ds.staffing.min,
              target_doctors: ds.staffing.target, max_doctors: ds.staffing.max,
            })
            .select("id").single();
          if (slotErr || !newSlot) { console.error("shift_day_slot insert failed:", slotErr); continue; }

          if (ds.slots.length > 0) {
            const reqRows = ds.slots.map((sl) => ({
              shift_day_slot_id: newSlot.id as string, rota_config_id: configId!,
              slot_index: sl.slotIndex, label: sl.label,
              permitted_grades: sl.permittedGrades,
              req_iac: sl.reqIac, req_iaoc: sl.reqIaoc, req_icu: sl.reqIcu, req_transfer: sl.reqTransfer,
            }));
            const { error: reqErr } = await supabase.from("shift_slot_requirements").insert(reqRows);
            if (reqErr) console.error("slot requirements insert failed:", reqErr);
          }
        }
      }

      toast.success("✓ Shift configuration saved");
      setDepartmentComplete(true);
      navigate("/admin/department/step-3");
    } catch (err: any) {
      console.error("Save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const activeModalShift = daySlotModal
    ? shifts.find((s) => s.id === daySlotModal.shiftId) ?? null
    : null;

  return (
    <AdminLayout
      title="Department Setup"
      subtitle="Step 2 of 3 — Shift patterns"
      accentColor="purple"
      pageIcon={Building2}
      navBar={
        <StepNavBar
          left={
            <Button variant="outline" size="lg" className="min-h-[44px]" onClick={() => navigate("/admin/department/step-1")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          }
          right={
            <Button size="lg" className="min-h-[44px] bg-purple-600 text-white hover:bg-purple-700"
              disabled={!canSave} onClick={handleSaveCheck}>
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
              }
            </Button>
          }
        />
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="mx-auto max-w-4xl space-y-6 animate-fadeSlideUp">

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-sm text-blue-800">
              Define your shifts, assign them to the days they run, then click any cell to set staffing and eligibility per day.
            </p>
          </div>

          {/* Card 1 — Weekly timetable grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" /> Weekly Shift Pattern
              </CardTitle>
              <CardDescription>
                Drag a shift onto a day to assign it. Click any filled cell to edit staffing and eligibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingShifts ? (
                <div className="flex min-h-[160px] items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading…</span>
                </div>
              ) : shifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
                  <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No shift types yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your first shift type below.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <span className="mr-1 flex items-center text-[10px] font-medium text-muted-foreground">Drag onto days →</span>
                    {shifts.map((s, i) => <DraggableShiftChipNew key={s.id} shift={s} index={i} />)}
                    <button
                      type="button"
                      onClick={() => setAddModalOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-purple-300 px-2.5 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> New shift
                    </button>
                  </div>
                  <hr className="border-border" />

                  {/* Desktop 7-column grid */}
                  <div className="hidden md:block">
                    <div className="mb-1 grid grid-cols-7 gap-2">
                      <div className="col-span-5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weekdays</span>
                        <hr className="mt-0.5 border-border" />
                      </div>
                      <div className="col-span-2">
                        <hr className="mt-0.5 border-purple-300" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Weekend</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {DAY_KEYS.map((key, i) => (
                        <div key={key} className={i === 5 ? "border-l-2 border-purple-200 pl-1" : ""}>
                          <DayColumnNew
                            dayKey={key} dayIndex={i} isWeekend={i >= 5}
                            shifts={shifts} dragOverDay={dragOverDay}
                            onCellClick={handleCellClick} onAssignShift={handleAssignShift}
                            onOpenAssignDialog={(dk) => setAssignDialog(dk)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile: single-day with arrow navigation */}
                  <div className="md:hidden">
                    <div className="mb-2 flex items-center justify-between">
                      <button type="button" disabled={activeDayIndex === 0}
                        onClick={() => setActiveDayIndex((v) => Math.max(0, v - 1))}
                        className="rounded-lg border border-border p-2 disabled:opacity-30">
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-semibold">{DAY_FULL[activeDayIndex]}</span>
                      <button type="button" disabled={activeDayIndex === 6}
                        onClick={() => setActiveDayIndex((v) => Math.min(6, v + 1))}
                        className="rounded-lg border border-border p-2 disabled:opacity-30">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <DayColumnNew
                      dayKey={DAY_KEYS[activeDayIndex]}
                      dayIndex={activeDayIndex}
                      isWeekend={activeDayIndex >= 5}
                      shifts={shifts}
                      dragOverDay={dragOverDay}
                      onCellClick={handleCellClick}
                      onAssignShift={handleAssignShift}
                      onOpenAssignDialog={(dk) => setAssignDialog(dk)}
                    />
                  </div>

                  {/* Coverage summary */}
                  {(() => {
                    const covered = DAY_KEYS.filter((k) =>
                      shifts.some((s) => s.daySlots.some((ds) => ds.dayKey === k))
                    ).length;
                    return (
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                        covered === 7
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}>
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        {covered} of 7 days have at least one shift assigned.
                        {covered < 7 && " Days with no shifts will have no rostered activity."}
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 2 — Shift identity panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" /> Shift Types
              </CardTitle>
              <CardDescription>
                Edit name, times, and badges. Staffing and eligibility are set per day in the grid above.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Badge meanings collapsible */}
              <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
                <button type="button" onClick={() => setBadgeMeaningsOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50">
                  <span className="flex items-center gap-2"><Info className="h-3.5 w-3.5 shrink-0" /> Badge meanings</span>
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${badgeMeaningsOpen ? "rotate-90" : ""}`} />
                </button>
                {badgeMeaningsOpen && (
                  <div className="space-y-1 border-t border-border px-4 pb-3 pt-2 text-xs text-muted-foreground">
                    <p>🌙 <span className="font-semibold">NIGHT</span> — ≥3h between 23:00–06:00</p>
                    <p>⏱ <span className="font-semibold">LONG</span> — duration &gt;10h</p>
                    <p>🌆 <span className="font-semibold">OOH</span> — outside 07:00–19:00 or on weekends</p>
                    <p>📟 <span className="font-semibold">ON-CALL</span> — resident on-site</p>
                    <p>🏠 <span className="font-semibold">NON-RES</span> — on-call from home</p>
                  </div>
                )}
              </div>

              {/* Identity validation errors */}
              {identityErrors.length > 0 && (
                <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  {identityErrors.map((e) => (
                    <p key={e} className="flex items-center gap-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {e}
                    </p>
                  ))}
                </div>
              )}

              {/* Shift identity cards */}
              <div className="space-y-3">
                {shifts.map((shift, index) => (
                  <div key={shift.id} id={`shift-card-${shift.id}`}>
                    <ShiftIdentityCard
                      shift={shift}
                      index={index}
                      expanded={expandedShiftId === shift.id}
                      onToggleExpand={() => setExpandedShiftId((prev) => prev === shift.id ? null : shift.id)}
                      onSave={handleIdentitySave}
                      onRemove={() => { removeShift(shift.id); setExpandedShiftId(null); }}
                      canRemove={shifts.length > 1}
                      allShifts={shifts}
                    />
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setAddModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 p-3 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50">
                <Plus className="h-4 w-4" /> Add shift type
              </button>
            </CardContent>
          </Card>
        </div>

        <AddShiftModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onConfirm={handleAddConfirm}
        />

        {assignDialog !== null && (
          <AssignShiftDialog
            open={assignDialog !== null}
            onOpenChange={(v) => { if (!v) setAssignDialog(null); }}
            dayKey={assignDialog}
            shifts={shifts}
            onAssign={(shiftId) => handleAssignShift(shiftId, assignDialog)}
            onNewShift={() => setAddModalOpen(true)}
          />
        )}

        <DaySlotModal
          open={daySlotModal !== null}
          onOpenChange={(v) => { if (!v) setDaySlotModal(null); }}
          shift={activeModalShift}
          dayKey={daySlotModal?.dayKey ?? null}
          onSave={handleDaySlotSave}
          onCopyToDays={handleCopyToDays}
          onRemoveFromDay={handleRemoveFromDay}
        />

        <Dialog open={showPreRotaWarn} onOpenChange={setShowPreRotaWarn}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Changing shift patterns</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              A pre-rota has already been generated. Saving changes will not invalidate it, but the next generation will use the updated patterns.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPreRotaWarn(false)}>Cancel</Button>
              <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={executeSave}>Save anyway</Button>
            </div>
          </DialogContent>
        </Dialog>

        <DragOverlay dropAnimation={null}>
          {draggedShiftId && (() => {
            const idx   = shifts.findIndex((s) => s.id === draggedShiftId);
            const shift = shifts[idx];
            if (!shift) return null;
            const color = getShiftColor(idx);
            return (
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-lg ${color.bg} ${color.text} ${color.border}`}
                style={{ pointerEvents: 'none' }}>
                {shift.abbreviation}
                <span className="text-[10px] font-medium opacity-70">{shift.name}</span>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </AdminLayout>
  );
}
