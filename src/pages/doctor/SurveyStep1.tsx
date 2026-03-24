import { useState, useEffect } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";

import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STANDARD_TYPES = ["Emergency Medicine", "Intensive Care Medicine"];

export default function SurveyStep1() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otherDualText, setOtherDualText] = useState("");

  if (!ctx) return null;
  const { formData, setField } = ctx;

  const dualOther = formData.dualSpecialtyTypes.some((t) => !STANDARD_TYPES.includes(t));

  // Initialise otherDualText from existing data
  useEffect(() => {
    const existing = formData.dualSpecialtyTypes.find((t) => !STANDARD_TYPES.includes(t));
    if (existing) setOtherDualText(existing);
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.fullName.trim()) e.fullName = "Full name is required";
    if (!formData.nhsEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.nhsEmail)) e.nhsEmail = "A valid email is required";
    if (!formData.phoneNumber.trim()) e.phoneNumber = "Phone number is required";
    if (!formData.grade) e.grade = "Please select your grade";
    setErrors(e);
    return Object.keys(e).length === 0;
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

  const toggleDualType = (type: string, checked: boolean) => {
    if (checked) {
      setField("dualSpecialtyTypes", [...formData.dualSpecialtyTypes.filter((t) => t !== type), type]);
    } else {
      setField("dualSpecialtyTypes", formData.dualSpecialtyTypes.filter((t) => t !== type));
    }
  };

  return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 space-y-4 sm:space-y-6">
        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-teal-600" />
          Confirm your details.
        </div>

        <Card className="bg-white shadow-sm" data-error={Object.keys(errors).length > 0 ? "true" : undefined}>
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-5 w-5 text-teal-600" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-4">
            <SurveySection number={1} title="Identification">
              <div className="space-y-3">
                {/* Full Name */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <span className="text-sm sm:text-base font-medium text-card-foreground">Full Name *</span>
                  <Input value={formData.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="Dr. Jane Smith" className="w-full bg-muted border-border" />
                </div>
                <FieldError message={errors.fullName} />

                {/* NHS Email */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <span className="text-sm sm:text-base font-medium text-card-foreground">Work (NHS) Email *</span>
                  <Input type="email" value={formData.nhsEmail} onChange={(e) => setField("nhsEmail", e.target.value)} placeholder="j.smith@nhs.net" className="w-full bg-muted border-border" />
                </div>
                <FieldError message={errors.nhsEmail} />

                {/* Personal Email */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <span className="text-sm sm:text-base font-medium text-card-foreground">Personal Email</span>
                  <Input type="email" value={formData.personalEmail} onChange={(e) => setField("personalEmail", e.target.value)} placeholder="jane@gmail.com" className="w-full bg-muted border-border" />
                </div>

                {/* Phone */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <span className="text-sm sm:text-base font-medium text-card-foreground">Phone Number *</span>
                  <Input type="tel" value={formData.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} placeholder="07xxx xxx xxx" className="w-full bg-muted border-border" />
                </div>
                <FieldError message={errors.phoneNumber} />
              </div>
            </SurveySection>

            <SurveySection number={2} title="Training Grade & Role">
              <div className="space-y-3">
                {/* Grade */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <span className="text-sm sm:text-base font-medium text-card-foreground">Grade *</span>
                  <select
                    value={formData.grade}
                    onChange={(e) => setField("grade", e.target.value)}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm cursor-pointer"
                  >
                    <option value="">Select grade</option>
                    {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <FieldError message={errors.grade} />

                <label className="flex items-start gap-2 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer">
                  <Checkbox
                    id="dualSpec"
                    checked={formData.dualSpecialty}
                    onCheckedChange={(v) => {
                      setField("dualSpecialty", !!v);
                      if (!v) { setField("dualSpecialtyTypes", []); setOtherDualText(""); }
                    }}
                    className="mt-0.5"
                  />
                  <span className="text-sm sm:text-base text-card-foreground">Dual training programme</span>
                </label>
                {formData.dualSpecialty && (
                  <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
                    <label className="flex items-center gap-2 cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3">
                      <Checkbox
                        checked={formData.dualSpecialtyTypes.includes("Emergency Medicine")}
                        onCheckedChange={(v) => toggleDualType("Emergency Medicine", !!v)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm sm:text-base text-card-foreground">Emergency Medicine</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3">
                      <Checkbox
                        checked={formData.dualSpecialtyTypes.includes("Intensive Care Medicine")}
                        onCheckedChange={(v) => toggleDualType("Intensive Care Medicine", !!v)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm sm:text-base text-card-foreground">Intensive Care Medicine</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3">
                      <Checkbox
                        checked={dualOther}
                        onCheckedChange={(v) => {
                          if (!v) {
                            setField("dualSpecialtyTypes", formData.dualSpecialtyTypes.filter(
                              (t) => STANDARD_TYPES.includes(t)
                            ));
                            setOtherDualText("");
                          } else {
                            setField("dualSpecialtyTypes", [...formData.dualSpecialtyTypes, ""]);
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm sm:text-base text-card-foreground">Other</span>
                    </label>
                    {dualOther && (
                      <Input
                        placeholder="Please specify"
                        value={otherDualText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOtherDualText(val);
                          const others = formData.dualSpecialtyTypes.filter((t) => STANDARD_TYPES.includes(t));
                          setField("dualSpecialtyTypes", val ? [...others, val] : others);
                        }}
                        className="bg-muted border-border"
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
