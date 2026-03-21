import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { DateRangePicker } from "@/components/survey/DateRangePicker";
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
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 pb-4 space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          Medical exemptions are confidential and will only be seen by the rota coordinator.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-teal-600" />
              Medical Exemptions
            </CardTitle>
            <CardDescription className="text-xs">Formal exemptions from Occupational Health, your training programme, or other health circumstances.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            {/* Exemptions */}
            <SurveySection number={1} title="Exemptions">
              <div className="space-y-2">
                <InfoBox type="info">Include any formal exemptions from Occupational Health or your training programme, and any relevant health or occupational circumstances.</InfoBox>
                <Textarea
                  value={formData.exemptionDetails}
                  onChange={(e) => setField("exemptionDetails", e.target.value)}
                  placeholder="e.g. Exempt from night shifts — OH recommendation ref. dated 12/01/2025. Cannot work consecutive long days due to health condition."
                  className="bg-muted border-border min-h-[80px] text-sm"
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
                      <label className="text-xs font-medium text-card-foreground block mb-1">Leave period *</label>
                      <DateRangePicker
                        startDate={formData.parentalLeaveStart}
                        endDate={formData.parentalLeaveEnd}
                        onChange={(s, e) => {
                          setField("parentalLeaveStart", s);
                          setField("parentalLeaveEnd", e);
                        }}
                        minDate={rotaInfo?.startDate || undefined}
                        maxDate={rotaInfo?.endDate || undefined}
                        errors={{
                          startDate: errors.parentalLeaveStart,
                          endDate: errors.parentalLeaveEnd,
                        }}
                      />
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

            {/* Other Restrictions */}
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
