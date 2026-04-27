// L1: shared helper for upserting wtr_settings from any WTR step.
// Steps 1–4 call this on "Continue" so the user's input survives a browser
// crash / tab close. Step 5 still owns the end-to-end commit flow (config
// create-if-missing, completeness check, status='complete' transition).
//
// Skips silently if rotaConfigId is null — Step 5 will create the
// rota_config and persist everything in that flow.

import { supabase } from "@/integrations/supabase/client";

export interface WtrFields {
  max_hours_per_week: number;
  max_hours_per_168h: number;
  max_shift_length_h: number;
  max_consec_standard: number;
  max_consec_long: number;
  max_long_evening_consec: number;
  max_consec_nights: number;
  rest_after_nights_h: number;
  rest_after_long_h: number;
  rest_after_long_evening_h: number;
  rest_after_standard_h: number;
  min_inter_shift_rest_h: number;
  weekend_frequency: number;
  oncall_no_consec_except_wknd: boolean;
  oncall_max_per_7_days: number;
  oncall_local_agreement_max_consec: number;
  oncall_day_after_max_hours: number;
  oncall_rest_per_24h: number;
  oncall_continuous_rest_hours: number;
  oncall_continuous_rest_start: string;
  oncall_continuous_rest_end: string;
  oncall_if_rest_not_met_max_hours: number;
  oncall_no_simultaneous_shift: boolean;
  oncall_day_after_last_consec_max_h: number;
  oncall_break_fine_threshold_pct: number;
  oncall_break_reference_weeks: number;
  oncall_clinical_exception_allowed: boolean;
  oncall_saturday_sunday_paired: boolean;
}

export async function persistWtrSettings(
  rotaConfigId: string | null | undefined,
  fields: WtrFields,
): Promise<void> {
  if (!rotaConfigId) return;
  const row = { rota_config_id: rotaConfigId, ...fields };
  const { data: existing, error: selErr } = await supabase
    .from("wtr_settings")
    .select("id")
    .eq("rota_config_id", rotaConfigId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    const { error } = await supabase
      .from("wtr_settings")
      .update({ ...row, updated_at: new Date().toISOString() } as any)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("wtr_settings").insert(row as any);
    if (error) throw error;
  }
}
