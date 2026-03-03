import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Circle, Zap, Calendar, Target, Users, ShieldCheck, Lock, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// SECTION 7 — Status indicators on Dashboard
// SECTION 9 — Department & Hospital fields on Dashboard

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone, restoredFromDb } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();

  // SECTION 9 — Department/Hospital state
  const [deptName, setDeptName] = useState("");
  const [trustName, setTrustName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (restoredConfig) {
      setDeptName(restoredConfig.department?.departmentName ?? "");
      setTrustName(restoredConfig.department?.trustName ?? "");
    }
  }, [restoredConfig]);

  const saveDeptInfo = async () => {
    if (!currentRotaConfigId) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    const { error } = await supabase
      .from("rota_configs")
      .update({ department_name: deptName, trust_name: trustName, updated_at: new Date().toISOString() })
      .eq("id", currentRotaConfigId);
    setSaving(false);
    if (error) {
      setSaveError(true);
      console.error(error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  // SECTION 9 COMPLETE

  const completedCount = [isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone].filter(Boolean).length;
  const canGeneratePreRota = isDepartmentComplete && isWtrComplete && isPeriodComplete;

  const getStatusLabel = (done: boolean) => {
    if (done && restoredFromDb) return "✅ Saved";
    if (done) return "Done";
    return null;
  };

  const steps = [
    { label: "Set up department", done: isDepartmentComplete, link: "/admin/department/step-1" },
    { label: "Contract rules (WTR)", done: isWtrComplete, link: "/admin/wtr/step-1" },
    { label: "Set up rota period", done: isPeriodComplete, link: "/admin/rota-period/step-1" },
  ];

  return (
    <AdminLayout title="Generation Command Center" subtitle="Track setup progress and generate the rota">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* SECTION 9 — Department & Hospital */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Department & Hospital</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Department name</label>
              <Input placeholder="e.g. Anaesthetics" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital / Trust name</label>
              <Input placeholder="e.g. Manchester University NHS Foundation Trust" value={trustName} onChange={(e) => setTrustName(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">These appear in all survey invite emails sent to doctors.</p>
            <div className="flex items-center gap-2">
              {saved && <span className="text-xs font-semibold text-emerald-600">✓ Saved</span>}
              {saveError && <span className="text-xs font-semibold text-destructive">Save failed — try again</span>}
              <Button size="sm" onClick={saveDeptInfo} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>

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
              return (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(s.link)}
                >
                  <div className="flex items-center gap-3">
                    {s.done ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                    <span className={s.done ? "font-medium text-card-foreground" : "font-medium text-muted-foreground"}>
                      {s.label}
                    </span>
                  </div>
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
                </div>
              );
            })}

            {/* Doctor preferences -- static for now */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-3">
                {areSurveysDone ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Users className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-medium text-card-foreground">Doctor preferences</span>
              </div>
              {areSurveysDone ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Done
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">10/16 responses</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phase 1: Pre-Rota Data */}
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
            disabled={!canGeneratePreRota}
            onClick={() => {/* future: trigger generation */}}
          >
            {!canGeneratePreRota && <Lock className="mr-2 h-4 w-4" />}
            Generate Pre-Rota Data
          </Button>

          {!canGeneratePreRota && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Complete all setup steps above to unlock generation.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Master Calendar</p>
              <p className="text-[10px] text-muted-foreground/60">Not generated</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <Target className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Targets</p>
              <p className="text-[10px] text-muted-foreground/60">Not generated</p>
            </div>
          </div>
        </div>

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

// SECTION 7 COMPLETE
