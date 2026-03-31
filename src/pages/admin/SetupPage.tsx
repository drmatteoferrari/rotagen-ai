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

  const canGeneratePreRota = isDepartmentComplete && isWtrComplete && isPeriodComplete;

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

  const getSurveyStatus = (): { color: string; text: string; bg: string } => {
    if (surveyTotal === 0) return { color: "text-red-700", bg: "bg-red-50", text: "No doctors added" };
    if (surveySubmitted === surveyTotal)
      return { color: "text-emerald-700", bg: "bg-emerald-50", text: `${surveySubmitted} / ${surveyTotal} submitted` };
    if (surveySubmitted > 0)
      return { color: "text-amber-700", bg: "bg-amber-50", text: `${surveySubmitted} / ${surveyTotal} submitted` };
    return { color: "text-red-700", bg: "bg-red-50", text: `${surveySubmitted} / ${surveyTotal} submitted` };
  };

  const getStepStyle = (done: boolean) =>
    done
      ? { color: "text-emerald-700", bg: "bg-emerald-50", text: "Complete" }
      : { color: "text-muted-foreground", bg: "bg-muted/50", text: "Not started" };

  const surveyStatus = getSurveyStatus();
  const surveysDone = surveySubmitted === surveyTotal && surveyTotal > 0;
  const stepsComplete = [isDepartmentComplete, isWtrComplete, isPeriodComplete, surveysDone].filter(Boolean).length;

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

      {/* Main Container: Removed restricted heights to prevent ANY cutoff. Allows natural scrolling if needed. */}
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-6 animate-fadeSlideUp pb-8">
        {/* Progress Bar */}
        <div className="flex items-center gap-4 bg-card px-5 py-3.5 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
              {stepsComplete}
            </div>
            <span className="text-sm font-bold text-foreground whitespace-nowrap hidden sm:inline-block">
              of 4 Steps Complete
            </span>
          </div>
          <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(stepsComplete / 4) * 100}%` }}
            />
          </div>
          {stepsComplete === 4 && <CheckCircle className="w-5 h-5 text-emerald-500 animate-in zoom-in shrink-0" />}
        </div>

        {/* Two-Panel Split Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT PANEL: Configuration Inputs (Strictly 1 Row Per Step) */}
          <div className="w-full lg:w-5/12 flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 shrink-0 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Configuration Inputs
            </h2>

            <div className="flex flex-col gap-3">
              {/* Step 1: Department */}
              <div
                onClick={() =>
                  navigate(
                    isDepartmentComplete ? "/admin/department/summary?mode=post-submit" : "/admin/department/step-1",
                  )
                }
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${isDepartmentComplete ? "border-border bg-card hover:border-primary/30" : "border-primary/20 bg-primary/5 shadow-sm"}`}
              >
                {/* Left: Icon + Number + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">1. Department</h3>
                </div>
                {/* Right: Status */}
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  <span
                    className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${getStepStyle(isDepartmentComplete).bg} ${getStepStyle(isDepartmentComplete).color}`}
                  >
                    {getStepStyle(isDepartmentComplete).text}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/admin/department/step-1");
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step 2: Contract Rules */}
              <div
                onClick={() => navigate(isWtrComplete ? "/admin/wtr/summary?mode=post-submit" : "/admin/wtr/step-1")}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${isWtrComplete ? "border-border bg-card hover:border-primary/30" : isDepartmentComplete ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50"}`}
              >
                {/* Left: Icon + Number + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">2. Contract (WTR)</h3>
                </div>
                {/* Right: Status */}
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  <span
                    className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${getStepStyle(isWtrComplete).bg} ${getStepStyle(isWtrComplete).color}`}
                  >
                    {getStepStyle(isWtrComplete).text}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/admin/wtr/step-1");
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step 3: Rota Period */}
              <div
                onClick={() =>
                  navigate(
                    isPeriodComplete ? "/admin/rota-period/summary?mode=post-submit" : "/admin/rota-period/step-1",
                  )
                }
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${isPeriodComplete ? "border-border bg-card hover:border-primary/30" : isDepartmentComplete && isWtrComplete ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50"}`}
              >
                {/* Left: Icon + Number + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">3. Rota Period</h3>
                </div>
                {/* Right: Status */}
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  <span
                    className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${getStepStyle(isPeriodComplete).bg} ${getStepStyle(isPeriodComplete).color}`}
                  >
                    {getStepStyle(isPeriodComplete).text}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 hidden sm:block group-hover:text-primary/50 transition-colors" />
                </div>
              </div>

              {/* Step 4: Doctor Surveys */}
              <div
                onClick={() => navigate("/admin/roster")}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${surveysDone ? "border-border bg-card hover:border-primary/30" : isPeriodComplete ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50"}`}
              >
                {/* Left: Icon + Number + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">4. Doctor Surveys</h3>
                </div>
                {/* Right: Status */}
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  <span
                    className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${surveyStatus.bg} ${surveyStatus.color}`}
                  >
                    {surveyStatus.text}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 hidden sm:block group-hover:text-primary/50 transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Generation Engine (Allows natural height, prevents cutting off) */}
          <div className="w-full lg:w-7/12 flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-1 shrink-0 flex items-center gap-2">
              <Target className="w-4 h-4" /> Generation Engine
            </h2>

            <div
              className={`flex flex-col rounded-2xl border bg-card shadow-sm transition-all duration-300 h-full ${canGeneratePreRota ? "border-primary/20" : "border-border/50 opacity-80"}`}
            >
              {/* TOP HALF: Blueprint (Pre-Rota) */}
              <div className="p-5 sm:p-7 border-b border-border bg-gradient-to-br from-transparent to-muted/20">
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded bg-muted text-muted-foreground text-xs sm:text-sm font-bold shrink-0">
                        A
                      </span>
                      <span className="truncate">Build Blueprint</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed hidden sm:block">
                      Generates the master calendar framework and calculates shift targets based on your rules.
                    </p>
                  </div>
                  {preRotaResult && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full border shrink-0 ${
                        preRotaResult.status === "complete"
                          ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                          : preRotaResult.status === "complete_with_warnings"
                            ? "border-amber-200 text-amber-700 bg-amber-50"
                            : "border-red-200 text-red-700 bg-red-50"
                      }`}
                    >
                      {preRotaResult.status === "complete" && (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" /> Ready
                        </>
                      )}
                      {preRotaResult.status === "complete_with_warnings" && (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" /> Warnings
                        </>
                      )}
                      {preRotaResult.status === "blocked" && (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Blocked
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  {preRotaError && (
                    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs sm:text-sm font-medium text-destructive">{preRotaError}</p>
                    </div>
                  )}

                  {isStale && preRotaResult && (
                    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs sm:text-sm font-medium text-amber-800">
                        Settings changed. Re-build required.
                      </p>
                    </div>
                  )}

                  <Button
                    variant={preRotaResult ? "outline" : "default"}
                    className="w-full h-11 sm:h-12 shadow-sm text-sm"
                    disabled={!canGeneratePreRota || preRotaLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGeneratePreRota();
                    }}
                  >
                    {!canGeneratePreRota && <Lock className="mr-2 h-4 w-4 text-muted-foreground" />}
                    {preRotaLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building Blueprint…
                      </>
                    ) : preRotaResult ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" /> Re-build Blueprint
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" /> Build Blueprint Data
                      </>
                    )}
                  </Button>

                  {preRotaResult && !isStale && (
                    <div className="mt-4 flex flex-wrap items-center justify-between border-t border-border/50 pt-4 gap-3">
                      <span className="text-xs text-muted-foreground font-medium truncate mr-2">
                        Last Built: {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB")}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/admin/pre-rota-calendar");
                          }}
                          className="p-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View Calendar"
                        >
                          <CalendarDays className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/admin/pre-rota-targets");
                          }}
                          className="p-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View Targets"
                        >
                          <Target className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/admin/pre-rota");
                          }}
                          className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-md transition-colors ml-1"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTTOM HALF: Final Allocation */}
              <div className="p-5 sm:p-7 flex flex-col justify-end bg-card flex-1 relative">
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded bg-primary/10 text-primary text-xs sm:text-sm font-bold shrink-0">
                      B
                    </span>
                    Final Allocation
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed hidden sm:block">
                    Runs the core algorithm to assign doctors to shifts, respecting WTR rules and survey preferences.
                  </p>
                </div>

                <Button
                  size="lg"
                  className={`w-full h-12 sm:h-14 text-sm sm:text-base relative overflow-hidden group transition-all mt-auto ${
                    canGeneratePreRota && preRotaResult && !finalLoading
                      ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                      : ""
                  }`}
                  disabled={!canGeneratePreRota || finalLoading || !preRotaResult}
                  onClick={() => setShowFinalChecklist(true)}
                >
                  {/* CSS Shimmer Effect */}
                  {canGeneratePreRota && preRotaResult && !finalLoading && (
                    <div className="absolute inset-0 w-full animate-shimmer-btn bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  )}

                  <span className="relative z-10 flex items-center justify-center font-bold tracking-wide">
                    {finalLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> EXECUTING ALGORITHM…
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" /> GENERATE FINAL
                        ROTA
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between pt-4 border-t border-border/50 mt-2">
          <button
            type="button"
            onClick={() => navigate("/feedback")}
            className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:bg-green-50 px-4 py-2 rounded-xl text-green-700 border border-transparent hover:border-green-200"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 shrink-0">
              <Star className="h-4 w-4 text-green-600" />
            </span>
            <span className="hidden sm:inline">Give Feedback on RotaGen</span>
            <span className="sm:hidden">Feedback</span>
          </button>

          <button
            className="flex items-center gap-2 text-sm font-bold text-destructive hover:bg-destructive/10 px-4 py-2 rounded-xl transition-colors border border-transparent hover:border-destructive/20"
            onClick={() => setResetModalOpen(true)}
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Reset / New Period</span>
            <span className="sm:hidden">Reset</span>
          </button>
        </div>

        {/* Final Rota Checklist Modal */}
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
                {["Blueprint data is up-to-date", "All doctor surveys submitted", "No unresolvable conflicts"].map(
                  (item) => (
                    <label key={item} className="flex items-start gap-3 text-sm cursor-pointer group">
                      <input
                        type="checkbox"
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
                <Button variant="outline" className="flex-1 font-bold" onClick={() => setShowFinalChecklist(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 font-bold"
                  disabled={finalLoading}
                  onClick={() => {
                    setShowFinalChecklist(false);
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
      </div>
    </AdminLayout>
  );
}
