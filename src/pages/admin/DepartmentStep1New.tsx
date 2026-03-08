import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// ✅ Section 4a complete (imports)

export default function DepartmentStep1New() {
  const navigate = useNavigate();
  const { user, setAccountSettings } = useAuth();
  const [deptName, setDeptName] = useState("");
  const [trustName, setTrustName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deptError, setDeptError] = useState("");
  const [trustError, setTrustError] = useState("");

  // Restore on mount
  useEffect(() => {
    const load = async () => {
      if (!user?.username) { setLoading(false); return; }
      const { data } = await supabase
        .from("account_settings")
        .select("department_name, trust_name")
        .eq("owned_by", user.username)
        .maybeSingle();
      if (data) {
        setDeptName(data.department_name ?? "");
        setTrustName(data.trust_name ?? "");
      }
      setLoading(false);
    };
    load();
  }, [user?.username]);

  const handleSaveAndContinue = async () => {
    setDeptError("");
    setTrustError("");
    if (!deptName.trim()) { setDeptError("Please enter a department name"); return; }
    if (!trustName.trim()) { setTrustError("Please enter a hospital or trust name"); return; }
    if (!user?.username) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("account_settings")
        .upsert(
          { owned_by: user.username, department_name: deptName.trim(), trust_name: trustName.trim(), updated_at: new Date().toISOString() },
          { onConflict: "owned_by" }
        );
      if (error) throw error;
      setAccountSettings({ departmentName: deptName.trim(), trustName: trustName.trim() });
      toast.success("✓ Department details saved");
      navigate("/admin/department/step-2");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Department Setup" subtitle="Step 1 of 3 — Department Details">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Department Details
            </CardTitle>
            <CardDescription>Enter your department and hospital name. These appear in all survey emails sent to doctors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Department Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Anaesthetics"
                    value={deptName}
                    onChange={(e) => { setDeptName(e.target.value.slice(0, 100)); setDeptError(""); }}
                    maxLength={100}
                  />
                  {deptError && <p className="text-xs text-destructive">{deptError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Hospital / Trust Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Manchester University NHS Foundation Trust"
                    value={trustName}
                    onChange={(e) => { setTrustName(e.target.value.slice(0, 100)); setTrustError(""); }}
                    maxLength={100}
                  />
                  {trustError && <p className="text-xs text-destructive">{trustError}</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSaveAndContinue} disabled={saving || loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save & Continue"}
            {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
// ✅ Section 4a complete
