import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, ArrowRight, Info } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

// Minimum container width (px) before two months fit comfortably side by side.
// Each month is ~280px (7 × 36px cells + padding). Two months + gap ≈ 600.
const TWO_MONTH_MIN_WIDTH = 600;

function StatusCell({ label, value, highlight, error }: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  error?: boolean;
}) {
  return (
    <div className={cn(
      "min-w-0 px-2 sm:px-4 first:pl-0 last:pr-0",
      highlight && "animate-pulse",
    )}>
      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-amber-700/70">
        {label}
      </div>
      <div className={cn(
        "text-base sm:text-xl font-bold truncate tracking-tight",
        value != null ? (error ? "text-red-700" : "text-amber-950") : "text-amber-700/40",
      )}>
        {value ?? "—"}
      </div>
    </div>
  );
}

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

  // Pick 1 or 2 months based on actual container width — handles sidebar
  // collapse, tablet portrait, etc. better than viewport breakpoints.
  const containerRef = useRef<HTMLDivElement>(null);
  const [calendarMonths, setCalendarMonths] = useState<1 | 2>(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setCalendarMonths(el.clientWidth >= TWO_MONTH_MIN_WIDTH ? 2 : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
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
    if (days <= 0) return { error: true, text: "Invalid range" };
    const weeks = (days / 7).toFixed(1);
    return { error: false, text: `${days}d · ${weeks}w` };
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

  return (
    <AdminLayout title="Rota Period" subtitle="Step 1 of 2 — Dates" accentColor="yellow" pageIcon={CalendarDays}
      navBar={
        <StepNavBar
          right={
            <Button size="lg" onClick={handleContinue} className="bg-amber-600 hover:bg-amber-700">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
      }
    >
      <div
        ref={containerRef}
        className="mx-auto w-full max-w-4xl h-full flex flex-col gap-3 sm:gap-4 animate-fadeSlideUp"
      >
        {/* Hint banner — context-aware guidance, single line. */}
        <div className="shrink-0 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium text-amber-700">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 truncate">
            {!range.from
              ? "Tap a date to set the rota start."
              : !range.to
              ? "Now tap a date to set the rota end."
              : "Rota period set — review and Continue."}
          </p>
        </div>

        {/* Status strip — uniform 3-col grid: Start | End | Duration. Always visible. */}
        <div className="shrink-0 grid grid-cols-3 divide-x divide-amber-200 rounded-lg border border-amber-200 bg-amber-50 px-2 sm:px-4 py-2 sm:py-3">
          <StatusCell
            label="Start"
            value={range.from ? (
              <>
                {format(range.from, "d MMM")}
                <span className="hidden sm:inline"> {format(range.from, "yyyy")}</span>
              </>
            ) : null}
            highlight={!range.from}
          />
          <StatusCell
            label="End"
            value={range.to ? (
              <>
                {format(range.to, "d MMM")}
                <span className="hidden sm:inline"> {format(range.to, "yyyy")}</span>
              </>
            ) : null}
            highlight={!!range.from && !range.to}
          />
          <StatusCell
            label="Duration"
            value={durationInfo?.text ?? null}
            error={durationInfo?.error}
          />
        </div>

        {/* Calendar card — fills remaining space, content centered */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-4">
            <Calendar
              mode="range"
              selected={{ from: range.from, to: range.to } as DateRange}
              onDayClick={handleDayClick}
              numberOfMonths={calendarMonths}
              className="p-0 pointer-events-auto"
              classNames={{ months: "flex flex-row gap-6 justify-center" }}
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
