import { ReactNode, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { Stethoscope } from "lucide-react";

interface SurveyShellProps {
  children: ReactNode;
}

const STEP_SUBTITLES: Record<number, string> = {
  1: "Step 1 of 6 — Personal details",
  2: "Step 2 of 6 — Competencies",
  3: "Step 3 of 6 — Working pattern",
  4: "Step 4 of 6 — Leave & unavailability",
  5: "Step 5 of 6 — Exemptions & preferences",
  6: "Step 6 of 6 — Review & submit",
};

export function SurveyShell({ children }: SurveyShellProps) {
  const ctx = useSurveyContext();
  const [saveVisible, setSaveVisible] = useState(false);

  useEffect(() => {
    if (ctx?.draftSavedAt) {
      setSaveVisible(true);
      const t = setTimeout(() => setSaveVisible(false), 4000);
      return () => clearTimeout(t);
    }
  }, [ctx?.draftSavedAt]);

  const fmtDate = (d: string | null) => {
    if (!d) return "TBC";
    try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; }
  };

  const progress = ((ctx?.currentStep || 1) / 6) * 100;
  const step = ctx?.currentStep || 1;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header — white bg matching WTR pattern */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-card-foreground leading-tight">Doctor Survey</h1>
              <p className="text-[11px] text-muted-foreground">{STEP_SUBTITLES[step]}</p>
            </div>
          </div>
          <div className="text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1">
            {step} / 6
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rota period banner */}
      {ctx?.rotaInfo && (
        <div className="bg-card border-b border-border px-4 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>📅 Rota period: {fmtDate(ctx.rotaInfo.startDate)} – {fmtDate(ctx.rotaInfo.endDate)}{ctx.rotaInfo.durationWeeks ? ` (${ctx.rotaInfo.durationWeeks} weeks)` : ""}</span>
          {ctx.rotaInfo.surveyDeadline && <span>Survey deadline: {fmtDate(ctx.rotaInfo.surveyDeadline)}</span>}
        </div>
      )}

      {/* Auto-save status indicator */}
      {ctx?.saveStatus === 'saving' && (
        <div className="flex items-center justify-center gap-1.5 text-xs py-1 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50" />
          Saving…
        </div>
      )}
      {ctx?.saveStatus === 'saved' && (
        <div className="flex items-center justify-center gap-1.5 text-xs py-1 text-teal-600 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
          Saved
        </div>
      )}
      {ctx?.saveStatus === 'error' && (
        <div className="flex items-center justify-center gap-1.5 text-xs py-1 text-destructive font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
          Save failed — check your connection. Your data may not be saved.
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
