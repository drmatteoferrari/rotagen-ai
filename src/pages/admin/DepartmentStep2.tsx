import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Clock, Save, X, ChevronDown, Info, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import {
  useDepartmentSetup,
  detectBadges,
  mergedBadges,
  type ShiftType,
  type BadgeKey,
  type ShiftBadges,
} from "@/contexts/DepartmentSetupContext";
import { calcDurationHours } from "@/lib/shiftUtils";
import type { ApplicableDays } from "@/lib/shiftUtils";

const DAY_KEYS: (keyof ApplicableDays)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const BADGE_DEFS: { key: BadgeKey; label: string; emoji: string; color: string; activeClasses: string }[] = [
  { key: "night", label: "NIGHT", emoji: "🌙", color: "bg-slate-700 text-white", activeClasses: "bg-slate-700 text-white" },
  { key: "long", label: "LONG", emoji: "⏱", color: "bg-amber-500 text-white", activeClasses: "bg-amber-500 text-white" },
  { key: "ooh", label: "OOH", emoji: "🌆", color: "bg-indigo-500 text-white", activeClasses: "bg-indigo-500 text-white" },
  { key: "weekend", label: "WEEKEND", emoji: "📅", color: "bg-purple-500 text-white", activeClasses: "bg-purple-500 text-white" },
  { key: "oncall", label: "ON-CALL", emoji: "📟", color: "bg-emerald-600 text-white", activeClasses: "bg-emerald-600 text-white" },
  { key: "nonres", label: "NON-RES OC", emoji: "🏠", color: "bg-teal-500 text-white", activeClasses: "bg-teal-500 text-white" },
];

function BadgeRow({
  shift,
  editable,
  onToggle,
  compact = false,
}: {
  shift: ShiftType;
  editable: boolean;
  onToggle?: (key: BadgeKey) => void;
  compact?: boolean;
}) {
  const auto = detectBadges(shift.startTime, shift.endTime, shift.applicableDays, shift.isOncall, shift.isNonRes);
  const effective = mergedBadges(auto, shift.badgeOverrides);

  return (
    <div className="flex flex-wrap gap-1.5">
      {BADGE_DEFS.map(({ key, label, emoji, activeClasses }) => {
        const isActive = effective[key];
        const isOverridden = shift.badgeOverrides[key] !== undefined;
        const suffix = isOverridden ? " ✏️" : " ⚡";

        return (
          <button
            key={key}
            type="button"
            disabled={!editable}
            onClick={() => editable && onToggle?.(key)}
            title={label}
            className={`inline-flex items-center gap-1 rounded-full py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
              compact ? "px-1.5" : "px-2.5"
            } ${
              isActive
                ? activeClasses
                : "bg-muted text-muted-foreground/40 line-through"
            } ${editable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
          >
            {emoji}{!compact && <>{" "}{label}{suffix}</>}
          </button>
        );
      })}
    </div>
  );
}

function CollapsedCard({
  shift,
  onExpand,
  onRemove,
  canRemove,
}: {
  shift: ShiftType;
  onExpand: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div
      onClick={onExpand}
      className="rounded-lg border border-border bg-card p-4 space-y-3 transition-all hover:shadow-md cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <h3 className="text-sm font-medium text-card-foreground truncate">{shift.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {shift.startTime} – {shift.endTime} ({shift.durationHours}h)
          </p>
          {/* Show icon-only badges on mobile, full badges on sm+ */}
          <div className="sm:hidden">
            <BadgeRow shift={shift} editable={false} compact />
          </div>
          <div className="hidden sm:block">
            <BadgeRow shift={shift} editable={false} />
          </div>
        </div>
        <div className="flex gap-2 shrink-0 ml-2">
          {canRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-purple-600 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpandedCard({
  shift: originalShift,
  onSave,
  onCancel,
  onRemove,
  canRemove,
}: {
  shift: ShiftType;
  onSave: (updated: ShiftType) => void;
  onCancel: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [draft, setDraft] = useState<ShiftType>({ ...originalShift, applicableDays: { ...originalShift.applicableDays }, badges: { ...originalShift.badges }, badgeOverrides: { ...originalShift.badgeOverrides }, staffing: { ...originalShift.staffing }, reqIac: originalShift.reqIac, reqIaoc: originalShift.reqIaoc, reqIcu: originalShift.reqIcu, reqMinGrade: originalShift.reqMinGrade });
  const [showMax, setShowMax] = useState(draft.staffing.max !== null);

  const recalc = useCallback((d: ShiftType): ShiftType => {
    const dur = calcDurationHours(d.startTime, d.endTime);
    const auto = detectBadges(d.startTime, d.endTime, d.applicableDays, d.isOncall, d.isNonRes);
    
    let isOncall = d.isOncall;
    let isNonRes = d.isNonRes;
    if (!d.oncallManuallySet) {
      isOncall = auto.night || auto.long || auto.weekend || auto.ooh;
    }
    
    const finalAuto = detectBadges(d.startTime, d.endTime, d.applicableDays, isOncall, isNonRes);
    const merged = mergedBadges(finalAuto, d.badgeOverrides);
    
    return { ...d, durationHours: dur, isOncall, isNonRes, badges: merged };
  }, []);

  const update = useCallback((updates: Partial<ShiftType>) => {
    setDraft((prev) => recalc({ ...prev, ...updates }));
  }, [recalc]);

  const toggleDay = (key: keyof ApplicableDays) => {
    const newDays = { ...draft.applicableDays, [key]: !draft.applicableDays[key] };
    if (!Object.values(newDays).some(Boolean)) return;
    update({ applicableDays: newDays });
  };

  const toggleBadge = (key: BadgeKey) => {
    const isCurrentlyOverridden = draft.badgeOverrides[key] !== undefined;
    let newOverrides = { ...draft.badgeOverrides };
    
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
    <div className="rounded-lg border-2 border-purple-200 bg-card p-6 shadow-lg space-y-5">
      {/* Header with remove */}
      <div className="flex justify-between items-center">
        <ChevronDown className="h-5 w-5 text-purple-600" />
        {canRemove && (
          <button onClick={onRemove} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Shift Name</Label>
        <Input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          className="text-lg font-bold border-none bg-transparent px-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Enter shift name"
        />
      </div>

      {/* Times + Duration */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="font-semibold text-xs">Start Time</Label>
          <Input type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })} className="bg-muted border-border" />
        </div>
        <div className="space-y-1">
          <Label className="font-semibold text-xs">End Time</Label>
          <Input type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.target.value })} className="bg-muted border-border" />
        </div>
        <div className="space-y-1">
          <Label className="font-semibold text-xs">Duration</Label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted text-muted-foreground text-sm font-medium">
            <Clock className="h-3.5 w-3.5" /> {draft.durationHours}h
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-2">
        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Applicable Days</Label>
        <div className="flex gap-2">
          {DAY_KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key)}
              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                draft.applicableDays[key]
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {DAY_LABELS[i]}
            </button>
          ))}
        </div>
      </div>

      {/* On-call radios */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Resident On-Call?</Label>
          <div className="flex gap-3">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => update({ isOncall: val, oncallManuallySet: true })}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  draft.isOncall === val
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {val ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Non-Resident On-Call?</Label>
          <div className="flex gap-3">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => update({ isNonRes: val })}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  draft.isNonRes === val
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {val ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staffing */}
      <div className="space-y-3">
        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Staffing</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Min Doctors</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={draft.staffing.min}
              onChange={(e) => update({ staffing: { ...draft.staffing, min: Math.max(0, Math.min(50, Number(e.target.value) || 0)) } })}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={showMax}
                onCheckedChange={(checked) => {
                  setShowMax(!!checked);
                  if (!checked) update({ staffing: { ...draft.staffing, max: null } });
                  else update({ staffing: { ...draft.staffing, max: draft.staffing.min } });
                }}
              />
              <Label className="text-xs">Set maximum doctors</Label>
            </div>
            {showMax && (
              <Input
                type="number"
                min={0}
                max={50}
                value={draft.staffing.max ?? ""}
                onChange={(e) => update({ staffing: { ...draft.staffing, max: Math.max(0, Math.min(50, Number(e.target.value) || 0)) } })}
                className="bg-muted border-border"
              />
            )}
          </div>
        </div>
      </div>

      {/* Badges (editable) */}
      <div className="space-y-2">
        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Badges</Label>
        <BadgeRow shift={draft} editable onToggle={toggleBadge} />
        <p className="text-[10px] text-muted-foreground">⚡ = auto-detected, ✏️ = manually set. Click to toggle.</p>
      </div>

      {/* Staffing Requirements */}
      <div className="space-y-4 border-t border-border pt-4">
        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Staffing Requirements</Label>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Minimum competency cover required on this shift</Label>
          <p className="text-[10px] text-muted-foreground">The algorithm will ensure at least this many doctors with each competency are assigned. Set to 0 if no requirement.</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "reqIac" as const, label: "IAC" },
              { key: "reqIaoc" as const, label: "IAOC" },
              { key: "reqIcu" as const, label: "ICU" },
            ]).map(({ key, label }) => {
              const maxVal = draft.staffing.max ?? 10;
              const val = draft[key];
              return (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={maxVal}
                    step={1}
                    value={val}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(maxVal, Math.floor(Number(e.target.value) || 0)));
                      update({ [key]: v } as any);
                    }}
                    className="bg-muted border-border"
                  />
                  {val > draft.staffing.min && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> This exceeds the minimum staffing level for this shift — check this is correct
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Minimum grade required (at least one doctor on this shift)</Label>
          <p className="text-[10px] text-muted-foreground">At least one doctor assigned to this shift must hold this grade or above. Leave blank if no requirement.</p>
          <Select
            value={draft.reqMinGrade ?? "__none__"}
            onValueChange={(v) => update({ reqMinGrade: v === "__none__" ? null : v })}
          >
            <SelectTrigger className="w-full">
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
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button onClick={() => onSave(draft)} className="bg-purple-600 hover:bg-purple-700 text-white">
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export default function DepartmentStep2() {
  const navigate = useNavigate();
  const { shifts, updateShift, addShift, removeShift, expandedShiftId, setExpandedShiftId, setShifts, isLoadingShifts } = useDepartmentSetup();

  const handleSaveCard = (updated: ShiftType) => {
    setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setExpandedShiftId(null);
  };

  return (
    <AdminLayout title="Department Setup" subtitle="Step 2 of 3 — Shift types">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700">
          <Info className="h-4 w-4 shrink-0 text-purple-600" />
          Define the shift types your department uses. Name, times, and on-call status are all required.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-600" />
              Shift Types
            </CardTitle>
            <CardDescription>Define shift names, times, and on-call status. Night shifts are auto-detected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Badge legend */}
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold">🏷️ Badge meanings:</span> NIGHT = ≥3h between 23:00–06:00 | LONG = duration &gt;10h | OOH = any hours 19:00–07:00 or weekend | WEEKEND = shift falls on Sat/Sun | ON-CALL = resident doctor on-site | NON-RES OC = on-call from home
              </p>
            </div>

            {isLoadingShifts && (
              <div className="text-sm text-muted-foreground py-2 italic">
                Loading your saved shift types…
              </div>
            )}

            {/* Shift cards */}
            <div className="flex flex-col gap-4">
              {shifts.map((shift) =>
                expandedShiftId === shift.id ? (
                  <ExpandedCard
                    key={shift.id}
                    shift={shift}
                    onSave={handleSaveCard}
                    onCancel={() => setExpandedShiftId(null)}
                    onRemove={() => removeShift(shift.id)}
                    canRemove={shifts.length > 1}
                  />
                ) : (
                  <CollapsedCard
                    key={shift.id}
                    shift={shift}
                    onExpand={() => setExpandedShiftId(shift.id)}
                    onRemove={() => removeShift(shift.id)}
                    canRemove={shifts.length > 1}
                  />
                ),
              )}
            </div>

            {/* Add shift button — dashed purple */}
            <button
              onClick={() => addShift()}
              disabled={isLoadingShifts}
              className="w-full rounded-lg border border-dashed border-purple-300 p-3 flex items-center justify-center gap-2 text-sm font-medium text-purple-600 cursor-pointer hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isLoadingShifts ? 'Loading saved shifts…' : 'Add Shift Type'}
            </button>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button
            size="lg"
            onClick={() => navigate("/admin/department/step-3")}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
