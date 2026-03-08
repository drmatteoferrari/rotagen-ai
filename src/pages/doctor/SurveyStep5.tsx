import { useState } from "react";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { DateRangePicker } from "@/components/survey/DateRangePicker";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Info } from "lucide-react";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

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
    if ((formData.exemptFromNights || formData.exemptFromWeekends || formData.exemptFromOncall) && !formData.exemptionDetails.trim()) {
      e.exemptionDetails = "Please provide details for your exemption(s)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) ctx.nextStep(); };

  const toggleSpecificDay = (day: string, checked: boolean) => {
    if (checked) {
      setField("specificDaysOff", [...formData.specificDaysOff, day]);
    } else {
      setField("specificDaysOff", formData.specificDaysOff.filter((d) => d !== day));
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 pb-4 space-y-4">
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
            {/* Shift Exemptions */}
            <SurveySection number={1} title="Shift Exemptions">
              <div className="space-y-3">
                <InfoBox type="info">Only select these if you have a formal exemption from Occupational Health or your training programme.</InfoBox>
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <Checkbox
                    checked={formData.exemptFromNights}
                    onCheckedChange={(v) => setField("exemptFromNights", !!v)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-card-foreground">Exempt from night shifts</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <Checkbox
                    checked={formData.exemptFromWeekends}
                    onCheckedChange={(v) => setField("exemptFromWeekends", !!v)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-card-foreground">Exempt from weekend shifts</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <Checkbox
                    checked={formData.exemptFromOncall}
                    onCheckedChange={(v) => setField("exemptFromOncall", !!v)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-card-foreground">Exempt from on-call duties</span>
                </label>
                {(formData.exemptFromNights || formData.exemptFromWeekends || formData.exemptFromOncall) && (
                  <div className="border-l-2 border-border pl-3 mt-2">
                    <label className="text-xs font-medium text-card-foreground block mb-1">Exemption details *</label>
                    <Textarea
                      value={formData.exemptionDetails}
                      onChange={(e) => setField("exemptionDetails", e.target.value)}
                      placeholder="e.g. OH recommendation ref. dated 12/01/2025"
                      className="bg-muted border-border min-h-[50px] text-sm"
                    />
                    <FieldError message={errors.exemptionDetails} />
                  </div>
                )}
              </div>
            </SurveySection>

            {/* Specific Days Off */}
            <SurveySection number={2} title="Specific Days Off">
              <div className="space-y-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Days you cannot work (beyond LTFT days off).</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                      formData.specificDaysOff.includes(day)
                        ? "border-teal-300 bg-teal-50 text-teal-700 font-semibold"
                        : "border-border text-card-foreground"
                    }`}>
                      <Checkbox
                        checked={formData.specificDaysOff.includes(day)}
                        onCheckedChange={(v) => toggleSpecificDay(day, !!v)}
                        className="h-4 w-4"
                      />
                      {day.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>
            </SurveySection>

            {/* Health & Restrictions */}
            <SurveySection number={3} title="Health & Restrictions">
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
            <SurveySection number={4} title="Parental Leave">
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

            {/* Other */}
            <SurveySection number={5} title="Other Restrictions">
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
