import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, ArrowRight, Info, AlertTriangle, CheckCircle, RotateCcw } from "lucide-react";
import { format, differenceInDays, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { useRotaConfigDetailsQuery } from "@/hooks/useAdminQueries";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

const DAY_COL_MAP: Record<number, string> = {
  0: "applicable_sun",
  1: "applicable_mon",
  2: "applicable_tue",
  3: "applicable_wed",
  4: "applicable_thu",
  5: "applicable_fri",
  6: "applicable_sat",
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export default function RotaPeriodStep1() {
  const navigate = useNavigate();
  const {
    rotaStartDate, rotaEndDate, setRotaStartDate, setRotaEndDate,
    rotaStartTime, rotaEndTime, setRotaStartTime, setRotaEndTime,
  } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();
  const { data: configDetails } = useRotaConfigDetailsQuery();

  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: rotaStartDate,
    to: rotaEndDate,
  });
  const [startTime, setStartTime] = useState(rotaStartTime || "08:00");
  const [endTime, setEndTime] = useState(rotaEndTime || "08:00");
  const [timesAutoSet, setTimesAutoSet] = useState(false);
  const [startTimeManual, setStartTimeManual] = useState(false);
  const [endTimeManual, setEndTimeManual] = useState(false);
  const [autoStartTime, setAutoStartTime] = useState("");
  const [autoEndTime, setAutoEndTime] = useState("");

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

  // Restore saved times from DB
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!configDetails) return;
    const cd = configDetails as any;
    const savedStart = cd.rota_start_time ? String(cd.rota_start_time).slice(0, 5) : null;
    const savedEnd = cd.rota_end_time ? String(cd.rota_end_time).slice(0, 5) : null;
    if (savedStart) {
      setStartTime(savedStart);
      setRotaStartTime(savedStart);
    }
    if (savedEnd) {
      setEndTime(savedEnd);
      setRotaEndTime(savedEnd);
    }
    restoredRef.current = true;
  }, [configDetails]);

  // Auto-derive times from shift types when dates change
  useEffect(() => {
    if (!range.from || !range.to || !currentRotaConfigId) return;
    const derive = async () => {
      const { data: shifts } = await supabase
        .from("shift_types")
        .select("id, shift_key, name, start_time, end_time, applicable_mon, applicable_tue, applicable_wed, applicable_thu, applicable_fri, applicable_sat, applicable_sun")
        .eq("rota_config_id", currentRotaConfigId);
      if (!shifts || shifts.length === 0) return;

      // Derive start time from first day
      const startDow = getDay(range.from!);
      const startCol = DAY_COL_MAP[startDow];
      const startDayShifts = shifts.filter((s: any) => s[startCol] === true);
      if (startDayShifts.length > 0) {
        const minStart = startDayShifts
          .map((s: any) => String(s.start_time).slice(0, 5))
          .sort()[0];
        setAutoStartTime(minStart);
        if (!startTimeManual) {
          setStartTime(minStart);
          setTimesAutoSet(true);
        }
      }

      // Derive end time from last day — handle midnight-crossing shifts
      const endDow = getDay(range.to!);
      const endCol = DAY_COL_MAP[endDow];
      const endDayShifts = shifts.filter((s: any) => s[endCol] === true);
      if (endDayShifts.length > 0) {
        const effectiveEndMinutes = endDayShifts.map((s: any) => {
          const et = String(s.end_time).slice(0, 5);
          const st = String(s.start_time).slice(0, 5);
          const etMin = toMinutes(et);
          const stMin = toMinutes(st);
          return etMin < stMin ? etMin + 1440 : etMin;
        });
        const maxEffectiveMinutes = Math.max(...effectiveEndMinutes);
        const finalMinutes = maxEffectiveMinutes % 1440;
        const derivedEndTime = `${String(Math.floor(finalMinutes / 60)).padStart(2, "0")}:${String(finalMinutes % 60).padStart(2, "0")}`;
        setAutoEndTime(derivedEndTime);
        if (!endTimeManual) {
          setEndTime(derivedEndTime);
          setTimesAutoSet(true);
        }
      }
    };
    derive();
  }, [range.from, range.to, currentRotaConfigId, startTimeManual, endTimeManual]);

  const handleDayClick = (day: Date) => {
    if (!range.from || (range.from && range.to)) {
      setRange({ from: day, to: undefined });
    } else {
      if (day > range.from) {
        setRange({ from: range.from, to: day });
      } else {
        setRange({ from: day, to: undefined });
      }
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
    setRotaStartDate(range.from);
    setRotaEndDate(range.to);
    setRotaStartTime(startTime);
    setRotaEndTime(endTime);
    navigate("/admin/rota-period/step-2");
  };

  const calendarHint = !range.from
    ? "Select a start date"
    : !range.to
    ? "Now select an end date"
    : null;

  return (
    <AdminLayout title="Rota Period" subtitle="Step 1 of 2 — Define the timeline" accentColor="yellow">
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          Set the rota start and end dates and the daily shift boundaries.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-600" />
              Rota Dates
            </CardTitle>
            <CardDescription>Click to select a start date, then click again for the end date.</CardDescription>
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

            {/* Start Time */}
            <div className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />Start Time
                </span>
                <span className="text-xs text-muted-foreground">Daily rota boundary — default 08:00</span>
                {timesAutoSet && !startTimeManual && (
                  <span className="text-[11px] font-semibold text-amber-600 mt-0.5">Auto-set from shift types</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setStartTimeManual(true); }}
                  className="w-full sm:w-[180px]"
                />
                {startTimeManual && autoStartTime && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 whitespace-nowrap min-h-[44px]"
                    onClick={() => { setStartTime(autoStartTime); setStartTimeManual(false); }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />Reset to auto
                  </Button>
                )}
              </div>
            </div>
            {startTimeManual && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Custom start time — shifts on the first day of the rota starting before this time will not be included
              </div>
            )}

            {/* End Time */}
            <div className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />End Time
                </span>
                <span className="text-xs text-muted-foreground">Morning handover time on day after end date</span>
                {timesAutoSet && !endTimeManual && (
                  <span className="text-[11px] font-semibold text-amber-600 mt-0.5">Auto-set from shift types</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setEndTimeManual(true); }}
                  className="w-full sm:w-[180px]"
                />
                {endTimeManual && autoEndTime && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 whitespace-nowrap min-h-[44px]"
                    onClick={() => { setEndTime(autoEndTime); setEndTimeManual(false); }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />Reset to auto
                  </Button>
                )}
              </div>
            </div>
            {endTimeManual && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Custom end time — shifts on the last day of the rota ending after this time may not be included
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
