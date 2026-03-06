import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// ✅ Section 4 complete

const GRADE_OPTIONS = [
  "CT1 (or ACCS equivalent)",
  "CT2 (or ACCS equivalent)",
  "CT3 (or ACCS equivalent)",
  "ST4", "ST5", "ST6", "ST7", "ST8", "ST9",
  "Staff Grade / Associate Specialist (SAS)",
  "Post-CCT Fellow",
  "Consultant",
  "Other",
];

export default function SurveyStep1() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!ctx) return null;
  const { formData, setField } = ctx;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.fullName.trim()) e.fullName = "Full name is required";
    if (!formData.nhsEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.nhsEmail)) e.nhsEmail = "A valid email is required";
    if (!formData.phoneNumber.trim()) e.phoneNumber = "Phone number is required";
    if (!formData.grade) e.grade = "Please select your grade";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validate()) ctx.nextStep();
  };

  const dualOther = formData.dualSpecialtyTypes.some((t) => t !== "Emergency Medicine" && t !== "Intensive Care Medicine");

  const toggleDualType = (type: string, checked: boolean) => {
    if (checked) {
      setField("dualSpecialtyTypes", [...formData.dualSpecialtyTypes.filter((t) => t !== type), type]);
    } else {
      setField("dualSpecialtyTypes", formData.dualSpecialtyTypes.filter((t) => t !== type));
    }
  };

  return (
    <>
      <div className="p-4 pb-32 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Personal Details</h1>
          <p className="text-slate-500 text-sm">Please confirm your basic information to get started.</p>
        </div>

        <SurveySection number={1} title="Identification">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name *</label>
              <Input value={formData.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="Dr. Jane Smith" className="bg-slate-50" />
              <FieldError message={errors.fullName} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Work (NHS) Email *</label>
              <Input type="email" value={formData.nhsEmail} onChange={(e) => setField("nhsEmail", e.target.value)} placeholder="j.smith@nhs.net" className="bg-slate-50" />
              <FieldError message={errors.nhsEmail} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Personal Email</label>
              <Input type="email" value={formData.personalEmail} onChange={(e) => setField("personalEmail", e.target.value)} placeholder="jane@gmail.com" className="bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number *</label>
              <Input type="tel" value={formData.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} placeholder="07xxx xxx xxx" className="bg-slate-50" />
              <FieldError message={errors.phoneNumber} />
            </div>
          </div>
        </SurveySection>

        <SurveySection number={2} title="Training Grade & Role">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Grade *</label>
              <select
                value={formData.grade}
                onChange={(e) => setField("grade", e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              >
                <option value="">Select your grade</option>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <FieldError message={errors.grade} />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="dualSpec"
                checked={formData.dualSpecialty}
                onCheckedChange={(v) => {
                  setField("dualSpecialty", !!v);
                  if (!v) setField("dualSpecialtyTypes", []);
                }}
                className="mt-0.5"
              />
              <label htmlFor="dualSpec" className="text-sm text-slate-700 cursor-pointer">Dual training programme</label>
            </div>
            {formData.dualSpecialty && (
              <div className="ml-6 space-y-2 border-l-2 border-slate-200 pl-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.dualSpecialtyTypes.includes("Emergency Medicine")}
                    onCheckedChange={(v) => toggleDualType("Emergency Medicine", !!v)}
                  />
                  <span className="text-sm text-slate-700">Emergency Medicine</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.dualSpecialtyTypes.includes("Intensive Care Medicine")}
                    onCheckedChange={(v) => toggleDualType("Intensive Care Medicine", !!v)}
                  />
                  <span className="text-sm text-slate-700">Intensive Care Medicine</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={dualOther}
                    onCheckedChange={(v) => {
                      if (!v) {
                        setField("dualSpecialtyTypes", formData.dualSpecialtyTypes.filter(
                          (t) => t === "Emergency Medicine" || t === "Intensive Care Medicine"
                        ));
                      } else {
                        setField("dualSpecialtyTypes", [...formData.dualSpecialtyTypes, ""]);
                      }
                    }}
                  />
                  <span className="text-sm text-slate-700">Other</span>
                </div>
                {dualOther && (
                  <Input
                    placeholder="Please specify"
                    value={formData.dualSpecialtyTypes.find((t) => t !== "Emergency Medicine" && t !== "Intensive Care Medicine") || ""}
                    onChange={(e) => {
                      const others = formData.dualSpecialtyTypes.filter(
                        (t) => t === "Emergency Medicine" || t === "Intensive Care Medicine"
                      );
                      setField("dualSpecialtyTypes", e.target.value ? [...others, e.target.value] : others);
                    }}
                    className="bg-slate-50 ml-0"
                  />
                )}
              </div>
            )}
          </div>
        </SurveySection>
      </div>
      <StepNav onNext={handleNext} />
    </>
  );
}
