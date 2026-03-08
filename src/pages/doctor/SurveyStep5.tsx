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
      <div className="p-3 sm:p-4 pb-4 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          Medical exemptions are treated as confidential.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-teal-600" />
              Exemptions & Preferences
            </CardTitle>
            <CardDescription className="text-xs">Medical exemptions and shift preferences.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            {/* Health & Restrictions */}
            <SurveySection number={1} title="Health & Restrictions">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-card-foreground block">Health, personal, or occupational circumstances</label>
                <InfoBox type="info">Confidential — seen only by the rota coordinator.</InfoBox>
                <Textarea
                  value={formData.otherRestrictions}
                  onChange={(e) => setField("otherRestrictions", e.target.value)}
                  placeholder="e.g. Cannot work nights due to OH recommendation."
                  className="bg-muted border-border min-h-[70px] text-sm"
                />
              </div>
            </SurveySection>

            {/* Parental Leave */}
            <SurveySection number={2} title="Parental Leave">
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-card-foreground">Expecting parental leave during this rota?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setField("parentalLeaveExpected", false)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${!formData.parentalLeaveExpected ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>No</button>
                  <button type="button" onClick={() => setField("parentalLeaveExpected", true)} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${formData.parentalLeaveExpected ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"}`}>Yes</button>
                </div>
                {formData.parentalLeaveExpected && (
                  <div className="space-y-3 border-l-2 border-border pl-3 mt-2">
                    <div>
                      <label className="text-xs font-medium text-card-foreground block mb-1">Expected start *</label>
                      <Input
                        type="date"
                        value={formData.parentalLeaveStart}
                        min={rotaInfo?.startDate || undefined}
                        max={rotaInfo?.endDate || undefined}
                        onChange={(e) => setField("parentalLeaveStart", e.target.value)}
                        className="bg-muted border-border w-full"
                      />
                      <FieldError message={errors.parentalLeaveStart} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-card-foreground block mb-1">Expected end *</label>
                      <Input
                        type="date"
                        value={formData.parentalLeaveEnd}
                        min={formData.parentalLeaveStart || undefined}
                        onChange={(e) => setField("parentalLeaveEnd", e.target.value)}
                        className="bg-muted border-border w-full"
                      />
                      <FieldError message={errors.parentalLeaveEnd} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-card-foreground block mb-1">Notes *</label>
                      <Textarea
                        value={formData.parentalLeaveNotes}
                        onChange={(e) => setField("parentalLeaveNotes", e.target.value)}
                        placeholder="e.g. Maternity leave starting week 6."
                        className="bg-muted border-border min-h-[50px] text-sm"
                      />
                      <FieldError message={errors.parentalLeaveNotes} />
                    </div>
                  </div>
                )}
              </div>
            </SurveySection>

            {/* Other */}
            <SurveySection number={3} title="Other Restrictions">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-card-foreground block mb-1">Other scheduling constraints</label>
                <Textarea
                  value={formData.otherSchedulingRestrictions}
                  onChange={(e) => setField("otherSchedulingRestrictions", e.target.value)}
                  className="bg-muted border-border min-h-[70px] text-sm"
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
