import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2, CheckCircle, Loader2, Clock, Users, Shield,
  Stethoscope, BarChart2, Info, CalendarDays, Percent
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

  const shiftIndexMap: Record<string, number> = {};
  displayShifts.forEach((s, i) => { shiftIndexMap[s.id] = i; });

  const oncallShifts = displayShifts.filter(s => s.isOncall);
  const nonOncallShifts = displayShifts.filter(s => !s.isOncall);

  function getEffectivePct(s: any): number {
    if (s.targetOverridePct != null) return s.targetOverridePct;
    const peers = s.isOncall ? oncallShifts : nonOncallShifts;
    const overriddenPeers = peers.filter((p: any) => p.targetOverridePct != null);
    const remainingPct = 100 - overriddenPeers.reduce((acc: number, p: any) => acc + (p.targetOverridePct ?? 0), 0);
    const unoverriddenCount = peers.filter((p: any) => p.targetOverridePct == null).length;
    return unoverriddenCount > 0 ? Math.round(remainingPct / unoverriddenCount) : 0;
  }

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

      {/* ── Card 2: Weekly Schedule ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-purple-600" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-7 w-full gap-0.5 sm:gap-1">
            {DAY_KEYS.map((day, i) => {
              const isWeekend = day === "sat" || day === "sun";
              return (
                <div key={day} className={`min-w-0 pb-1 ${isWeekend ? "border-t-2 border-border/40" : "border-t-2 border-purple-200"}`}>
                  <p className={`text-[10px] font-semibold text-center truncate ${isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                    {DAY_LABELS[i]}
                  </p>
                </div>
              );
            })}
            {DAY_KEYS.map((day) => {
              const dayShifts = displayShifts.filter(s => (s.applicableDays ?? {})[day]);
              return (
                <div key={day} className="min-w-0 flex flex-col gap-0.5">
                  {dayShifts.length === 0
                    ? <span className="text-[10px] text-muted-foreground/30 text-center block">—</span>
                    : dayShifts.map((s) => {
                        const idx = shiftIndexMap[s.id] ?? 0;
                        const color = getShiftColor(idx);
                        const target = s.staffing?.target ?? s.staffing?.min ?? 1;
                        return (
                          <div
                            key={s.id}
                            className="rounded px-0.5 py-0.5 text-center w-full"
                            style={{ backgroundColor: color.solid, color: "white" }}
                          >
                            <span className="text-[9px] font-bold leading-tight block truncate">{s.abbreviation}</span>
                            <span className="text-[8px] leading-tight block opacity-90">{`\u00d7${target}`}</span>
                          </div>
                        );
                      })
                  }
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Shift Types (compact) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-purple-600" />
            Shift Types
          </CardTitle>
          {displayShifts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayShifts.length} shift{displayShifts.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-0 divide-y-0">
            {displayShifts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No shift types defined.</p>
            )}
            {displayShifts.map((s, index) => {
              const color = getShiftColor(index);
              return (
                <div key={s.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0">
                  <div
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white mt-0.5"
                    style={{ backgroundColor: color.solid }}
                  >
                    {s.abbreviation}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.startTime}–{s.endTime} · {typeof s.durationHours === "number" ? s.durationHours.toFixed(1) : "—"}h
                    </p>
                    {(() => {
                      const activeBadges = BADGE_CONFIG.filter(({ key }) => !!(s.badges as any)?.[key]);
                      if (activeBadges.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeBadges.map(({ key, label, title }) => (
                            <span
                              key={key}
                              title={title}
                              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 font-medium"
                            >
                              {label} {title}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {((s.reqIac ?? 0) > 0 || (s.reqIaoc ?? 0) > 0 || (s.reqIcu ?? 0) > 0 || (s.reqTransfer ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(s.reqIac ?? 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">IAC ×{s.reqIac}</span>}
                        {(s.reqIaoc ?? 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">IAOC ×{s.reqIaoc}</span>}
                        {(s.reqIcu ?? 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">ICU ×{s.reqIcu}</span>}
                        {(s.reqTransfer ?? 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">Transfer ×{s.reqTransfer}</span>}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">target</p>
                    <p className="text-sm font-bold">{s.staffing?.target ?? s.staffing?.min ?? 1}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Hour Distribution ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4 text-purple-600" />
            Hour Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>On-call</span>
              <span>Non-on-call</span>
            </div>
            <div className="flex h-3 w-full rounded-full overflow-hidden">
              <div className="bg-purple-500 transition-all" style={{ width: `${globalOncallPct}%` }} />
              <div className="bg-slate-300 flex-1" />
            </div>
            <div className="flex justify-between text-xs font-semibold mt-1">
              <span className="text-purple-700">{globalOncallPct}%</span>
              <span className="text-slate-500">{100 - globalOncallPct}%</span>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Per-shift allocation</p>

          {displayShifts.map((s, index) => {
            const color = getShiftColor(index);
            const withinBucketPct = getEffectivePct(s);
            const bucketPct = s.isOncall ? globalOncallPct : (100 - globalOncallPct);
            const globalSharePct = Math.round(bucketPct * withinBucketPct / 100);
            return (
              <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                <div className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: color.solid }}>
                  {s.abbreviation}
                </div>
                <span className="flex-1 min-w-0 text-xs text-foreground truncate">{s.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{s.isOncall ? "On-call" : "Non-OC"}</span>
                <span className="shrink-0 text-xs font-semibold text-foreground w-10 text-right">{globalSharePct}%</span>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Percentages show each shift's share of total rostered hours. Overrides set in Step 3 are applied first; remaining hours are split equally within each bucket.
          </p>
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
    <>
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

        </div>
      </AdminLayout>

      <Dialog open={showEditConfirm} onOpenChange={(open) => { if (!open) setShowEditConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit department setup?</DialogTitle>
            <DialogDescription>Editing department setup may affect a rota already in progress.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
            <Button onClick={() => navigate('/admin/department/step-1')}>Continue to Edit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirm} onOpenChange={(open) => { if (!open) setShowResetConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset department setup?</DialogTitle>
            <DialogDescription>This will permanently delete all shift types and department settings. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={handleReset}>
              {saving ? <>Resetting…</> : "Reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
