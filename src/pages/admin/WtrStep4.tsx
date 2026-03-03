import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Lock } from "lucide-react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const { setWtrComplete, maxAvgWeekly, maxIn7Days, maxConsecDays, maxConsecLong, maxConsecNights, restPostNights, restPostBlock, restAfter7, weekendFreq } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const [saving, setSaving] = useState(false);

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 4 of 4 — On-Call Rules">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex justify-between items-end">
          <span className="text-sm font-semibold text-red-500">Step 4 of 4</span>
          <span className="text-xs font-medium text-muted-foreground">Final Configuration</span>
        </div>
        <div className="h-2 w-full bg-red-500/10 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 w-full rounded-full" />
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">On-Call Working Patterns</h2>
          <p className="text-muted-foreground text-sm mt-1">
            These rules are fixed by the 2016 Terms and Conditions of Service, Schedule 3, and apply to all on-call rotas. They cannot be modified.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {onCallCards.map((card) => (
            <div key={card.title} className="rounded-xl bg-card border border-border p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-card-foreground">{card.title}</h3>
                <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
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
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-3")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" disabled={saving} onClick={async () => {
            // SECTION 6 — Save on /admin/wtr/step-4
            setSaving(true);
            try {
              let configId = currentRotaConfigId;

              if (!configId) {
                const { data, error } = await supabase
                  .from("rota_configs")
                  .insert({})
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

              // Upsert wtr_settings (all defaults from the locked on-call rules)
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
                oncall_continuous_rest_start: "22:00",
                oncall_continuous_rest_end: "07:00",
                oncall_if_rest_not_met_max_hours: 5,
                oncall_no_simultaneous_shift: true,
                oncall_break_fine_threshold_pct: 25,
                oncall_break_reference_weeks: 4,
                oncall_clinical_exception_allowed: true,
                oncall_saturday_sunday_paired: true,
                oncall_day_after_last_consec_max_h: 10,
              };

              // Check if wtr_settings exists
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

              // Check completion status
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
              // SECTION 6 COMPLETE
            } catch (err: any) {
              console.error("WTR save failed:", err);
              toast.error("Save failed — please try again");
            } finally {
              setSaving(false);
            }
          }} className="bg-red-500 hover:bg-red-600">
            <CheckCircle className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save WTR Configuration"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
