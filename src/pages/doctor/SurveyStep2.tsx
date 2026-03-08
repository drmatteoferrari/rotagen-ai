import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stethoscope, Info } from "lucide-react";

interface CompBlock {
  key: "iac" | "iaoc" | "icu" | "transfer";
  title: string;
  shortName: string;
  achievedField: "iacAchieved" | "iaocAchieved" | "icuAchieved" | "transferAchieved";
  workingField: "iacWorkingTowards" | "iaocWorkingTowards" | "icuWorkingTowards" | "transferWorkingTowards";
  remoteField: "iacRemoteSupervision" | "iaocRemoteSupervision" | "icuRemoteSupervision" | "transferRemoteSupervision";
}

const BLOCKS: CompBlock[] = [
  { key: "iac", shortName: "IAC", title: "IAC — Initial Assessment of Competency", achievedField: "iacAchieved", workingField: "iacWorkingTowards", remoteField: "iacRemoteSupervision" },
  { key: "iaoc", shortName: "IAOC", title: "IAOC — Initial Assessment of Obstetrics Competency", achievedField: "iaocAchieved", workingField: "iaocWorkingTowards", remoteField: "iaocRemoteSupervision" },
  { key: "icu", shortName: "ICU", title: "ICU — Intensive Care Medicine", achievedField: "icuAchieved", workingField: "icuWorkingTowards", remoteField: "icuRemoteSupervision" },
  { key: "transfer", shortName: "Transfer", title: "Transfer", achievedField: "transferAchieved", workingField: "transferWorkingTowards", remoteField: "transferRemoteSupervision" },
];

function RadioYesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs sm:text-sm font-medium text-card-foreground">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${value === true ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border hover:border-teal-300"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${value === false ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border hover:border-teal-300"}`}
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
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) ctx.nextStep(); };

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 pb-4 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          Only tick competencies where you have confirmed clinical sign-off.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              Clinical Competencies
            </CardTitle>
            <CardDescription className="text-xs">Areas you are trained and signed off to work in.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            {BLOCKS.map((b) => (
              <SurveySection key={b.key} number={BLOCKS.indexOf(b) + 1} title={b.title}>
                <div className="space-y-3">
                  <RadioYesNo
                    label={`Have you achieved ${b.shortName}?`}
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
                        label={`Covered ${b.shortName} with remote supervision?`}
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