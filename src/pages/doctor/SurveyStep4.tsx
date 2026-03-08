import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useSurveyContext, type LeaveEntry, type RotationEntry } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, X, CalendarX, Info, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

function genId() { return crypto.randomUUID(); }

/* ─── Range date picker: pick start + end from one calendar ─── */
function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  errors,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
  maxDate?: string;
  errors?: { startDate?: string; endDate?: string };
}) {
  const [open, setOpen] = useState(false);

  const selected: DateRange | undefined =
    startDate || endDate
      ? {
          from: startDate ? parseISO(startDate) : undefined,
          to: endDate ? parseISO(endDate) : undefined,
        }
      : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    const from = range?.from ? format(range.from, "yyyy-MM-dd") : "";
    const to = range?.to ? format(range.to, "yyyy-MM-dd") : "";
    onChange(from, to);
    // Close popover once both dates are selected
    if (range?.from && range?.to) {
      setTimeout(() => setOpen(false), 200);
    }
  };

  const displayText = startDate && endDate
    ? `${format(parseISO(startDate), "d MMM")} → ${format(parseISO(endDate), "d MMM yyyy")}`
    : startDate
    ? `${format(parseISO(startDate), "d MMM yyyy")} → …`
    : "Select dates";

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-10 text-sm",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={1}
            disabled={(date) => {
              if (minDate && date < parseISO(minDate)) return true;
              if (maxDate && date > parseISO(maxDate)) return true;
              return false;
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {errors?.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
      {errors?.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
    </div>
  );
}

interface DateRowProps {
  entry: LeaveEntry;
  onChange: (e: LeaveEntry) => void;
  onRemove: () => void;
  rotaStart?: string;
  rotaEnd?: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  errors?: Record<string, string>;
}

function DateRow({ entry, onChange, onRemove, rotaStart, rotaEnd, reasonLabel = "Reason", reasonRequired = false, reasonPlaceholder = "", errors = {} }: DateRowProps) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 relative">
      <button onClick={onRemove} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
      <DateRangePicker
        startDate={entry.startDate}
        endDate={entry.endDate}
        onChange={(s, e) => onChange({ ...entry, startDate: s, endDate: e })}
        minDate={rotaStart}
        maxDate={rotaEnd}
        errors={{ startDate: errors.startDate, endDate: errors.endDate }}
      />
      <div>
        <label className="text-xs font-medium text-muted-foreground">{reasonLabel}{reasonRequired ? " *" : ""}</label>
        <Input value={entry.reason} onChange={(e) => onChange({ ...entry, reason: e.target.value })} placeholder={reasonPlaceholder} className="bg-muted border-border text-sm" />
        <FieldError message={errors.reason} />
      </div>
    </div>
  );
}

function RotationRow({ entry, onChange, onRemove, rotaStart, rotaEnd, errors = {} }: { entry: RotationEntry; onChange: (e: RotationEntry) => void; onRemove: () => void; rotaStart?: string; rotaEnd?: string; errors?: Record<string, string> }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 relative">
      <button onClick={onRemove} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
      <DateRangePicker
        startDate={entry.startDate}
        endDate={entry.endDate}
        onChange={(s, e) => onChange({ ...entry, startDate: s, endDate: e })}
        minDate={rotaStart}
        maxDate={rotaEnd}
        errors={{ startDate: errors.startDate, endDate: errors.endDate }}
      />
      <div>
        <label className="text-xs font-medium text-muted-foreground">Location / department *</label>
        <Input value={entry.location} onChange={(e) => onChange({ ...entry, location: e.target.value })} placeholder="e.g. Royal Liverpool Hospital — ICU" className="bg-muted border-border text-sm" />
        <FieldError message={errors.location} />
      </div>
    </div>
  );
}

function validateDateEntry(e: LeaveEntry, rotaStart?: string, rotaEnd?: string, reasonRequired = false): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!e.startDate) errs.startDate = "Start date is required";
  else if (rotaStart && e.startDate < rotaStart) errs.startDate = `Date must be within the rota period`;
  else if (rotaEnd && e.startDate > rotaEnd) errs.startDate = `Date must be within the rota period`;
  if (!e.endDate) errs.endDate = "End date is required";
  else if (rotaEnd && e.endDate > rotaEnd) errs.endDate = `Date must be within the rota period`;
  else if (rotaStart && e.endDate < rotaStart) errs.endDate = `Date must be within the rota period`;
  if (e.startDate && e.endDate && e.endDate < e.startDate) errs.endDate = "End date must be on or after start date";
  if (reasonRequired && !e.reason.trim()) errs.reason = "Reason is required";
  return errs;
}

export default function SurveyStep4() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [hasRotation, setHasRotation] = useState(false);

  if (!ctx) return null;
  const { formData, setField, rotaInfo } = ctx;
  const rs = rotaInfo?.startDate || undefined;
  const re = rotaInfo?.endDate || undefined;
  const dw = rotaInfo?.durationWeeks || 0;
  const effectiveWte = formData.wtePercent === 0 ? (formData.wteOtherValue || 100) : formData.wtePercent;

  const proRata = formData.alEntitlement ? Math.round((dw / 52) * formData.alEntitlement * (effectiveWte / 100)) : null;
  const alTotalDays = formData.annualLeave.reduce((sum, e) => {
    if (e.startDate && e.endDate && e.endDate >= e.startDate) {
      return sum + Math.ceil((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 86400000) + 1;
    }
    return sum;
  }, 0);

  const updateEntry = <T extends LeaveEntry | RotationEntry>(arr: T[], idx: number, updated: T, key: keyof typeof formData) => {
    const newArr = [...arr];
    newArr[idx] = updated;
    setField(key as any, newArr as any);
  };

  const removeEntry = <T,>(arr: T[], idx: number, key: keyof typeof formData) => {
    setField(key as any, arr.filter((_, i) => i !== idx) as any);
  };

  const validate = (): boolean => {
    const allErrors: Record<string, Record<string, string>> = {};
    let valid = true;
    formData.annualLeave.forEach((e, i) => {
      if (e.startDate || e.endDate) {
        const errs = validateDateEntry(e, rs, re);
        if (Object.keys(errs).length) { allErrors[`al_${i}`] = errs; valid = false; }
      }
    });
    formData.studyLeave.forEach((e, i) => {
      if (e.startDate || e.endDate || e.reason) {
        const errs = validateDateEntry(e, rs, re, true);
        if (Object.keys(errs).length) { allErrors[`sl_${i}`] = errs; valid = false; }
      }
    });
    formData.nocDates.forEach((e, i) => {
      if (e.startDate || e.endDate) {
        const errs = validateDateEntry(e, rs, re);
        if (Object.keys(errs).length) { allErrors[`noc_${i}`] = errs; valid = false; }
      }
    });
    if (hasRotation) {
      formData.rotations.forEach((e, i) => {
        const errs: Record<string, string> = {};
        if (!e.startDate) errs.startDate = "Required";
        if (!e.endDate) errs.endDate = "Required";
        if (e.startDate && e.endDate && e.endDate < e.startDate) errs.endDate = "End must be after start";
        if (!e.location.trim()) errs.location = "Location is required";
        if (Object.keys(errs).length) { allErrors[`rot_${i}`] = errs; valid = false; }
      });
    }
    setErrors(allErrors);
    return valid;
  };

  const handleNext = () => { if (validate()) ctx.nextStep(); };

  return (
    <>
      <div className="p-3 sm:p-4 pb-32 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          All leave entered here will be blocked in the rota. Add everything you know now.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarX className="h-5 w-5 text-teal-600" />
              Leave & Unavailability
            </CardTitle>
            <CardDescription className="text-xs">All leave and unavailability during the rota period.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            <InfoBox type="danger">Enter all known leave now. Changes after submission require coordinator approval.</InfoBox>

            {/* Annual Leave */}
            <SurveySection number={1} title="Annual Leave" badge="high">
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">AL entitlement</span>
                    <span className="text-xs text-muted-foreground">Select your annual entitlement</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <select
                    value={formData.alEntitlement ?? ""}
                    onChange={(e) => setField("alEntitlement", e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="27">27 days</option>
                    <option value="32">32 days</option>
                  </select>
                </div>
                {proRata !== null && (
                  <InfoBox type="info">
                    For a {dw}-week rota at {effectiveWte}%, your estimated pro-rata entitlement is approximately {proRata} days.
                  </InfoBox>
                )}
                {formData.annualLeave.map((e, i) => (
                  <DateRow
                    key={e.id}
                    entry={e}
                    onChange={(u) => updateEntry(formData.annualLeave, i, u, "annualLeave")}
                    onRemove={() => removeEntry(formData.annualLeave, i, "annualLeave")}
                    rotaStart={rs}
                    rotaEnd={re}
                    reasonPlaceholder="e.g. family holiday, pre-booked"
                    errors={errors[`al_${i}`]}
                  />
                ))}
                <button
                  onClick={() => setField("annualLeave", [...formData.annualLeave, { id: genId(), startDate: "", endDate: "", reason: "" }])}
                  className="w-full rounded-lg border border-dashed border-teal-300 p-3 flex items-center justify-center gap-2 text-sm font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add annual leave
                </button>
                {formData.annualLeave.length > 0 && (
                  <InfoBox type="info">Total AL: {alTotalDays} day(s) including weekends</InfoBox>
                )}
                {proRata !== null && alTotalDays > 2 * proRata && (
                  <InfoBox type="warn">High leave entered — please check this does not exceed your pro-rata entitlement.</InfoBox>
                )}
              </div>
            </SurveySection>

            {/* Study Leave */}
            <SurveySection number={2} title="Study Leave" badge="high">
              <div className="space-y-3">
                {formData.studyLeave.map((e, i) => (
                  <DateRow
                    key={e.id}
                    entry={e}
                    onChange={(u) => updateEntry(formData.studyLeave, i, u, "studyLeave")}
                    onRemove={() => removeEntry(formData.studyLeave, i, "studyLeave")}
                    rotaStart={rs}
                    rotaEnd={re}
                    reasonLabel="Reason"
                    reasonRequired
                    reasonPlaceholder="e.g. Primary FRCA, ALS course"
                    errors={errors[`sl_${i}`]}
                  />
                ))}
                <button
                  onClick={() => setField("studyLeave", [...formData.studyLeave, { id: genId(), startDate: "", endDate: "", reason: "" }])}
                  className="w-full rounded-lg border border-dashed border-teal-300 p-3 flex items-center justify-center gap-2 text-sm font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add study leave
                </button>
              </div>
            </SurveySection>

            {/* NOC */}
            <SurveySection number={3} title="Not On-Call (NOC)" badge="medium">
              <div className="space-y-3">
                <InfoBox type="info">On these dates you won't be allocated on-call duties, but may still be assigned day shifts.</InfoBox>
                {formData.nocDates.map((e, i) => (
                  <DateRow
                    key={e.id}
                    entry={e}
                    onChange={(u) => updateEntry(formData.nocDates, i, u, "nocDates")}
                    onRemove={() => removeEntry(formData.nocDates, i, "nocDates")}
                    rotaStart={rs}
                    rotaEnd={re}
                    errors={errors[`noc_${i}`]}
                  />
                ))}
                <button
                  onClick={() => setField("nocDates", [...formData.nocDates, { id: genId(), startDate: "", endDate: "", reason: "" }])}
                  className="w-full rounded-lg border border-dashed border-teal-300 p-3 flex items-center justify-center gap-2 text-sm font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add not-on-call period
                </button>
              </div>
            </SurveySection>

            {/* Rotations */}
            <SurveySection number={4} title="Rotations" badge="hard">
              <div className="space-y-3">
                <p className="text-xs text-card-foreground">Rotating to another hospital during this rota?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHasRotation(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${!hasRotation ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>No</button>
                  <button type="button" onClick={() => setHasRotation(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${hasRotation ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>Yes</button>
                </div>
                {hasRotation && (
                  <>
                    {formData.rotations.map((e, i) => (
                      <RotationRow
                        key={e.id}
                        entry={e}
                        onChange={(u) => { const n = [...formData.rotations]; n[i] = u; setField("rotations", n); }}
                        onRemove={() => setField("rotations", formData.rotations.filter((_, j) => j !== i))}
                        rotaStart={rs}
                        rotaEnd={re}
                        errors={errors[`rot_${i}`]}
                      />
                    ))}
                    <button
                      onClick={() => setField("rotations", [...formData.rotations, { id: genId(), startDate: "", endDate: "", location: "" }])}
                      className="w-full rounded-lg border border-dashed border-teal-300 p-3 flex items-center justify-center gap-2 text-sm font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Add rotation
                    </button>
                  </>
                )}
              </div>
            </SurveySection>
          </CardContent>
        </Card>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}