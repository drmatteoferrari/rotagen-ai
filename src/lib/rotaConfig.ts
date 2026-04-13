import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

// ─── Internal helpers ─────────────────────────────────────────

function generateAbbreviationForConfig(name: string): string {
  const base = name.split(/\s[—\-]\s/)[0].trim();
  const initials = base
    .split(/\s+/)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  return initials || name.slice(0, 2).toUpperCase();
}

// ─── SlotRequirement ─────────────────────────────────────────
// Defined here independently to avoid circular imports with shiftEligibility.ts.
// Shape is intentionally identical to shiftEligibility.SlotRequirement —
// keep in sync manually if either changes.

export interface SlotRequirement {
  slotIndex: number;
  label: string | null;
  permittedGrades: string[]; // [] = unrestricted
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqTransfer: number;
}

// ─── DaySlotData ─────────────────────────────────────────────
// Per-day staffing + slot requirements for one (shift × day) pair.
// Populated from shift_day_slots + shift_slot_requirements tables.

export interface DaySlotData {
  id: string; // shift_day_slots.id (UUID)
  dayKey: string; // "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
  minDoctors: number;
  targetDoctors: number;
  maxDoctors: number | null;
  slots: SlotRequirement[]; // ordered by slotIndex, may be fewer than targetDoctors
}

// ─── RotaConfigShift ─────────────────────────────────────────

export interface RotaConfigShift {
  id: string; // shift_types.id (UUID)
  shiftKey: string; // human-readable key e.g. "night", "long-day"
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  durationHours: number;
  isOncall: boolean;
  isNonResOncall: boolean;
  applicableDays: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
    sun: boolean;
  };
  badges: {
    night: boolean;
    long: boolean;
    ooh: boolean;
    oncall: boolean;
    nonres: boolean;
  };
  badgeOverrides: {
    night?: boolean;
    long?: boolean;
    ooh?: boolean;
    oncall?: boolean;
    nonres?: boolean;
  };
  oncallManuallySet: boolean;
  // Shift-level defaults — seed values used when no day slot override exists
  minDoctors: number;
  maxDoctors: number | null;
  targetDoctors: number;
  targetPercentage: number | null;
  sortOrder: number;
  reqIac: number;
  reqIaoc: number;
  reqIcu: number;
  reqMinGrade: string | null;
  reqTransfer: number;
  abbreviation: string;
  // Per-day data — empty array means no day slots saved yet (new shift)
  daySlots: DaySlotData[];
}

// ─── RotaConfig ───────────────────────────────────────────────

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
    bankHolidays: Array<{
      id: string;
      date: string;
      name: string;
      isAutoAdded: boolean;
      isActive: boolean;
    }>;
  };
  shifts: RotaConfigShift[];
  distribution: {
    globalOncallPct: number;
    globalNonOncallPct: number;
    byShift: Array<{ shiftKey: string; targetPct: number }>;
  };
  bhSameAsWeekend: boolean | null;
  bhShiftRules: Array<{
    shift_key: string;
    name: string;
    start_time: string;
    end_time: string;
    target_doctors: number;
    included: boolean;
  }> | null;
  wtr: {
    maxHoursPerWeek: number;
    maxHoursPer168h: number;
    maxShiftLengthH: number;
    minInterShiftRestH: number;
    maxConsecStandard: number;
    maxConsecLong: number;
    maxConsecNights: number;
    maxLongEveningConsec: number;
    restAfterNightsH: number;
    restAfterLongH: number;
    restAfterStandardH: number;
    restAfterLongEveningH: number;
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

// ─── getRotaConfig ────────────────────────────────────────────

export async function getRotaConfig(id: string): Promise<RotaConfig> {
  // Six parallel fetches — zero sequential round trips
  const [configRes, shiftsRes, holidaysRes, wtrRes, daySlotsRes, slotReqsRes] = await Promise.all([
    supabase.from("rota_configs").select("*").eq("id", id).single(),
    supabase.from("shift_types").select("*").eq("rota_config_id", id).order("sort_order", { ascending: true }),
    supabase.from("bank_holidays").select("*").eq("rota_config_id", id).order("date", { ascending: true }),
    supabase.from("wtr_settings").select("*").eq("rota_config_id", id).maybeSingle(),
    // New tables — typed as any until types.ts is regenerated by Lovable
    (supabase as any).from("shift_day_slots").select("*").eq("rota_config_id", id),
    (supabase as any).from("shift_slot_requirements").select("*").eq("rota_config_id", id),
  ]);

  if (configRes.error) throw configRes.error;
  const c = configRes.data;

  // ── Bank holidays ─────────────────────────────────────────
  const bankHolidays = (holidaysRes.data ?? []).map((h: any) => ({
    id: h.id,
    date: h.date,
    name: h.name,
    isAutoAdded: h.is_auto_added,
    isActive: h.is_active ?? true,
  }));

  // ── Build slot requirements lookup: shift_day_slot_id → SlotRequirement[] ──
  const rawSlotReqs: any[] = slotReqsRes.data ?? [];
  const reqsByDaySlotId = new Map<string, SlotRequirement[]>();

  for (const req of rawSlotReqs) {
    const sid: string = req.shift_day_slot_id;
    if (!reqsByDaySlotId.has(sid)) reqsByDaySlotId.set(sid, []);
    reqsByDaySlotId.get(sid)!.push({
      slotIndex: req.slot_index as number,
      label: req.label as string | null,
      permittedGrades: (req.permitted_grades as string[]) ?? [],
      reqIac: (req.req_iac as number) ?? 0,
      reqIaoc: (req.req_iaoc as number) ?? 0,
      reqIcu: (req.req_icu as number) ?? 0,
      reqTransfer: (req.req_transfer as number) ?? 0,
    });
  }
  // Sort each group by slotIndex ascending
  for (const reqs of reqsByDaySlotId.values()) {
    reqs.sort((a, b) => a.slotIndex - b.slotIndex);
  }

  // ── Build day slots lookup: shift_type_id → DaySlotData[] ──
  const rawDaySlots: any[] = daySlotsRes.data ?? [];
  const daySlotsByShiftTypeId = new Map<string, DaySlotData[]>();

  for (const ds of rawDaySlots) {
    const stid: string = ds.shift_type_id;
    if (!daySlotsByShiftTypeId.has(stid)) daySlotsByShiftTypeId.set(stid, []);
    daySlotsByShiftTypeId.get(stid)!.push({
      id: ds.id as string,
      dayKey: ds.day_key as string,
      minDoctors: (ds.min_doctors as number) ?? 1,
      targetDoctors: (ds.target_doctors as number) ?? 1,
      maxDoctors: (ds.max_doctors as number | null) ?? null,
      slots: reqsByDaySlotId.get(ds.id as string) ?? [],
    });
  }

  // ── Map shift_types rows ──────────────────────────────────
  const shifts: RotaConfigShift[] = (shiftsRes.data ?? []).map((s: any) => ({
    id: s.id,
    shiftKey: s.shift_key,
    name: s.name,
    startTime: s.start_time,
    endTime: s.end_time,
    durationHours: Number(s.duration_hours),
    isOncall: s.is_oncall ?? false,
    isNonResOncall: s.is_non_res_oncall ?? false,
    applicableDays: {
      mon: s.applicable_mon ?? false,
      tue: s.applicable_tue ?? false,
      wed: s.applicable_wed ?? false,
      thu: s.applicable_thu ?? false,
      fri: s.applicable_fri ?? false,
      sat: s.applicable_sat ?? false,
      sun: s.applicable_sun ?? false,
    },
    badges: {
      night: s.badge_night ?? false,
      long: s.badge_long ?? false,
      ooh: s.badge_ooh ?? false,
      oncall: s.badge_oncall ?? false,
      nonres: s.badge_nonres ?? false,
    },
    badgeOverrides: {
      ...(s.badge_night_manual_override !== null && s.badge_night_manual_override !== undefined
        ? { night: s.badge_night_manual_override as boolean }
        : {}),
      ...(s.badge_long_manual_override !== null && s.badge_long_manual_override !== undefined
        ? { long: s.badge_long_manual_override as boolean }
        : {}),
      ...(s.badge_ooh_manual_override !== null && s.badge_ooh_manual_override !== undefined
        ? { ooh: s.badge_ooh_manual_override as boolean }
        : {}),
      ...(s.badge_oncall_manual_override !== null && s.badge_oncall_manual_override !== undefined
        ? { oncall: s.badge_oncall_manual_override as boolean }
        : {}),
      ...(s.badge_nonres_manual_override !== null && s.badge_nonres_manual_override !== undefined
        ? { nonres: s.badge_nonres_manual_override as boolean }
        : {}),
    },
    oncallManuallySet: s.oncall_manually_set ?? false,
    minDoctors: s.min_doctors ?? 1,
    maxDoctors: s.max_doctors ?? null,
    targetDoctors: s.target_doctors ?? s.min_doctors ?? 1,
    targetPercentage: s.target_percentage != null ? Number(s.target_percentage) : null,
    sortOrder: s.sort_order ?? 0,
    reqIac: s.req_iac ?? 0,
    reqIaoc: s.req_iaoc ?? 0,
    reqIcu: s.req_icu ?? 0,
    reqMinGrade: s.req_min_grade ?? null,
    reqTransfer: s.req_transfer ?? 0,
    abbreviation: s.abbreviation ?? generateAbbreviationForConfig(s.name),
    // Attach per-day slots — empty array if none saved yet
    daySlots: daySlotsByShiftTypeId.get(s.id as string) ?? [],
  }));

  // ── WTR settings ──────────────────────────────────────────
  const w = wtrRes.data;
  const wtr = w
    ? {
        maxHoursPerWeek: Number(w.max_hours_per_week),
        maxHoursPer168h: Number(w.max_hours_per_168h),
        maxShiftLengthH: Number((w as any).max_shift_length_h ?? 13),
        minInterShiftRestH: Number((w as any).min_inter_shift_rest_h ?? 11),
        maxConsecStandard: w.max_consec_standard as number,
        maxConsecLong: w.max_consec_long as number,
        maxConsecNights: w.max_consec_nights as number,
        maxLongEveningConsec: (w as any).max_long_evening_consec ?? 4,
        restAfterNightsH: Number(w.rest_after_nights_h),
        restAfterLongH: Number(w.rest_after_long_h),
        restAfterStandardH: Number(w.rest_after_standard_h),
        restAfterLongEveningH: Number((w as any).rest_after_long_evening_h ?? 48),
        weekendFrequency: w.weekend_frequency as number,
        oncall: {
          noConsecExceptWknd: w.oncall_no_consec_except_wknd as boolean,
          maxPer7Days: w.oncall_max_per_7_days as number,
          localAgreementMaxConsec: w.oncall_local_agreement_max_consec as number,
          dayAfterMaxHours: Number(w.oncall_day_after_max_hours),
          restPer24h: Number(w.oncall_rest_per_24h),
          continuousRestHours: Number(w.oncall_continuous_rest_hours),
          continuousRestStart: w.oncall_continuous_rest_start as string,
          continuousRestEnd: w.oncall_continuous_rest_end as string,
          ifRestNotMetMaxHours: Number(w.oncall_if_rest_not_met_max_hours),
          noSimultaneousShift: w.oncall_no_simultaneous_shift as boolean,
          breakFineThresholdPct: w.oncall_break_fine_threshold_pct as number,
          breakReferenceWeeks: w.oncall_break_reference_weeks as number,
          clinicalExceptionAllowed: w.oncall_clinical_exception_allowed as boolean,
          saturdaySundayPaired: w.oncall_saturday_sunday_paired as boolean,
          dayAfterLastConsecMaxH: Number(w.oncall_day_after_last_consec_max_h),
        },
      }
    : null;

  // ── Assemble and return ───────────────────────────────────
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
      bankHolidays,
    },
    shifts,
    distribution: {
      globalOncallPct: Number(c.global_oncall_pct ?? 50),
      globalNonOncallPct: Number(c.global_non_oncall_pct ?? 50),
      byShift: shifts
        .filter((s) => s.targetPercentage != null)
        .map((s) => ({
          shiftKey: s.shiftKey,
          targetPct: s.targetPercentage!,
        })),
    },
    bhSameAsWeekend: c.bh_same_as_weekend ?? null,
    bhShiftRules: (c.bh_shift_rules as any[]) ?? null,
    wtr,
    createdAt: c.created_at ?? "",
    updatedAt: c.updated_at ?? "",
  };
}

// ─── getCurrentRotaConfig ─────────────────────────────────────

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

// ─── useRotaConfig hook ───────────────────────────────────────

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { config, loading, error, refresh };
}
