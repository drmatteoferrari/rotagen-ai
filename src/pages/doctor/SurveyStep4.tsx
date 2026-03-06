import { useState } from "react";
import { useSurveyContext, type LeaveEntry, type RotationEntry } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

// ✅ Section 7 complete

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
    <div className="border border-slate-200 rounded-lg p-3 space-y-2 relative">
      <button onClick={onRemove} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-500">From</label>
          <Input type="date" value={entry.startDate} min={rotaStart} max={rotaEnd} onChange={(e) => onChange({ ...entry, startDate: e.target.value })} className="bg-slate-50 text-sm" />
          <FieldError message={errors.startDate} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">To</label>
          <Input type="date" value={entry.endDate} min={rotaStart} max={rotaEnd} onChange={(e) => onChange({ ...entry, endDate: e.target.value })} className="bg-slate-50 text-sm" />
          <FieldError message={errors.endDate} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">{reasonLabel}{reasonRequired ? " *" : ""}</label>
        <Input value={entry.reason} onChange={(e) => onChange({ ...entry, reason: e.target.value })} placeholder={reasonPlaceholder} className="bg-slate-50 text-sm" />
        <FieldError message={errors.reason} />
      </div>
    </div>
  );
}

function RotationRow({ entry, onChange, onRemove, rotaStart, rotaEnd, errors = {} }: { entry: RotationEntry; onChange: (e: RotationEntry) => void; onRemove: () => void; rotaStart?: string; rotaEnd?: string; errors?: Record<string, string> }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2 relative">
      <button onClick={onRemove} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-500">From</label>
          <Input type="date" value={entry.startDate} min={rotaStart} max={rotaEnd} onChange={(e) => onChange({ ...entry, startDate: e.target.value })} className="bg-slate-50 text-sm" />
          <FieldError message={errors.startDate} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">To</label>
          <Input type="date" value={entry.endDate} min={rotaStart} max={rotaEnd} onChange={(e) => onChange({ ...entry, endDate: e.target.value })} className="bg-slate-50 text-sm" />
          <FieldError message={errors.endDate} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Location / department *</label>
        <Input value={entry.location} onChange={(e) => onChange({ ...entry, location: e.target.value })} placeholder="e.g. Royal Liverpool Hospital — ICU" className="bg-slate-50 text-sm" />
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

  // AL calculation
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
      <div className="p-4 pb-32 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Leave & Unavailability</h1>
        </div>

        <InfoBox type="danger">Enter all known leave now. Changes after submission require coordinator approval and may not be respected.</InfoBox>

        {/* Annual Leave */}
        <SurveySection number={1} title="Annual Leave" badge="high">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">AL entitlement *</label>
              <select
                value={formData.alEntitlement ?? ""}
                onChange={(e) => setField("alEntitlement", e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="">Select entitlement</option>
                <option value="27">27 days — first NHS appointment</option>
                <option value="32">32 days — after 5 years NHS service</option>
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-[#0f766e] hover:text-[#0f766e] transition-colors"
            >
              <Plus className="h-4 w-4" /> Add annual leave period
            </button>
            {formData.annualLeave.length > 0 && (
              <InfoBox type="info">Total AL entered: {alTotalDays} days (including weekends — subtract weekends and bank holidays for working days)</InfoBox>
            )}
            {proRata !== null && alTotalDays > 2 * proRata && (
              <InfoBox type="warn">High leave entered — please check this does not exceed your pro-rata entitlement. Excessive leave may significantly affect scheduling fairness.</InfoBox>
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
                reasonPlaceholder="e.g. Primary FRCA, ALS course, ARCP"
                errors={errors[`sl_${i}`]}
              />
            ))}
            <button
              onClick={() => setField("studyLeave", [...formData.studyLeave, { id: genId(), startDate: "", endDate: "", reason: "" }])}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-[#0f766e] hover:text-[#0f766e] transition-colors"
            >
              <Plus className="h-4 w-4" /> Add study leave period
            </button>
          </div>
        </SurveySection>

        {/* NOC */}
        <SurveySection number={3} title="Prefer Not On-Call (NOC)" badge="medium">
          <div className="space-y-3">
            <InfoBox type="info">On these dates you will not be allocated on-call duties, but you may still be assigned standard day shifts. Use annual leave if you want to be certain of the whole day off.</InfoBox>
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-[#0f766e] hover:text-[#0f766e] transition-colors"
            >
              <Plus className="h-4 w-4" /> Add not-on-call date/period
            </button>
          </div>
        </SurveySection>

        {/* Rotations */}
        <SurveySection number={4} title="Rotations in Other Hospitals" badge="hard">
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Are you expected to rotate to another hospital or department during this rota period?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasRotation(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${!hasRotation ? "bg-[#0f766e] text-white border-[#0f766e]" : "bg-white text-slate-600 border-slate-200"}`}>No</button>
              <button type="button" onClick={() => setHasRotation(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${hasRotation ? "bg-[#0f766e] text-white border-[#0f766e]" : "bg-white text-slate-600 border-slate-200"}`}>Yes</button>
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-[#0f766e] hover:text-[#0f766e] transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add rotation period
                </button>
              </>
            )}
          </div>
        </SurveySection>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
