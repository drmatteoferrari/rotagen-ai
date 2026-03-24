import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Target, Users, Lock,
  Building2, Loader2, ClipboardList, CalendarDays,
  RefreshCw, Play, AlertTriangle, XCircle, Pencil, RotateCcw, Wand2,
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
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone, restoredFromDb, rotaStartDate, rotaEndDate } = useAdminSetup();
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
    const { success, result, error } = await generatePreRota(currentRotaConfigId, user?.username ?? 'developer1');
    setPreRotaLoading(false);
    if (!success || !result) {
      setPreRotaError(error ?? 'Generation failed.');
      return;
    }
    setLocalPreRota(result);
    invalidatePreRota();
    navigate('/admin/pre-rota');
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
        toast({ title: "Warnings found — proceeding in 2 seconds", description: validation.warnings.slice(0, 5).join("\n") });
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    if (surveyTotal === 0) return { color: '#dc2626', text: 'No doctors added' };
    if (surveySubmitted === surveyTotal) return { color: '#16a34a', text: `${surveySubmitted} / ${surveyTotal} submitted` };
    if (surveySubmitted > 0) return { color: '#d97706', text: `${surveySubmitted} / ${surveyTotal} submitted` };
    return { color: '#dc2626', text: `${surveySubmitted} / ${surveyTotal} submitted` };
  };

  const getStepColor = (done: boolean) => done ? '#16a34a' : '#dc2626';

  const surveyStatus = getSurveyStatus();
  const surveysDone = surveySubmitted === surveyTotal && surveyTotal > 0;

  const stepsComplete = [isDepartmentComplete, isWtrComplete, isPeriodComplete, surveysDone].filter(Boolean).length;

  return (
    <AdminLayout title="Rota Setup" subtitle="Complete all steps to generate" accentColor="blue" pageIcon={Wand2}>
      <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">

        {/* Minimal progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(stepsComplete / 4) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{stepsComplete}/4</span>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LEFT — Department & Rules */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Department & Rules</p>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-1">

              {/* Department — full row */}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(isDepartmentComplete ? "/admin/department/summary?mode=post-submit" : "/admin/department/step-1")}
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">1.</span>
                <span className="flex-1 text-sm font-medium text-foreground">Department</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: getStepColor(isDepartmentComplete) }}>
                  {isDepartmentComplete ? 'Complete' : 'Not started'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/admin/department/step-1"); }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* WTR — full row */}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(isWtrComplete ? "/admin/wtr/summary?mode=post-submit" : "/admin/wtr/step-1")}
              >
                <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">2.</span>
                <span className="flex-1 text-sm font-medium text-foreground">Contract Rules (WTR)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: getStepColor(isWtrComplete) }}>
                  {isWtrComplete ? 'Complete' : 'Not started'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/admin/wtr/step-1"); }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          </div>

          {/* RIGHT — Dates & Preferences */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Dates & Preferences</p>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-1">

              {/* Rota Period — mobile collapsed */}
              {isSectionCollapsed('period', isPeriodComplete) && (
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors md:hidden" onClick={() => toggleSection('period')}>
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground">3.</span>
                  <span className="flex-1 text-sm font-medium text-foreground">Rota Period</span>
                  <span className="text-xs font-semibold text-emerald-600">Complete</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {/* Rota Period — full row */}
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${isSectionCollapsed('period', isPeriodComplete) ? 'hidden md:flex' : 'flex'}`}
                onClick={() => navigate(isPeriodComplete ? "/admin/rota-period/summary?mode=post-submit" : "/admin/rota-period/step-1")}
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">3.</span>
                <span className="flex-1 text-sm font-medium text-foreground">Rota Period</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: getStepColor(isPeriodComplete) }}>
                  {isPeriodComplete ? 'Complete' : 'Not started'}
                </span>
              </div>

              {/* Doctor Surveys — never collapsed */}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/admin/roster")}
              >
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">4.</span>
                <span className="flex-1 text-sm font-medium text-foreground">Doctor Surveys</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: surveyStatus.color }}>
                  {surveyStatus.text}
                </span>
              </div>

            </div>
          </div>

        </div>

        {/* Generate separator */}
        <div className="relative flex items-center justify-center py-1">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <span className="relative bg-background px-3 text-xs text-muted-foreground font-medium">Generate</span>
        </div>

        {/* Generation cards — dimmed when setup incomplete */}
        <div className={!canGeneratePreRota ? "opacity-50 pointer-events-none" : ""}>
          {/* Pre-allocation Rota */}
          <div
            className="rounded-xl border border-border bg-card p-3 shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate('/admin/pre-rota')}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Pre-allocation Rota</h2>
              {preRotaResult && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  preRotaResult.status === 'complete' ? 'text-emerald-700 bg-emerald-100' :
                  preRotaResult.status === 'complete_with_warnings' ? 'text-amber-700 bg-amber-100' :
                  'text-red-700 bg-red-100'
                }`}>
                  {preRotaResult.status === 'complete' && <><CheckCircle className="h-3 w-3" /> Complete</>}
                  {preRotaResult.status === 'complete_with_warnings' && <><AlertTriangle className="h-3 w-3" /> Warnings</>}
                  {preRotaResult.status === 'blocked' && <><XCircle className="h-3 w-3" /> Blocked</>}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">Generate the master calendar and shift targets.</p>
            <Button
              size="sm"
              className="w-full"
              disabled={!canGeneratePreRota || preRotaLoading}
              onClick={(e) => { e.stopPropagation(); handleGeneratePreRota(); }}
            >
              {!canGeneratePreRota && <Lock className="mr-2 h-3.5 w-3.5" />}
              {preRotaLoading ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : preRotaResult ? (
                <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-generate Pre-Rota</>
              ) : (
                <><Play className="mr-2 h-3.5 w-3.5" /> Generate Pre-Rota Data</>
              )}
            </Button>
            {preRotaError && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{preRotaError}</p>
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
                  Generated {new Date(preRotaResult.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('/admin/pre-rota-calendar'); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="View Calendar"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('/admin/pre-rota-targets'); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="View Targets"
                  >
                    <Target className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('/admin/pre-rota'); }}
                    className="text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors"
                  >
                    View details →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Final Allocation Rota */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm mt-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">Final Allocation Rota</h2>
            <p className="text-xs text-muted-foreground mb-2">Run the allocation algorithm.</p>
            <Button
              size="sm"
              className="w-full"
              disabled={!canGeneratePreRota || finalLoading}
              onClick={() => setShowFinalChecklist(true)}
            >
              {finalLoading ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Building…</>
              ) : (
                <><Play className="mr-2 h-3.5 w-3.5" /> Generate Final Rota</>
              )}
            </Button>
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
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowFinalChecklist(false)}>Cancel</Button>
                    <Button size="sm" className="flex-1" disabled={finalLoading} onClick={() => { setShowFinalChecklist(false); handleGenerateFinalRota(); }}>
                      {finalLoading ? 'Building…' : 'Confirm & Generate'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reset button */}
        <div className="pt-4 flex justify-center">
          <button
            className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
            onClick={() => setResetModalOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Reset / New Rota Period
          </button>
        </div>

        <ResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} />
      </div>
    </AdminLayout>
  );
}
