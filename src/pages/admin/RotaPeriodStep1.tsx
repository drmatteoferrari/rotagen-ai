import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, CalendarIcon, Clock, ArrowRight, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "@/contexts/AdminSetupContext";

export default function RotaPeriodStep1() {
  const navigate = useNavigate();
  const { rotaStartDate, rotaEndDate, setRotaStartDate, setRotaEndDate } = useAdminSetup();
  const [startDate, setStartDate] = useState<Date | undefined>(rotaStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(rotaEndDate);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:00");

  const handleContinue = () => {
    setRotaStartDate(startDate);
    setRotaEndDate(endDate);
    navigate("/admin/rota-period/step-2");
  };

  const durationInfo = (() => {
    if (!startDate || !endDate) return null;
    const days = differenceInDays(endDate, startDate);
    if (days <= 0) return { error: true, text: "End date must be after start date." };
    const weeks = (days / 7).toFixed(1);
    return { error: false, text: `Rota duration: ${days} days (${weeks} weeks)` };
  })();

  return (
    <AdminLayout title="Rota Period" subtitle="Step 1 of 2 — Define the timeline">
      <div className="mx-auto max-w-3xl space-y-6">
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
            <CardDescription>Set the start and end dates, and the daily shift boundaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Start Date */}
            <div className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-card-foreground">Start Date</span>
                <span className="text-xs text-muted-foreground">First day of the rota period</span>
                <span className="text-[11px] font-semibold text-amber-600 mt-0.5">Required</span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[220px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-card-foreground">End Date</span>
                <span className="text-xs text-muted-foreground">Last day a night shift can start</span>
                <span className="text-[11px] font-semibold text-amber-600 mt-0.5">Required</span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[220px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Duration info */}
            {durationInfo && (
              <div className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs mt-2",
                durationInfo.error
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-green-200 bg-green-50 text-green-700"
              )}>
                {durationInfo.error
                  ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  : <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                {durationInfo.text}
              </div>
            )}

            {/* Start Time */}
            <div className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />Start Time
                </span>
                <span className="text-xs text-muted-foreground">Daily rota boundary — default 08:00</span>
                <span className="text-[11px] font-semibold text-amber-600 mt-0.5">Auto-set from shift types</span>
              </div>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full sm:w-[220px]" />
            </div>

            {/* End Time */}
            <div className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />End Time
                </span>
                <span className="text-xs text-muted-foreground">Morning handover time on day after end date</span>
                <span className="text-[11px] font-semibold text-amber-600 mt-0.5">Auto-set from shift types</span>
              </div>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full sm:w-[220px]" />
            </div>
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
