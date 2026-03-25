import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, Target, AlertTriangle, CheckCircle,
  XCircle, Info, RefreshCw, Loader2, ArrowLeft, RotateCcw, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRota } from "@/lib/preRotaGenerator";
import type { PreRotaResult } from "@/lib/preRotaTypes";
import { refreshResolvedAvailabilityForDoctor, rebuildResolvedAvailabilityFromDB } from '@/lib/resolvedAvailability';

export default function PreRotaPage() {
  const navigate = useNavigate();
  const { currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();

  const [preRotaResult, setPreRotaResult] = useState<PreRotaResult | null>(null);
  const [preRotaLoading, setPreRotaLoading] = useState(false);
  const [preRotaError, setPreRotaError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(false);
  const [changesPanelOpen, setChangesPanelOpen] = useState(false)
  const [overrides, setOverrides] = useState<Array<{
    id: string; doctor_id: string; event_type: string; action: string
    start_date: string; end_date: string; note: string | null; created_at: string
  }>>([])
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({})
  const [overridesLoading, setOverridesLoading] = useState(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [revertAllConfirm, setRevertAllConfirm] = useState(false)
  const [revertOneConfirm, setRevertOneConfirm] = useState<string | null>(null)

  // Load existing pre-rota
  useEffect(() => {
    const load = async () => {
      if (!currentRotaConfigId) return;
      try {
        const { data: pr } = await supabase
          .from("pre_rota_results")
          .select("*")
          .eq("rota_config_id", currentRotaConfigId)
          .maybeSingle();

        if (!pr) return;

        const result: PreRotaResult = {
          id: pr.id,
          rotaConfigId: pr.rota_config_id,
          generatedAt: pr.generated_at,
          generatedBy: pr.generated_by,
          status: pr.status as PreRotaResult["status"],
          validationIssues: (pr.validation_issues ?? []) as any,
          calendarData: (pr.calendar_data ?? {}) as any,
          targetsData: (pr.targets_data ?? {}) as any,
          isStale: false,
        };

        const generatedAt = new Date(pr.generated_at);

        const { data: latestDoctors } = await supabase
          .from("doctors")
          .select("updated_at")
          .eq("rota_config_id", currentRotaConfigId)
          .order("updated_at", { ascending: false })
          .limit(1);

        const { data: latestSurveys } = await supabase
          .from("doctor_survey_responses")
          .select("updated_at")
          .eq("rota_config_id", currentRotaConfigId)
          .order("updated_at", { ascending: false })
          .limit(1);

        const latestDoctorUpdate = latestDoctors?.[0]?.updated_at ? new Date(latestDoctors[0].updated_at) : null;
        const latestSurveyUpdate = latestSurveys?.[0]?.updated_at ? new Date(latestSurveys[0].updated_at) : null;

        const stale =
          (latestDoctorUpdate && latestDoctorUpdate > generatedAt) ||
          (latestSurveyUpdate && latestSurveyUpdate > generatedAt);

        result.isStale = !!stale;
        setPreRotaResult(result);
        setIsStale(!!stale);
        setIssuesPanelOpen(result.validationIssues.length > 0 && result.status !== "complete");
      } catch (err) {
        console.error("Failed to load pre-rota:", err);
      }
    };
    load();
  }, [currentRotaConfigId]);

  const handleGeneratePreRota = async () => {
    if (!currentRotaConfigId) return;
    setPreRotaLoading(true);
    setPreRotaError(null);

    const { success, result, error } = await generatePreRota(
      currentRotaConfigId,
      user?.username ?? "developer1"
    );

    setPreRotaLoading(false);

    if (!success || !result) {
      setPreRotaError(error ?? "Generation failed.");
      return;
    }

    setPreRotaResult(result);
    setIsStale(false);
    setIssuesPanelOpen(result.validationIssues.length > 0);
  };

  const loadOverrides = async () => {
    if (!currentRotaConfigId) return
    setOverridesLoading(true)
    try {
      const { data } = await supabase
        .from('coordinator_calendar_overrides')
        .select('id, doctor_id, event_type, action, start_date, end_date, note, created_at')
        .eq('rota_config_id', currentRotaConfigId)
        .order('created_at', { ascending: false })
      const rows = (data ?? []) as Array<{
        id: string; doctor_id: string; event_type: string; action: string
        start_date: string; end_date: string; note: string | null; created_at: string
      }>
      setOverrides(rows)
      const uniqueIds = [...new Set(rows.map(r => r.doctor_id))]
      if (uniqueIds.length > 0) {
        const { data: docs } = await supabase
          .from('doctors')
          .select('id, first_name, last_name')
          .in('id', uniqueIds)
        const names: Record<string, string> = {}
        for (const d of (docs ?? [])) {
          names[d.id] = `Dr ${d.first_name} ${d.last_name}`
        }
        setDoctorNames(names)
      }
    } finally {
      setOverridesLoading(false)
    }
  }

  const handleRevertOne = async (id: string) => {
    setRevertingId(id)
    await supabase.from('coordinator_calendar_overrides').delete().eq('id', id)
    setRevertOneConfirm(null)
    setRevertingId(null)
    await loadOverrides()
  }

  const handleRevertAll = async () => {
    if (!currentRotaConfigId) return
    await supabase.from('coordinator_calendar_overrides').delete().eq('rota_config_id', currentRotaConfigId)
    setRevertAllConfirm(false)
    setOverrides([])
  }

  useEffect(() => {
    if (changesPanelOpen) loadOverrides()
  }, [changesPanelOpen, currentRotaConfigId])

  return (
    <AdminLayout title="Pre-Rota" subtitle="Calendar, targets and data validation" accentColor="blue" pageIcon={BarChart3}>
      <div className="mx-auto max-w-3xl space-y-5 animate-fadeSlideUp">
        {/* Back link + re-generate */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <Button
            size="sm"
            disabled={preRotaLoading}
            onClick={handleGeneratePreRota}
          >
            {preRotaLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Re-generate</>
            )}
          </Button>
        </div>

        {/* Error banner */}
        {preRotaError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{preRotaError}</p>
          </div>
        )}

        {/* Calendar + Targets grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/admin/pre-rota-calendar")}
            disabled={!preRotaResult || preRotaResult.status === "blocked"}
            className="rounded-lg border border-border bg-white p-3 text-center hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CalendarDays className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs font-medium text-muted-foreground">View Calendar →</p>
            <p className="text-[10px] text-muted-foreground/60">
              {preRotaResult && preRotaResult.status !== "blocked" ? "Availability calendar" : "Not generated"}
            </p>
          </button>
          <button
            onClick={() => navigate("/admin/pre-rota-targets")}
            disabled={!preRotaResult || preRotaResult.status === "blocked"}
            className="rounded-lg border border-border bg-white p-3 text-center hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Target className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs font-medium text-muted-foreground">View Targets →</p>
            <p className="text-[10px] text-muted-foreground/60">
              {preRotaResult && preRotaResult.status !== "blocked" ? "Shift hour targets" : "Not generated"}
            </p>
          </button>
        </div>

        {/* Stale warning banner */}
        {isStale && preRotaResult && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Data has changed since this pre-rota was generated on{" "}
              {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}.
              Re-generate to reflect the latest survey submissions.
            </p>
          </div>
        )}

        {/* Status badge + timestamp */}
        {preRotaResult && (
          <div className="flex items-center gap-3">
            {preRotaResult.status === "complete" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                <CheckCircle className="h-3.5 w-3.5" /> Pre-rota complete
              </span>
            )}
            {preRotaResult.status === "complete_with_warnings" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                <AlertTriangle className="h-3.5 w-3.5" /> Complete with warnings
              </span>
            )}
            {preRotaResult.status === "blocked" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                <XCircle className="h-3.5 w-3.5" /> Blocked — critical issues found
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              Generated {new Date(preRotaResult.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at{" "}
              {new Date(preRotaResult.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* Validation issues panel */}
        {preRotaResult && (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <button
              onClick={() => setIssuesPanelOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span>
                Data Validation ({preRotaResult.validationIssues.length} issue
                {preRotaResult.validationIssues.length !== 1 ? "s" : ""})
              </span>
              <span className="text-muted-foreground">{issuesPanelOpen ? "▲" : "▼"}</span>
            </button>

            {issuesPanelOpen && (
              <div className="px-4 py-3 space-y-4">
                {preRotaResult.status === "blocked" && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                    <p className="text-xs font-semibold text-destructive">
                      Generation blocked. Resolve all critical issues before proceeding.
                    </p>
                  </div>
                )}

                {preRotaResult.validationIssues.filter((i) => i.severity === "critical").length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">🔴 Critical</p>
                    <div className="space-y-1.5">
                      {preRotaResult.validationIssues
                        .filter((i) => i.severity === "critical")
                        .map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                            <span className="text-foreground">
                              {issue.doctorName && <strong>{issue.doctorName}: </strong>}
                              {issue.message.replace(issue.doctorName ? `${issue.doctorName}: ` : "", "")}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {preRotaResult.validationIssues.filter((i) => i.severity === "warning").length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">🟠 Warnings</p>
                    <div className="space-y-1.5">
                      {preRotaResult.validationIssues
                        .filter((i) => i.severity === "warning")
                        .map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span className="text-foreground">
                              {issue.doctorName && <strong>{issue.doctorName}: </strong>}
                              {issue.message.replace(issue.doctorName ? `${issue.doctorName}: ` : "", "")}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {preRotaResult.validationIssues.filter((i) => i.severity === "info").length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">🟡 Info</p>
                    <div className="space-y-1.5">
                      {preRotaResult.validationIssues
                        .filter((i) => i.severity === "info")
                        .map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="text-foreground">
                              {issue.doctorName && <strong>{issue.doctorName}: </strong>}
                              {issue.message.replace(issue.doctorName ? `${issue.doctorName}: ` : "", "")}
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

        {/* Coordinator Changes panel */}
        {preRotaResult && (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <button
              onClick={() => setChangesPanelOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Coordinator Changes ({overrides.length} change{overrides.length !== 1 ? 's' : ''})
              <span className="text-muted-foreground">{changesPanelOpen ? '▲' : '▼'}</span>
            </button>

            {changesPanelOpen && (
              <div className="px-4 py-3 space-y-3">
                {overridesLoading ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> <span className="text-xs text-muted-foreground">Loading changes…</span>
                  </div>
                ) : overrides.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No coordinator changes have been made.</p>
                ) : (
                  <>
                    {revertAllConfirm ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-foreground">Revert all {overrides.length} changes? This cannot be undone.</span>
                        <button onClick={handleRevertAll} className="text-xs font-semibold text-red-600 border border-red-200 rounded px-2 py-0.5 bg-white hover:bg-red-50">Confirm</button>
                        <button onClick={() => setRevertAllConfirm(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setRevertAllConfirm(true)}
                          className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 border border-red-200 rounded px-3 py-1.5 bg-white hover:bg-red-50 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Revert all
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      {overrides.map(ov => {
                        const actionColor = ov.action === 'add' ? '#16a34a' : ov.action === 'modify' ? '#2563eb' : '#9ca3af'
                        const actionLabel = ov.action === 'add' ? 'Added' : ov.action === 'modify' ? 'Modified' : 'Removed'
                        const dateLabel = ov.start_date === ov.end_date
                          ? new Date(ov.start_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                          : `${new Date(ov.start_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })} – ${new Date(ov.end_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
                        return (
                          <div key={ov.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="inline-block text-[10px] font-bold text-white rounded px-1.5 py-0.5"
                                  style={{ background: actionColor }}
                                >
                                  {actionLabel}
                                </span>
                                <span className="text-xs font-semibold text-foreground">{ov.event_type}</span>
                                <span className="text-xs text-muted-foreground">{doctorNames[ov.doctor_id] ?? 'Doctor'}</span>
                                <span className="text-xs text-muted-foreground">{dateLabel}</span>
                              </div>
                              {ov.note && <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{ov.note}"</p>}
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {new Date(ov.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at{' '}
                                {new Date(ov.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              {revertOneConfirm === ov.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-foreground">Confirm?</span>
                                  <button
                                    onClick={() => handleRevertOne(ov.id)}
                                    disabled={revertingId === ov.id}
                                    className="text-[10px] font-semibold text-red-600 border border-red-200 rounded px-2 py-0.5 bg-white hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {revertingId === ov.id ? '…' : 'Yes'}
                                  </button>
                                  <button onClick={() => setRevertOneConfirm(null)} className="text-[10px] text-muted-foreground hover:text-foreground">No</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRevertOneConfirm(ov.id)}
                                  className="text-[10px] font-medium text-muted-foreground hover:text-red-600 flex items-center gap-1 border border-border rounded px-2 py-1 hover:border-red-200 transition-colors"
                                >
                                  <RotateCcw className="h-2.5 w-2.5" /> Revert
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
