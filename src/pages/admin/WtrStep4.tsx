import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, AlertTriangle, ClipboardCheck, Info, Minus, Plus } from "lucide-react";

function MaxWarning({ value, max, label }: { value: number; max: number; label: string }) {
  if (value <= max) return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      {value === max ? `Matches the WTR maximum of ${max} — compliant.` : `More restrictive than the WTR maximum of ${max} — compliant.`}
    </div>
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ⚠️ WTR WARNING: {label} exceeds the legal maximum of {max} — a Guardian of Safe Working Hours fine may apply.
    </div>
  );
}

function MinWarning({ value, min, label }: { value: number; min: number; label: string }) {
  if (value >= min) return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      {value === min ? `Matches the WTR minimum of ${min} hrs — compliant.` : `More protective than the WTR minimum of ${min} hrs — compliant.`}
    </div>
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ⚠️ WTR WARNING: {label} is below the legal minimum of {min} hrs — this may breach Working Time Regulations.
    </div>
  );
}

function TimeWarning({ value, standard, label }: { value: string; standard: string; label: string }) {
  if (value !== standard) return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ⚠️ Deviates from WTR standard {label} of {standard}
    </div>
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      Matches WTR standard {label} of {standard} — compliant.
    </div>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-muted p-1.5 rounded-lg border border-border">
      <button className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all" onClick={onDec}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-lg font-bold text-card-foreground">{value}</span>
      <button className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all" onClick={onInc}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function WtrStep4() {
  const navigate = useNavigate();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const {
    setWtrComplete,
    maxAvgWeekly, maxIn7Days, maxShiftLengthH,
    maxConsecDays, maxConsecLong, maxLongEveningConsec, maxConsecNights,
    restPostNights, restPostBlock, restAfterLongEveningH, restAfter7, minInterShiftRestH,
    weekendFreq,
    oncallMaxPer7Days, setOncallMaxPer7Days,
    oncallLocalAgreementMaxConsec, setOncallLocalAgreementMaxConsec,
    oncallDayAfterMaxHours, setOncallDayAfterMaxHours,
    oncallDayAfterLastConsecMaxH, setOncallDayAfterLastConsecMaxH,
    oncallRestPer24h, setOncallRestPer24h,
    oncallContinuousRestHours, setOncallContinuousRestHours,
    oncallContinuousRestStart, setOncallContinuousRestStart,
    oncallContinuousRestEnd, setOncallContinuousRestEnd,
    oncallIfRestNotMetMaxHours, setOncallIfRestNotMetMaxHours,
    oncallNoConsecExceptWknd, setOncallNoConsecExceptWknd,
    oncallNoSimultaneousShift, setOncallNoSimultaneousShift,
  } = useAdminSetup();

  const handleSave = async () => {
    setSaving(true);
    try {
      let configId = currentRotaConfigId;
      if (!configId) {
        const { data, error } = await supabase
          .from("rota_configs")
          .insert({ owned_by: user?.id ?? "developer1" } as any)
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
      navigate("/admin/dashboard");
    } catch (err: any) {
      console.error("WTR save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const summaryItems = [
    { label: "Max avg weekly hrs", value: `${maxAvgWeekly}h` },
    { label: "Max in 7 days", value: `${maxIn7Days}h` },
    { label: "Max shift length", value: `${maxShiftLengthH}h` },
    { label: "Max consec standard days", value: `${maxConsecDays}` },
    { label: "Max consec long shifts", value: `${maxConsecLong}` },
    { label: "Max consec long evening", value: `${maxLongEveningConsec}` },
    { label: "Max consec nights", value: `${maxConsecNights}` },
    { label: "Rest after any night(s)", value: `${restPostNights}h` },
    { label: "Rest after long block", value: `${restPostBlock}h` },
    { label: "Rest after long evening", value: `${restAfterLongEveningH}h` },
    { label: "Rest after standard block", value: `${restAfter7}h` },
    { label: "Min inter-shift rest", value: `${minInterShiftRestH}h` },
    { label: "Weekend frequency", value: `1 in ${weekendFreq}` },
  ];

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 4 of 4 — Non-Resident On-Call" accentColor="red">
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        {/* Amber scope banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          ⚠️ The rules on this page apply exclusively to non-resident on-call shifts — doctors on-call from home (is_non_res_oncall = true). They do NOT apply to resident on-call (on-site) shifts. The rota algorithm enforces these rules only on non-resident on-call periods.
        </div>

        {/* Configurable on-call card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-red-600" />
              Non-Resident On-Call Rules
            </CardTitle>
            <CardDescription>All values are configurable. WTR compliance status is shown automatically.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Field 1 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Max on-call periods per 7 days</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 3 (TCS §28)</span>
              <div className="mt-2">
                <Stepper value={oncallMaxPer7Days} onDec={() => setOncallMaxPer7Days(Math.max(1, oncallMaxPer7Days - 1))} onInc={() => setOncallMaxPer7Days(oncallMaxPer7Days + 1)} />
              </div>
              <MaxWarning value={oncallMaxPer7Days} max={3} label="On-call periods per 7 days" />
            </div>

            {/* Field 2 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Max consecutive non-res on-call (local agreement)</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 7 (TCS §27)</span>
              <div className="mt-2">
                <Stepper value={oncallLocalAgreementMaxConsec} onDec={() => setOncallLocalAgreementMaxConsec(Math.max(1, oncallLocalAgreementMaxConsec - 1))} onInc={() => setOncallLocalAgreementMaxConsec(oncallLocalAgreementMaxConsec + 1)} />
              </div>
              <MaxWarning value={oncallLocalAgreementMaxConsec} max={7} label="Consecutive non-res on-call periods" />
            </div>

            {/* Field 3 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Day after non-res on-call: max hours</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 10 hrs (TCS §29)</span>
              <div className="mt-2">
                <Stepper value={oncallDayAfterMaxHours} onDec={() => setOncallDayAfterMaxHours(Math.max(1, oncallDayAfterMaxHours - 1))} onInc={() => setOncallDayAfterMaxHours(oncallDayAfterMaxHours + 1)} />
              </div>
              <MaxWarning value={oncallDayAfterMaxHours} max={10} label="Day-after on-call hours" />
            </div>

            {/* Field 4 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Day after last consecutive on-call: max hours</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 10 hrs — applies after the last period in a consecutive block (TCS §29)</span>
              <div className="mt-2">
                <Stepper value={oncallDayAfterLastConsecMaxH} onDec={() => setOncallDayAfterLastConsecMaxH(Math.max(1, oncallDayAfterLastConsecMaxH - 1))} onInc={() => setOncallDayAfterLastConsecMaxH(oncallDayAfterLastConsecMaxH + 1)} />
              </div>
              <MaxWarning value={oncallDayAfterLastConsecMaxH} max={10} label="Day-after last consecutive on-call hours" />
            </div>

            {/* Field 5 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Expected rest per 24h while on-call</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR minimum: 8 hrs (TCS §30)</span>
              <div className="mt-2">
                <Stepper value={oncallRestPer24h} onDec={() => setOncallRestPer24h(Math.max(1, oncallRestPer24h - 1))} onInc={() => setOncallRestPer24h(oncallRestPer24h + 1)} />
              </div>
              <MinWarning value={oncallRestPer24h} min={8} label="Rest per 24h on-call" />
            </div>

            {/* Field 6 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Continuous rest window: duration</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR minimum: 5 hrs (TCS §30)</span>
              <div className="mt-2">
                <Stepper value={oncallContinuousRestHours} onDec={() => setOncallContinuousRestHours(Math.max(1, oncallContinuousRestHours - 1))} onInc={() => setOncallContinuousRestHours(oncallContinuousRestHours + 1)} />
              </div>
              <MinWarning value={oncallContinuousRestHours} min={5} label="Continuous rest window hours" />
            </div>

            {/* Field 7 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Continuous rest window: start time</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR standard: 22:00 (TCS §30)</span>
              <input type="time" value={oncallContinuousRestStart} onChange={(e) => setOncallContinuousRestStart(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" />
              <TimeWarning value={oncallContinuousRestStart} standard="22:00" label="rest window start time" />
            </div>

            {/* Field 8 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">Continuous rest window: end time</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR standard: 07:00 (TCS §30)</span>
              <input type="time" value={oncallContinuousRestEnd} onChange={(e) => setOncallContinuousRestEnd(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" />
              <TimeWarning value={oncallContinuousRestEnd} standard="07:00" label="rest window end time" />
            </div>

            {/* Field 9 */}
            <div>
              <p className="text-sm font-medium text-card-foreground">If rest not met: next day max hours</p>
              <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 5 hrs (TCS §31)</span>
              <div className="mt-2">
                <Stepper value={oncallIfRestNotMetMaxHours} onDec={() => setOncallIfRestNotMetMaxHours(Math.max(1, oncallIfRestNotMetMaxHours - 1))} onInc={() => setOncallIfRestNotMetMaxHours(oncallIfRestNotMetMaxHours + 1)} />
              </div>
              <MaxWarning value={oncallIfRestNotMetMaxHours} max={5} label="Next-day hours when rest not met" />
            </div>

            {/* Field 10 — Toggle full width */}
            <div className="col-span-1 sm:col-span-2">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-card-foreground">No consecutive non-res on-call except Sat/Sun</p>
                    <p className="text-xs text-muted-foreground">Standard rule: no consecutive non-resident on-call except Saturday and Sunday (TCS §27)</p>
                  </div>
                  <Switch checked={oncallNoConsecExceptWknd} onCheckedChange={setOncallNoConsecExceptWknd} />
                </div>
                {oncallNoConsecExceptWknd ? (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Compliant — consecutive non-res on-call restricted to Sat/Sun only
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ⚠️ WTR WARNING: Consecutive non-resident on-call is not permitted except at weekends
                  </div>
                )}
              </div>
            </div>

            {/* Field 11 — Toggle full width */}
            <div className="col-span-1 sm:col-span-2">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-card-foreground">No simultaneous non-res on-call + rostered shift</p>
                    <p className="text-xs text-muted-foreground">A doctor must not be on non-resident on-call on the same shift a colleague covers by rostered working (TCS §46)</p>
                  </div>
                  <Switch checked={oncallNoSimultaneousShift} onCheckedChange={setOncallNoSimultaneousShift} />
                </div>
                {oncallNoSimultaneousShift ? (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Compliant
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ⚠️ WTR WARNING: Requires explicit Clinical Director and Guardian of Safe Working Hours approval
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-red-600" />
              Summary — Steps 1–3
            </CardTitle>
            <CardDescription>Review your configuration before saving.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="flex justify-between rounded-md border border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-semibold text-card-foreground">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-3")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" disabled={saving} onClick={handleSave} className="bg-red-600 hover:bg-red-700">
            <CheckCircle className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save WTR Settings"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}