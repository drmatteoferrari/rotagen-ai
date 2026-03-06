import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";

// ✅ Section 5 complete

interface CompBlock {
  key: "iac" | "iaoc" | "icu" | "transfer";
  title: string;
  achievedField: "iacAchieved" | "iaocAchieved" | "icuAchieved" | "transferAchieved";
  workingField: "iacWorkingTowards" | "iaocWorkingTowards" | "icuWorkingTowards" | "transferWorkingTowards";
  remoteField: "iacRemoteSupervision" | "iaocRemoteSupervision" | "icuRemoteSupervision" | "transferRemoteSupervision";
}

const BLOCKS: CompBlock[] = [
  { key: "iac", title: "IAC — Initial Assessment of Competency", achievedField: "iacAchieved", workingField: "iacWorkingTowards", remoteField: "iacRemoteSupervision" },
  { key: "iaoc", title: "IAOC — Initial Assessment of Obstetrics Competency", achievedField: "iaocAchieved", workingField: "iaocWorkingTowards", remoteField: "iaocRemoteSupervision" },
  { key: "icu", title: "ICU — Intensive Care Medicine", achievedField: "icuAchieved", workingField: "icuWorkingTowards", remoteField: "icuRemoteSupervision" },
  { key: "transfer", title: "Transfer", achievedField: "transferAchieved", workingField: "transferWorkingTowards", remoteField: "transferRemoteSupervision" },
];

function RadioYesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-all ${value === true ? "bg-[#0f766e] text-white border-[#0f766e]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-all ${value === false ? "bg-[#0f766e] text-white border-[#0f766e]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
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
      <div className="p-4 pb-32 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Competencies & Scope of Practice</h1>
        </div>

        <InfoBox type="info">These answers determine whether you can be allocated on certain lists.</InfoBox>

        {BLOCKS.map((b) => (
          <SurveySection key={b.key} number={BLOCKS.indexOf(b) + 1} title={b.title}>
            <div className="space-y-4">
              <RadioYesNo
                label={`Have you achieved ${b.title.split(" — ")[0]}?`}
                value={formData[b.achievedField]}
                onChange={(v) => {
                  setField(b.achievedField, v);
                  // Clear follow-ups when toggling
                  if (v) setField(b.workingField, null);
                  else setField(b.remoteField, null);
                }}
              />
              <FieldError message={errors[b.achievedField]} />

              {formData[b.achievedField] === false && (
                <>
                  <RadioYesNo
                    label={`Working towards ${b.title.split(" — ")[0]} this rotation?`}
                    value={formData[b.workingField]}
                    onChange={(v) => setField(b.workingField, v)}
                  />
                  <FieldError message={errors[b.workingField]} />
                </>
              )}

              {formData[b.achievedField] === true && (
                <>
                  <RadioYesNo
                    label={`Already covered ${b.title.split(" — ")[0]} with remote supervision?`}
                    value={formData[b.remoteField]}
                    onChange={(v) => setField(b.remoteField, v)}
                  />
                  <FieldError message={errors[b.remoteField]} />
                </>
              )}
            </div>
          </SurveySection>
        ))}
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
