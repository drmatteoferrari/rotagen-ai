import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Target,
  Users,
  Lock,
  Building2,
  Loader2,
  ClipboardList,
  CalendarDays,
  RefreshCw,
  Play,
  AlertTriangle,
  XCircle,
  Pencil,
  RotateCcw,
  Wand2,
  Star,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { generatePreRota } from "@/lib/preRotaGenerator";
import { buildFinalRotaInput, validateFinalRotaInput } from "@/lib/rotaGenInput";
import { toast } from "@/hooks/use-toast";
import type { PreRotaResult } from "@/lib/preRotaTypes";
import { useDoctorsQuery, usePreRotaResultQuery, useInvalidateQuery } from "@/hooks/useAdminQueries";
import { ResetModal } from "@/components/ResetModal";

export default function SetupPage() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const { invalidatePreRota } = useInvalidateQuery();

  const { data: doctorsData } = useDoctorsQuery();
  const surveyTotal = doctorsData?.length ?? 0;
  const surveySubmitted = doctorsData?.filter((d: any) => d.survey_status === "submitted").length ?? 0;

  const { data: cachedPreRota } = usePreRotaResultQuery();

  const [preRotaLoading, setPreRotaLoading] = useState(false);
  const [preRotaError, setPreRotaError] = useState<string | null>(null);
  const [localPreRota, setLocalPreRota] = useState<PreRotaResult | null>(null);
  const preRotaResult = localPreRota ?? cachedPreRota ?? null;
  const isStale = preRotaResult?.isStale ?? false;

  const [finalLoading, setFinalLoading] = useState(false);
  const [showFinalChecklist, setShowFinalChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<boolean[]>([false, false, false]);
  const allChecked = checklistItems.every(Boolean);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const handleGeneratePreRota = async () => {
    if (!currentRotaConfigId) return;
    setPreRotaLoading(true);
    setPreRotaError(null);
    const { success, result, error } = await generatePreRota(currentRotaConfigId, user?.username ?? "developer1");
    setPreRotaLoading(false);
    if (!success || !result) {
      setPreRotaError(error ?? "Generation failed.");
      return;
    }
    setLocalPreRota(result);
    invalidatePreRota();
    navigate("/admin/pre-rota");
  };

  const canGeneratePreRota = isDepartmentComplete && isWtrComplete && isPeriodComplete && surveysDone;

  const handleGenerateFinalRota = async () => {
    if (!currentRotaConfigId) {
      toast({ title: "No active rota config found", variant: "destructive" });
      return;
    }
    setFinalLoading(true);
    try {
      const validation = await validateFinalRotaInput(currentRotaConfigId);
      if (validation.blockers.length > 0) {
        toast({ title: "Generation blocked", description: validation.blockers.join("\n"), variant: "destructive" });
        setFinalLoading(false);
        return;
      }
      if (validation.warnings.length > 0) {
        toast({
          title: "Warnings found — proceeding in 2 seconds",
          description: validation.warnings.slice(0, 5).join("\n"),
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const result = await buildFinalRotaInput(currentRotaConfigId);
      console.log("Final rota input:", result);
      toast({ title: "Final rota input built successfully", description: "Check console for output." });
    } catch (err: any) {
      console.error("Final rota build failed:", err);
      toast({ title: "Final rota build failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setFinalLoading(false);
    }
  };

  const getSurveyStatus = (): { color: string; text: string; shortText: string; bg: string } => {
    if (surveyTotal === 0)
      return { color: "text-red-700", bg: "bg-red-50", text: "No doctors added", shortText: "0 doctors" };
    if (surveySubmitted === surveyTotal)
      return {
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        text: `${surveySubmitted} / ${surveyTotal} submitted`,
        shortText: `${surveySubmitted}/${surveyTotal}`,
      };
    if (surveySubmitted > 0)
      return {
        color: "text-amber-700",
        bg: "bg-amber-50",
        text: `${surveySubmitted} / ${surveyTotal} submitted`,
        shortText: `${surveySubmitted}/${surveyTotal}`,
      };
    return {
      color: "text-red-700",
      bg: "bg-red-50",
      text: `${surveySubmitted} / ${surveyTotal} submitted`,
      shortText: `${surveySubmitted}/${surveyTotal}`,
    };
  };

  const getStepStyle = (done: boolean) =>
    done
      ? { color: "text-emerald-700", bg: "bg-emerald-50", text: "Complete" }
      : { color: "text-muted-foreground", bg: "bg-muted/50", text: "Not started" };

  const surveyStatus = getSurveyStatus();
  const surveysDone = surveySubmitted === surveyTotal && surveyTotal > 0;
  const stepsComplete = [isDepartmentComplete, isWtrComplete, isPeriodComplete, surveysDone].filter(Boolean).length;

  const surveyBarColor = surveysDone ? "bg-emerald-500" : surveySubmitted > 0 ? "bg-amber-400" : "bg-red-400";

  return (
    <AdminLayout
      title="Rota Setup"
      subtitle="Complete all steps to generate your rota"
      accentColor="blue"
      pageIcon={Wand2}
    >
      <style>{`
        @keyframes shimmer-slide {
          0% { transform: translateX(-150%) skewX(-15deg); }
          100% { transform: translateX(150%) skewX(-15deg); }
        }
        .animate-shimmer-btn {
          animation: shimmer-slide 2.5s infinite linear;
        }
      `}</style>

      {/*
        Outer wrapper:
        - min-h-full (not h-full): on desktop/tablet this fills the viewport exactly;
          on mobile it can grow beyond if content is tall, letting AdminLayout's
          overflow-y-auto scroll container handle the scroll naturally.
        - flex flex-col so footer is always pushed to the bottom.
        - overflow-x-hidden prevents any child causing horizontal scroll.
        - No overflow-hidden (vertical) so mobile content isn't clipped.
      */}
      <div className="w-full max-w-5xl mx-auto min-h-full flex flex-col gap-3 animate-fadeSlideUp overflow-x-hidden">
        {/* ── PROGRESS BAR ── */}
        <div className="flex items-center gap-3 bg-card px-4 py-3 rounded-xl border border-border shadow-sm shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
              {stepsComplete}
            </div>
            <span className="text-sm font-bold text-foreground whitespace-nowrap hidden sm:inline-block">
              of 4 steps complete
            </span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(stepsComplete / 4) * 100}%` }}
            />
          </div>
          {stepsComplete === 4 && <CheckCircle className="w-5 h-5 text-emerald-500 animate-in zoom-in shrink-0" />}
        </div>

        {/* ── CONFIGURATION STEPS ── */}
        <div className="shrink-0 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 px-0.5">
            <ClipboardList className="w-3.5 h-3.5" /> Configuration
          </p>

          {/*
            2 columns on mobile, 4 on sm+.
            Each tile has min-w-0 to prevent text overflow causing horizontal scroll.
          */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Step 1 — Department */}
            <div
              onClick={() =>
                navigate(
                  isDepartmentComplete ? "/admin/department/summary?mode=post-submit" : "/admin/department/step-1",
                )
              }
              className={`group cursor-pointer rounded-xl border p-3 flex flex-col gap-2 transition-all min-w-0 ${
                isDepartmentComplete
                  ? "border-border bg-card hover:border-primary/30"
                  : "border-primary/20 bg-primary/5 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="p-1.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] sm:max-w-none ${getStepStyle(isDepartmentComplete).bg} ${getStepStyle(isDepartmentComplete).color}`}
                >
                  {getStepStyle(isDepartmentComplete).text}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">1. Department</p>
            </div>

            {/* Step 2 — Contract (WTR) */}
            <div
              onClick={() => navigate(isWtrComplete ? "/admin/wtr/summary?mode=post-submit" : "/admin/wtr/step-1")}
              className={`group cursor-pointer rounded-xl border p-3 flex flex-col gap-2 transition-all min-w-0 ${
                isWtrComplete
                  ? "border-border bg-card hover:border-primary/30"
                  : isDepartmentComplete
                    ? "border-primary/20 bg-primary/5 shadow-sm"
                    : "border-border/50 bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="p-1.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <CalendarCheck className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] sm:max-w-none ${getStepStyle(isWtrComplete).bg} ${getStepStyle(isWtrComplete).color}`}
                >
                  {getStepStyle(isWtrComplete).text}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">2. Contract (WTR)</p>
            </div>

            {/* Step 3 — Rota Period */}
            <div
              onClick={() =>
                navigate(isPeriodComplete ? "/admin/rota-period/summary?mode=post-submit" : "/admin/rota-period/step-1")
              }
              className={`group cursor-pointer rounded-xl border p-3 flex flex-col gap-2 transition-all min-w-0 ${
                isPeriodComplete
                  ? "border-border bg-card hover:border-primary/30"
                  : isDepartmentComplete && isWtrComplete
                    ? "border-primary/20 bg-primary/5 shadow-sm"
                    : "border-border/50 bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="p-1.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] sm:max-w-none ${getStepStyle(isPeriodComplete).bg} ${getStepStyle(isPeriodComplete).color}`}
                >
                  {getStepStyle(isPeriodComplete).text}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">3. Rota Period</p>
            </div>

            {/* Step 4 — Doctor Surveys */}
            <div
              onClick={() => navigate("/admin/roster")}
              className={`group cursor-pointer rounded-xl border p-3 flex flex-col gap-2 transition-all min-w-0 ${
                surveysDone
                  ? "border-border bg-card hover:border-primary/30"
                  : isPeriodComplete
                    ? "border-primary/20 bg-primary/5 shadow-sm"
                    : "border-border/50 bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="p-1.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md max-w-none ${surveyStatus.bg} ${surveyStatus.color}`}
                >
                  <span className="sm:hidden">{surveyStatus.shortText}</span>
                  <span className="hidden sm:inline">{surveyStatus.text}</span>
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">4. Doctor Surveys</p>
              {/* Mini survey completion bar */}
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${surveyBarColor}`}
                  style={{ width: surveyTotal > 0 ? `${(surveySubmitted / surveyTotal) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── GENERATION ENGINE ──
            shrink-0: natural content height on ALL screen sizes.
            The card height is driven by its content, not by the viewport.
            A flex-1 spacer below this pushes the footer to the page bottom.
        */}
        <div className="shrink-0 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 px-0.5">
            <Target className="w-3.5 h-3.5" /> Generation Engine
          </p>

          {/*
            Engine card: natural height, flex-col mobile / flex-row desktop.
            Both panels are equal height because flex-row makes siblings
            stretch to the tallest panel (Panel A with "last built" row sets height).
            Panel B uses that height for mt-auto to work.
          */}
          <div
            className={`flex flex-col lg:flex-row rounded-2xl border bg-card shadow-sm transition-all duration-300 ${
              canGeneratePreRota ? "border-primary/20" : "border-border/50 opacity-80"
            }`}
          >
            {/* ── PANEL A: Pre-Rota Plan ──
              On desktop: lg:w-1/2, natural height set by content.
              In flex-row, both panels auto-stretch to equal height (CSS default).
            */}
            <div className="flex flex-col p-4 sm:p-5 lg:w-1/2 border-b lg:border-b-0 lg:border-r border-border bg-gradient-to-br from-transparent to-muted/10">
              {/* Header row: title + status pill */}
              <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground text-xs font-bold shrink-0">
                    A
                  </span>
                  Pre-Rota Plan
                </h3>
                {preRotaResult && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                      preRotaResult.status === "complete"
                        ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                        : preRotaResult.status === "complete_with_warnings"
                          ? "border-amber-200 text-amber-700 bg-amber-50"
                          : "border-red-200 text-red-700 bg-red-50"
                    }`}
                  >
                    {preRotaResult.status === "complete" && (
                      <>
                        <CheckCircle className="w-3 h-3" /> Ready
                      </>
                    )}
                    {preRotaResult.status === "complete_with_warnings" && (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Warnings
                      </>
                    )}
                    {preRotaResult.status === "blocked" && (
                      <>
                        <XCircle className="w-3 h-3" /> Blocked
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Description — hidden on mobile to save space */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-3 shrink-0 hidden sm:block">
                Generates the master calendar framework and calculates shift targets based on your rules.
              </p>

              {/* Error banner — shown directly above the button */}
              {preRotaError && (
                <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center gap-2 shrink-0">
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p className="text-xs font-medium text-destructive">{preRotaError}</p>
                </div>
              )}

              {/* Stale banner — shown directly above the button */}
              {isStale && preRotaResult && (
                <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center gap-2 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs font-medium text-amber-800">Settings changed — re-build required.</p>
                </div>
              )}

              {/* Action button */}
              <Button
                variant={preRotaResult ? "outline" : "default"}
                className="w-full h-10 shadow-sm text-sm shrink-0"
                disabled={!canGeneratePreRota || preRotaLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGeneratePreRota();
                }}
              >
                {!canGeneratePreRota && <Lock className="mr-2 h-4 w-4 text-muted-foreground" />}
                {preRotaLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building Pre-Rota…
                  </>
                ) : preRotaResult ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" /> Rebuild Pre-Rota Plan
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" /> Build Pre-Rota Plan
                  </>
                )}
              </Button>

              {/* Last built row + shortcut navigation buttons */}
              {preRotaResult && !isStale && (
                <div className="mt-3 flex flex-wrap items-center justify-between border-t border-border/50 pt-3 gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium truncate">
                    Last built: {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB")}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/admin/pre-rota-calendar");
                      }}
                      className="p-1.5 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="View Calendar"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/admin/pre-rota-targets");
                      }}
                      className="p-1.5 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="View Targets"
                    >
                      <Target className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/admin/pre-rota");
                      }}
                      className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors ml-0.5"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── DESKTOP SEPARATOR: visible only on lg+ ── */}
            <div className="hidden lg:flex items-center justify-center w-9 shrink-0 bg-muted/20">
              <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
            </div>

            {/* ── PANEL B: Final Allocation ──
                lg:w-1/2: shares equal width with Panel A on desktop.
                In flex-row both panels auto-stretch to equal height, so mt-auto
                on the button wrapper correctly pins it to the bottom of Panel B,
                matching Panel A's "last built" row visually.
            */}
            <div className="flex flex-col p-4 sm:p-5 lg:w-1/2">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
                    B
                  </span>
                  Final Allocation
                </h3>
              </div>

              {/* Description — hidden on mobile to save space */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-3 shrink-0 hidden sm:block">
                Runs the core algorithm to assign doctors to shifts, respecting WTR rules and survey preferences.
              </p>

              {/* Lock banner — only shown when config is complete but Pre-Rota not yet built */}
              {canGeneratePreRota && !preRotaResult && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2 shrink-0">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Build Pre-Rota Plan (step A) first</span>
                </div>
              )}

              {/*
                mt-auto works here because in a flex-row card both panels
                auto-stretch to equal height (tallest panel wins — Panel A
                with its "last built" row sets the height). Panel B's flex-col
                fills that same height, so mt-auto correctly pins the button
                to the bottom, creating visual symmetry with Panel A.
                On mobile (flex-col card) Panel B is natural height — mt-auto
                has minimal space to push but the button still renders correctly.
              */}
              <div className="mt-auto pt-2">
                <Button
                  size="lg"
                  className={`w-full h-11 sm:h-12 text-sm relative overflow-hidden group transition-all ${
                    canGeneratePreRota && preRotaResult && !finalLoading
                      ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                      : ""
                  }`}
                  disabled={!canGeneratePreRota || finalLoading || !preRotaResult}
                  onClick={() => setShowFinalChecklist(true)}
                >
                  {/* Shimmer — only shown when button is fully active */}
                  {canGeneratePreRota && preRotaResult && !finalLoading && (
                    <div className="absolute inset-0 w-full animate-shimmer-btn bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  )}
                  <span className="relative z-10 flex items-center justify-center font-bold tracking-wide">
                    {finalLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> EXECUTING ALGORITHM…
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" /> GENERATE FINAL
                        ROTA
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer: pushes footer to the bottom of the page on desktop/tablet
            without requiring the engine card to stretch to fill the viewport */}
        <div className="flex-1" />

        {/* ── FOOTER — always at the bottom of the flex column ──
            shrink-0 prevents it from being compressed.
            On desktop/tablet: sits flush at the page bottom with no scroll.
            On mobile: naturally at the end of content, scrolled to if needed.
        */}
        <div className="shrink-0 flex items-center justify-between pt-3 border-t border-border/50">
          {/* Feedback — green accent */}
          <button
            type="button"
            onClick={() => navigate("/feedback")}
            className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:bg-green-50 px-3 py-2 rounded-xl text-green-700 border border-transparent hover:border-green-200"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-100 shrink-0">
              <Star className="h-3.5 w-3.5 text-green-600" />
            </span>
            <span className="hidden sm:inline">Give Feedback on RotaGen</span>
            <span className="sm:hidden">Feedback</span>
          </button>

          {/* Reset / New Rota — destructive accent */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-bold text-destructive hover:bg-destructive/10 px-3 py-2 rounded-xl transition-colors border border-transparent hover:border-destructive/20"
            onClick={() => setResetModalOpen(true)}
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Reset / New Rota</span>
            <span className="sm:hidden">New Rota</span>
          </button>
        </div>
      </div>

      {/* ── FINAL ROTA CHECKLIST MODAL — rendered outside layout div, above everything ── */}
      {showFinalChecklist && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                <Wand2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Confirm Generation</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-5 pl-1">
              Ensure the following are complete before executing the algorithm:
            </p>

            <div className="space-y-3 mb-6 bg-muted/40 p-4 rounded-xl border border-border/50">
              {["Pre-Rota Plan is up-to-date", "All doctor surveys submitted", "No unresolvable conflicts"].map(
                (item, i) => (
                  <label key={item} className="flex items-start gap-3 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checklistItems[i]}
                      onChange={() =>
                        setChecklistItems((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
                      }
                      className="mt-0.5 rounded border-border accent-primary w-4 h-4 cursor-pointer shrink-0"
                    />
                    <span className="text-foreground group-hover:text-primary transition-colors font-medium">
                      {item}
                    </span>
                  </label>
                ),
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 font-bold"
                onClick={() => {
                  setShowFinalChecklist(false);
                  setChecklistItems([false, false, false]);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 font-bold"
                disabled={finalLoading || !allChecked}
                onClick={() => {
                  setShowFinalChecklist(false);
                  setChecklistItems([false, false, false]);
                  handleGenerateFinalRota();
                }}
              >
                {finalLoading ? "Executing…" : "Execute"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} />
    </AdminLayout>
  );
}
