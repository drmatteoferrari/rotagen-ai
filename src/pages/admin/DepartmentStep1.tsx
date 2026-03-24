import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, ArrowLeft, ArrowRight, Loader2, Info, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAccountSettingsQuery, useInvalidateQuery } from "@/hooks/useAdminQueries";

export default function DepartmentStep1New() {
  const navigate = useNavigate();
  const { user, setAccountSettings } = useAuth();
  const { currentRotaConfigId } = useRotaContext();
  const { invalidateAccountSettings } = useInvalidateQuery();
  const { data: accountData, isLoading: loading } = useAccountSettingsQuery();
  const [deptName, setDeptName] = useState("");
  const [trustName, setTrustName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deptError, setDeptError] = useState("");
  const [trustError, setTrustError] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Sync from cached query
  useEffect(() => {
    if (accountData && !initialized) {
      setDeptName(accountData.department_name ?? "");
      setTrustName(accountData.trust_name ?? "");
      setInitialized(true);
    }
  }, [accountData, initialized]);

  const handleSaveAndContinue = async () => {
    setDeptError("");
    setTrustError("");
    if (!deptName.trim()) { setDeptError("Please enter a department name"); return; }
    if (!trustName.trim()) { setTrustError("Please enter a hospital or trust name"); return; }
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("account_settings")
        .upsert(
          { owned_by: user.id, department_name: deptName.trim(), trust_name: trustName.trim(), updated_at: new Date().toISOString() },
          { onConflict: "owned_by" }
        );
      if (error) throw error;

      // SECTION 4 COMPLETE — Sync to rota_configs
      if (currentRotaConfigId) {
        try {
          await supabase
            .from("rota_configs")
            .update({ department_name: deptName.trim(), trust_name: trustName.trim() })
            .eq("id", currentRotaConfigId);
        } catch (syncErr) {
          console.error("Failed to sync department/trust to rota_configs (non-blocking):", syncErr);
        }
      }

      setAccountSettings({ departmentName: deptName.trim(), trustName: trustName.trim() });
      invalidateAccountSettings();
      toast.success("✓ Department details saved");
      navigate("/admin/department/step-2");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const bothFilled = deptName.trim().length > 0 && trustName.trim().length > 0;

  return (
    <AdminLayout title="Department Setup" subtitle="Step 1 of 3 — Department" accentColor="purple" pageIcon={Building2}
      navBar={
        <StepNavBar
          left={
            <Button variant="outline" size="lg" onClick={() => navigate("/admin/setup")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          }
          right={
            <Button size="lg" onClick={handleSaveAndContinue} disabled={saving || loading} className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? "Saving…" : "Continue"}
              {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          }
        />
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700">
          <Info className="h-4 w-4 shrink-0 text-purple-600" />
          Enter your department and hospital.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Department Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Department Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-card-foreground">
                    Department Name <span className="text-[11px] font-semibold text-purple-600 ml-1">Required</span>
                  </label>
                  <Input
                    placeholder="e.g. Anaesthetics"
                    value={deptName}
                    onChange={(e) => { setDeptName(e.target.value.slice(0, 100)); setDeptError(""); }}
                    maxLength={100}
                    className="min-h-[44px]"
                  />
                  {deptError && <p className="text-xs text-destructive">{deptError}</p>}
                </div>

                {/* Hospital / Trust Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-card-foreground">
                    Hospital or Trust <span className="text-[11px] font-semibold text-purple-600 ml-1">Required</span>
                  </label>
                  <Input
                    placeholder="e.g. Manchester University NHS Foundation Trust"
                    value={trustName}
                    onChange={(e) => { setTrustName(e.target.value.slice(0, 100)); setTrustError(""); }}
                    maxLength={100}
                    className="min-h-[44px]"
                  />
                  {trustError && <p className="text-xs text-destructive">{trustError}</p>}
                </div>

                {/* Confirmation row */}
              </>
            )}
          </CardContent>
        </Card>

        <StepNavBar
          left={
            <Button variant="outline" size="lg" onClick={() => navigate("/admin/setup")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          }
          right={
            <Button size="lg" onClick={handleSaveAndContinue} disabled={saving || loading} className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? "Saving…" : "Continue"}
              {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          }
        />
      </div>
    </AdminLayout>
  );
}
