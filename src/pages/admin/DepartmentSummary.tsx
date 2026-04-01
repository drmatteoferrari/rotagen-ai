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

  const dataCards = (
    <>
      <Card>
        <CardHeader><CardTitle>Department Details</CardTitle></CardHeader>
        <CardContent>
          <div className="flex justify-between text-sm py-1.5 border-b border-border"><span className="text-muted-foreground">Department</span><span className="font-medium">{accountSettings.departmentName ?? "—"}</span></div>
          <div className="flex justify-between text-sm py-1.5"><span className="text-muted-foreground">Hospital / Trust</span><span className="font-medium">{accountSettings.trustName ?? "—"}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Shift Types</CardTitle></CardHeader>
        <CardContent>
          {displayShifts.map(s => (
            <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded">{s.abbreviation}</span>
              <span className="flex-1 text-sm font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.startTime}–{s.endTime} ({s.durationHours}h)</span>
              <span className="text-xs text-muted-foreground">{s.isOncall ? 'On-call' : 'Non-on-call'}</span>
            </div>
          ))}
          {displayShifts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No shift types defined.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Hour Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="flex justify-between text-sm py-1.5 border-b border-border"><span className="text-muted-foreground">On-call fraction</span><span className="font-medium">{globalOncallPct}%</span></div>
          <div className="flex justify-between text-sm py-1.5"><span className="text-muted-foreground">Non-on-call fraction</span><span className="font-medium">{100 - globalOncallPct}%</span></div>
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
