import { useState } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
  maxDate?: string;
  errors?: { startDate?: string; endDate?: string };
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  errors,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [tempStart, setTempStart] = useState<Date | undefined>(undefined);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Dismissing — if we had a start date selected but no end, save as single-day
      if (phase === "end" && tempStart) {
        onChange(format(tempStart, "yyyy-MM-dd"), format(tempStart, "yyyy-MM-dd"));
      }
      setPhase("start");
      setTempStart(undefined);
    } else {
      // Always start fresh — pick start date first
      setPhase("start");
      setTempStart(undefined);
    }
    setOpen(isOpen);
  };

  const handleDayClick = (day: Date) => {
    if (phase === "start") {
      setTempStart(day);
      setPhase("end");
      onChange(format(day, "yyyy-MM-dd"), "");
    } else {
      // Phase "end" — check for same-day (double-click)
      if (tempStart && format(day, "yyyy-MM-dd") === format(tempStart, "yyyy-MM-dd")) {
        onChange(format(day, "yyyy-MM-dd"), format(day, "yyyy-MM-dd"));
        setPhase("start");
        setTempStart(undefined);
        setOpen(false);
        return;
      }
      // Finalize range
      if (tempStart) {
        const [s, e] = tempStart <= day ? [tempStart, day] : [day, tempStart];
        onChange(format(s, "yyyy-MM-dd"), format(e, "yyyy-MM-dd"));
      }
      setPhase("start");
      setTempStart(undefined);
      setTimeout(() => setOpen(false), 120);
    }
  };

  // Build modifiers for visual range highlighting
  const modifiers: Record<string, Date[]> = {};
  const modifiersStyles: Record<string, React.CSSProperties> = {};

  if (phase === "end" && tempStart) {
    modifiers.rangeStart = [tempStart];
    modifiersStyles.rangeStart = {
      background: "hsl(var(--primary))",
      color: "white",
      borderRadius: "9999px",
    };
  } else if (startDate && endDate) {
    try {
      const from = parseISO(startDate);
      const to = parseISO(endDate);
      const days = eachDayOfInterval({ start: from, end: to });
      modifiers.inRange = days;
      modifiers.rangeStart = [from];
      modifiers.rangeEnd = [to];
      modifiersStyles.inRange = {
        background: "hsl(var(--primary) / 0.15)",
        borderRadius: "0",
      };
      modifiersStyles.rangeStart = {
        background: "hsl(var(--primary))",
        color: "white",
        borderRadius: "9999px 0 0 9999px",
      };
      modifiersStyles.rangeEnd = {
        background: "hsl(var(--primary))",
        color: "white",
        borderRadius: "0 9999px 9999px 0",
      };
    } catch {}
  } else if (startDate && !endDate) {
    try {
      modifiers.rangeStart = [parseISO(startDate)];
      modifiersStyles.rangeStart = {
        background: "hsl(var(--primary))",
        color: "white",
        borderRadius: "9999px",
      };
    } catch {}
  }

  const isSingleDay = startDate && endDate && startDate === endDate;
  const displayText = isSingleDay
    ? format(parseISO(startDate), "d MMM yyyy")
    : startDate && endDate
    ? `${format(parseISO(startDate), "d MMM")} → ${format(parseISO(endDate), "d MMM yyyy")}`
    : startDate
    ? `${format(parseISO(startDate), "d MMM yyyy")} → …`
    : "Select dates";

  const hint = phase === "start"
    ? "Select a date. Tap again to save as a single day, or pick an end date."
    : "Select end date — or tap outside to save as a single day.";

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-11 text-sm sm:text-base cursor-pointer",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <div style={{ minHeight: '320px' }}>
            <Calendar
              selected={phase === "end" ? tempStart : (startDate ? parseISO(startDate) : undefined)}
              onDayClick={(day) => handleDayClick(day)}
              numberOfMonths={1}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              disabled={(date) => {
                if (minDate && date < parseISO(minDate)) return true;
                if (maxDate && date > parseISO(maxDate)) return true;
                return false;
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
          <p className="text-[10px] text-center text-muted-foreground pb-2 font-medium">
            {hint}
          </p>
        </PopoverContent>
      </Popover>
      {errors?.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
      {errors?.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
    </div>
  );
}
