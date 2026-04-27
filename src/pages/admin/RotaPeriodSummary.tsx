import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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
    surveyDeadline, setSurveyDeadline,
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
    if (!surveyDeadline) { toast.error("Survey deadline is required — set it on Step 2"); return; }
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
        // L4: persist required survey deadline alongside other rota period fields
        survey_deadline: format(surveyDeadline, "yyyy-MM-dd"),
      };

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
        const { data, error } = await supabase.from("rota_configs")
          .insert({
            ...configFields,
            owned_by: user.id,
            department_name: acct.department_name,
            trust_name: acct.trust_name,
          } as any)
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
        survey_deadline: null,
      }).eq('id', currentRotaConfigId);
      await supabase.from('bank_holidays').delete().eq('rota_config_id', currentRotaConfigId);
      setPeriodComplete(false);
      setRotaStartDate(undefined);
      setRotaEndDate(undefined);
      setRotaBankHolidays([]);
      setBhSameAsWeekend(null);
      setBhShiftRules([]);
      setSurveyDeadline(undefined);
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
    <>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-amber-600" />
                Rota Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Start date</span>
                <span className="font-medium">{rotaStartDate ? format(rotaStartDate, "EEEE dd MMM yyyy") : "\u2014"}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">End date</span>
                <span className="font-medium">{rotaEndDate ? format(rotaEndDate, "EEEE dd MMM yyyy") : "\u2014"}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{durationText}</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-muted-foreground">Survey deadline</span>
                <span className="font-medium">
                  {surveyDeadline ? format(surveyDeadline, "EEEE dd MMM yyyy") : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-amber-600" />
                Bank Holiday Treatment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Treatment rule</span>
                <span className="font-medium">
                  {bhSameAsWeekend === true
                    ? "Same as weekends"
                    : bhSameAsWeekend === false
                    ? "Custom shift rules"
                    : "Not set"}
                </span>
              </div>
              {bhSameAsWeekend === false && (() => {
                const includedRules = bhShiftRules.filter(r => r.included);
                if (includedRules.length === 0) return null;
                return (
                  <>
                    <div className="pt-3 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Shifts on bank holidays
                      </p>
                    </div>
                    {includedRules.map((r, idx) => (
                      <div
                        key={r.shift_key}
                        className={`py-2 ${idx < includedRules.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{r.name}</span>
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Users className="h-3 w-3" />
                            {r.target_doctors} {r.target_doctors === 1 ? "doctor" : "doctors"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          {r.start_time} {"\u2013"} {r.end_time}
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                Bank Holiday Dates
              </CardTitle>
              {rotaBankHolidays.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeBankHolidays.length} active
                  {inactiveBankHolidays.length > 0 ? `, ${inactiveBankHolidays.length} excluded` : ""}
                  {customBankHolidays.length > 0 ? `, ${customBankHolidays.length} custom` : ""}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-0">
              {activeBankHolidays.length === 0 && inactiveBankHolidays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No bank holidays in this rota period.
                </p>
              ) : (
                <>
                  {activeBankHolidays.length > 0 && (
                    <>
                      <div className="pt-1 pb-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active</p>
                      </div>
                      {activeBankHolidays.map((h, idx) => (
                        <div
                          key={h.id}
                          className={`flex justify-between items-center text-sm py-2 ${idx < activeBankHolidays.length - 1 ? "border-b border-border" : ""}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{h.name}</span>
                            {!h.isAutoAdded && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium px-1.5 py-0.5">
                                <Tag className="h-2.5 w-2.5" />
                                Custom
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-right shrink-0">
                            {format(h.date, "EEE dd MMM yyyy")}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {inactiveBankHolidays.length > 0 && (
                    <>
                      <div className={`pb-1 ${activeBankHolidays.length > 0 ? "pt-4 border-t border-border mt-2" : "pt-1"}`}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Excluded</p>
                      </div>
                      {inactiveBankHolidays.map((h, idx) => (
                        <div
                          key={h.id}
                          className={`flex justify-between items-center text-sm py-2 opacity-50 ${idx < inactiveBankHolidays.length - 1 ? "border-b border-border" : ""}`}
                        >
                          <span className="line-through">{h.name}</span>
                          <span className="font-medium text-right shrink-0">
                            {format(h.date, "EEE dd MMM yyyy")}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </AdminLayout>

      <Dialog open={showEditConfirm} onOpenChange={(open) => { if (!open) setShowEditConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit rota period?</DialogTitle>
            <DialogDescription>Editing rota period dates may affect a rota already in progress.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
            <Button onClick={() => navigate('/admin/rota-period/step-1')}>Continue to Edit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirm} onOpenChange={(open) => { if (!open) setShowResetConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset rota period?</DialogTitle>
            <DialogDescription>This will clear all rota period dates and bank holiday rules. This cannot be undone.</DialogDescription>
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
