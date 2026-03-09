import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Target, Users, Lock,
  Building2, Loader2, ClipboardList, CalendarDays,
  RefreshCw, Play, AlertTriangle, XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRota } from "@/lib/preRotaGenerator";
import { buildFinalRotaInput, validateFinalRotaInput } from "@/lib/rotaGenInput";
import { toast } from "@/hooks/use-toast";
import type { PreRotaResult } from "@/lib/preRotaTypes";
// ✅ Section 1a complete — title changed to "Dashboard"
// ✅ Section 2 complete — icon sizes increased

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone, restoredFromDb, rotaStartDate, rotaEndDate } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();


  // Live survey counts
  const [surveySubmitted, setSurveySubmitted] = useState(0);
  const [surveyTotal, setSurveyTotal] = useState(0);

  // Pre-rota state
  const [preRotaResult, setPreRotaResult] = useState<PreRotaResult | null>(null);
  const [preRotaLoading, setPreRotaLoading] = useState(false);
  const [preRotaError, setPreRotaError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(false);
  const [finalLoading, setFinalLoading] = useState(false);
  const [showFinalChecklist, setShowFinalChecklist] = useState(false);

  // Fetch live survey counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!currentRotaConfigId) { setSurveySubmitted(0); setSurveyTotal(0); return; }
      const { data, error } = await supabase
        .from("doctors")
        .select("survey_status")
        .eq("rota_config_id", currentRotaConfigId);
      if (error) { console.error("Failed to fetch survey counts:", error); return; }
      setSurveyTotal(data?.length ?? 0);
      setSurveySubmitted(data?.filter((d) => d.survey_status === "submitted").length ?? 0);
    };
    fetchCounts();
  }, [currentRotaConfigId]);

  // Load existing pre-rota on mount
  useEffect(() => {
    const loadPreRota = async () => {
      if (!currentRotaConfigId) return;
      try {
        const { data: existingPreRota } = await supabase
          .from('pre_rota_results')
          .select('*')
          .eq('rota_config_id', currentRotaConfigId)
          .maybeSingle();

        if (existingPreRota) {
          const pr = existingPreRota as any;
          const result: PreRotaResult = {
            id: pr.id,
            rotaConfigId: pr.rota_config_id,
            generatedAt: pr.generated_at,
            generatedBy: pr.generated_by,
            status: pr.status,
            validationIssues: pr.validation_issues ?? [],
            calendarData: pr.calendar_data ?? {},
            targetsData: pr.targets_data ?? {},
            isStale: false,
          };

          const generatedAt = new Date(pr.generated_at);

          const { data: latestDoctors } = await supabase
            .from('doctors')
            .select('updated_at')
            .eq('rota_config_id', currentRotaConfigId)
            .order('updated_at', { ascending: false })
            .limit(1);

          const { data: latestSurveys } = await supabase
            .from('doctor_survey_responses')
            .select('updated_at')
            .eq('rota_config_id', currentRotaConfigId)
            .order('updated_at', { ascending: false })
            .limit(1);

          const latestDoctorUpdate = latestDoctors?.[0]?.updated_at ? new Date(latestDoctors[0].updated_at) : null;
          const latestSurveyUpdate = latestSurveys?.[0]?.updated_at ? new Date(latestSurveys[0].updated_at) : null;

          const stale =
            (latestDoctorUpdate && latestDoctorUpdate > generatedAt) ||
            (latestSurveyUpdate && latestSurveyUpdate > generatedAt);

          result.isStale = !!stale;
          setPreRotaResult(result);
          setIsStale(!!stale);
          setIssuesPanelOpen(result.validationIssues.length > 0 && result.status !== 'complete');
        }
      } catch (err) {
        console.error('Failed to load existing pre-rota:', err);
      }
    };
    loadPreRota();
  }, [currentRotaConfigId]);

  // Handler functions
  const handleGeneratePreRota = async () => {
    if (!currentRotaConfigId) return;
    setPreRotaLoading(true);
    setPreRotaError(null);

    const { success, result, error } = await generatePreRota(
      currentRotaConfigId,
      user?.username ?? 'developer1'
    );

    setPreRotaLoading(false);

    if (!success || !result) {
      setPreRotaError(error ?? 'Generation failed. Check the console for details.');
      return;
    }

    setPreRotaResult(result);
    setIsStale(false);
    setIssuesPanelOpen(result.validationIssues.length > 0);
    navigate('/admin/pre-rota');
  };

  const canGeneratePreRota = isDepartmentComplete && isWtrComplete && isPeriodComplete;

  const steps = [
    { num: 1, label: "Department", done: isDepartmentComplete, link: "/admin/department/step-1", icon: Building2 },
    { num: 2, label: "Contract Rules (WTR)", done: isWtrComplete, link: "/admin/wtr/step-1", icon: ClipboardList },
    { num: 3, label: "Rota Period", done: isPeriodComplete, link: "/admin/rota-period/step-1", icon: CalendarDays },
  ];

  const getStepStatus = (done: boolean): { color: string; text: string } => {
    if (done) return { color: '#16a34a', text: 'Complete' };
    return { color: '#dc2626', text: 'Not started' };
  };

  const getSurveyStatus = (): { color: string; text: string } => {
    if (surveyTotal === 0) return { color: '#dc2626', text: 'No doctors added' };
    if (surveySubmitted === surveyTotal) return { color: '#16a34a', text: `${surveySubmitted} / ${surveyTotal} submitted` };
    if (surveySubmitted > 0) return { color: '#d97706', text: `${surveySubmitted} / ${surveyTotal} submitted` };
    return { color: '#dc2626', text: `${surveySubmitted} / ${surveyTotal} submitted` };
  };

  const handleGenerateFinalRota = async () => {
    if (!currentRotaConfigId) {
      toast({ title: "No active rota config found", description: "Please complete setup first.", variant: "destructive" });
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

  return (
    <AdminLayout title="Dashboard" subtitle="Track setup progress and generate the rota" accentColor="blue">
      <div className="mx-auto max-w-3xl space-y-4">

        {/* 1. Setup */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">1. Setup</h2>

          <div className="space-y-1">
            {steps.map((s) => {
              const status = getStepStatus(s.done);
              const IconComp = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(s.link)}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: status.color, color: '#fff', fontSize: 13, fontWeight: 700,
                  }}>
                    {s.num}
                  </div>
                  <IconComp className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{s.label}</span>
                    {s.num === 3 && (() => {
                      const sd = rotaStartDate ?? (restoredConfig?.rotaPeriod?.startDate ? new Date(restoredConfig.rotaPeriod.startDate) : null);
                      const ed = rotaEndDate ?? (restoredConfig?.rotaPeriod?.endDate ? new Date(restoredConfig.rotaPeriod.endDate) : null);
                      if (!sd || !ed) return null;
                      return (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {sd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' → '}
                          {ed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      );
                    })()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: status.color }}>{status.text}</span>
                </div>
              );
            })}

            {/* Doctor Preferences — item 4 */}
            {(() => {
              const surveyStatus = getSurveyStatus();
              return (
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate("/admin/roster")}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: surveyStatus.color, color: '#fff', fontSize: 13, fontWeight: 700,
                  }}>
                    4
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium text-foreground">Doctor Preferences</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: surveyStatus.color }}>{surveyStatus.text}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 2. Pre-allocation Rota */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              2. Pre-allocation Rota
            </h2>
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
          <p className="text-xs text-muted-foreground mb-2">
            Generate the master calendar and shift targets.
          </p>
          <Button
            size="sm"
            className="w-full"
            disabled={!canGeneratePreRota || preRotaLoading}
            onClick={handleGeneratePreRota}
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
          {!canGeneratePreRota && (
            <p className="text-[11px] text-muted-foreground mt-1 text-center">
              Complete setup steps above to unlock.
            </p>
          )}
          {preRotaError && (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{preRotaError}</p>
            </div>
          )}
          {isStale && preRotaResult && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-800">
                Data changed — re-generate to reflect latest submissions.
              </p>
            </div>
          )}
          {preRotaResult && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Generated {new Date(preRotaResult.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <button
                onClick={() => navigate('/admin/pre-rota')}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                View details →
              </button>
            </div>
          )}
        </div>

        {/* 3. Final Allocation Rota */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              3. Final Allocation Rota
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Run the allocation algorithm.
          </p>
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
                <p className="text-xs text-muted-foreground mb-4">
                  Confirm the following before running the final rota:
                </p>
                <div className="space-y-3 mb-5">
                  {["Pre-rota data generated", "All surveys completed", "No scheduling conflicts"].map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded border-border accent-primary" />
                      {item}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowFinalChecklist(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={finalLoading}
                    onClick={() => { setShowFinalChecklist(false); handleGenerateFinalRota(); }}
                  >
                    {finalLoading ? 'Building…' : 'Confirm & Generate'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
