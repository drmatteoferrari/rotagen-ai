import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Info } from "lucide-react";

const GRADE_OPTIONS = [
  "CT1 (or ACCS)",
  "CT2 (or ACCS)",
  "CT3 (or ACCS)",
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
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 text-teal-600" />
          Confirm your details. Your WTE determines your proportional share of shifts.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-teal-600" />
              Personal Details
            </CardTitle>
            <CardDescription>Name, grade, and WTE. Used to calculate your fair share of shifts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SurveySection number={1} title="Identification">
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Full Name</span>
                    <span className="text-xs text-muted-foreground">As it should appear on the rota</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input value={formData.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="Dr. Jane Smith" className="w-[180px] bg-muted border-border" />
                </div>
                <FieldError message={errors.fullName} />

                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Work (NHS) Email</span>
                    <span className="text-xs text-muted-foreground">For rota communications</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input type="email" value={formData.nhsEmail} onChange={(e) => setField("nhsEmail", e.target.value)} placeholder="j.smith@nhs.net" className="w-[180px] bg-muted border-border" />
                </div>
                <FieldError message={errors.nhsEmail} />

                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Personal Email</span>
                    <span className="text-xs text-muted-foreground">Optional backup contact</span>
                  </div>
                  <Input type="email" value={formData.personalEmail} onChange={(e) => setField("personalEmail", e.target.value)} placeholder="jane@gmail.com" className="w-[180px] bg-muted border-border" />
                </div>

                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Phone Number</span>
                    <span className="text-xs text-muted-foreground">For urgent rota changes</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input type="tel" value={formData.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} placeholder="07xxx xxx xxx" className="w-[180px] bg-muted border-border" />
                </div>
                <FieldError message={errors.phoneNumber} />
              </div>
            </SurveySection>

            <SurveySection number={2} title="Training Grade & Role">
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Grade</span>
                    <span className="text-xs text-muted-foreground">Your current training level</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <select
                    value={formData.grade}
                    onChange={(e) => setField("grade", e.target.value)}
                    className="w-[180px] rounded-md border border-border bg-muted px-3 py-2 text-sm"
                  >
                    <option value="">Select grade</option>
                    {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <FieldError message={errors.grade} />

                <div className="flex items-start gap-2 px-4">
                  <Checkbox
                    id="dualSpec"
                    checked={formData.dualSpecialty}
                    onCheckedChange={(v) => {
                      setField("dualSpecialty", !!v);
                      if (!v) setField("dualSpecialtyTypes", []);
                    }}
                    className="mt-0.5"
                  />
                  <label htmlFor="dualSpec" className="text-sm text-card-foreground cursor-pointer">Dual training programme</label>
                </div>
                {formData.dualSpecialty && (
                  <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.dualSpecialtyTypes.includes("Emergency Medicine")}
                        onCheckedChange={(v) => toggleDualType("Emergency Medicine", !!v)}
                      />
                      <span className="text-sm text-card-foreground">Emergency Medicine</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.dualSpecialtyTypes.includes("Intensive Care Medicine")}
                        onCheckedChange={(v) => toggleDualType("Intensive Care Medicine", !!v)}
                      />
                      <span className="text-sm text-card-foreground">Intensive Care Medicine</span>
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
                      <span className="text-sm text-card-foreground">Other</span>
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
                        className="bg-muted border-border ml-0"
                      />
                    )}
                  </div>
                )}
              </div>
            </SurveySection>
          </CardContent>
        </Card>
      </div>
      <StepNav onNext={handleNext} />
    </>
  );
}
