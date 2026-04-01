import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, CheckCircle, Loader2, Clock, Users, Calendar, Info, Tag } from "lucide-react";
import { useAdminSetup, type BankHolidayEntry, type BhShiftRule } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { getRotaConfig } from "@/lib/rotaConfig";
import { useInvalidateQuery } from "@/hooks/useAdminQueries";

export default function RotaPeriodSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPostSubmit = searchParams.get("mode") !== "pre-submit";

  const {
    rotaStartDate, rotaEndDate,
    rotaBankHolidays, bhSameAsWeekend, bhShiftRules,
    setPeriodComplete, setRotaStartDate, setRotaEndDate,
    setRotaBankHolidays, setBhSameAsWeekend, setBhShiftRules,
    setPeriodWorkingStateLoaded,
  } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId, setRestoredConfig } = useRotaContext();
  const { user } = useAuth();
  const { invalidateRotaConfigDetails } = useInvalidateQuery();

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (!isPostSubmit || !currentRotaConfigId) return;
    supabase.from('rota_configs').select('updated_at').eq('id', currentRotaConfigId).maybeSingle()
      .then(({ data }) => {
        if (data?.updated_at) setSavedAt(format(new Date(data.updated_at), "dd MMM yyyy 'at' HH:mm"));
      });
  }, [isPostSubmit, currentRotaConfigId]);

  const handleConfirmSave = async () => {
    if (!rotaStartDate || !rotaEndDate) { toast.error("Missing dates — go back and select dates"); return; }
    setSaving(true);
    try {
      const startDateStr = format(rotaStartDate, "yyyy-MM-dd");
      const endDateStr = format(rotaEndDate, "yyyy-MM-dd");
      const durationDays = differenceInDays(rotaEndDate, rotaStartDate);
      const durationWeeks = Number((durationDays / 7).toFixed(1));

      let configId = currentRotaConfigId;
      const configFields = {
        rota_start_date: startDateStr,
        rota_end_date: endDateStr,
        rota_duration_days: durationDays,
        rota_duration_weeks: durationWeeks,
        bh_same_as_weekend: bhSameAsWeekend,
        bh_shift_rules: bhSameAsWeekend === false
          ? bhShiftRules.map(r => ({ shift_key: r.shift_key, name: r.name, start_time: r.start_time, end_time: r.end_time, target_doctors: r.target_doctors, included: r.included }))
          : null,
      };

      if (!configId) {
        const { data, error } = await supabase.from("rota_configs")
          .insert({ ...configFields, owned_by: user?.id ?? "" } as any)
          .select("id").single();
        if (error) throw error;
        configId = data.id;
        setCurrentRotaConfigId(configId);
      } else {
        const { error } = await supabase.from("rota_configs")
          .update({ ...configFields, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      }

      await supabase.from("bank_holidays").delete().eq("rota_config_id", configId);
      if (rotaBankHolidays.length > 0) {
        const rows = rotaBankHolidays.map((h: BankHolidayEntry) => ({
          rota_config_id: configId!,
          date: format(h.date, "yyyy-MM-dd"),
          name: h.name,
          is_auto_added: h.isAutoAdded,
          is_active: h.isActive,
        }));
        const { error } = await supabase.from("bank_holidays").insert(rows);
        if (error) throw error;
      }

      const refreshedConfig = await getRotaConfig(configId!);
      setRestoredConfig(refreshedConfig);
      invalidateRotaConfigDetails();
      setPeriodComplete(true);
      toast.success("✓ Rota period saved");
      navigate("/admin/setup");
    } catch {
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentRotaConfigId) return;
    setSaving(true);
    try {
      await supabase.from('rota_configs').update({
        rota_start_date: null, rota_end_date: null,
        rota_duration_days: null, rota_duration_weeks: null,
        bh_same_as_weekend: null, bh_shift_rules: null,
      }).eq('id', currentRotaConfigId);
      await supabase.from('bank_holidays').delete().eq('rota_config_id', currentRotaConfigId);
      setPeriodComplete(false);
      setRotaStartDate(undefined);
      setRotaEndDate(undefined);
      setRotaBankHolidays([]);
      setBhSameAsWeekend(null);
      setBhShiftRules([]);
      setPeriodWorkingStateLoaded(false);
      toast.success('Rota period reset');
      navigate('/admin/rota-period/step-1');
    } catch { toast.error('Reset failed'); } finally { setSaving(false); }
  };

  const durationText = rotaStartDate && rotaEndDate
    ? `${differenceInDays(rotaEndDate, rotaStartDate)} days · ${(differenceInDays(rotaEndDate, rotaStartDate) / 7).toFixed(1)} weeks`
    : "—";

  const activeBankHolidays = rotaBankHolidays.filter(h => h.isActive);
  const inactiveBankHolidays = rotaBankHolidays.filter(h => !h.isActive);
  const customBankHolidays = rotaBankHolidays.filter(h => !h.isAutoAdded && h.isActive);

  const navBarContent = isPostSubmit ? (
    <StepNavBar
      left={<Button variant="outline" size="lg" onClick={() => { setShowResetConfirm(true); setShowEditConfirm(false); }}>Reset</Button>}
      right={<Button variant="outline" size="lg" onClick={() => { setShowEditConfirm(true); setShowResetConfirm(false); }}>Edit</Button>}
    />
  ) : (
    <StepNavBar
      left={<Button variant="outline" size="lg" onClick={() => navigate("/admin/rota-period/step-2")}>Back</Button>}
      right={
        <Button size="lg" disabled={saving} onClick={handleConfirmSave} className="bg-amber-600 hover:bg-amber-700">
          {saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Confirm & Save"}
        </Button>
      }
    />
  );

  return (
    <AdminLayout title="Rota Period" subtitle={isPostSubmit ? "Summary" : "Review & save"} accentColor="yellow" pageIcon={CalendarDays} navBar={navBarContent}>
      <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">

        {isPostSubmit ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Rota period saved{savedAt ? ` · ${savedAt}` : ''}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
            Review your rota period configuration before saving.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Rota Dates</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm py-1.5 border-b border-border"><span className="text-muted-foreground">Start</span><span className="font-medium">{rotaStartDate ? format(rotaStartDate, "dd MMM yyyy") : "—"}</span></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-border"><span className="text-muted-foreground">End</span><span className="font-medium">{rotaEndDate ? format(rotaEndDate, "dd MMM yyyy") : "—"}</span></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-muted-foreground">Duration</span><span className="font-medium">{durationText}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bank Holidays</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm py-1.5 border-b border-border">
              <span className="text-muted-foreground">Treatment</span>
              <span className="font-medium">{bhSameAsWeekend === true ? 'Same as weekends' : bhSameAsWeekend === false ? 'Custom shift rules' : 'Not set'}</span>
            </div>
            {bhSameAsWeekend === false && bhShiftRules.filter(r => r.included).map(r => (
              <div key={r.shift_key} className="flex justify-between text-sm py-1.5 border-b border-border">
                <span className="text-muted-foreground">{r.name}</span>
                <span className="font-medium">{r.target_doctors} doctors</span>
              </div>
            ))}
            {activeBankHolidays.length > 0 ? activeBankHolidays.map(h => (
              <div key={h.id} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground">{h.name}</span>
                <span className="font-medium">{format(h.date, "dd MMM yyyy")}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">No bank holidays in this rota period.</p>
            )}
          </CardContent>
        </Card>

        {isPostSubmit && showEditConfirm && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-800 mb-3">Editing rota period may affect a rota already in progress. Continue?</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => navigate('/admin/rota-period/step-1')}>Continue to Edit</Button>
            </div>
          </div>
        )}
        {isPostSubmit && showResetConfirm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive mb-3">This will clear all rota period dates and bank holiday rules.</p>
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
