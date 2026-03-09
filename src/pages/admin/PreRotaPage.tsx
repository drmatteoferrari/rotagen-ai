import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, Target, AlertTriangle, CheckCircle,
  XCircle, Info, RefreshCw, Loader2, ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRota } from "@/lib/preRotaGenerator";
import type { PreRotaResult } from "@/lib/preRotaTypes";

export default function PreRotaPage() {
  const navigate = useNavigate();
  const { currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();

  const [preRotaResult, setPreRotaResult] = useState<PreRotaResult | null>(null);
  const [preRotaLoading, setPreRotaLoading] = useState(false);
  const [preRotaError, setPreRotaError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

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

  return (
    <AdminLayout title="Pre-Rota" subtitle="Calendar, targets and data validation" accentColor="blue">
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
      </div>
    </AdminLayout>
  );
}
