// SECTION 11 COMPLETE
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, Lock, ClipboardCheck, Info, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const onCallCards = [
  {
    title: "Consecutive on-call periods",
    rule: "No consecutive on-call periods apart from Saturday & Sunday. No more than 3 on-call periods in 7 consecutive days.",
    notes: "A maximum of 7 consecutive on-call periods can be agreed locally where safe to do so and no other safety rules would be breached; likely to be low intensity rotas only.",
  },
  {
    title: "Day after on-call: maximum rostered hours",
    rule: "Day after an on-call period must not be rostered to exceed 10 hours.",
    notes: "Where more than 1 on-call period is rostered consecutively (e.g. Saturday/Sunday), this rule applies to the day after the last on-call period.",
  },
  {
    title: "Expected rest during on-call & shift conflict prohibition",
    rule: "Expected rest while on-call is 8 hours per 24-hour period, of which at least 5 hours should be continuous between 22:00 and 07:00. No doctor should be rostered on-call to cover the same shift as a doctor on the same rota who is covering by working a rostered shift.",
    notes: "If it is expected that the rest requirement will not be met, the day after must not exceed 5 hours. The doctor must inform their employer where rest requirements are not met. TOIL must be taken within 24 hours or the time will be paid. A Guardian of Safe Working Hours fine will apply in this circumstance.",
  },
  {
    title: "Break requirements & clinical exceptions",
    rule: "A Guardian of Safe Working Hours fine will apply if breaks are missed on at least 25% of occasions across a 4-week reference period. Breaks should be taken separately but if combined must be taken as near as possible to the middle of the shift.",
    notes: "Unless there is a clearly defined clinical reason agreed by the Clinical Director and the working pattern is agreed by both the Guardian of Safe Working Hours and the Director of Medical Education.",
  },
];

export default function WtrStep4() {
  const navigate = useNavigate();
  const {
    setWtrComplete, maxAvgWeekly, maxIn7Days, maxConsecDays, maxConsecLong, maxConsecNights, restPostNights, restPostBlock, restAfter7, weekendFreq,
    oncallContinuousRestStart, oncallContinuousRestEnd, oncallIfRestNotMetMaxHours, oncallBreakReferenceWeeks, oncallBreakFineThresholdPct,
    setOncallContinuousRestStart, setOncallContinuousRestEnd, setOncallIfRestNotMetMaxHours, setOncallBreakReferenceWeeks, setOncallBreakFineThresholdPct,
  } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 4 of 4 — Review & Save" accentColor="red">
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <Info className="h-4 w-4 shrink-0 text-red-600" />
          These on-call rules are fixed by the 2016 Terms and Conditions of Service, Schedule 3. They cannot be modified.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-red-600" />
              Review & Save
            </CardTitle>
            <CardDescription>Confirm your WTR configuration before saving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {onCallCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-card-foreground">{card.title}</h3>
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Rule</p>
                    <p className="text-sm text-card-foreground leading-relaxed">{card.rule}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.notes}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SECTION 11 — Advanced On-Call Settings */}
        <Card>
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-card-foreground">Advanced On-Call Settings</p>
                <p className="text-xs text-muted-foreground">Fine-tune rest windows, break references, and fine thresholds</p>
              </div>
            </div>
            {advancedOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {advancedOpen && (
            <CardContent className="space-y-5 pt-0">
              <TooltipProvider>
                {/* Continuous rest window start */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-card-foreground">Continuous rest window — start</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The hours during which on-call doctors must have 5 continuous hours of rest (NHS standard: 22:00–07:00)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="time"
                    value={oncallContinuousRestStart}
                    onChange={(e) => setOncallContinuousRestStart(e.target.value)}
                    className="w-32"
                  />
                </div>

                {/* Continuous rest window end */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-card-foreground">Continuous rest window — end</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The hours during which on-call doctors must have 5 continuous hours of rest (NHS standard: 22:00–07:00)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="time"
                    value={oncallContinuousRestEnd}
                    onChange={(e) => setOncallContinuousRestEnd(e.target.value)}
                    className="w-32"
                  />
                </div>

                {/* Max hours next day if rest not met */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-card-foreground">Max hours next day if rest not met</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Maximum hours the following day if the rest requirement was not achieved (NHS standard: 5 hours)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    value={oncallIfRestNotMetMaxHours}
                    onChange={(e) => setOncallIfRestNotMetMaxHours(Number(e.target.value))}
                    className="w-24"
                  />
                </div>

                {/* Break reference period */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-card-foreground">Break reference period (weeks)</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Number of weeks used to calculate on-call frequency limits (typically 4)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={oncallBreakReferenceWeeks}
                    onChange={(e) => setOncallBreakReferenceWeeks(Number(e.target.value))}
                    className="w-24"
                  />
                </div>

                {/* Fine threshold percentage */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-card-foreground">Fine threshold (%)</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Percentage of reference periods where rest breaches trigger a Guardian of Safe Working fine (typically 25%)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={oncallBreakFineThresholdPct}
                    onChange={(e) => setOncallBreakFineThresholdPct(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
              </TooltipProvider>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-3")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" disabled={saving} onClick={async () => {
            setSaving(true);
            try {
              let configId = currentRotaConfigId;

              if (!configId) {
                const { data, error } = await supabase
                  .from("rota_configs")
                  .insert({ owned_by: user?.id ?? "developer1" } as any)
                  .select("id")
                  .single();
                if (error) throw error;
                configId = data.id;
                setCurrentRotaConfigId(configId);
              } else {
                await supabase
                  .from("rota_configs")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", configId);
              }

              const wtrFields = {
                rota_config_id: configId,
                max_hours_per_week: maxAvgWeekly,
                max_hours_per_168h: maxIn7Days,
                max_consec_standard: maxConsecDays,
                max_consec_long: maxConsecLong,
                max_consec_nights: maxConsecNights,
                rest_after_nights_h: restPostNights,
                rest_after_long_h: restPostBlock,
                rest_after_standard_h: restAfter7,
                weekend_frequency: weekendFreq,
                oncall_no_consec_except_wknd: true,
                oncall_max_per_7_days: 3,
                oncall_local_agreement_max_consec: 7,
                oncall_day_after_max_hours: 10,
                oncall_rest_per_24h: 8,
                oncall_continuous_rest_hours: 5,
                oncall_continuous_rest_start: oncallContinuousRestStart,
                oncall_continuous_rest_end: oncallContinuousRestEnd,
                oncall_if_rest_not_met_max_hours: oncallIfRestNotMetMaxHours,
                oncall_no_simultaneous_shift: true,
                oncall_break_fine_threshold_pct: oncallBreakFineThresholdPct,
                oncall_break_reference_weeks: oncallBreakReferenceWeeks,
                oncall_clinical_exception_allowed: true,
                oncall_saturday_sunday_paired: true,
                oncall_day_after_last_consec_max_h: 10,
              };

              const { data: existing } = await supabase
                .from("wtr_settings")
                .select("id")
                .eq("rota_config_id", configId)
                .maybeSingle();

              if (existing) {
                const { error } = await supabase
                  .from("wtr_settings")
                  .update({ ...wtrFields, updated_at: new Date().toISOString() })
                  .eq("id", existing.id);
                if (error) throw error;
              } else {
                const { error } = await supabase
                  .from("wtr_settings")
                  .insert(wtrFields);
                if (error) throw error;
              }

              const { count: shiftCount } = await supabase
                .from("shift_types")
                .select("id", { count: "exact", head: true })
                .eq("rota_config_id", configId);

              const { data: configRow } = await supabase
                .from("rota_configs")
                .select("rota_start_date")
                .eq("id", configId)
                .single();

              const isComplete = (shiftCount ?? 0) > 0 && configRow?.rota_start_date != null;

              if (isComplete) {
                await supabase
                  .from("rota_configs")
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
          }} className="bg-red-600 hover:bg-red-700">
            <CheckCircle className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save WTR Settings"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
