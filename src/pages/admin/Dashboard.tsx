import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth, loadAccountSettings } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Circle, Zap, Calendar, Target, Users, ShieldCheck, Lock, Building2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// SECTION 7 — Status indicators on Dashboard
// SECTION 2, 3, 6 — Department & Hospital fields with account_settings persistence

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, areSurveysDone, restoredFromDb } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();
  const { user, accountSettings, setAccountSettings } = useAuth();

  // SECTION 3 — Loading state
  const [loadingSettings, setLoadingSettings] = useState(true);

  // SECTION 2 — Department/Hospital state
  const [departmentName, setDepartmentName] = useState("");
  const [trustName, setTrustName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);

  // SECTION 6 — Inline validation errors
  const [departmentError, setDepartmentError] = useState("");
  const [trustError, setTrustError] = useState("");

  // SECTION 3 — Load on mount
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
  // SECTION 3 COMPLETE

  // SECTION 2 — Save handler
  const handleSaveAccountSettings = async () => {
    setDepartmentError("");
    setTrustError("");
    setSaveStatus(null);

    if (!departmentName.trim()) {
      setDepartmentError("Please enter a department name");
      return;
    }
    if (!trustName.trim()) {
      setTrustError("Please enter a hospital or trust name");
      return;
    }
    if (!user?.username) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("account_settings")
        .upsert(
          {
            owned_by: user.username,
            department_name: departmentName.trim(),
            trust_name: trustName.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owned_by" }
        );

      if (error) throw error;

      // Update context immediately
      setAccountSettings({
        departmentName: departmentName.trim(),
        trustName: trustName.trim(),
      });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Failed to save account settings:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };
  // SECTION 2 COMPLETE

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
        {/* SECTION 6 — Department & Hospital with loading/validation/save states */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Department & Hospital</h2>
          </div>

          {loadingSettings ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Department name</label>
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital / Trust name</label>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Department name</label>
                <Input
                  placeholder="e.g. Anaesthetics"
                  value={departmentName}
                  onChange={(e) => { setDepartmentName(e.target.value); setDepartmentError(""); setSaveStatus(null); }}
                />
                {departmentError && <p className="text-xs text-destructive mt-1">{departmentError}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital / Trust name</label>
                <Input
                  placeholder="e.g. Manchester University NHS Foundation Trust"
                  value={trustName}
                  onChange={(e) => { setTrustName(e.target.value); setTrustError(""); setSaveStatus(null); }}
                />
                {trustError && <p className="text-xs text-destructive mt-1">{trustError}</p>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">These appear in all survey invite emails sent to doctors.</p>
            <Button
              size="sm"
              onClick={handleSaveAccountSettings}
              disabled={saving || saveStatus === "saved" || loadingSettings}
              className={saveStatus === "saved" ? "bg-emerald-600 hover:bg-emerald-600" : ""}
            >
              {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {saving ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "Save"}
            </Button>
          </div>

          {/* Inline status messages */}
          {saveStatus === "saved" && (
            <p className="text-xs text-emerald-600 mt-2">
              ✓ Saved — your department and hospital name will appear in all survey emails.
            </p>
          )}
          {saveStatus === "error" && (
            <p className="text-xs text-destructive mt-2">
              Save failed — please try again.
            </p>
          )}
        </div>
        {/* SECTION 6 COMPLETE */}

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
