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

      {/* Main Container: Locked height, no scroll on desktop */}
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-5 animate-fadeSlideUp lg:h-[calc(100vh-10rem)] pb-4 lg:pb-0">
        {/* Progress Bar */}
        <div className="flex items-center gap-4 bg-card px-5 py-3 rounded-xl border border-border shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
              {stepsComplete}
            </div>
            <span className="text-sm font-bold text-foreground whitespace-nowrap">of 4 Steps Complete</span>
          </div>
          <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(stepsComplete / 4) * 100}%` }}
            />
          </div>
          {stepsComplete === 4 && <CheckCircle className="w-5 h-5 text-emerald-500 animate-in zoom-in" />}
        </div>

        {/* Two-Panel Split Layout */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          {/* LEFT PANEL: Vertical Checklist */}
          <div className="w-full lg:w-5/12 flex flex-col min-h-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 shrink-0 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Configuration Inputs
            </h2>

            <div className="flex flex-col gap-3 flex-1">
              {/* Step 1: Department */}
              <div
                onClick={() =>
                  navigate(
                    isDepartmentComplete ? "/admin/department/summary?mode=post-submit" : "/admin/department/step-1",
                  )
                }
                className={`group flex items-center p-3.5 rounded-xl border transition-all cursor-pointer ${isDepartmentComplete ? "border-border bg-card hover:border-primary/30" : "border-primary/20 bg-primary/5 shadow-sm"}`}
              >
                <div className="p-2.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4">
                  <h3 className="text-sm font-bold text-foreground">1. Department</h3>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-md ${getStepStyle(isDepartmentComplete).bg} ${getStepStyle(isDepartmentComplete).color}`}
                  >
                    {getStepStyle(isDepartmentComplete).text}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/department/step-1");
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* Step 2: Contract Rules */}
              <div
                onClick={() => navigate(isWtrComplete ? "/admin/wtr/summary?mode=post-submit" : "/admin/wtr/step-1")}
                className={`group flex items-center p-3.5 rounded-xl border transition-all cursor-pointer ${isWtrComplete ? "border-border bg-card hover:border-primary/30" : isDepartmentComplete ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50"}`}
              >
                <div className="p-2.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4">
                  <h3 className="text-sm font-bold text-foreground">2. Contract (WTR)</h3>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-md ${getStepStyle(isWtrComplete).bg} ${getStepStyle(isWtrComplete).color}`}
                  >
                    {getStepStyle(isWtrComplete).text}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/wtr/step-1");
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* Step 3: Rota Period */}
              <div
                onClick={() =>
                  navigate(
                    isPeriodComplete ? "/admin/rota-period/summary?mode=post-submit" : "/admin/rota-period/step-1",
                  )
                }
                className={`group flex items-center p-3.5 rounded-xl border transition-all cursor-pointer ${isPeriodComplete ? "border-border bg-card hover:border-primary/30" : isDepartmentComplete && isWtrComplete ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50"}`}
              >
                <div className="p-2.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4">
                  <h3 className="text-sm font-bold text-foreground">3. Rota Period</h3>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-md ${getStepStyle(isPeriodComplete).bg} ${getStepStyle(isPeriodComplete).color}`}
                  >
                    {getStepStyle(isPeriodComplete).text}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 mr-2 group-hover:text-primary/50 transition-colors" />
              </div>

              {/* Step 4: Doctor Surveys */}
              <div
                onClick={() => navigate("/admin/roster")}
                className={`group flex items-center p-3.5 rounded-xl border transition-all cursor-pointer ${surveysDone ? "border-border bg-card hover:border-primary/30" : isPeriodComplete ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50"}`}
              >
                <div className="p-2.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4">
                  <h3 className="text-sm font-bold text-foreground">4. Doctor Surveys</h3>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-md ${surveyStatus.bg} ${surveyStatus.color}`}
                  >
                    {surveyStatus.text}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 mr-2 group-hover:text-primary/50 transition-colors" />
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Generation Engine */}
          <div className="w-full lg:w-7/12 flex flex-col min-h-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 shrink-0 flex items-center gap-2">
              <Target className="w-4 h-4" /> Generation Engine
            </h2>

            <div
              className={`flex flex-col flex-1 rounded-2xl border bg-card overflow-hidden shadow-sm transition-all duration-300 ${canGeneratePreRota ? "border-primary/20" : "border-border/50 opacity-80"}`}
            >
              {/* TOP HALF: Blueprint (Pre-Rota) */}
              <div className="flex-1 p-6 flex flex-col border-b border-border bg-gradient-to-br from-transparent to-muted/20">
                <div className="mb-2">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground text-xs font-bold">
                      1
                    </span>
                    Build Blueprint
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                    Generates the master calendar framework and calculates necessary shift targets based on your rules.
                  </p>
                </div>

                {/* Dark Console Box for Blueprint Results */}
                {preRotaResult && !isStale && (
                  <div className="mt-3 mb-2 rounded-xl bg-[#0a0a0b] p-4 border border-zinc-800/60 shadow-inner flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
                    {/* Status Row */}
                    <div className="flex items-center justify-between text-xs">
                      <div
                        className={`flex items-center gap-2 font-bold ${
                          preRotaResult.status === "complete"
                            ? "text-emerald-400"
                            : preRotaResult.status === "complete_with_warnings"
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            preRotaResult.status === "complete"
                              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                              : preRotaResult.status === "complete_with_warnings"
                                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                                : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]"
                          }`}
                        ></span>
                        Status:{" "}
                        {preRotaResult.status === "complete"
                          ? "Ready"
                          : preRotaResult.status === "complete_with_warnings"
                            ? "Warnings"
                            : "Blocked"}
                      </div>
                      <span className="text-zinc-500 font-medium tracking-wide">
                        Last built: {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB")}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-zinc-300">
                      {preRotaResult.status === "complete"
                        ? "Blueprint is valid. You can proceed to final allocation."
                        : preRotaResult.status === "complete_with_warnings"
                          ? "Blueprint generated with warnings. Review targets before proceeding."
                          : "Generation failed due to blocking errors. Please resolve."}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota-calendar");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs font-semibold transition-all border border-zinc-700/50"
                        title="View Calendar"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        View Calendar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota-targets");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs font-semibold transition-all border border-zinc-700/50"
                        title="View Targets"
                      >
                        <Target className="h-3.5 w-3.5" />
                        View Targets
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota");
                        }}
                        className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        View details <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4 flex flex-col gap-3">
                  {preRotaError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive">{preRotaError}</p>
                    </div>
                  )}

                  {isStale && preRotaResult && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-medium text-amber-800">Settings changed. Re-build required.</p>
                    </div>
                  )}

                  <Button
                    variant={preRotaResult ? "outline" : "default"}
                    className="w-full h-10 shadow-sm"
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
                        <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" /> Re-build Blueprint Data
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" /> Build Blueprint Data
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* BOTTOM HALF: Final Allocation */}
              <div className="p-6 flex flex-col justify-end bg-card relative">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-xs font-bold">
                      2
                    </span>
                    Final Allocation
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-5">
                    Runs the core algorithm to assign doctors to shifts, respecting WTR rules and survey preferences.
                  </p>
                </div>

                <Button
                  size="lg"
                  className={`w-full h-12 text-sm relative overflow-hidden group transition-all ${
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

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between pt-2 mt-auto">
          <button
            type="button"
            onClick={() => navigate("/feedback")}
            className="inline-flex items-center gap-2 text-xs font-bold transition-colors hover:bg-green-50 px-3 py-2 rounded-lg text-green-700 border border-transparent hover:border-green-200"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100">
              <Star className="h-3.5 w-3.5 text-green-600" />
            </span>
            Give Feedback on RotaGen
          </button>

          <button
            className="flex items-center gap-2 text-xs font-bold text-destructive hover:bg-destructive/10 px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
            onClick={() => setResetModalOpen(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset / New Period
          </button>
        </div>

        {/* Final Rota Checklist Modal */}
        {showFinalChecklist && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
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
                        className="mt-0.5 rounded border-border accent-primary w-4 h-4 cursor-pointer"
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
