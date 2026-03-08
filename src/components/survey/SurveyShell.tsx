import { ReactNode, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";

// ✅ Section 3 complete — SurveyShell

interface SurveyShellProps {
  children: ReactNode;
}

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

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-[#0f766e] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold">RE</div>
            <div>
              <div className="text-sm font-bold leading-tight">RotaEngine</div>
              <div className="text-xs text-white/70">Doctor Preference Survey</div>
            </div>
          </div>
          <div className="text-xs font-medium bg-white/20 rounded-full px-3 py-1">
            Step {ctx?.currentStep || 1} of 6
          </div>
        </div>
        <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rota period banner */}
      {ctx?.rotaInfo && (
        <div className="bg-white border-b border-slate-200 px-4 py-2 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>📅 Rota period: {fmtDate(ctx.rotaInfo.startDate)} – {fmtDate(ctx.rotaInfo.endDate)}{ctx.rotaInfo.durationWeeks ? ` (${ctx.rotaInfo.durationWeeks} weeks)` : ""}</span>
          {ctx.rotaInfo.surveyDeadline && <span>Survey deadline: {fmtDate(ctx.rotaInfo.surveyDeadline)}</span>}
        </div>
      )}

      {/* ✅ Section 4 complete — Auto-save status indicator */}
      {ctx?.saveStatus === 'saving' && (
        <div className="flex items-center justify-center gap-1.5 text-xs py-1 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50" />
          Saving…
        </div>
      )}
      {ctx?.saveStatus === 'saved' && (
        <div className="flex items-center justify-center gap-1.5 text-xs py-1 text-emerald-600">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
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
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
