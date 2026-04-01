import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, CheckCircle, Loader2, Clock, Users, Shield,
  Stethoscope, BarChart2, Info
} from "lucide-react";
import {
  useDepartmentSetup,
  getShiftColor,
  SHIFT_COLORS,
} from "@/contexts/DepartmentSetupContext";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DepartmentSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPostSubmit = searchParams.get("mode") !== "pre-submit";

  const { shifts, globalOncallPct, resetDepartment } = useDepartmentSetup();
  const { setDepartmentComplete } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();
  const { user, accountSettings } = useAuth();

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [displayShifts, setDisplayShifts] = useState<any[]>(shifts);

  useEffect(() => {
    if (!isPostSubmit || !currentRotaConfigId) return;
    supabase.from('rota_configs').select('updated_at').eq('id', currentRotaConfigId).maybeSingle()
      .then(({ data }) => {
        if (data?.updated_at) setSavedAt(format(new Date(data.updated_at), "dd MMM yyyy 'at' HH:mm"));
      });
  }, [isPostSubmit, currentRotaConfigId]);

  useEffect(() => {
    if (shifts.length > 0) { setDisplayShifts(shifts); return; }
    if (!currentRotaConfigId) return;
    supabase.from('shift_types').select('*').eq('rota_config_id', currentRotaConfigId).order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDisplayShifts(data.map((r: any) => ({
            id: r.shift_key ?? r.id,
            name: r.name,
            startTime: r.start_time,
            endTime: r.end_time,
            durationHours: r.duration_hours,
            isOncall: r.is_oncall ?? false,
            abbreviation: r.abbreviation ?? r.name.slice(0, 2).toUpperCase(),
            targetOverridePct: r.target_percentage ?? null,
            staffing: { min: r.min_doctors ?? 1, target: r.target_doctors ?? 1, max: r.max_doctors ?? null },
            applicableDays: { mon: r.applicable_mon, tue: r.applicable_tue, wed: r.applicable_wed, thu: r.applicable_thu, fri: r.applicable_fri, sat: r.applicable_sat, sun: r.applicable_sun },
          })));
        }
      });
  }, [shifts, currentRotaConfigId]);

  const handleConfirmSave = async () => {
    if (!currentRotaConfigId || !user?.id) return;
    setSaving(true);
    try {
      await supabase.from('rota_configs').update({
        global_oncall_pct: globalOncallPct,
        global_non_oncall_pct: 100 - globalOncallPct,
        updated_at: new Date().toISOString(),
      }).eq('id', currentRotaConfigId);

      for (const shift of displayShifts) {
        await supabase.from('shift_types').update({
          target_percentage: shift.targetOverridePct ?? null,
          updated_at: new Date().toISOString(),
        }).eq('rota_config_id', currentRotaConfigId).eq('shift_key', shift.id);
      }
      setDepartmentComplete(true);
      toast.success('✓ Department setup saved');
      navigate('/admin/setup');
    } catch {
      toast.error('Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentRotaConfigId) return;
    setSaving(true);
    try {
      await supabase.from('shift_types').delete().eq('rota_config_id', currentRotaConfigId);
      resetDepartment();
      setDepartmentComplete(false);
      toast.success('Department setup reset');
      navigate('/admin/department/step-1');
    } catch {
      toast.error('Reset failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  const BADGE_CONFIG: {
    key: "night" | "long" | "ooh" | "oncall" | "nonres";
    label: string;
    title: string;
  }[] = [
    { key: "night",  label: "🌙", title: "Night" },
    { key: "long",   label: "⏱",  title: "Long (>10 h)" },
    { key: "ooh",    label: "🌆", title: "Out of hours" },
    { key: "oncall", label: "📟", title: "On-call (resident)" },
    { key: "nonres", label: "🏠", title: "Non-resident on-call" },
  ];

  const dataCards = (
    <>
      {/* ── Card 1: Department Details ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-purple-600" />
            Department Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex justify-between text-sm py-2 border-b border-border">
            <span className="text-muted-foreground">Department</span>
            <span className="font-medium">{accountSettings.departmentName ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between text-sm py-2">
            <span className="text-muted-foreground">Hospital / Trust</span>
            <span className="font-medium">{accountSettings.trustName ?? "\u2014"}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Hour Distribution ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4 text-purple-600" />
            Hour Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex justify-between text-sm py-2 border-b border-border">
            <span className="text-muted-foreground">On-call fraction</span>
            <span className="font-medium">{globalOncallPct}%</span>
          </div>
          <div className="flex justify-between text-sm py-2">
            <span className="text-muted-foreground">Non-on-call fraction</span>
            <span className="font-medium">{100 - globalOncallPct}%</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Shift Types (one sub-card per shift) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-purple-600" />
            Shift Types
          </CardTitle>
          {displayShifts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayShifts.length} shift{displayShifts.length !== 1 ? "s" : ""} defined
            </p>
          )}
        </CardHeader>
        <CardContent>
          {displayShifts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No shift types defined.</p>
          )}

          {displayShifts.map((s, index) => {
            const color = getShiftColor(index);
            const applicableDays: Record<string, boolean> =
              s.applicableDays ?? {};
            const hasCompetency =
              (s.reqIac ?? 0) > 0 ||
              (s.reqIaoc ?? 0) > 0 ||
              (s.reqIcu ?? 0) > 0 ||
              (s.reqTransfer ?? 0) > 0;
            const hasMinGrade = s.reqMinGrade != null && s.reqMinGrade !== "";

            return (
              <div
                key={s.id}
                className="rounded-lg border border-border p-3 mb-3 last:mb-0"
                style={{ borderLeftWidth: 4, borderLeftColor: color.solid }}
              >
                {/* Shift header bar */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${color.bg} ${color.text}`}
                  >
                    {s.abbreviation}
                  </span>
                  <span className="text-sm font-semibold flex-1">
                    {s.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {String(s.startTime).slice(0, 5)}{"\u2013"}{String(s.endTime).slice(0, 5)}
                    {" "}({s.durationHours}h)
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  {/* 7-day applicable grid */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Applicable days
                    </p>
                    <div className="flex gap-1">
                      {DAY_KEYS.map((day, i) => {
                        const active = !!applicableDays[day];
                        const isWeekend = day === "sat" || day === "sun";
                        return (
                          <span
                            key={day}
                            className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors ${
                              active
                                ? `${color.bg} ${color.text}`
                                : isWeekend
                                ? "bg-muted/60 text-muted-foreground/50"
                                : "bg-muted text-muted-foreground/50"
                            }`}
                          >
                            {DAY_LABELS[i]}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Staffing row */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <Users className="h-3 w-3 inline mr-1" />
                      Staffing
                    </p>
                    <div className="flex gap-2">
                      {[
                        { label: "Min",    value: s.staffing?.min    ?? s.staffing?.target ?? 1 },
                        { label: "Target", value: s.staffing?.target ?? 1 },
                        { label: "Max",    value: s.staffing?.max    != null ? s.staffing.max : "\u2014" },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center bg-muted rounded px-3 py-1.5">
                          <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
                          <p className="text-sm font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Badges */}
                  {s.badges && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Shift characteristics
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {BADGE_CONFIG.map(({ key, label, title }) => {
                          const active = !!(s.badges as any)[key];
                          return (
                            <span key={key} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${active ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-muted text-muted-foreground/50 line-through border-transparent"}`}>
                              {label} {title}
                            </span>
                          );
                        })}
                        {/* On-call type pill */}
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border font-medium">
                          {s.isOncall
                            ? (s.isNonRes ? "Non-resident on-call" : "Resident on-call")
                            : "Non-on-call"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Competency requirements */}
                  {(hasCompetency || hasMinGrade) && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Competency requirements
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: "reqIac",      label: "IAC",      val: s.reqIac      ?? 0 },
                          { key: "reqIaoc",     label: "IAOC",     val: s.reqIaoc     ?? 0 },
                          { key: "reqIcu",      label: "ICU",      val: s.reqIcu      ?? 0 },
                          { key: "reqTransfer", label: "Transfer", val: s.reqTransfer ?? 0 },
                        ]
                          .filter(({ val }) => val > 0)
                          .map(({ key, label, val }) => (
                            <span key={key} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              <Shield className="h-3 w-3" />
                              {label}: {val}+
                            </span>
                          ))}
                        {hasMinGrade && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
                            <Info className="h-3 w-3" />
                            Min grade: {s.reqMinGrade}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Target override % */}
                  {s.targetOverridePct != null && (
                    <div className="flex justify-between text-sm py-1.5 border-t border-border mt-1">
                      <span className="text-muted-foreground">Target allocation override</span>
                      <span className="font-medium">{s.targetOverridePct}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );

  const navBarContent = isPostSubmit ? (
    <StepNavBar
      left={<Button variant="outline" size="lg" onClick={() => { setShowResetConfirm(true); setShowEditConfirm(false); }}>Reset</Button>}
      right={<Button variant="outline" size="lg" onClick={() => { setShowEditConfirm(true); setShowResetConfirm(false); }}>Edit</Button>}
    />
  ) : (
    <StepNavBar
      left={<Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-3")}>Back</Button>}
      right={
        <Button size="lg" disabled={saving} onClick={handleConfirmSave}>
          {saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Confirm & Save"}
        </Button>
      }
    />
  );

  return (
    <AdminLayout title="Department Setup" subtitle={isPostSubmit ? "Summary" : "Review & save"} accentColor="purple" pageIcon={Building2} navBar={navBarContent}>
      <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">

        {isPostSubmit ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Department setup complete{savedAt ? ` · ${savedAt}` : ''}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700">
            Review your department configuration before saving.
          </div>
        )}

        {dataCards}

        {isPostSubmit && showEditConfirm && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-800 mb-3">Editing department setup may affect a rota already in progress. Continue?</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => navigate('/admin/department/step-1')}>Continue to Edit</Button>
            </div>
          </div>
        )}
        {isPostSubmit && showResetConfirm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive mb-3">This will delete all shift types and department settings. This cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={saving} onClick={handleReset}>
                {saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Resetting…</> : "Reset"}
              </Button>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
