import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

// SECTION 7 — getRotaConfig() retrieval function

function generateAbbreviationForConfig(name: string): string {
  const base = name.split(/\s[—\-]\s/)[0].trim();
  const initials = base.split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? "").join("").slice(0, 4);
  return initials || name.slice(0, 2).toUpperCase();
}

export interface RotaConfigShift {
  id: string;
  shiftKey: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  isOncall: boolean;
  isNonResOncall: boolean;
  applicableDays: {
    mon: boolean; tue: boolean; wed: boolean; thu: boolean;
    fri: boolean; sat: boolean; sun: boolean;
  };
  badges: {
    night: boolean; long: boolean; ooh: boolean;
    oncall: boolean; nonres: boolean;
  };
  badgeOverrides: {
    night?: boolean; long?: boolean; ooh?: boolean;
    oncall?: boolean; nonres?: boolean;
  };
  oncallManuallySet: boolean;
  minDoctors: number;
  maxDoctors: number | null;
  targetPercentage: number | null;
  sortOrder: number;
  // ✅ Section 2 — competency & grade requirements
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqMinGrade: string | null;
  reqTransfer: number;
  abbreviation: string;
  targetDoctors: number;
}

export interface RotaConfig {
  id: string;
  status: string;
  surveyDeadline: string | null;
  department: {
    departmentName: string;
    trustName: string;
    contactEmail: string;
  };
  rotaPeriod: {
    startDate: string | null;
    endDate: string | null;
    durationDays: number | null;
    durationWeeks: number | null;
    startTime: string;
    endTime: string;
    bankHolidays: Array<{
      date: string;
      name: string;
      isAutoAdded: boolean;
    }>;
  };
  shifts: RotaConfigShift[];
  distribution: {
    globalOncallPct: number;
    globalNonOncallPct: number;
    byShift: Array<{ shiftKey: string; targetPct: number }>;
  };
  wtr: {
    maxHoursPerWeek: number;
    maxHoursPer168h: number;
    maxConsecStandard: number;
    maxConsecLong: number;
    maxConsecNights: number;
    restAfterNightsH: number;
    restAfterLongH: number;
    restAfterStandardH: number;
    weekendFrequency: number;
    oncall: {
      noConsecExceptWknd: boolean;
      maxPer7Days: number;
      localAgreementMaxConsec: number;
      dayAfterMaxHours: number;
      restPer24h: number;
      continuousRestHours: number;
      continuousRestStart: string;
      continuousRestEnd: string;
      ifRestNotMetMaxHours: number;
      noSimultaneousShift: boolean;
      breakFineThresholdPct: number;
      breakReferenceWeeks: number;
      clinicalExceptionAllowed: boolean;
      saturdaySundayPaired: boolean;
      dayAfterLastConsecMaxH: number;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
}

export async function getRotaConfig(id: string): Promise<RotaConfig> {
  const [configRes, shiftsRes, holidaysRes, wtrRes] = await Promise.all([
    supabase.from("rota_configs").select("*").eq("id", id).single(),
    supabase.from("shift_types").select("*").eq("rota_config_id", id).order("sort_order", { ascending: true }),
    supabase.from("bank_holidays").select("*").eq("rota_config_id", id).order("date", { ascending: true }),
    supabase.from("wtr_settings").select("*").eq("rota_config_id", id).maybeSingle(),
  ]);

  if (configRes.error) throw configRes.error;
  const c = configRes.data;
  const shifts = (shiftsRes.data ?? []).map((s: any) => ({
    id: s.id,
    shiftKey: s.shift_key,
    name: s.name,
    startTime: s.start_time,
    endTime: s.end_time,
    durationHours: Number(s.duration_hours),
    isOncall: s.is_oncall,
    isNonResOncall: s.is_non_res_oncall,
    applicableDays: {
      mon: s.applicable_mon, tue: s.applicable_tue, wed: s.applicable_wed,
      thu: s.applicable_thu, fri: s.applicable_fri, sat: s.applicable_sat, sun: s.applicable_sun,
    },
    badges: {
      night: s.badge_night, long: s.badge_long, ooh: s.badge_ooh,
      oncall: s.badge_oncall, nonres: s.badge_nonres,
    },
    badgeOverrides: {
      ...(s.badge_night_manual_override !== null ? { night: s.badge_night_manual_override } : {}),
      ...(s.badge_long_manual_override !== null ? { long: s.badge_long_manual_override } : {}),
      ...(s.badge_ooh_manual_override !== null ? { ooh: s.badge_ooh_manual_override } : {}),
      
      ...(s.badge_oncall_manual_override !== null ? { oncall: s.badge_oncall_manual_override } : {}),
      ...(s.badge_nonres_manual_override !== null ? { nonres: s.badge_nonres_manual_override } : {}),
    },
    oncallManuallySet: s.oncall_manually_set,
    minDoctors: s.min_doctors,
    maxDoctors: s.max_doctors,
    targetPercentage: s.target_percentage != null ? Number(s.target_percentage) : null,
    sortOrder: s.sort_order,
    reqIac: s.req_iac ?? 0,
    reqIaoc: s.req_iaoc ?? 0,
    reqIcu: s.req_icu ?? 0,
    reqMinGrade: s.req_min_grade ?? null,
    reqTransfer: s.req_transfer ?? 0,
    abbreviation: s.abbreviation ?? generateAbbreviationForConfig(s.name),
    targetDoctors: s.target_doctors ?? s.min_doctors ?? 1,
  }));
  // ✅ Section 2 complete (rotaConfig mapping)

  const bankHolidays = (holidaysRes.data ?? []).map((h: any) => ({
    date: h.date,
    name: h.name,
    isAutoAdded: h.is_auto_added,
  }));

  const w = wtrRes.data;
  const wtr = w ? {
    maxHoursPerWeek: Number(w.max_hours_per_week),
    maxHoursPer168h: Number(w.max_hours_per_168h),
    maxConsecStandard: w.max_consec_standard,
    maxConsecLong: w.max_consec_long,
    maxConsecNights: w.max_consec_nights,
    restAfterNightsH: Number(w.rest_after_nights_h),
    restAfterLongH: Number(w.rest_after_long_h),
    restAfterStandardH: Number(w.rest_after_standard_h),
    weekendFrequency: w.weekend_frequency,
    oncall: {
      noConsecExceptWknd: w.oncall_no_consec_except_wknd,
      maxPer7Days: w.oncall_max_per_7_days,
      localAgreementMaxConsec: w.oncall_local_agreement_max_consec,
      dayAfterMaxHours: Number(w.oncall_day_after_max_hours),
      restPer24h: Number(w.oncall_rest_per_24h),
      continuousRestHours: Number(w.oncall_continuous_rest_hours),
      continuousRestStart: w.oncall_continuous_rest_start,
      continuousRestEnd: w.oncall_continuous_rest_end,
      ifRestNotMetMaxHours: Number(w.oncall_if_rest_not_met_max_hours),
      noSimultaneousShift: w.oncall_no_simultaneous_shift,
      breakFineThresholdPct: w.oncall_break_fine_threshold_pct,
      breakReferenceWeeks: w.oncall_break_reference_weeks,
      clinicalExceptionAllowed: w.oncall_clinical_exception_allowed,
      saturdaySundayPaired: w.oncall_saturday_sunday_paired,
      dayAfterLastConsecMaxH: Number(w.oncall_day_after_last_consec_max_h),
    },
  } : null;

  return {
    id: c.id,
    status: c.status ?? "draft",
    surveyDeadline: c.survey_deadline ?? null,
    department: {
      departmentName: c.department_name ?? "",
      trustName: c.trust_name ?? "",
      contactEmail: c.contact_email ?? "",
    },
    rotaPeriod: {
      startDate: c.rota_start_date,
      endDate: c.rota_end_date,
      durationDays: c.rota_duration_days,
      durationWeeks: c.rota_duration_weeks != null ? Number(c.rota_duration_weeks) : null,
      startTime: c.rota_start_time ?? "08:00",
      endTime: c.rota_end_time ?? "08:00",
      bankHolidays,
    },
    shifts,
    distribution: {
      globalOncallPct: Number(c.global_oncall_pct ?? 50),
      globalNonOncallPct: Number(c.global_non_oncall_pct ?? 50),
      byShift: shifts.filter((s: RotaConfigShift) => s.targetPercentage != null).map((s: RotaConfigShift) => ({
        shiftKey: s.shiftKey,
        targetPct: s.targetPercentage!,
      })),
    },
    wtr,
    createdAt: c.created_at ?? "",
    updatedAt: c.updated_at ?? "",
  };
}

// SECTION 3 — getCurrentRotaConfig now filters by username
export async function getCurrentRotaConfig(userId: string): Promise<RotaConfig | null> {
  const { data } = await supabase
    .from("rota_configs")
    .select("id")
    .eq("owned_by", userId)
    .in("status", ["draft", "complete"])
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return getRotaConfig(data.id);
}
// SECTION 3 COMPLETE

export function useRotaConfig() {
  const [config, setConfig] = useState<RotaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!user) {
      setConfig(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getCurrentRotaConfig(user.id);
      setConfig(result);
    } catch (e: any) {
      setError(e.message ?? "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { config, loading, error, refresh };
}

// SECTION 7 COMPLETE
