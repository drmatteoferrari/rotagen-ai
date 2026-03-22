import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Info } from "lucide-react";

interface CompBlock {
  key: "iac" | "iaoc" | "icu" | "transfer";
  title: string;
  shortName: string;
  achievedField: "iacAchieved" | "iaocAchieved" | "icuAchieved" | "transferAchieved";
  workingField: "iacWorkingTowards" | "iaocWorkingTowards" | "icuWorkingTowards" | "transferWorkingTowards";
  remoteField: "iacRemoteSupervision" | "iaocRemoteSupervision" | "icuRemoteSupervision" | "transferRemoteSupervision";
  remoteLabel: string;
}

const BLOCKS: CompBlock[] = [
  { key: "iac", shortName: "IAC", title: "IAC — Initial Assessment of Competency", achievedField: "iacAchieved", workingField: "iacWorkingTowards", remoteField: "iacRemoteSupervision", remoteLabel: "Covered anaesthetic on-calls with remote supervision?" },
  { key: "iaoc", shortName: "IAOC", title: "IAOC — Initial Assessment of Obstetrics Competency", achievedField: "iaocAchieved", workingField: "iaocWorkingTowards", remoteField: "iaocRemoteSupervision", remoteLabel: "Covered obstetrics on-calls with remote supervision?" },
  { key: "icu", shortName: "ICU", title: "ICU — Intensive Care Medicine", achievedField: "icuAchieved", workingField: "icuWorkingTowards", remoteField: "icuRemoteSupervision", remoteLabel: "Covered ICU with remote supervision?" },
  { key: "transfer", shortName: "Transfer", title: "Transfers — inter-hospital", achievedField: "transferAchieved", workingField: "transferWorkingTowards", remoteField: "transferRemoteSupervision", remoteLabel: "Performed inter-hospital transfers with remote supervision?" },
];

function RadioYesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm sm:text-base font-medium text-card-foreground">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${value === true ? "bg-teal-600 text-white border-teal-600 active:bg-teal-700 active:border-teal-700" : "bg-card text-muted-foreground border-border hover:border-teal-300 active:bg-muted"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${value === false ? "bg-teal-600 text-white border-teal-600 active:bg-teal-700 active:border-teal-700" : "bg-card text-muted-foreground border-border hover:border-teal-300 active:bg-muted"}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default function SurveyStep2() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!ctx) return null;
  const { formData, setField } = ctx;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    for (const b of BLOCKS) {
      if (formData[b.achievedField] === null) e[b.achievedField] = "Please answer this question";
      if (formData[b.achievedField] === false && formData[b.workingField] === null) e[b.workingField] = "Please answer this question";
      if (formData[b.achievedField] === true && formData[b.remoteField] === null) e[b.remoteField] = "Please answer this question";
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setTimeout(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) {
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
          Tick only competencies with confirmed clinical sign-off.
        </div>

        <Card className="bg-white shadow-sm">
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              Clinical Competencies
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-4">
            {BLOCKS.map((b) => (
              <SurveySection
                key={b.key}
                number={BLOCKS.indexOf(b) + 1}
                title={b.title}
              >
                <div
                  className="space-y-3"
                  data-error={(errors[b.achievedField] || errors[b.workingField] || errors[b.remoteField]) ? "true" : undefined}
                >
                  <RadioYesNo
                    label={b.key === "transfer" ? "Have you achieved Transfer training?" : `Have you achieved ${b.shortName}?`}
                    value={formData[b.achievedField]}
                    onChange={(v) => {
                      setField(b.achievedField, v);
                      if (v) setField(b.workingField, null);
                      else setField(b.remoteField, null);
                    }}
                  />
                  <FieldError message={errors[b.achievedField]} />

                  {formData[b.achievedField] === false && (
                    <>
                      <RadioYesNo
                        label={`Working towards ${b.shortName} this rotation?`}
                        value={formData[b.workingField]}
                        onChange={(v) => setField(b.workingField, v)}
                      />
                      <FieldError message={errors[b.workingField]} />
                    </>
                  )}

                  {formData[b.achievedField] === true && (
                    <>
                      <RadioYesNo
                        label={b.remoteLabel}
                        value={formData[b.remoteField]}
                        onChange={(v) => setField(b.remoteField, v)}
                      />
                      <FieldError message={errors[b.remoteField]} />
                    </>
                  )}
                </div>
              </SurveySection>
            ))}
          </CardContent>
        </Card>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
