import { useState, useMemo } from "react";
import { useSurveyContext, type LeaveEntry, type RotationEntry } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { DateRangePicker } from "@/components/survey/DateRangePicker";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, CalendarX, Info } from "lucide-react";
import { eachDayOfInterval, parseISO } from "date-fns";

function genId() { return crypto.randomUUID(); }

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
    <div className="rounded-lg border border-border p-4 space-y-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <DateRangePicker
            startDate={entry.startDate}
            endDate={entry.endDate}
            onChange={(s, e) => onChange({ ...entry, startDate: s, endDate: e })}
            minDate={rotaStart}
            maxDate={rotaEnd}
            errors={{ startDate: errors.startDate, endDate: errors.endDate }}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 flex items-center justify-center h-11 w-11 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors cursor-pointer"
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
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
    <div className="rounded-lg border border-border p-4 space-y-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <DateRangePicker
            startDate={entry.startDate}
            endDate={entry.endDate}
            onChange={(s, e) => onChange({ ...entry, startDate: s, endDate: e })}
            minDate={rotaStart}
            maxDate={rotaEnd}
            errors={{ startDate: errors.startDate, endDate: errors.endDate }}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 flex items-center justify-center h-11 w-11 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors cursor-pointer"
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
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
  const effectiveWte = (formData.wtePercent === 0 ? formData.wteOtherValue : formData.wtePercent) ?? 100;

  const proRata = formData.alEntitlement ? Math.round(formData.alEntitlement * (dw / 52) * (effectiveWte / 100)) : null;
  const showProRata = formData.alEntitlement !== null && dw > 0 && proRata !== null && proRata > 0;

  // AL total — weekdays only, excluding bank holidays
  const bhSet = useMemo(
    () => new Set(rotaInfo?.bankHolidays ?? []),
    [rotaInfo?.bankHolidays]
  );

  const alTotalDays = useMemo(() => {
    return formData.annualLeave.reduce((sum, e) => {
      if (!e.startDate || !e.endDate || e.endDate < e.startDate) return sum;
      let count = 0;
      const cur = new Date(e.startDate + 'T00:00:00');
      const end = new Date(e.endDate + 'T00:00:00');
      while (cur <= end) {
        const dow = cur.getDay();
        const dateStr = cur.toISOString().split('T')[0];
        if (dow !== 0 && dow !== 6 && !bhSet.has(dateStr)) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return sum + count;
    }, 0);
  }, [formData.annualLeave, bhSet]);

  // Overlap detection
  const hasOverlap = useMemo(() => {
    const allEntries = [
      ...formData.annualLeave,
      ...formData.studyLeave,
      ...formData.nocDates,
      ...formData.rotations.map((r) => ({ startDate: r.startDate, endDate: r.endDate })),
    ].filter((e) => e.startDate && e.endDate);

    if (allEntries.length < 2) return false;

    const intervals = allEntries.map((e) => {
      try {
        return eachDayOfInterval({ start: parseISO(e.startDate), end: parseISO(e.endDate) }).map((d) => d.getTime());
      } catch { return []; }
    });

    for (let i = 0; i < intervals.length; i++) {
      const setA = new Set(intervals[i]);
      for (let j = i + 1; j < intervals.length; j++) {
        if (intervals[j].some((d) => setA.has(d))) return true;
      }
    }
    return false;
  }, [formData.annualLeave, formData.studyLeave, formData.nocDates, formData.rotations]);

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

    if (formData.alEntitlement === null) {
      allErrors["al_entitlement"] = { entitlement: "Please select your annual leave entitlement" };
      valid = false;
    } else if (formData.alEntitlement !== 27 && formData.alEntitlement !== 32) {
      allErrors["al_entitlement"] = { entitlement: "Entitlement must be 27 or 32 days" };
      valid = false;
    }

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

  const handleNext = async () => {
    if (!validate()) {
      setTimeout(() => {
        const firstError = document.querySelector('[data-error="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
      return;
    }
    await ctx.nextStep();
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 space-y-4 sm:space-y-6">
        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-teal-600" />
          Leave entered here will be considered in rota generation. We'll try to honour all requests, but staffing minimums take priority.
        </div>

        <Card className="bg-white shadow-sm">
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarX className="h-5 w-5 text-teal-600" />
              Leave & Unavailability
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-4">
            <InfoBox type="info">Changes after deadline require coordinator approval and may not be granted.</InfoBox>

            {/* Annual Leave */}
            <SurveySection number={1} title="Annual Leave" badge="high">
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-4 space-y-2" data-error={errors["al_entitlement"] ? "true" : undefined}>
                  <span className="text-sm sm:text-base font-medium text-card-foreground">AL entitlement *</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setField("alEntitlement", 27)}
                      className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${formData.alEntitlement === 27 ? "bg-teal-600 text-white border-teal-600 active:bg-teal-700 active:border-teal-700" : "bg-card text-muted-foreground border-border hover:border-teal-300 active:bg-muted"}`}
                    >
                      27 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setField("alEntitlement", 32)}
                      className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${formData.alEntitlement === 32 ? "bg-teal-600 text-white border-teal-600 active:bg-teal-700 active:border-teal-700" : "bg-card text-muted-foreground border-border hover:border-teal-300 active:bg-muted"}`}
                    >
                      32 days
                    </button>
                  </div>
                  <FieldError message={errors["al_entitlement"]?.entitlement} />
                </div>
                {showProRata && (
                  <p className="text-[10px] text-muted-foreground italic mt-1">
                    For a {dw}-week rota at {effectiveWte}%, your estimated pro-rata entitlement is approximately {proRata} days.
                  </p>
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
                  type="button"
                  onClick={() => setField("annualLeave", [...formData.annualLeave, { id: genId(), startDate: "", endDate: "", reason: "" }])}
                  className="w-full rounded-lg border border-dashed border-teal-300 h-11 px-4 flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add annual leave
                </button>
                {formData.annualLeave.length > 0 && (
                  <InfoBox type="info">Total AL entered: {alTotalDays} working day(s) (weekends and bank holidays excluded)</InfoBox>
                )}
                {showProRata && alTotalDays > proRata! && (
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
                  type="button"
                  onClick={() => setField("studyLeave", [...formData.studyLeave, { id: genId(), startDate: "", endDate: "", reason: "" }])}
                  className="w-full rounded-lg border border-dashed border-teal-300 h-11 px-4 flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add study leave
                </button>
              </div>
            </SurveySection>

            {/* NOC */}
            <SurveySection number={3} title="Not On-Call (NOC) Dates" badge="medium">
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
                  type="button"
                  onClick={() => setField("nocDates", [...formData.nocDates, { id: genId(), startDate: "", endDate: "", reason: "" }])}
                  className="w-full rounded-lg border border-dashed border-teal-300 h-11 px-4 flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add not-on-call period
                </button>
              </div>
            </SurveySection>

            {/* Rotations */}
            <SurveySection number={4} title="Rotations" badge="hard">
              <div className="space-y-3">
                <p className="text-sm sm:text-base text-card-foreground">Rotating to another hospital during this rota?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHasRotation(false)} className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-semibold border cursor-pointer transition-all ${!hasRotation ? "bg-teal-600 text-white border-teal-600 active:bg-teal-700 active:border-teal-700" : "bg-card text-muted-foreground border-border active:bg-muted"}`}>No</button>
                  <button type="button" onClick={() => setHasRotation(true)} className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-semibold border cursor-pointer transition-all ${hasRotation ? "bg-teal-600 text-white border-teal-600 active:bg-teal-700 active:border-teal-700" : "bg-card text-muted-foreground border-border active:bg-muted"}`}>Yes</button>
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
                      type="button"
                      onClick={() => setField("rotations", [...formData.rotations, { id: genId(), startDate: "", endDate: "", location: "" }])}
                      className="w-full rounded-lg border border-dashed border-teal-300 h-11 px-4 flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-teal-600 cursor-pointer hover:bg-teal-50 transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Add rotation
                    </button>
                  </>
                )}
              </div>
            </SurveySection>

            {/* Overlap warning */}
            {hasOverlap && (
              <InfoBox type="warn">One or more leave entries overlap — please review your dates.</InfoBox>
            )}
          </CardContent>
        </Card>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
