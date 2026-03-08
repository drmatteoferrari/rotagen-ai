import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Info } from "lucide-react";

export default function SurveyStep5() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!ctx) return null;
  const { formData, setField, rotaInfo } = ctx;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (formData.parentalLeaveExpected) {
      if (!formData.parentalLeaveStart) e.parentalLeaveStart = "Start date is required";
      else if (rotaInfo?.startDate && formData.parentalLeaveStart < rotaInfo.startDate) e.parentalLeaveStart = "Must be within the rota period";
      else if (rotaInfo?.endDate && formData.parentalLeaveStart > rotaInfo.endDate) e.parentalLeaveStart = "Must be within the rota period";
      if (!formData.parentalLeaveEnd) e.parentalLeaveEnd = "End date is required";
      else if (formData.parentalLeaveStart && formData.parentalLeaveEnd < formData.parentalLeaveStart) e.parentalLeaveEnd = "End must be on or after start";
      if (!formData.parentalLeaveNotes.trim()) e.parentalLeaveNotes = "Please provide details";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) ctx.nextStep(); };

  return (
    <>
      <div className="p-4 pb-32 space-y-6">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 text-teal-600" />
          Medical exemptions are treated as confidential by the coordinator.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-teal-600" />
              Exemptions & Preferences
            </CardTitle>
            <CardDescription>Medical exemptions and shift preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Health & Restrictions */}
            <SurveySection number={1} title="Health & Restrictions">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-card-foreground block">Health, personal, or occupational circumstances affecting shift allocation</label>
                <InfoBox type="info">This information is confidential and seen only by the rota coordinator.</InfoBox>
                <Textarea
                  value={formData.otherRestrictions}
                  onChange={(e) => setField("otherRestrictions", e.target.value)}
                  placeholder="e.g. Cannot work nights due to OH recommendation. Adjusted duties — no weekend on-call. No restrictions."
                  className="bg-muted border-border min-h-[80px]"
                />
              </div>
            </SurveySection>

            {/* Parental Leave */}
            <SurveySection number={2} title="Parental Leave">
              <div className="space-y-3">
                <p className="text-sm text-card-foreground">Are you expecting to start parental leave during this rota period?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setField("parentalLeaveExpected", false)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${!formData.parentalLeaveExpected ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>No</button>
                  <button type="button" onClick={() => setField("parentalLeaveExpected", true)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${formData.parentalLeaveExpected ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>Yes</button>
                </div>
                {formData.parentalLeaveExpected && (
                  <div className="space-y-3 border-l-2 border-border pl-4 mt-2">
                    <div>
                      <label className="text-sm font-medium text-card-foreground block mb-1">Expected start date *</label>
                      <Input
                        type="date"
                        value={formData.parentalLeaveStart}
                        min={rotaInfo?.startDate || undefined}
                        max={rotaInfo?.endDate || undefined}
                        onChange={(e) => setField("parentalLeaveStart", e.target.value)}
                        className="bg-muted border-border"
                      />
                      <FieldError message={errors.parentalLeaveStart} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-card-foreground block mb-1">Expected end date *</label>
                      <Input
                        type="date"
                        value={formData.parentalLeaveEnd}
                        min={formData.parentalLeaveStart || undefined}
                        onChange={(e) => setField("parentalLeaveEnd", e.target.value)}
                        className="bg-muted border-border"
                      />
                      <FieldError message={errors.parentalLeaveEnd} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-card-foreground block mb-1">Reason / notes *</label>
                      <Textarea
                        value={formData.parentalLeaveNotes}
                        onChange={(e) => setField("parentalLeaveNotes", e.target.value)}
                        placeholder="e.g. Maternity leave starting week 6. Paternity leave — 2 weeks from expected due date."
                        className="bg-muted border-border min-h-[60px]"
                      />
                      <FieldError message={errors.parentalLeaveNotes} />
                    </div>
                  </div>
                )}
              </div>
            </SurveySection>

            {/* Other Scheduling Restrictions */}
            <SurveySection number={3} title="Other Scheduling Restrictions">
              <div>
                <label className="text-sm font-semibold text-card-foreground block mb-1">Any other scheduling constraints not covered above</label>
                <Textarea
                  value={formData.otherSchedulingRestrictions}
                  onChange={(e) => setField("otherSchedulingRestrictions", e.target.value)}
                  className="bg-muted border-border min-h-[80px]"
                />
              </div>
            </SurveySection>
          </CardContent>
        </Card>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
