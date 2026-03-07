import { useState, useEffect, useMemo, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth, loadAccountSettings } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle, Circle, Zap, Calendar, Target, Users, ShieldCheck, Lock,
  Building2, Loader2, Pencil, ClipboardList, CalendarDays, X, BarChart3,
  ChevronLeft, ChevronRight, RefreshCw, Play, Download, AlertTriangle, XCircle, Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRotaConfig } from "@/lib/rotaConfig";
import { computeShiftTargets, type ComputeShiftTargetsResult } from "@/lib/shiftTargets";
import { generatePreRota } from "@/lib/preRotaGenerator";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import type { PreRotaResult, CellCode } from "@/lib/preRotaTypes";
// ✅ Section 1 complete

const CELL_BG: Record<string, string> = {
  AL: 'bg-green-500', SL: 'bg-blue-500', NOC: 'bg-purple-500',
  ROT: 'bg-orange-500', PL: 'bg-pink-500', BH: 'bg-red-500',
  LTFT: 'bg-gray-200', AVAILABLE: 'bg-white',
};
const CELL_TEXT: Record<string, string> = {
  AL: 'text-white', SL: 'text-white', NOC: 'text-white',
  ROT: 'text-white', PL: 'text-white', BH: 'text-white',
  LTFT: 'text-gray-600', AVAILABLE: 'text-transparent',
};
const LEGEND_LABELS: Record<string, string> = {
  AL: 'Annual Leave', SL: 'Study Leave', NOC: 'Not On-Call',
  ROT: 'Rotation', PL: 'Parental Leave', BH: 'Bank Holiday', LTFT: 'LTFT day off',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone, restoredFromDb } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();
  const { user, accountSettings, setAccountSettings } = useAuth();

  // Loading state
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Department/Hospital state
  const [departmentName, setDepartmentName] = useState("");
  const [trustName, setTrustName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);
  const [departmentError, setDepartmentError] = useState("");
  const [trustError, setTrustError] = useState("");

  // Editing state for compact view
  const [editing, setEditing] = useState(false);
  const [editDept, setEditDept] = useState("");
  const [editTrust, setEditTrust] = useState("");

  // Live survey counts
  const [surveySubmitted, setSurveySubmitted] = useState(0);
  const [surveyTotal, setSurveyTotal] = useState(0);

  // ✅ Section 2 — Pre-rota state
  const [preRotaResult, setPreRotaResult] = useState<PreRotaResult | null>(null);
  const [preRotaLoading, setPreRotaLoading] = useState(false);
  const [preRotaError, setPreRotaError] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(false);
  // ✅ Section 2 complete

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      if (!user?.username) { setLoadingSettings(false); return; }
      setLoadingSettings(true);
      try {
        const settings = await loadAccountSettings(user.username);
        setDepartmentName(settings.departmentName || "");
        setTrustName(settings.trustName || "");
      } catch (error) {
        console.error("Failed to load account settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    };
    load();
  }, [user?.username]);

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

  // ✅ Section 3 — Load existing pre-rota on mount
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
  // ✅ Section 3 complete

  // Shift targets preview
  const { config: fullConfig } = useRotaConfig();

  const targetsResult = useMemo<ComputeShiftTargetsResult | null>(() => {
    if (!fullConfig?.wtr || !fullConfig.shifts.length) return null;
    const hasTargets = fullConfig.shifts.some((s) => s.targetPercentage != null && s.targetPercentage > 0);
    if (!hasTargets) return null;
    return computeShiftTargets({
      maxHoursPerWeek: fullConfig.wtr.maxHoursPerWeek,
      maxHoursPer168h: fullConfig.wtr.maxHoursPer168h,
      rotaWeeks: fullConfig.rotaPeriod.durationWeeks ?? 0,
      globalOncallPct: fullConfig.distribution.globalOncallPct,
      globalNonOncallPct: fullConfig.distribution.globalNonOncallPct,
      shiftTypes: fullConfig.shifts.map((s) => ({
        id: s.id, name: s.name, shiftKey: s.shiftKey, isOncall: s.isOncall,
        targetPercentage: s.targetPercentage ?? 0, durationHours: s.durationHours,
      })),
      wtePercent: 100,
    });
  }, [fullConfig]);

  // ✅ Section 4 — Handler functions
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
    setCurrentWeekIndex(0);
    setIsStale(false);
    setIssuesPanelOpen(result.validationIssues.length > 0);
  };

  const handleDownloadCalendar = () => {
    if (!preRotaResult?.calendarData || preRotaResult.status === 'blocked') return;
    const blob = generatePreRotaExcel(preRotaResult.calendarData, preRotaResult.targetsData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RotaGen_PreRota_${preRotaResult.calendarData.rotaStartDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTargets = handleDownloadCalendar;

  const handlePrevWeek = useCallback(() => setCurrentWeekIndex(i => Math.max(0, i - 1)), []);
  const handleNextWeek = useCallback(() => {
    const totalWeeks = preRotaResult?.calendarData?.weeks?.length ?? 0;
    setCurrentWeekIndex(i => Math.min(totalWeeks - 1, i + 1));
  }, [preRotaResult]);
  // ✅ Section 4 complete

  // ✅ Section 7 — Keyboard navigation
  useEffect(() => {
    if (!preRotaResult || preRotaResult.status === 'blocked') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevWeek();
      if (e.key === 'ArrowRight') handleNextWeek();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [preRotaResult, handlePrevWeek, handleNextWeek]);
  // ✅ Section 7 complete

  // Save handler
  const handleSaveAccountSettings = async () => {
    setDepartmentError("");
    setTrustError("");
    setSaveStatus(null);
    const dName = editing ? editDept : departmentName;
    const tName = editing ? editTrust : trustName;

    if (!dName.trim()) { setDepartmentError("Please enter a department name"); return; }
    if (!tName.trim()) { setTrustError("Please enter a hospital or trust name"); return; }
    if (!user?.username) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("account_settings")
        .upsert(
          { owned_by: user.username, department_name: dName.trim(), trust_name: tName.trim(), updated_at: new Date().toISOString() },
          { onConflict: "owned_by" }
        );
      if (error) throw error;

      setAccountSettings({ departmentName: dName.trim(), trustName: tName.trim() });
      setDepartmentName(dName.trim());
      setTrustName(tName.trim());
      setSaveStatus("saved");
      setEditing(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Failed to save account settings:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const hasSavedSettings = !loadingSettings && !!departmentName.trim() && !!trustName.trim();

  const completedCount = [isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone].filter(Boolean).length;
  const canGeneratePreRota = isDepartmentComplete && isWtrComplete && isPeriodComplete;

  const getStatusLabel = (done: boolean) => {
    if (done && restoredFromDb) return "✅ Saved";
    if (done) return "Done";
    return null;
  };

  const steps = [
    { num: 1, label: "Department", done: isDepartmentComplete, link: "/admin/department/step-1", icon: Building2 },
    { num: 2, label: "Contract Rules (WTR)", done: isWtrComplete, link: "/admin/wtr/step-1", icon: ClipboardList },
    { num: 3, label: "Rota Period", done: isPeriodComplete, link: "/admin/rota-period/step-1", icon: CalendarDays },
  ];

  return (
    <AdminLayout title="Generation Command Center" subtitle="Track setup progress and generate the rota">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Department & Hospital */}
        {loadingSettings ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : hasSavedSettings && !editing ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {departmentName} <span className="text-muted-foreground mx-1">·</span> {trustName}
            </span>
            <button
              onClick={() => { setEditDept(departmentName); setEditTrust(trustName); setEditing(true); setDepartmentError(""); setTrustError(""); setSaveStatus(null); }}
              className="ml-auto shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : hasSavedSettings && editing ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Department name</label>
                <Input value={editDept} onChange={(e) => { setEditDept(e.target.value); setDepartmentError(""); }} placeholder="e.g. Anaesthetics" />
                {departmentError && <p className="text-xs text-destructive mt-1">{departmentError}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital / Trust name</label>
                <Input value={editTrust} onChange={(e) => { setEditTrust(e.target.value); setTrustError(""); }} placeholder="e.g. Manchester University NHS Foundation Trust" />
                {trustError && <p className="text-xs text-destructive mt-1">{trustError}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveAccountSettings} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            {saveStatus === "error" && <p className="text-xs text-destructive">Save failed — please try again.</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Department & Hospital</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Department name</label>
                <Input placeholder="e.g. Anaesthetics" value={departmentName} onChange={(e) => { setDepartmentName(e.target.value); setDepartmentError(""); setSaveStatus(null); }} />
                {departmentError && <p className="text-xs text-destructive mt-1">{departmentError}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital / Trust name</label>
                <Input placeholder="e.g. Manchester University NHS Foundation Trust" value={trustName} onChange={(e) => { setTrustName(e.target.value); setTrustError(""); setSaveStatus(null); }} />
                {trustError && <p className="text-xs text-destructive mt-1">{trustError}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">Set these once — they appear in all survey emails sent to doctors.</p>
              <Button size="sm" onClick={handleSaveAccountSettings} disabled={saving || saveStatus === "saved"} className={saveStatus === "saved" ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                {saving ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "Save"}
              </Button>
            </div>
            {saveStatus === "saved" && <p className="text-xs text-emerald-600 mt-2">✓ Saved — your department and hospital name will appear in all survey emails.</p>}
            {saveStatus === "error" && <p className="text-xs text-destructive mt-2">Save failed — please try again.</p>}
          </div>
        )}

        {/* Setup Progress */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Setup Progress</h2>
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {completedCount}/4 Completed
            </span>
          </div>
          <div className="space-y-3">
            {steps.map((s) => {
              const statusLabel = getStatusLabel(s.done);
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(s.link)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {s.num}
                    </span>
                    {s.done ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className={s.done ? "font-medium text-card-foreground" : "font-medium text-muted-foreground"}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusLabel && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                        {statusLabel}
                      </span>
                    )}
                    {!s.done && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        ○ Not started
                      </span>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(s.link); }}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}

            {/* Doctor Preferences row */}
            <div
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/admin/roster")}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  4
                </span>
                {areSurveysDone ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Users className="h-5 w-5 text-amber-500" />
                )}
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-card-foreground">Doctor Preferences</span>
              </div>
              <div className="flex items-center gap-2">
                {areSurveysDone ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Done
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {surveySubmitted} / {surveyTotal} responses received
                  </span>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate("/admin/roster"); }}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p>Edit</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>

        {/* Targets Preview Panel */}
        {targetsResult ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Shift Hour Targets (Full-Time Baseline)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Shift name</th>
                    <th className="pb-2 font-medium">On-call?</th>
                    <th className="pb-2 font-medium text-right">Max target hours</th>
                    <th className="pb-2 font-medium text-right">Est. shifts</th>
                    <th className="pb-2 font-medium text-right">Avg duration</th>
                  </tr>
                </thead>
                <tbody>
                  {targetsResult.targets.map((t) => (
                    <tr key={t.shiftId} className="border-b border-border/50">
                      <td className="py-2 font-medium text-card-foreground">{t.shiftName}</td>
                      <td className="py-2 text-muted-foreground">{fullConfig?.shifts.find((s) => s.id === t.shiftId)?.isOncall ? "Yes" : "No"}</td>
                      <td className="py-2 text-right font-mono">{t.maxTargetHours}h</td>
                      <td className="py-2 text-right font-mono">~{t.estimatedShiftCount}</td>
                      <td className="py-2 text-right font-mono">{fullConfig?.shifts.find((s) => s.id === t.shiftId)?.durationHours ?? 0}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs font-semibold text-card-foreground mt-3">
              Total: {targetsResult.totalMaxTargetHours}h over {targetsResult.targets[0]?.rotaWeeks ?? 0} weeks
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              LTFT doctors receive pro-rata targets. WTE scaling applied per doctor at generation time.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Hard per-week cap: {targetsResult.hardWeeklyCap}h — checked during generation, not included in targets.
            </p>
          </div>
        ) : isDepartmentComplete && isWtrComplete && isPeriodComplete ? null : (
          <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
            <p className="text-sm text-muted-foreground">Complete department setup and WTR configuration to see shift targets.</p>
          </div>
        )}

        {/* ✅ Section 5 — Phase 1: Pre-Rota Data */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Phase 1: Pre-Rota Data</h2>
          </div>
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
              onClick={handleDownloadCalendar}
              disabled={!preRotaResult || preRotaResult.status === 'blocked'}
              className="rounded-lg border border-border p-3 text-center hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Download Calendar</p>
              <p className="text-[10px] text-muted-foreground/60">
                {preRotaResult && preRotaResult.status !== 'blocked' ? 'Excel (.xlsx)' : 'Not generated'}
              </p>
            </button>
            <button
              onClick={handleDownloadTargets}
              disabled={!preRotaResult || preRotaResult.status === 'blocked'}
              className="rounded-lg border border-border p-3 text-center hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Download Targets</p>
              <p className="text-[10px] text-muted-foreground/60">
                {preRotaResult && preRotaResult.status !== 'blocked' ? 'Excel (.xlsx)' : 'Not generated'}
              </p>
            </button>
          </div>
          {/* ✅ Section 5 complete */}

          {/* ✅ Section 6 — Results section */}

          {/* 6.1 — Error banner */}
          {preRotaError && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{preRotaError}</p>
            </div>
          )}

          {/* 6.2 — Stale warning banner */}
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

          {/* 6.3 — Status badge + timestamp */}
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

          {/* 6.4 — Validation issues panel */}
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

        {/* 6.5 — Weekly calendar view */}
        {preRotaResult && preRotaResult.status !== 'blocked' && preRotaResult.calendarData?.weeks?.length > 0 && (() => {
          const { weeks, doctors } = preRotaResult.calendarData;
          const week = weeks[currentWeekIndex];
          if (!week) return null;
          const totalDoctors = doctors.length;

          return (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Availability Calendar</h3>

              {/* Week navigator */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevWeek} disabled={currentWeekIndex === 0} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium text-foreground">
                  Week {week.weekNumber} of {weeks.length} —{' '}
                  {new Date(week.dates[0] + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} to{' '}
                  {new Date(week.dates[week.dates.length - 1] + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                </span>
                <button onClick={handleNextWeek} disabled={currentWeekIndex >= weeks.length - 1} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Calendar table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground border-b border-border">Doctor</th>
                      {week.dates.map(date => {
                        const d = new Date(date + 'T00:00:00');
                        const isWknd = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <th key={date} className={`text-center py-1.5 px-1 font-medium border-b border-border ${isWknd ? 'bg-gray-100' : ''}`}>
                            <p className="text-[10px] text-muted-foreground">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                            <p className="text-[10px] text-muted-foreground">{d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map(doctor => (
                      <tr key={doctor.doctorId} className="border-b border-border/50">
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <p className="font-medium text-foreground text-[11px]">{doctor.doctorName}</p>
                          <p className="text-[9px] text-muted-foreground">{doctor.grade} · {doctor.wte}%</p>
                        </td>
                        {week.dates.map(date => {
                          const cell = doctor.availability[date];
                          const primary = cell?.primary ?? 'AVAILABLE';
                          const isWknd = new Date(date + 'T00:00:00').getDay() === 0 || new Date(date + 'T00:00:00').getDay() === 6;
                          return (
                            <td key={date} className={`text-center py-1.5 px-0.5 ${isWknd && primary === 'AVAILABLE' ? 'bg-gray-50' : ''}`}>
                              <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold ${CELL_BG[primary] ?? ''} ${CELL_TEXT[primary] ?? ''}`}>
                                {cell?.label || ''}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Available count row */}
                    <tr className="bg-blue-50 font-semibold">
                      <td className="py-1.5 px-2 text-[11px] text-foreground">Available</td>
                      {week.dates.map(date => {
                        const available = doctors.filter(d => !d.availability[date] || d.availability[date].primary === 'AVAILABLE').length;
                        return (
                          <td key={date} className="text-center py-1.5 text-[10px] text-foreground">
                            {available}/{totalDoctors}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4">
                {(['AL', 'SL', 'NOC', 'ROT', 'PL', 'BH', 'LTFT'] as const).map(code => (
                  <span key={code} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className={`inline-block w-3 h-3 rounded ${CELL_BG[code]}`} />
                    {LEGEND_LABELS[code]}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="inline-block w-3 h-3 rounded border border-border bg-white" />
                  Available
                </span>
              </div>
            </div>
          );
        })()}

        {/* 6.6 — Targets table */}
        {preRotaResult && preRotaResult.status !== 'blocked' && preRotaResult.targetsData?.doctors?.length > 0 && (() => {
          const { doctors: tDoctors, shiftTypes: tShiftTypes, teamTotal, teamAverage, wtrMaxHoursPerWeek, hardWeeklyCap: hwc } = preRotaResult.targetsData;

          return (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Shift Hour Targets</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 px-2 font-medium text-muted-foreground">Doctor</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Grade</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">WTE</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-center">
                        <p>Hrs/wk</p><p className="font-normal text-[9px]">contracted</p>
                      </th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-center">
                        <p>Hard cap</p><p className="font-normal text-[9px]">per 168h</p>
                      </th>
                      {tShiftTypes.map(st => (
                        <th key={st.id} className="py-2 px-2 font-medium text-muted-foreground text-center">
                          <p>{st.name}</p><p className="font-normal text-[9px]">{st.isOncall ? 'on-call' : 'non-oncall'}</p>
                        </th>
                      ))}
                      <th className="py-2 px-2 font-medium text-muted-foreground text-center">
                        <p>Weekends</p><p className="font-normal text-[9px]">max</p>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tDoctors.map((doctor, idx) => {
                      const isLTFT = doctor.wte < 100;
                      return (
                        <tr key={doctor.doctorId} className={`border-b border-border/50 ${isLTFT ? 'bg-amber-50' : idx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                          <td className="py-2 px-2 font-medium text-foreground whitespace-nowrap">{doctor.doctorName}</td>
                          <td className="py-2 px-2 text-muted-foreground">{doctor.grade}</td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {doctor.wte}%
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{doctor.contractedHoursPerWeek}h</td>
                          <td className="py-2 px-2 text-center font-mono">{doctor.hardWeeklyCap}h</td>
                          {tShiftTypes.map(st => {
                            const target = doctor.shiftTargets.find(t => t.shiftTypeId === st.id);
                            return (
                              <td key={st.id} className="py-2 px-2 text-center">
                                <p className="font-mono">{target?.maxTargetHours ?? 0}h</p>
                                <p className="text-[9px] text-muted-foreground">~{target?.estimatedShiftCount ?? 0} shifts</p>
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center font-mono">{doctor.weekendCap}</td>
                        </tr>
                      );
                    })}

                    {/* Team Total row */}
                    <tr className="border-b-2 border-border bg-blue-50 font-semibold">
                      <td className="py-2 px-2 text-foreground">Team Total</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2"></td>
                      {tShiftTypes.map(st => {
                        const t = teamTotal.shiftTargets.find(x => x.shiftTypeId === st.id);
                        return <td key={st.id} className="py-2 px-2 text-center font-mono">{t?.value ?? 0}h</td>;
                      })}
                      <td className="py-2 px-2 text-center font-mono">{teamTotal.weekendCap}</td>
                    </tr>

                    {/* Team Average row */}
                    <tr className="bg-blue-50 font-semibold">
                      <td className="py-2 px-2 text-foreground">Team Average</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2"></td>
                      {tShiftTypes.map(st => {
                        const t = teamAverage.shiftTargets.find(x => x.shiftTypeId === st.id);
                        return <td key={st.id} className="py-2 px-2 text-center font-mono">{t?.value ?? 0}h</td>;
                      })}
                      <td className="py-2 px-2 text-center font-mono">{teamAverage.weekendCap}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        {/* ✅ Section 6 complete */}

        {/* Phase 2: Final Allocation */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Phase 2: Final Allocation</h2>
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
          <Button size="lg" className="w-full" disabled>
            <Lock className="mr-2 h-4 w-4" />
            Run Allocation Algorithm
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
