// SECTION 1 COMPLETE
import { useState } from "react";
import { useSurveyContext, type LtftNightFlex } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, Info, CheckCircle2 } from "lucide-react";

const WTE_OPTIONS = [
  { value: 100, label: "Full-time (100%)", sub: "40–48 h/week" },
  { value: 80, label: "LTFT: 80%", sub: "" },
  { value: 60, label: "LTFT: 60%", sub: "" },
  { value: 40, label: "LTFT: 40%", sub: "" },
  { value: 0, label: "Other LTFT %", sub: "" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const DAY_SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri" } as const;

const GUIDANCE: Record<number, string> = {
  80: "80% WTE → select 1 day off per week",
  60: "60% WTE → select 2 days off per week",
  40: "40% WTE → select 3 days off per week",
};

function expectedDaysOff(wte: number, otherVal: number | null): number {
  const pct = wte === 0 ? (otherVal || 100) : wte;
  if (pct >= 100) return 0;
  return Math.round((1 - pct / 100) * 5);
}

function RadioYN({ value, onChange, label, hint }: { value: boolean | null; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs sm:text-sm font-medium text-card-foreground">{label}</p>
      {hint && <p className="text-[10px] sm:text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${value === true ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>Yes</button>
        <button type="button" onClick={() => onChange(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${value === false ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>No</button>
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
    ? "Select days off matching your WTE percentage"
    : GUIDANCE[formData.wtePercent] || null;

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 pb-4 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          If you work full time, no action is needed here.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-teal-600" />
              Working Pattern
            </CardTitle>
            <CardDescription className="text-xs">Non-working days if LTFT. Full-time: nothing to do.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            <SurveySection number={1} title="WTE" badge="high">
              <div className="space-y-2">
                {WTE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer py-1">
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
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-card-foreground">{opt.label}{opt.sub ? ` — ${opt.sub}` : ""}</span>
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
                      className="bg-muted border-border w-28"
                    />
                    <FieldError message={errors.wteOther} />
                  </div>
                )}

                {formData.wtePercent === 100 && (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Full time — no non-working days to configure.
                  </div>
                )}

                {guidanceText && (
                  <p className="text-[10px] text-muted-foreground italic mt-1">{guidanceText}</p>
                )}
              </div>
            </SurveySection>

            {isLtft && (
              <SurveySection number={2} title="Day(s) Off">
                <div className="space-y-3">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Select your LTFT day(s) off. Consecutive days help night block scheduling.</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <label key={day} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                        formData.ltftDaysOff.includes(day)
                          ? "border-teal-300 bg-teal-50 text-teal-700 font-semibold"
                          : "border-border text-card-foreground"
                      }`}>
                        <Checkbox
                          checked={formData.ltftDaysOff.includes(day)}
                          onCheckedChange={(v) => toggleDay(day, !!v)}
                          className="h-4 w-4"
                        />
                        {DAY_SHORT[day]}
                      </label>
                    ))}
                  </div>
                  <FieldError message={errors.ltftDays} />

                  {formData.ltftDaysOff.length > 0 && formData.ltftDaysOff.length !== expected && (
                    <InfoBox type="warn">
                      Expected {expected} day(s) off — please check.
                    </InfoBox>
                  )}
                </div>
              </SurveySection>
            )}

            {isLtft && formData.ltftDaysOff.length > 0 && (
              <SurveySection number={3} title="Night Flexibility">
                <div className="space-y-3">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Night blocks span 2–4 nights. Can they start/end on your day off?</p>
                  {formData.ltftDaysOff.map((day) => {
                    const flex = formData.ltftNightFlexibility.find((f) => f.day === day);
                    return (
                      <div key={day} className="border border-border rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-semibold text-card-foreground">{day}</h4>
                        <RadioYN
                          label={`Can START nights on ${DAY_SHORT[day as keyof typeof DAY_SHORT] || day}?`}
                          value={flex?.canStart ?? null}
                          onChange={(v) => updateFlex(day, "canStart", v)}
                        />
                        <FieldError message={errors[`flex_start_${day}`]} />
                        <RadioYN
                          label={`Can END nights on ${DAY_SHORT[day as keyof typeof DAY_SHORT] || day}?`}
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
          </CardContent>
        </Card>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}