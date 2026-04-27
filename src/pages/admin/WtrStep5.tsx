import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle, AlertTriangle, ClipboardCheck, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function WtrStep5() {
  const navigate = useNavigate();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [searchParams] = useSearchParams();
  const isPostSubmit = searchParams.get("mode") === "post-submit";
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const {
    setWtrComplete,
    resetWtr,
    maxAvgWeekly, maxIn7Days, maxShiftLengthH,
    maxConsecDays, maxConsecLong, maxLongEveningConsec, maxConsecNights,
    restPostNights, restPostBlock, restAfterLongEveningH, restAfter7, minInterShiftRestH,
    weekendFreq,
    oncallMaxPer7Days, oncallLocalAgreementMaxConsec,
    oncallDayAfterMaxHours, oncallDayAfterLastConsecMaxH,
    oncallRestPer24h, oncallContinuousRestHours,
    oncallContinuousRestStart, oncallContinuousRestEnd,
    oncallIfRestNotMetMaxHours, oncallNoConsecExceptWknd, oncallNoSimultaneousShift,
  } = useAdminSetup();

  useEffect(() => {
    if (!isPostSubmit || !currentRotaConfigId) return;
    supabase.from('wtr_settings').select('updated_at').eq('rota_config_id', currentRotaConfigId).maybeSingle()
      .then(({ data }) => {
        if (data?.updated_at) setSavedAt(format(new Date(data.updated_at), "dd MMM yyyy 'at' HH:mm"));
      });
  }, [isPostSubmit, currentRotaConfigId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let configId = currentRotaConfigId;
      if (!configId) {
        // M1: pull names from account_settings on first creation. Both DB
        // failure and a missing/blank account_settings row must block the
        // insert — falling back to "" silently re-creates the original bug.
        if (!user?.id) throw new Error("Not signed in.");
        const { data: acct, error: acctErr } = await supabase
          .from("account_settings")
          .select("department_name, trust_name")
          .eq("owned_by", user.id)
          .maybeSingle();
        if (acctErr) throw acctErr;
        if (!acct?.department_name?.trim() || !acct?.trust_name?.trim()) {
          throw new Error("Complete Department Step 1 before continuing.");
        }
        const { data, error } = await supabase
          .from("rota_configs")
          .insert({
            owned_by: user.id,
            department_name: acct.department_name,
            trust_name: acct.trust_name,
          } as any)
          .select("id").single();
        if (error) throw error;
        configId = data.id;
        setCurrentRotaConfigId(configId);
      } else {
        await supabase.from("rota_configs")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", configId);
      }

      const wtrFields = {
        rota_config_id: configId,
        max_hours_per_week: maxAvgWeekly,
        max_hours_per_168h: maxIn7Days,
        max_shift_length_h: maxShiftLengthH,
        max_consec_standard: maxConsecDays,
        max_consec_long: maxConsecLong,
        max_long_evening_consec: maxLongEveningConsec,
        max_consec_nights: maxConsecNights,
        rest_after_nights_h: restPostNights,
        rest_after_long_h: restPostBlock,
        rest_after_long_evening_h: restAfterLongEveningH,
        rest_after_standard_h: restAfter7,
        min_inter_shift_rest_h: minInterShiftRestH,
        weekend_frequency: weekendFreq,
        oncall_no_consec_except_wknd: oncallNoConsecExceptWknd,
        oncall_max_per_7_days: oncallMaxPer7Days,
        oncall_local_agreement_max_consec: oncallLocalAgreementMaxConsec,
        oncall_day_after_max_hours: oncallDayAfterMaxHours,
        oncall_rest_per_24h: oncallRestPer24h,
        oncall_continuous_rest_hours: oncallContinuousRestHours,
        oncall_continuous_rest_start: oncallContinuousRestStart,
        oncall_continuous_rest_end: oncallContinuousRestEnd,
        oncall_if_rest_not_met_max_hours: oncallIfRestNotMetMaxHours,
        oncall_no_simultaneous_shift: oncallNoSimultaneousShift,
        oncall_day_after_last_consec_max_h: oncallDayAfterLastConsecMaxH,
        oncall_break_fine_threshold_pct: 25,
        oncall_break_reference_weeks: 4,
        oncall_clinical_exception_allowed: true,
        oncall_saturday_sunday_paired: true,
      };

      const { data: existing } = await supabase
        .from("wtr_settings").select("id")
        .eq("rota_config_id", configId).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("wtr_settings")
          .update({ ...wtrFields, updated_at: new Date().toISOString() } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wtr_settings").insert(wtrFields as any);
        if (error) throw error;
      }

      const { count: shiftCount } = await supabase
        .from("shift_types").select("id", { count: "exact", head: true })
        .eq("rota_config_id", configId);
      const { data: configRow } = await supabase
        .from("rota_configs").select("rota_start_date")
        .eq("id", configId).single();
      const isComplete = (shiftCount ?? 0) > 0 && configRow?.rota_start_date != null;
      if (isComplete) {
        await supabase.from("rota_configs")
          .update({ status: "complete", updated_at: new Date().toISOString() })
          .eq("id", configId);
        toast.success("✓ Setup complete — all configuration saved. Ready to generate rota.");
      } else {
        toast.success("✓ WTR settings saved");
      }
      setWtrComplete(true);
      navigate("/admin/setup");
    } catch (err: any) {
      console.error("WTR save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const summaryItems: { label: string; value: string; compliant: boolean }[] = [
    { label: "Max avg weekly hrs", value: `${maxAvgWeekly}h`, compliant: maxAvgWeekly <= 48 },
    { label: "Max in 7 days", value: `${maxIn7Days}h`, compliant: maxIn7Days <= 72 },
    { label: "Max shift length", value: `${maxShiftLengthH}h`, compliant: maxShiftLengthH <= 13 },
    { label: "Max consec standard days", value: `${maxConsecDays}`, compliant: maxConsecDays <= 7 },
    { label: "Max consec long shifts", value: `${maxConsecLong}`, compliant: maxConsecLong <= 4 },
    { label: "Max consec long evening", value: `${maxLongEveningConsec}`, compliant: maxLongEveningConsec <= 4 },
    { label: "Max consec nights", value: `${maxConsecNights}`, compliant: maxConsecNights <= 4 },
    { label: "Rest after any night(s)", value: `${restPostNights}h`, compliant: restPostNights >= 46 },
    { label: "Rest after long block", value: `${restPostBlock}h`, compliant: restPostBlock >= 48 },
    { label: "Rest after long evening", value: `${restAfterLongEveningH}h`, compliant: restAfterLongEveningH >= 48 },
    { label: "Rest after standard block", value: `${restAfter7}h`, compliant: restAfter7 >= 48 },
    { label: "Min inter-shift rest", value: `${minInterShiftRestH}h`, compliant: minInterShiftRestH >= 11 },
    { label: "Weekend frequency", value: `1 in ${weekendFreq}`, compliant: weekendFreq >= 3 },
    { label: "On-call max per 7 days", value: `${oncallMaxPer7Days}`, compliant: oncallMaxPer7Days <= 3 },
    { label: "On-call day-after max hrs", value: `${oncallDayAfterMaxHours}h`, compliant: oncallDayAfterMaxHours <= 10 },
    { label: "On-call rest per 24h", value: `${oncallRestPer24h}h`, compliant: oncallRestPer24h >= 8 },
    { label: "Continuous rest duration", value: `${oncallContinuousRestHours}h`, compliant: oncallContinuousRestHours >= 5 },
    { label: "Rest window start", value: oncallContinuousRestStart ?? "—", compliant: (oncallContinuousRestStart ?? "").slice(0, 5) === "22:00" },
    { label: "Rest window end", value: oncallContinuousRestEnd ?? "—", compliant: (oncallContinuousRestEnd ?? "").slice(0, 5) === "07:00" },
    { label: "If rest not met: max hrs", value: `${oncallIfRestNotMetMaxHours}h`, compliant: oncallIfRestNotMetMaxHours <= 5 },
  ];

  const navBarContent = isPostSubmit ? (
    <StepNavBar
      left={<Button variant="outline" size="lg" onClick={() => { setShowResetConfirm(true); setShowEditConfirm(false); }}>Reset</Button>}
      right={<Button variant="outline" size="lg" onClick={() => { setShowEditConfirm(true); setShowResetConfirm(false); }}>Edit</Button>}
    />
  ) : (
    <StepNavBar
      left={
        <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-4")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      }
      right={
        <Button size="lg" disabled={saving} onClick={handleSave} className="bg-red-600 hover:bg-red-700">
          <CheckCircle className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save WTR Settings"}
        </Button>
      }
    />
  );

  return (
    <>
      <AdminLayout title="Working Time Regulations" subtitle="Step 5 of 5 — Review & save" accentColor="red" pageIcon={ClipboardCheck} navBar={navBarContent}>
        <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
          {isPostSubmit && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              WTR settings saved{savedAt ? ` · ${savedAt}` : ''}
            </div>
          )}

          {!isPostSubmit && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              <ClipboardCheck className="h-4 w-4 shrink-0 text-red-600" />
              Review your configuration before saving.
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-red-600" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {summaryItems.map((item) => (
                  <div key={item.label} className="flex justify-between items-center rounded-md border border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-card-foreground">{item.value}</span>
                      {item.compliant
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      }
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </AdminLayout>

      <Dialog open={showEditConfirm} onOpenChange={(open) => { if (!open) setShowEditConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit WTR settings?</DialogTitle>
            <DialogDescription>Editing WTR settings may affect a rota already in progress.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
            <Button onClick={() => navigate('/admin/wtr/step-1')}>Continue to Edit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirm} onOpenChange={(open) => { if (!open) setShowResetConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset WTR settings?</DialogTitle>
            <DialogDescription>This will reset all WTR settings to defaults. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                if (currentRotaConfigId) await supabase.from('wtr_settings').delete().eq('rota_config_id', currentRotaConfigId);
                resetWtr();
                toast.success('WTR settings reset');
                setShowResetConfirm(false);
                navigate('/admin/wtr/step-1');
              } catch { toast.error('Reset failed'); } finally { setSaving(false); }
            }}>
              {saving ? "Resetting…" : "Reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
