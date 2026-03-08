import { getRotaConfig, type RotaConfig } from "./rotaConfig";
import { supabase } from "@/integrations/supabase/client";
import { computeShiftTargets, computeWeekendCap } from "./shiftTargets";
// ✅ Section 6 complete (imports)

// SECTION 8 — Pre-rota generation input builder

export interface PreRotaInput {
  configId: string;
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
    totalWeeks: number;
    bankHolidayDates: string[];
  };
  shiftSlots: Array<{
    shiftId: string;
    shiftKey: string;
    name: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    isOncall: boolean;
    isNonResOncall: boolean;
    applicableDays: string[];
    badges: string[];
    minDoctors: number;
    maxDoctors: number | null;
    targetPct: number;
  }>;
  wtrConstraints: {
    maxAvgHoursPerWeek: number;
    maxHoursIn168h: number;
    maxConsecutive: {
      standard: number;
      long: number;
      nights: number;
    };
    minRestHoursAfter: {
      nights: number;
      longShifts: number;
      standardShifts: number;
    };
    weekendFrequencyMax: number;
    oncall: {
      maxPer7Days: number;
      localAgreementMaxConsec: number;
      dayAfterMaxHours: number;
      restPer24hHours: number;
      continuousRestHours: number;
      continuousRestStart: string;
      continuousRestEnd: string;
      ifRestNotMetNextDayMaxHours: number;
      noSimultaneousShift: boolean;
    };
  };
  distributionTargets: {
    globalOncallPct: number;
    globalNonOncallPct: number;
    byShift: Array<{
      shiftKey: string;
      targetPct: number;
      isOncall: boolean;
    }>;
  };
}

export async function buildPreRotaInput(configId: string): Promise<PreRotaInput> {
  const cfg = await getRotaConfig(configId);

  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  return {
    configId: cfg.id,
    period: {
      startDate: cfg.rotaPeriod.startDate ?? "",
      endDate: cfg.rotaPeriod.endDate ?? "",
      totalDays: cfg.rotaPeriod.durationDays ?? 0,
      totalWeeks: cfg.rotaPeriod.durationWeeks ?? 0,
      bankHolidayDates: cfg.rotaPeriod.bankHolidays.map((h) => h.date),
    },
    shiftSlots: cfg.shifts.map((s) => ({
      shiftId: s.id,
      shiftKey: s.shiftKey,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      durationHours: s.durationHours,
      isOncall: s.isOncall,
      isNonResOncall: s.isNonResOncall,
      applicableDays: dayKeys.filter((d) => s.applicableDays[d]),
      badges: (["night", "long", "ooh", "weekend", "oncall", "nonres"] as const).filter((b) => s.badges[b]),
      minDoctors: s.minDoctors,
      maxDoctors: s.maxDoctors,
      targetPct: s.targetPercentage ?? 0,
      // ✅ Section 6 — competency requirements on shift types
      reqIac: s.reqIac,
      reqIaoc: s.reqIaoc,
      reqIcu: s.reqIcu,
      reqMinGrade: s.reqMinGrade,
    })),
    wtrConstraints: {
      maxAvgHoursPerWeek: cfg.wtr?.maxHoursPerWeek ?? 48,
      maxHoursIn168h: cfg.wtr?.maxHoursPer168h ?? 72,
      maxConsecutive: {
        standard: cfg.wtr?.maxConsecStandard ?? 7,
        long: cfg.wtr?.maxConsecLong ?? 7,
        nights: cfg.wtr?.maxConsecNights ?? 4,
      },
      minRestHoursAfter: {
        nights: cfg.wtr?.restAfterNightsH ?? 46,
        longShifts: cfg.wtr?.restAfterLongH ?? 48,
        standardShifts: cfg.wtr?.restAfterStandardH ?? 48,
      },
      weekendFrequencyMax: cfg.wtr?.weekendFrequency ?? 3,
      oncall: {
        maxPer7Days: cfg.wtr?.oncall.maxPer7Days ?? 3,
        localAgreementMaxConsec: cfg.wtr?.oncall.localAgreementMaxConsec ?? 7,
        dayAfterMaxHours: cfg.wtr?.oncall.dayAfterMaxHours ?? 10,
        restPer24hHours: cfg.wtr?.oncall.restPer24h ?? 8,
        continuousRestHours: cfg.wtr?.oncall.continuousRestHours ?? 5,
        continuousRestStart: cfg.wtr?.oncall.continuousRestStart ?? "22:00",
        continuousRestEnd: cfg.wtr?.oncall.continuousRestEnd ?? "07:00",
        ifRestNotMetNextDayMaxHours: cfg.wtr?.oncall.ifRestNotMetMaxHours ?? 5,
        noSimultaneousShift: cfg.wtr?.oncall.noSimultaneousShift ?? true,
      },
    },
    distributionTargets: {
      globalOncallPct: cfg.distribution.globalOncallPct,
      globalNonOncallPct: cfg.distribution.globalNonOncallPct,
      byShift: cfg.shifts
        .filter((s) => s.targetPercentage != null)
        .map((s) => ({
          shiftKey: s.shiftKey,
          targetPct: s.targetPercentage!,
          isOncall: s.isOncall,
        })),
    },
  };
}

// SECTION 8 COMPLETE

// SECTION 9 — Final rota generation input builder

export interface DoctorPreference {
  doctorId: string;
  name: string;
  grade: string;
  wtePct: number;
  ltftDaysOff: string[];
  ltftNightFlexibility: Array<{
    day: string;
    canStartNightsOnDay: boolean;
    canEndNightsOnDay: boolean;
  }>;
  maxConsecNights: number;
  annualLeave: Array<{ startDate: string; endDate: string; notes: string }>;
  studyLeave: Array<{ startDate: string; endDate: string; reason: string }>;
  nocDates: string[];
  // ✅ Section 3 complete — parental leave added to DoctorPreference
  parentalLeaveDates: string[];
  parentalLeaveNotes?: string;
  exemptFromNights: boolean;
  exemptFromWeekends: boolean;
  exemptFromOncall: boolean;
  additionalNotes: string;
}

export interface FinalRotaInput {
  preRotaInput: PreRotaInput;
  doctors: Array<{
    doctorId: string;
    name: string;
    grade: string;
    wtePct: number;
    contractedHoursPerWeek: number;
    ltft: {
      isLtft: boolean;
      daysOff: string[];
      nightFlexibility: DoctorPreference["ltftNightFlexibility"];
    };
    constraints: {
      hard: {
        annualLeaveDates: string[];
        studyLeaveDates: string[];
        // ✅ Section 3 complete — parental leave in FinalRotaInput type
        parentalLeaveDates: string[];
        exemptFromNights: boolean;
        exemptFromWeekends: boolean;
        exemptFromOncall: boolean;
        ltftDaysBlocked: string[];
      };
      soft: {
        nocDates: string[];
        maxConsecNights: number;
        additionalNotes: string;
      };
    };
    fairnessTargets: {
      targetTotalHours: number;
      targetNightShiftCount: number;
      targetWeekendShiftCount: number;
      targetOncallCount: number;
      proportionFactor: number;
    };
  }>;
  constraints: {
    hard: string[];
    soft: string[];
  };
}

// SECTION 10 — Survey response type
export interface DoctorSurveyResponse {
  id: string;
  doctor_id: string;
  rota_config_id: string;
  full_name: string | null;
  nhs_email: string | null;
  grade: string | null;
  specialty: string | null;
  wte_percent: number;
  ltft_days_off: string[] | null;
  ltft_night_flexibility: any[];
  annual_leave: any[];
  study_leave: any[];
  noc_dates: any[];
  exempt_from_nights: boolean;
  exempt_from_weekends: boolean;
  exempt_from_oncall: boolean;
  other_requests: string | null;
  additional_restrictions: string | null;
  additional_notes: string | null;
  status: string;
  submitted_at: string | null;
}

export async function getSurveyResponsesForConfig(configId: string): Promise<DoctorSurveyResponse[]> {
  const { data, error } = await supabase
    .from("doctor_survey_responses")
    .select("*")
    .eq("rota_config_id", configId);

  if (error) {
    console.error("Failed to fetch survey responses:", error);
    return [];
  }
  return (data ?? []) as DoctorSurveyResponse[];
}

// SECTION 10 COMPLETE

function expandDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function mapResponseToPreference(resp: DoctorSurveyResponse): DoctorPreference {
  const annualLeave = Array.isArray(resp.annual_leave) ? resp.annual_leave : [];
  const studyLeave = Array.isArray(resp.study_leave) ? resp.study_leave : [];
  // ✅ Section 1 complete — NOC dates expanded from {startDate, endDate} ranges
  const nocDates = Array.isArray(resp.noc_dates)
    ? resp.noc_dates.flatMap((n: any) => {
        if (typeof n === "string") return [n];
        const start = n?.startDate ?? n?.start_date ?? n?.date ?? '';
        const end   = n?.endDate   ?? n?.end_date   ?? n?.date ?? '';
        if (!start) return [];
        if (!end || end === start) return [start];
        return expandDateRange(start, end);
      })
    : [];
  const ltftNightFlex = Array.isArray(resp.ltft_night_flexibility) ? resp.ltft_night_flexibility : [];

  // ✅ Section 3 complete — expand parental leave into individual blocked dates
  const parentalLeaveDates: string[] = (() => {
    if (!(resp as any).parental_leave_expected) return [];
    const start = (resp as any).parental_leave_start;
    const end   = (resp as any).parental_leave_end;
    if (!start) return [];
    if (!end || end === start) return [start];
    return expandDateRange(start, end);
  })();

  return {
    doctorId: resp.doctor_id,
    name: resp.full_name ?? "",
    grade: resp.grade ?? "",
    wtePct: resp.wte_percent ?? 100,
    // ✅ Section 3 complete — normalise day names to lowercase
    ltftDaysOff: (resp.ltft_days_off ?? []).map((d: string) => d.toLowerCase()),
    ltftNightFlexibility: ltftNightFlex.map((f: any) => ({
      ...f,
      day: (f.day ?? '').toLowerCase(),
    })),
    maxConsecNights: 0, // placeholder — replaced in buildFinalRotaInput with WTR value
    annualLeave: annualLeave.map((l: any) => ({
      startDate: l.startDate ?? l.start_date ?? "",
      endDate: l.endDate ?? l.end_date ?? "",
      notes: l.notes ?? "",
    })),
    studyLeave: studyLeave.map((l: any) => ({
      startDate: l.startDate ?? l.start_date ?? "",
      endDate: l.endDate ?? l.end_date ?? "",
      reason: l.reason ?? "",
    })),
    nocDates,
    parentalLeaveDates,
    parentalLeaveNotes: (resp as any).parental_leave_notes ?? undefined,
    exemptFromNights: resp.exempt_from_nights ?? false,
    exemptFromWeekends: resp.exempt_from_weekends ?? false,
    exemptFromOncall: resp.exempt_from_oncall ?? false,
    additionalNotes: [resp.other_requests, resp.additional_restrictions].filter(Boolean).join("\n"),
  };
}

export async function buildFinalRotaInput(configId: string): Promise<FinalRotaInput> {
  const preRotaInput = await buildPreRotaInput(configId);
  const cfg = await getRotaConfig(configId);
  const totalWeeks = preRotaInput.period.totalWeeks || 1;

  // ✅ Section 2 complete — read maxConsecNights from WTR settings instead of hardcoding
  const maxConsecNights = cfg.wtr?.maxConsecNights ?? 4;

  // Fetch submitted survey responses
  const responses = await getSurveyResponsesForConfig(configId);
  const submittedResponses = responses.filter((r) => r.status === "submitted");
  const doctors = submittedResponses.map((r) => {
    const pref = mapResponseToPreference(r);
    pref.maxConsecNights = maxConsecNights;
    return pref;
  });

  const totalNightSlots = preRotaInput.shiftSlots
    .filter((s) => s.badges.includes("night"))
    .reduce((sum, s) => sum + s.minDoctors * preRotaInput.period.totalDays, 0);
  const totalWeekendSlots = preRotaInput.shiftSlots
    .filter((s) => s.badges.includes("weekend"))
    .reduce((sum, s) => sum + s.minDoctors * preRotaInput.period.totalDays, 0);
  const totalOncallSlots = preRotaInput.shiftSlots
    .filter((s) => s.isOncall)
    .reduce((sum, s) => sum + s.minDoctors * preRotaInput.period.totalDays, 0);

  const doctorCount = doctors.length || 1;

  // ✅ Section 6 — Compute baseline shift targets (full-time, for reference)
  const shiftTargetShifts = cfg.shifts.map((s) => ({
    id: s.id,
    name: s.name,
    shiftKey: s.shiftKey,
    isOncall: s.isOncall,
    targetPercentage: s.targetPercentage ?? 0,
    durationHours: s.durationHours,
  }));

  const baselineTargets = cfg.wtr ? computeShiftTargets({
    maxHoursPerWeek: cfg.wtr.maxHoursPerWeek,
    maxHoursPer168h: cfg.wtr.maxHoursPer168h,
    rotaWeeks: totalWeeks,
    globalOncallPct: cfg.distribution.globalOncallPct,
    globalNonOncallPct: cfg.distribution.globalNonOncallPct,
    shiftTypes: shiftTargetShifts,
    wtePercent: 100,
  }) : null;

  // Per-doctor targets
  const doctorTargets = doctors.map((doc) => {
    const resp = submittedResponses.find((r) => r.doctor_id === doc.doctorId);
    const compJson = (resp as any)?.competencies_json ?? {};

    const targets = cfg.wtr ? computeShiftTargets({
      maxHoursPerWeek: cfg.wtr.maxHoursPerWeek,
      maxHoursPer168h: cfg.wtr.maxHoursPer168h,
      rotaWeeks: totalWeeks,
      globalOncallPct: cfg.distribution.globalOncallPct,
      globalNonOncallPct: cfg.distribution.globalNonOncallPct,
      shiftTypes: shiftTargetShifts,
      wtePercent: doc.wtePct,
    }) : null;

    const weekendCap = cfg.wtr ? computeWeekendCap({
      rotaWeeks: totalWeeks,
      weekendFrequency: cfg.wtr.weekendFrequency,
      wtePercent: doc.wtePct,
    }) : null;

    return {
      doctorId: doc.doctorId,
      shiftTargets: targets?.targets ?? [],
      totalMaxHours: targets?.totalMaxTargetHours ?? 0,
      weekendCap: weekendCap?.maxWeekends ?? 0,
      hardWeeklyCap: targets?.hardWeeklyCap ?? 72,
      // ✅ Section 6 — competency status on doctors
      hasIac: compJson?.iac?.achieved === true,
      hasIaoc: compJson?.iaoc?.achieved === true,
      hasIcu: compJson?.icu?.achieved === true,
      grade: doc.grade ?? null,
    };
  });

  return {
    preRotaInput,
    doctors: doctors.map((doc) => {
      const proportion = doc.wtePct / 100;
      const annualLeaveDates = doc.annualLeave.flatMap((l) => expandDateRange(l.startDate, l.endDate));
      const studyLeaveDates = doc.studyLeave.flatMap((l) => expandDateRange(l.startDate, l.endDate));
      const dt = doctorTargets.find((d) => d.doctorId === doc.doctorId);

      return {
        doctorId: doc.doctorId,
        name: doc.name,
        grade: doc.grade,
        wtePct: doc.wtePct,
        contractedHoursPerWeek: (doc.wtePct / 100) * 40,
        ltft: {
          isLtft: doc.wtePct < 100,
          daysOff: doc.ltftDaysOff,
          nightFlexibility: doc.ltftNightFlexibility,
        },
        constraints: {
          hard: {
            annualLeaveDates,
            studyLeaveDates,
            // ✅ Section 3 complete — parental leave dates in hard constraints
            parentalLeaveDates: doc.parentalLeaveDates ?? [],
            exemptFromNights: doc.exemptFromNights,
            exemptFromWeekends: doc.exemptFromWeekends,
            exemptFromOncall: doc.exemptFromOncall,
            ltftDaysBlocked: doc.ltftDaysOff,
          },
          soft: {
            nocDates: doc.nocDates,
            maxConsecNights: doc.maxConsecNights,
            additionalNotes: doc.additionalNotes,
          },
        },
        fairnessTargets: {
          targetTotalHours: ((doc.wtePct / 100) * 40) * totalWeeks,
          targetNightShiftCount: Math.round((totalNightSlots / doctorCount) * proportion),
          targetWeekendShiftCount: Math.round((totalWeekendSlots / doctorCount) * proportion),
          targetOncallCount: Math.round((totalOncallSlots / doctorCount) * proportion),
          proportionFactor: proportion,
        },
        // ✅ Section 6 — per-doctor computed targets
        shiftTargets: dt?.shiftTargets ?? [],
        totalMaxHours: dt?.totalMaxHours ?? 0,
        weekendCap: dt?.weekendCap ?? 0,
        hardWeeklyCap: dt?.hardWeeklyCap ?? 72,
        hasIac: dt?.hasIac ?? false,
        hasIaoc: dt?.hasIaoc ?? false,
        hasIcu: dt?.hasIcu ?? false,
      };
    }),
    constraints: {
      hard: [
        "WTR_MAX_HOURS_PER_WEEK",
        "WTR_MAX_HOURS_PER_168H",
        "WTR_MIN_REST_AFTER_NIGHTS",
        "WTR_MIN_REST_AFTER_LONG_SHIFTS",
        "WTR_MIN_REST_AFTER_STANDARD_SHIFTS",
        "WTR_MAX_CONSEC_NIGHTS",
        "WTR_MAX_CONSEC_LONG",
        "WTR_MAX_CONSEC_STANDARD",
        "ANNUAL_LEAVE_DATES_BLOCKED",
        "STUDY_LEAVE_DATES_BLOCKED",
        "LTFT_DAYS_BLOCKED",
        "NIGHT_EXEMPTIONS_RESPECTED",
        "WEEKEND_EXEMPTIONS_RESPECTED",
        "ONCALL_EXEMPTIONS_RESPECTED",
        "MIN_STAFFING_MET_ALL_SHIFTS",
        "ONCALL_MAX_PER_7_DAYS",
        "ONCALL_DAY_AFTER_MAX_HOURS",
        "NO_SIMULTANEOUS_ONCALL_AND_SHIFT",
        "COMPETENCY_COMPOSITION_MET",
        "GRADE_FLOOR_MET",
        "WEEKEND_CAP_RESPECTED",
      ],
      soft: [
        "SOFT_NOC_DATES_RESPECTED",
        "SOFT_MAX_CONSEC_NIGHTS_PREFERENCE",
        "SOFT_WEEKEND_FREQUENCY_TARGET",
        "SOFT_FAIR_NIGHT_DISTRIBUTION",
        "SOFT_FAIR_WEEKEND_DISTRIBUTION",
        "SOFT_FAIR_ONCALL_DISTRIBUTION",
        "SOFT_FAIR_LONG_DAY_DISTRIBUTION",
        "SOFT_LTFT_NIGHT_FLEXIBILITY",
      ],
    },
  };
}

// SECTION 9 COMPLETE
