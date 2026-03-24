import { ReactNode, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { Stethoscope, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SurveyShellProps {
  children: ReactNode;
}

const TOTAL_STEPS = 7;

const STEP_SUBTITLES: Record<number, string> = {
  1: "Step 1 of 7 — Personal details",
  2: "Step 2 of 7 — Competencies",
  3: "Step 3 of 7 — Working pattern",
  4: "Step 4 of 7 — Leave & unavailability",
  5: "Step 5 of 7 — Medical exemptions",
  6: "Step 6 of 7 — Preferences",
  7: "Step 7 of 7 — Review & submit",
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

  const progress = ((ctx?.currentStep || 1) / TOTAL_STEPS) * 100;
  const step = ctx?.currentStep || 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header — fixed at top, shrink-0 */}
      <div className="shrink-0 bg-white border-b border-border py-3 sm:py-4 z-10">
        <div className="mx-auto max-w-2xl w-full px-4 sm:px-6">
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
              {step} / {TOTAL_STEPS}
            </div>
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Rota period banner */}
      {ctx?.rotaInfo?.startDate && ctx?.rotaInfo?.endDate && (
        <div className="shrink-0 bg-card border-b border-border py-2 text-xs text-muted-foreground">
          <div className="mx-auto max-w-2xl w-full px-4 sm:px-6 flex flex-wrap gap-x-4 gap-y-1">
            <span>📅 Rota period: {fmtDate(ctx.rotaInfo.startDate)} – {fmtDate(ctx.rotaInfo.endDate)}{ctx.rotaInfo.durationWeeks ? ` (${ctx.rotaInfo.durationWeeks} weeks)` : ""}</span>
            {ctx.rotaInfo.surveyDeadline && <span>Survey deadline: {fmtDate(ctx.rotaInfo.surveyDeadline)}</span>}
          </div>
        </div>
      )}

      {/* Auto-save status */}
      {ctx?.saveStatus === 'saving' && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 text-xs sm:text-sm py-1 text-muted-foreground bg-white border-b border-border">
          <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50" />
          Saving…
        </div>
      )}
      {ctx?.saveStatus === 'saved' && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 text-xs sm:text-sm py-1 text-teal-600 font-medium bg-white border-b border-border">
          <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
          Saved
        </div>
      )}
      {ctx?.saveStatus === 'error' && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 text-xs sm:text-sm py-1 text-destructive font-semibold bg-white border-b border-border">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
          Auto-save failed — check your connection.
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {children}
      </div>

      {/* Nav bar — shrink-0 sibling, always visible, never scrolls */}
      {ctx && ctx.loadState === "ready" && ctx.currentStep < 7 && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              {ctx.currentStep > 1 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => ctx.prevStep()}
                  className="h-11 px-5 cursor-pointer border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 active:bg-teal-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              )}
            </div>
            <Button
              size="lg"
              onClick={() => ctx.nextStep()}
              className="h-11 px-6 cursor-pointer bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white transition-colors"
            >
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
