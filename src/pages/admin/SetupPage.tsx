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

  const getSurveyStatus = (): { color: string; text: string } => {
    if (surveyTotal === 0) return { color: "#dc2626", text: "No doctors added" };
    if (surveySubmitted === surveyTotal)
      return { color: "#16a34a", text: `${surveySubmitted} / ${surveyTotal} submitted` };
    if (surveySubmitted > 0) return { color: "#d97706", text: `${surveySubmitted} / ${surveyTotal} submitted` };
    return { color: "#dc2626", text: `${surveySubmitted} / ${surveyTotal} submitted` };
  };

  const getStepColor = (done: boolean) => (done ? "#16a34a" : "#dc2626");

  const surveyStatus = getSurveyStatus();
  const surveysDone = surveySubmitted === surveyTotal && surveyTotal > 0;
  const stepsComplete = [isDepartmentComplete, isWtrComplete, isPeriodComplete, surveysDone].filter(Boolean).length;

  return (
    <AdminLayout title="Rota Setup" subtitle="Complete all steps to generate" accentColor="blue" pageIcon={Wand2}>
      {/* Inline style for the shimmering effect to guarantee it works without tailwind.config changes */}
      <style>{`
        @keyframes shimmer-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer-btn {
          animation: shimmer-slide 2.5s infinite linear;
        }
      `}</style>

      {/* Main Container: Locked to viewport height to prevent scrolling, flex-col for internal layout */}
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-4 animate-fadeSlideUp lg:h-[calc(100vh-10rem)]">
        {/* Progress Bar Header */}
        <div className="flex items-center gap-4 bg-card px-4 py-2.5 rounded-xl border border-border shadow-sm shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Setup Progress
          </span>
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(stepsComplete / 4) * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-foreground whitespace-nowrap">{stepsComplete} / 4</span>
        </div>

        {/* Two-Panel Layout: Left (Inputs/Steps) -> Right (Engine/Outputs) */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          {/* LEFT PANEL: 4 Steps Grid */}
          <div className="flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 shrink-0 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> 1. Configuration & Data
            </h2>

            {/* 2x2 Grid fits perfectly in the space without scrolling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0 content-start">
              {/* Step 1: Department */}
              <div
                onClick={() =>
                  navigate(
                    isDepartmentComplete ? "/admin/department/summary?mode=post-submit" : "/admin/department/step-1",
                  )
                }
                className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/admin/department/step-1");
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">1. Department</h3>
                  <span className="text-xs font-semibold" style={{ color: getStepColor(isDepartmentComplete) }}>
                    {isDepartmentComplete ? "Complete" : "Not started"}
                  </span>
                </div>
              </div>

              {/* Step 2: Contract Rules */}
              <div
                onClick={() => navigate(isWtrComplete ? "/admin/wtr/summary?mode=post-submit" : "/admin/wtr/step-1")}
                className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/admin/wtr/step-1");
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">2. Contract (WTR)</h3>
                  <span className="text-xs font-semibold" style={{ color: getStepColor(isWtrComplete) }}>
                    {isWtrComplete ? "Complete" : "Not started"}
                  </span>
                </div>
              </div>

              {/* Step 3: Rota Period */}
              <div
                onClick={() =>
                  navigate(
                    isPeriodComplete ? "/admin/rota-period/summary?mode=post-submit" : "/admin/rota-period/step-1",
                  )
                }
                className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">3. Rota Period</h3>
                  <span className="text-xs font-semibold" style={{ color: getStepColor(isPeriodComplete) }}>
                    {isPeriodComplete ? "Complete" : "Not started"}
                  </span>
                </div>
              </div>

              {/* Step 4: Doctor Surveys */}
              <div
                onClick={() => navigate("/admin/roster")}
                className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">4. Doctor Surveys</h3>
                  <span className="text-xs font-semibold" style={{ color: surveyStatus.color }}>
                    {surveyStatus.text}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Generation Engine */}
          <div className="flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 shrink-0 flex items-center gap-2">
              <Target className="w-4 h-4" /> 2. Generation Engine
            </h2>

            <div
              className={`flex flex-col flex-1 rounded-2xl border-2 bg-card overflow-hidden shadow-sm transition-all duration-300 ${canGeneratePreRota ? "border-primary/30" : "border-border opacity-70 grayscale-[0.3]"}`}
            >
              {/* Top Half: Pre-Rota Blueprint */}
              <div className="flex-1 p-5 flex flex-col border-b border-border bg-gradient-to-br from-transparent to-muted/30 relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-foreground">A. Build Blueprint</h3>
                  {preRotaResult && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                        preRotaResult.status === "complete"
                          ? "text-emerald-700 bg-emerald-100"
                          : preRotaResult.status === "complete_with_warnings"
                            ? "text-amber-700 bg-amber-100"
                            : "text-red-700 bg-red-100"
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
                <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                  Generates the master calendar framework and calculates necessary shift targets based on your rules.
                </p>

                <Button
                  variant={preRotaResult ? "outline" : "default"}
                  className="w-full h-10 mt-auto"
                  disabled={!canGeneratePreRota || preRotaLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGeneratePreRota();
                  }}
                >
                  {!canGeneratePreRota && <Lock className="mr-2 h-4 w-4" />}
                  {preRotaLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building Blueprint…
                    </>
                  ) : preRotaResult ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" /> Re-build Blueprint
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" /> Build Blueprint Data
                    </>
                  )}
                </Button>

                {preRotaError && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">{preRotaError}</p>
                  </div>
                )}

                {isStale && preRotaResult && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-medium text-amber-800">Data changed — please re-build.</p>
                  </div>
                )}

                {preRotaResult && !isStale && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Built: {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota-calendar");
                        }}
                        className="p-1.5 rounded bg-background border border-border text-muted-foreground hover:text-primary transition-colors"
                        title="View Calendar"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota-targets");
                        }}
                        className="p-1.5 rounded bg-background border border-border text-muted-foreground hover:text-primary transition-colors"
                        title="View Targets"
                      >
                        <Target className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota");
                        }}
                        className="text-xs font-bold text-primary hover:underline px-1"
                      >
                        Details →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Half: Final Rota */}
              <div className="flex-1 p-5 flex flex-col justify-end bg-card relative">
                <div className="mb-auto">
                  <h3 className="text-base font-bold text-foreground mb-1">B. Final Allocation</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Runs the core algorithm to assign doctors to shifts, respecting WTR rules and survey preferences.
                  </p>
                </div>

                <Button
                  size="lg"
                  className={`w-full mt-4 h-12 text-sm relative overflow-hidden group transition-all ${
                    canGeneratePreRota && preRotaResult && !finalLoading
                      ? "bg-primary text-primary-foreground shadow-lg hover:shadow-primary/25"
                      : ""
                  }`}
                  disabled={!canGeneratePreRota || finalLoading || !preRotaResult}
                  onClick={() => setShowFinalChecklist(true)}
                >
                  {/* The Shimmer Effect Layer */}
                  {canGeneratePreRota && preRotaResult && !finalLoading && (
                    <div className="absolute inset-0 w-[200%] animate-shimmer-btn bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
                  )}

                  <span className="relative z-10 flex items-center justify-center font-bold tracking-wide">
                    {finalLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> EXECUTING ALGORITHM…
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" /> GENERATE FINAL
                        ROTA
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions (Feedback & Reset on same row) */}
        <div className="shrink-0 flex items-center justify-between pt-2 mt-auto">
          <button
            type="button"
            onClick={() => navigate("/feedback")}
            className="inline-flex items-center gap-2 text-xs font-bold transition-colors hover:bg-green-50 px-3 py-2 rounded-lg text-green-700"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100">
              <Star className="h-3.5 w-3.5 text-green-600" />
            </span>
            Give Feedback on RotaGen
          </button>

          <button
            className="flex items-center gap-2 text-xs font-bold text-destructive hover:bg-destructive/10 px-3 py-2 rounded-lg transition-colors"
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
