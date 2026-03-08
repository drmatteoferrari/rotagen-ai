import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Zap, Target, Users, ShieldCheck, Lock,
  Building2, Loader2, ClipboardList, CalendarDays,
  RefreshCw, Play, AlertTriangle, XCircle, Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRota } from "@/lib/preRotaGenerator";
import { buildFinalRotaInput } from "@/lib/rotaGenInput";
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

  // Live survey counts

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
          .from('pre_rota_results' as any)
          .select('*')
          .eq('rota_config_id', currentRotaConfigId)
          .single();

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
  };

  const canGeneratePreRota = isDepartmentComplete && isWtrComplete && isPeriodComplete;

  // ✅ Section 1e complete — setup items with numbered circles
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

  return (
    <AdminLayout title="Dashboard" subtitle="Track setup progress and generate the rota">
      <div className="mx-auto max-w-3xl space-y-6">


        {/* 1. Setup */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">1. Setup</h2>
          {/* ✅ Section 1d complete — numbered heading, progress bar removed */}

          <div className="space-y-1">
            {steps.map((s) => {
              const status = getStepStatus(s.done);
              const IconComp = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(s.link)}
                  style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}
                >
                  {/* Numbered circle */}
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
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
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
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-6 w-6 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">2. Pre-allocation Rota</h2>
          </div>
          {/* ✅ Section 1d complete — numbered heading */}
          <p className="text-xs text-muted-foreground mb-4">
            Generate the master calendar and shift targets from your configuration.
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={!canGeneratePreRota || preRotaLoading}
            onClick={handleGeneratePreRota}
          >
            {!canGeneratePreRota && <Lock className="mr-2 h-4 w-4" />}
            {preRotaLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : preRotaResult ? (
              <><RefreshCw className="mr-2 h-4 w-4" /> Re-generate Pre-Rota</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Generate Pre-Rota Data</>
            )}
          </Button>
          {!canGeneratePreRota && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Complete all setup steps above to unlock generation.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => navigate('/admin/pre-rota-calendar')}
              disabled={!preRotaResult || preRotaResult.status === 'blocked'}
              className="rounded-lg border border-border p-3 text-center hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CalendarDays className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">View Calendar →</p>
              <p className="text-[10px] text-muted-foreground/60">
                {preRotaResult && preRotaResult.status !== 'blocked' ? 'Availability calendar' : 'Not generated'}
              </p>
            </button>
            <button
              onClick={() => navigate('/admin/pre-rota-targets')}
              disabled={!preRotaResult || preRotaResult.status === 'blocked'}
              className="rounded-lg border border-border p-3 text-center hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Target className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">View Targets →</p>
              <p className="text-[10px] text-muted-foreground/60">
                {preRotaResult && preRotaResult.status !== 'blocked' ? 'Shift hour targets' : 'Not generated'}
              </p>
            </button>
          </div>

          {/* Error banner */}
          {preRotaError && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{preRotaError}</p>
            </div>
          )}

          {/* Stale warning banner */}
          {isStale && preRotaResult && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Data has changed since this pre-rota was generated on{' '}
                {new Date(preRotaResult.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
                Re-generate to reflect the latest survey submissions.
              </p>
            </div>
          )}

          {/* Status badge + timestamp */}
          {preRotaResult && (
            <div className="mt-4 flex items-center gap-3">
              {preRotaResult.status === 'complete' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                  <CheckCircle className="h-3.5 w-3.5" /> Pre-rota complete
                </span>
              )}
              {preRotaResult.status === 'complete_with_warnings' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" /> Complete with warnings
                </span>
              )}
              {preRotaResult.status === 'blocked' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                  <XCircle className="h-3.5 w-3.5" /> Blocked — critical issues found
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                Generated {new Date(preRotaResult.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(preRotaResult.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* Validation issues panel */}
          {preRotaResult && (
            <div className="mt-4 rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setIssuesPanelOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span>Data Validation ({preRotaResult.validationIssues.length} issue{preRotaResult.validationIssues.length !== 1 ? 's' : ''})</span>
                <span className="text-muted-foreground">{issuesPanelOpen ? '▲' : '▼'}</span>
              </button>

              {issuesPanelOpen && (
                <div className="px-4 py-3 space-y-4">
                  {preRotaResult.status === 'blocked' && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                      <p className="text-xs font-semibold text-destructive">Generation blocked. Resolve all critical issues before proceeding.</p>
                    </div>
                  )}

                  {preRotaResult.validationIssues.filter(i => i.severity === 'critical').length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-foreground mb-2">🔴 Critical</p>
                      <div className="space-y-1.5">
                        {preRotaResult.validationIssues.filter(i => i.severity === 'critical').map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                            <span className="text-foreground">
                              {issue.doctorName && <strong>{issue.doctorName}: </strong>}
                              {issue.message.replace(issue.doctorName ? `${issue.doctorName}: ` : '', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {preRotaResult.validationIssues.filter(i => i.severity === 'warning').length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-foreground mb-2">🟠 Warnings</p>
                      <div className="space-y-1.5">
                        {preRotaResult.validationIssues.filter(i => i.severity === 'warning').map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span className="text-foreground">
                              {issue.doctorName && <strong>{issue.doctorName}: </strong>}
                              {issue.message.replace(issue.doctorName ? `${issue.doctorName}: ` : '', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {preRotaResult.validationIssues.filter(i => i.severity === 'info').length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-foreground mb-2">🟡 Info</p>
                      <div className="space-y-1.5">
                        {preRotaResult.validationIssues.filter(i => i.severity === 'info').map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="text-foreground">
                              {issue.doctorName && <strong>{issue.doctorName}: </strong>}
                              {issue.message.replace(issue.doctorName ? `${issue.doctorName}: ` : '', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {preRotaResult.validationIssues.length === 0 && (
                    <p className="text-xs text-muted-foreground">No issues found.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Final Allocation Rota */}
        {(() => {
          const [finalLoading, setFinalLoading] = useState(false);

          // SECTION 3 COMPLETE
          const handleGenerateFinalRota = async () => {
            if (!currentRotaConfigId) {
              toast({ title: "No active rota config found", description: "Please complete setup first.", variant: "destructive" });
              return;
            }
            setFinalLoading(true);
            try {
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
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm opacity-60">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">3. Final Allocation Rota</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Verify data quality and run the allocation algorithm.
              </p>
              <div className="space-y-2 mb-4">
                {["Pre-rota data generated", "All surveys completed", "No scheduling conflicts"].map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" disabled className="rounded border-border" />
                    {item}
                  </label>
                ))}
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={!canGeneratePreRota || finalLoading}
                onClick={handleGenerateFinalRota}
              >
                {finalLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building…</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" /> Generate Final Rota Input</>
                )}
              </Button>
            </div>
          );
        })()}
      </div>
    </AdminLayout>
  );
}
// ✅ Section 1 complete
// ✅ Section 2 complete
// ✅ Section 4d complete
// ✅ Section 4e complete
