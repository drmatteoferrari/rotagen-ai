import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, ArrowRight, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

export default function RotaPeriodStep1() {
  const navigate = useNavigate();
  const {
    rotaStartDate, rotaEndDate, setRotaStartDate, setRotaEndDate,
    setPeriodWorkingStateLoaded,
  } = useAdminSetup();

  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: rotaStartDate,
    to: rotaEndDate,
  });

  // Responsive calendar months
  const [calendarMonths, setCalendarMonths] = useState(1);
  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1280) setCalendarMonths(3);
      else if (window.innerWidth >= 768) setCalendarMonths(2);
      else setCalendarMonths(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleDayClick = (day: Date) => {
    let newRange: { from: Date | undefined; to: Date | undefined };
    if (!range.from || (range.from && range.to)) {
      newRange = { from: day, to: undefined };
    } else {
      if (day > range.from) {
        newRange = { from: range.from, to: day };
      } else {
        newRange = { from: day, to: undefined };
      }
    }
    setRange(newRange);

    // Check if dates actually changed — if so, signal Step 2 to recalculate BH
    const prevStart = rotaStartDate?.getTime();
    const prevEnd = rotaEndDate?.getTime();
    const newStart = newRange.from?.getTime();
    const newEnd = newRange.to?.getTime();

    setRotaStartDate(newRange.from);
    setRotaEndDate(newRange.to);

    if (newStart !== prevStart || newEnd !== prevEnd) {
      setPeriodWorkingStateLoaded(false);
    }
  };

  const durationInfo = (() => {
    if (!range.from || !range.to) return null;
    const days = differenceInDays(range.to, range.from);
    if (days <= 0) return { error: true, text: "End date must be after start date." };
    const weeks = (days / 7).toFixed(1);
    return { error: false, text: `${days} days · ${weeks} weeks` };
  })();

  const handleContinue = () => {
    if (!range.from || !range.to) {
      toast.error("Please select both a start and end date.");
      return;
    }
    if (differenceInDays(range.to, range.from) <= 0) {
      toast.error("End date must be after start date.");
      return;
    }
    navigate("/admin/rota-period/step-2");
  };

  const calendarHint = !range.from
    ? "Select a start date"
    : !range.to
    ? "Now select an end date"
    : null;

  return (
    <AdminLayout title="Rota Period" subtitle="Step 1 of 2 — Select the rota dates" accentColor="yellow">
      <div className="mx-auto max-w-3xl space-y-3 sm:space-y-6 animate-fadeSlideUp">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          Set the rota start and end dates.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-600" />
              Rota Dates
            </CardTitle>
            
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hint text */}
            {calendarHint && (
              <p className="text-sm font-medium text-amber-600 text-center">{calendarHint}</p>
            )}

            {/* Inline range calendar */}
            <div className="w-full overflow-x-hidden">
              <Calendar
                mode="range"
                selected={{ from: range.from, to: range.to } as DateRange}
                onDayClick={handleDayClick}
                numberOfMonths={calendarMonths}
                className="w-full p-3 pointer-events-auto"
                classNames={{ months: "flex flex-wrap gap-4 justify-center" }}
              />
            </div>

            {/* Duration pill */}
            {durationInfo && (
              <div className="flex justify-center">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold",
                  durationInfo.error
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                )}>
                  {durationInfo.error
                    ? <AlertTriangle className="h-3.5 w-3.5" />
                    : <CheckCircle className="h-3.5 w-3.5" />}
                  {durationInfo.text}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleContinue} className="bg-amber-600 hover:bg-amber-700">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
