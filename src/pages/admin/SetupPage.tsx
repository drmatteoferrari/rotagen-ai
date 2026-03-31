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
  const {
    isDepartmentComplete,
    isWtrComplete,
    isPeriodComplete,
    areSurveysDone,
    restoredFromDb,
    rotaStartDate,
    rotaEndDate,
  } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();
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
      <div className="mx-auto max-w-6xl h-full min-h-[calc(100vh-12rem)] flex flex-col space-y-6 animate-fadeSlideUp pb-4">
        {/* Minimal progress bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(stepsComplete / 4) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{stepsComplete}/4</span>
        </div>

        {/* Main 3-Column Grid for Desktop (2 for tablet, 1 for mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* COLUMN 1: Department & Rules */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Configuration
            </p>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-2 flex-1">
              {/* Department */}
              <div
                className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                onClick={() =>
                  navigate(
                    isDepartmentComplete ? "/admin/department/summary?mode=post-submit" : "/admin/department/step-1",
                  )
                }
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-medium text-foreground">1. Department</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: getStepColor(isDepartmentComplete) }}>
                    {isDepartmentComplete ? "Complete" : "Not started"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/department/step-1");
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Contract Rules (WTR) */}
              <div
                className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                onClick={() => navigate(isWtrComplete ? "/admin/wtr/summary?mode=post-submit" : "/admin/wtr/step-1")}
              >
                <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-medium text-foreground">2. Contract (WTR)</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: getStepColor(isWtrComplete) }}>
                    {isWtrComplete ? "Complete" : "Not started"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/wtr/step-1");
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Dates & Surveys */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Availability
            </p>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-2 flex-1">
              {/* Rota Period */}
              <div
                className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                onClick={() =>
                  navigate(
                    isPeriodComplete ? "/admin/rota-period/summary?mode=post-submit" : "/admin/rota-period/step-1",
                  )
                }
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-medium text-foreground">3. Rota Period</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: getStepColor(isPeriodComplete) }}>
                    {isPeriodComplete ? "Complete" : "Not started"}
                  </span>
                </div>
              </div>

              {/* Doctor Surveys */}
              <div
                className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                onClick={() => navigate("/admin/roster")}
              >
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-medium text-foreground">4. Doctor Surveys</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: surveyStatus.color }}>{surveyStatus.text}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: Generation Station */}
          <div
            className={`flex flex-col gap-2 ${!canGeneratePreRota ? "opacity-60 grayscale-[0.5] transition-all" : ""}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Engine</p>
            <div className="rounded-xl border-2 border-primary/20 bg-card p-4 shadow-sm flex flex-col flex-1 relative overflow-hidden">
              {/* Background Accent */}
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

              {/* Pre-Rota Section */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-foreground">1. Blueprint (Pre-Rota)</h2>
                  {preRotaResult && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        preRotaResult.status === "complete"
                          ? "text-emerald-700 bg-emerald-100"
                          : preRotaResult.status === "complete_with_warnings"
                            ? "text-amber-700 bg-amber-100"
                            : "text-red-700 bg-red-100"
                      }`}
                    >
                      {preRotaResult.status === "complete" && (
                        <>
                          <CheckCircle className="h-3 w-3" /> Complete
                        </>
                      )}
                      {preRotaResult.status === "complete_with_warnings" && (
                        <>
                          <AlertTriangle className="h-3 w-3" /> Warnings
                        </>
                      )}
                      {preRotaResult.status === "blocked" && (
                        <>
                          <XCircle className="h-3 w-3" /> Blocked
                        </>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mb-2 leading-tight">Master calendar & shift targets.</p>
                <Button
                  size="sm"
                  variant={preRotaResult ? "outline" : "default"}
                  className="w-full h-8 text-xs"
                  disabled={!canGeneratePreRota || preRotaLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGeneratePreRota();
                  }}
                >
                  {!canGeneratePreRota && <Lock className="mr-2 h-3 w-3" />}
                  {preRotaLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generating…
                    </>
                  ) : preRotaResult ? (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" /> Re-build Blueprint
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-3 w-3" /> Build Blueprint
                    </>
                  )}
                </Button>

                {preRotaError && (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <p className="text-[11px] text-destructive">{preRotaError}</p>
                  </div>
                )}
                {isStale && preRotaResult && (
                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 flex items-center justify-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-800">Data changed — re-generate to update.</p>
                  </div>
                )}
                {preRotaResult && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Generated{" "}
                      {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota-calendar");
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="View Calendar"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota-targets");
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="View Targets"
                      >
                        <Target className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/pre-rota");
                        }}
                        className="text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors"
                      >
                        View details →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px w-full bg-border my-2"></div>

              {/* Final Rota Section */}
              <div className="mt-2 flex-1 flex flex-col justify-end">
                <h2 className="text-sm font-bold text-foreground mb-1">2. Final Allocation</h2>
                <p className="text-[11px] text-muted-foreground mb-3 leading-tight">
                  Run the core allocation algorithm.
                </p>
                <Button
                  size="sm"
                  className={`w-full h-9 transition-all relative overflow-hidden group ${
                    canGeneratePreRota && preRotaResult && !finalLoading
                      ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                      : ""
                  }`}
                  disabled={!canGeneratePreRota || finalLoading || !preRotaResult}
                  onClick={() => setShowFinalChecklist(true)}
                >
                  {/* Shimmer Effect Span */}
                  {canGeneratePreRota && preRotaResult && !finalLoading && (
                    <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                  )}

                  {finalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin relative z-10" />{" "}
                      <span className="relative z-10">Building…</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-3.5 w-3.5 relative z-10 group-hover:scale-110 transition-transform" />{" "}
                      <span className="relative z-10">Generate Final Rota</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER: Feedback & Reset (Same Row) */}
        <div className="mt-auto pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/feedback")}
            className="inline-flex items-center gap-2 text-xs font-medium transition-colors hover:bg-green-50 px-3 py-1.5 rounded-lg text-green-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-green-100">
              <Star className="h-3 w-3 text-green-600" />
            </span>
            Give feedback on RotaGen
          </button>

          <button
            className="flex items-center gap-2 text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
            onClick={() => setResetModalOpen(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset / New Period
          </button>
        </div>

        {/* Modals */}
        {showFinalChecklist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-sm font-bold mb-3">Before you generate</h3>
              <p className="text-xs text-muted-foreground mb-4">Confirm the following before running the final rota:</p>
              <div className="space-y-3 mb-5">
                {["Pre-rota data generated", "All surveys completed", "No scheduling conflicts"].map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded border-border accent-primary" />
                    {item}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowFinalChecklist(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={finalLoading}
                  onClick={() => {
                    setShowFinalChecklist(false);
                    handleGenerateFinalRota();
                  }}
                >
                  {finalLoading ? "Building…" : "Confirm & Generate"}
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
