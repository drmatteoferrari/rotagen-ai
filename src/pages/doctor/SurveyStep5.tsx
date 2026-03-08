import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Info, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

/* ─── Parental leave date range picker (same pattern as Step 4) ─── */
function ParentalDateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  errors,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
  maxDate?: string;
  errors?: { start?: string; end?: string };
}) {
  const [open, setOpen] = useState(false);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(undefined);

  const selected: DateRange | undefined = pickingEnd
    ? { from: tempFrom, to: undefined }
    : startDate || endDate
      ? {
          from: startDate ? parseISO(startDate) : undefined,
          to: endDate ? parseISO(endDate) : undefined,
        }
      : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    if (!pickingEnd) {
      const clickedDate = range?.from || range?.to;
      if (clickedDate) {
        setTempFrom(clickedDate);
        setPickingEnd(true);
        onChange(format(clickedDate, "yyyy-MM-dd"), "");
      }
      return;
    }
    const to = range?.to || range?.from;
    if (tempFrom && to) {
      const [start, end] = tempFrom <= to ? [tempFrom, to] : [to, tempFrom];
      onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
      setPickingEnd(false);
      setTempFrom(undefined);
      setTimeout(() => setOpen(false), 150);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setPickingEnd(false);
      setTempFrom(undefined);
    }
  };

  const displayText = startDate && endDate
    ? `${format(parseISO(startDate), "d MMM")} → ${format(parseISO(endDate), "d MMM yyyy")}`
    : startDate
    ? `${format(parseISO(startDate), "d MMM yyyy")} → …`
    : "Select dates";

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-10 text-sm",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={1}
            disabled={(date) => {
              if (minDate && date < parseISO(minDate)) return true;
              if (maxDate && date > parseISO(maxDate)) return true;
              return false;
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          {pickingEnd && (
            <p className="text-[10px] text-center text-muted-foreground pb-2">Now select end date</p>
          )}
        </PopoverContent>
      </Popover>
      {errors?.start && <p className="text-xs text-destructive">{errors.start}</p>}
      {errors?.end && <p className="text-xs text-destructive">{errors.end}</p>}
    </div>
  );
}

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
                      <label className="text-xs font-medium text-card-foreground block mb-1">Leave period *</label>
                      <ParentalDateRangePicker
                        startDate={formData.parentalLeaveStart}
                        endDate={formData.parentalLeaveEnd}
                        onChange={(s, e) => {
                          setField("parentalLeaveStart", s);
                          setField("parentalLeaveEnd", e);
                        }}
                        minDate={rotaInfo?.startDate || undefined}
                        maxDate={rotaInfo?.endDate || undefined}
                        errors={{
                          start: errors.parentalLeaveStart,
                          end: errors.parentalLeaveEnd,
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
