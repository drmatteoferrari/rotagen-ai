import { useState } from "react";
import { useSurveyContext, type LtftNightFlex } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// ✅ Section 6 complete

const WTE_OPTIONS = [
  { value: 100, label: "Full-time (100%)", sub: "Typically 40–48 hours/week" },
  { value: 80, label: "Less Than Full Time: 80%", sub: "" },
  { value: 60, label: "Less Than Full Time: 60%", sub: "" },
  { value: 40, label: "Less Than Full Time: 40%", sub: "" },
  { value: 0, label: "Other LTFT percentage", sub: "" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

const GUIDANCE: Record<number, string> = {
  80: "Based on 80% WTE: you should select 1 day off per week",
  60: "Based on 60% WTE: you should select 2 days off per week",
  40: "Based on 40% WTE: you should select 3 days off per week",
};

function expectedDaysOff(wte: number, otherVal: number | null): number {
  const pct = wte === 0 ? (otherVal || 100) : wte;
  if (pct >= 100) return 0;
  return Math.round((1 - pct / 100) * 5);
}

function RadioYN({ value, onChange, label, hint }: { value: boolean | null; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${value === true ? "bg-[#0f766e] text-white border-[#0f766e]" : "bg-white text-slate-600 border-slate-200"}`}>Yes</button>
        <button type="button" onClick={() => onChange(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${value === false ? "bg-[#0f766e] text-white border-[#0f766e]" : "bg-white text-slate-600 border-slate-200"}`}>No</button>
      </div>
    </div>
  );
}

export default function SurveyStep3() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!ctx) return null;
  const { formData, setField } = ctx;
  const isLtft = formData.wtePercent !== 100;
  const expected = expectedDaysOff(formData.wtePercent, formData.wteOtherValue);

  const toggleDay = (day: string, checked: boolean) => {
    let newDays: string[];
    if (checked) {
      newDays = [...formData.ltftDaysOff, day];
    } else {
      newDays = formData.ltftDaysOff.filter((d) => d !== day);
    }
    setField("ltftDaysOff", newDays);
    // Update night flexibility
    const newFlex: LtftNightFlex[] = newDays.map((d) => {
      const existing = formData.ltftNightFlexibility.find((f) => f.day === d);
      return existing || { day: d, canStart: null, canEnd: null };
    });
    setField("ltftNightFlexibility", newFlex);
  };

  const updateFlex = (day: string, field: "canStart" | "canEnd", value: boolean) => {
    const newFlex = formData.ltftNightFlexibility.map((f) =>
      f.day === day ? { ...f, [field]: value } : f
    );
    setField("ltftNightFlexibility", newFlex);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (formData.wtePercent === 0 && (formData.wteOtherValue === null || formData.wteOtherValue < 10 || formData.wteOtherValue > 90)) {
      e.wteOther = "Enter a value between 10 and 90";
    }
    if (isLtft && formData.ltftDaysOff.length === 0) {
      e.ltftDays = "Select at least one day off";
    }
    if (isLtft && formData.ltftDaysOff.length > 0) {
      for (const f of formData.ltftNightFlexibility) {
        if (f.canStart === null) e[`flex_start_${f.day}`] = "Required";
        if (f.canEnd === null) e[`flex_end_${f.day}`] = "Required";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) ctx.nextStep(); };

  const guidanceText = formData.wtePercent === 0
    ? "Please select the correct number of days off for your specific WTE percentage"
    : GUIDANCE[formData.wtePercent] || null;

  return (
    <>
      <div className="p-4 pb-32 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Working Pattern</h1>
        </div>

        <InfoBox type="info">High priority — we will try to prioritise and respect your preferences.</InfoBox>

        <SurveySection number={1} title="Contracted Working Pattern" badge="high">
          <div className="space-y-3">
            {WTE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="wte"
                  checked={formData.wtePercent === opt.value}
                  onChange={() => {
                    setField("wtePercent", opt.value);
                    if (opt.value === 100) {
                      setField("ltftDaysOff", []);
                      setField("ltftNightFlexibility", []);
                    }
                  }}
                  className="accent-[#0f766e]"
                />
                <span className="text-sm text-slate-700">{opt.label}{opt.sub ? ` — ${opt.sub}` : ""}</span>
              </label>
            ))}

            {formData.wtePercent === 0 && (
              <div className="ml-6">
                <Input
                  type="number"
                  min={10}
                  max={90}
                  placeholder="e.g. 70"
                  value={formData.wteOtherValue ?? ""}
                  onChange={(e) => setField("wteOtherValue", e.target.value ? Number(e.target.value) : null)}
                  className="bg-slate-50 w-32"
                />
                <FieldError message={errors.wteOther} />
              </div>
            )}

            {guidanceText && (
              <p className="text-xs text-slate-500 italic mt-1">{guidanceText}</p>
            )}
          </div>
        </SurveySection>

        {isLtft && (
          <SurveySection number={2} title="Designated Day(s) Off">
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Select your formal LTFT day(s) off. Where possible choose consecutive days — this helps the algorithm assign night blocks more efficiently.</p>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.ltftDaysOff.includes(day)}
                      onCheckedChange={(v) => toggleDay(day, !!v)}
                    />
                    <span className="text-sm text-slate-700">{day}</span>
                  </div>
                ))}
              </div>
              <FieldError message={errors.ltftDays} />

              {formData.ltftDaysOff.length > 0 && formData.ltftDaysOff.length !== expected && (
                <InfoBox type="warn">
                  Based on your WTE, we would expect {expected} day(s) off — please check this is correct.
                </InfoBox>
              )}
            </div>
          </SurveySection>
        )}

        {isLtft && formData.ltftDaysOff.length > 0 && (
          <SurveySection number={3} title="Night Shift Flexibility">
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Night shifts are allocated as blocks of 2–4 consecutive nights spanning midnight. A block may start or finish on your designated day off — we need to know your flexibility for each LTFT day.</p>
              {formData.ltftDaysOff.map((day) => {
                const flex = formData.ltftNightFlexibility.find((f) => f.day === day);
                return (
                  <div key={day} className="border border-slate-200 rounded-lg p-3 space-y-3">
                    <h4 className="text-sm font-bold text-slate-800">Night flexibility — {day}</h4>
                    <RadioYN
                      label={`Can you START a block of nights on ${day}?`}
                      hint={`Example: If yes and ${day} is your LTFT day, you can start the night on that ${day} evening.`}
                      value={flex?.canStart ?? null}
                      onChange={(v) => updateFlex(day, "canStart", v)}
                    />
                    <FieldError message={errors[`flex_start_${day}`]} />
                    <RadioYN
                      label={`Can you END a block of nights on ${day}?`}
                      hint={`Example: If yes and ${day} is your LTFT day, you can finish the night on that ${day} morning.`}
                      value={flex?.canEnd ?? null}
                      onChange={(v) => updateFlex(day, "canEnd", v)}
                    />
                    <FieldError message={errors[`flex_end_${day}`]} />
                  </div>
                );
              })}
            </div>
          </SurveySection>
        )}
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
