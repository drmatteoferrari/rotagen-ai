import { getRotaConfig, type RotaConfig, type DaySlotData } from "./rotaConfig";
import { supabase } from "@/integrations/supabase/client";
import type { TargetsData, DoctorShiftTarget } from "./preRotaTypes";

// ─── Constants ────────────────────────────────────────────────

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

// ─── PreRotaInput ─────────────────────────────────────────────
// shiftSlots is now one entry per (shiftKey × dayKey) pair.
// The algorithm iterates calendar dates, maps each to its dayKey,
// and looks up matching entries to get the complete daily manifest.

export interface ShiftSlotEntry {
  shiftId: string; // shift_types.id
  shiftKey: string; // e.g. "night", "long-day"
  name: string;
  dayKey: string; // "mon" | "tue" | ... | "sun"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  durationHours: number;
  isOncall: boolean;
  isNonResOncall: boolean;
  badges: string[]; // ["night", "long", "ooh", "oncall", "nonres"]
  staffing: {
    min: number;
    target: number;
    max: number | null;
  };
  // Slot-level eligibility requirements.
  // Each entry = one doctor position with its own grade + competency constraints.
  // Array length may be less than staffing.target — remaining positions unconstrained.
  slots: Array<{
    slotIndex: number;
    label: string | null;
    permittedGrades: string[]; // [] = no restriction
    reqIac: number;
    reqIaoc: number;
    reqIcu: number;
    reqTransfer: number;
  }>;
  targetPct: number; // shift-level distribution percentage
}

export interface PreRotaInput {
  configId: string;
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
    totalWeeks: number;
    bankHolidayDates: string[];
    bhSameAsWeekend: boolean | null;
    bhShiftRules: Array<{
      shift_key: string;
      name: string;
      start_time: string;
      end_time: string;
      target_doctors: number;
      included: boolean;
    }> | null;
  };
  shiftSlots: ShiftSlotEntry[];
  wtrConstraints: {
    maxAvgHoursPerWeek: number;
    maxHoursIn168h: number;
    maxShiftLengthH: number;
    minInterShiftRestH: number;
    maxConsecutive: {
      standard: number;
      long: number;
      nights: number;
      longEvening: number;
    };
    minRestHoursAfter: {
      nights: number;
      longShifts: number;
      standardShifts: number;
      longEveningShifts: number;
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
      noConsecExceptWknd: boolean;
      dayAfterLastConsecMaxH: number;
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

// ─── buildPreRotaInput ────────────────────────────────────────

export async function buildPreRotaInput(configId: string): Promise<PreRotaInput> {
  const cfg = await getRotaConfig(configId);

  // Build shiftSlots: one entry per (shift × active day).
  // If a shift has daySlots from the new tables, use those.
  // If not (legacy / pre-migration shift), fall back to applicableDays
  // from shift_types and synthesise entries from shift-level defaults.
  const shiftSlots: ShiftSlotEntry[] = [];

  for (const shift of cfg.shifts) {
    const badges = (["night", "long", "ooh", "oncall", "nonres"] as const).filter((b) => shift.badges[b]);

    if (shift.daySlots.length > 0) {
      // ── New path: per-day slots exist ──
      for (const ds of shift.daySlots) {
        shiftSlots.push({
          shiftId: shift.id,
          shiftKey: shift.shiftKey,
          name: shift.name,
          dayKey: ds.dayKey,
          startTime: shift.startTime,
          endTime: shift.endTime,
          durationHours: shift.durationHours,
          isOncall: shift.isOncall,
          isNonResOncall: shift.isNonResOncall,
          badges,
          staffing: {
            min: ds.minDoctors,
            target: ds.targetDoctors,
            max: ds.maxDoctors,
          },
          slots: ds.slots,
          targetPct: shift.targetPercentage ?? 0,
        });
      }
    } else {
      // ── Fallback path: no day slots saved yet ──
      // Synthesise one entry per active day using shift-level defaults.
      // Produces zero slot requirements (unconstrained eligibility).
      for (const dayKey of DAY_KEYS) {
        if (!shift.applicableDays[dayKey]) continue;
        shiftSlots.push({
          shiftId: shift.id,
          shiftKey: shift.shiftKey,
          name: shift.name,
          dayKey,
          startTime: shift.startTime,
          endTime: shift.endTime,
          durationHours: shift.durationHours,
          isOncall: shift.isOncall,
          isNonResOncall: shift.isNonResOncall,
          badges,
          staffing: {
            min: shift.minDoctors,
            target: shift.targetDoctors,
            max: shift.maxDoctors,
          },
          slots: [], // no per-slot constraints in fallback
          targetPct: shift.targetPercentage ?? 0,
        });
      }
    }
  }

  return {
    configId: cfg.id,
    period: {
      startDate: cfg.rotaPeriod.startDate ?? "",
      endDate: cfg.rotaPeriod.endDate ?? "",
      totalDays: cfg.rotaPeriod.durationDays ?? 0,
      totalWeeks: cfg.rotaPeriod.durationWeeks ?? 0,
      bankHolidayDates: cfg.rotaPeriod.bankHolidays.filter((h) => h.isActive).map((h) => h.date),
      bhSameAsWeekend: cfg.bhSameAsWeekend ?? null,
      bhShiftRules: cfg.bhShiftRules ?? null,
    },
    shiftSlots,
    wtrConstraints: {
      maxAvgHoursPerWeek: cfg.wtr?.maxHoursPerWeek ?? 48,
      maxHoursIn168h: cfg.wtr?.maxHoursPer168h ?? 72,
      maxShiftLengthH: cfg.wtr?.maxShiftLengthH ?? 13,
      minInterShiftRestH: cfg.wtr?.minInterShiftRestH ?? 11,
      maxConsecutive: {
        standard: cfg.wtr?.maxConsecStandard ?? 7,
        long: cfg.wtr?.maxConsecLong ?? 4,
        nights: cfg.wtr?.maxConsecNights ?? 4,
        longEvening: cfg.wtr?.maxLongEveningConsec ?? 4,
      },
      minRestHoursAfter: {
        nights: cfg.wtr?.restAfterNightsH ?? 46,
        longShifts: cfg.wtr?.restAfterLongH ?? 48,
        standardShifts: cfg.wtr?.restAfterStandardH ?? 48,
        longEveningShifts: cfg.wtr?.restAfterLongEveningH ?? 48,
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
        noConsecExceptWknd: cfg.wtr?.oncall.noConsecExceptWknd ?? true,
        dayAfterLastConsecMaxH: cfg.wtr?.oncall.dayAfterLastConsecMaxH ?? 10,
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

// ─── Helper: total slots per shiftKey across all days ─────────
// Used by buildFinalRotaInput to compute fairness targets.
// Counts total doctor-slots that need filling across the rota period.

function countTotalSlots(
  shiftSlots: ShiftSlotEntry[],
  filter: (s: ShiftSlotEntry) => boolean,
  totalWeeks: number,
): number {
  // Group by shiftKey + dayKey to get weekly occurrences
  const seen = new Map<string, number>(); // key = shiftKey:dayKey → target
  for (const s of shiftSlots) {
    if (!filter(s)) continue;
    const key = `${s.shiftKey}:${s.dayKey}`;
    // Use max target seen for this pair (should always be the same)
    seen.set(key, Math.max(seen.get(key) ?? 0, s.staffing.target));
  }
  // Each (shiftKey × dayKey) occurs once per week × totalWeeks
  let total = 0;
  for (const target of seen.values()) {
    total += target * totalWeeks;
  }
  return total;
}

// ─── DoctorPreference ─────────────────────────────────────────

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
  parentalLeaveDates: string[];
  parentalLeaveNotes?: string;
  exemptFromNights: boolean;
  exemptFromWeekends: boolean;
  exemptFromOncall: boolean;
  additionalNotes: string;
}

// ─── FinalRotaInput ───────────────────────────────────────────

export interface FinalRotaInput {
  preRotaInput: PreRotaInput;
  doctors: Array<{
    doctorId: string;
    name: string;
    grade: string;
    wtePct: number;
    contractedHoursPerWeek: number;
    // Competency flags — read from survey, used for slot eligibility
    hasIac: boolean;
    hasIaoc: boolean;
    hasIcu: boolean;
    hasTransfer: boolean;
    ltft: {
      isLtft: boolean;
      daysOff: string[];
      nightFlexibility: DoctorPreference["ltftNightFlexibility"];
    };
    constraints: {
      hard: {
        annualLeaveDates: string[];
        studyLeaveDates: string[];
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
    shiftTargets: any[]; // computed by computeShiftTargets
    totalMaxHours: number;
    weekendCap: number;
    hardWeeklyCap: number;
  }>;
  constraints: {
    hard: string[];
    soft: string[];
  };
}

// ─── DoctorSurveyResponse ─────────────────────────────────────

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
  parental_leave_expected: boolean | null;
  parental_leave_start: string | null;
  parental_leave_end: string | null;
  parental_leave_notes: string | null;
  competencies_json: Record<string, any> | null;
  comp_ip_anaesthesia: boolean | null;
  comp_obstetric: boolean | null;
  comp_icu: boolean | null;
}

// ─── getSurveyResponsesForConfig ─────────────────────────────

export async function getSurveyResponsesForConfig(configId: string): Promise<DoctorSurveyResponse[]> {
  const { data, error } = await supabase
    .from("doctor_survey_responses")
    .select("*, doctors!inner(is_active)")
    .eq("rota_config_id", configId)
    .eq("doctors.is_active", true);

  if (error) {
    console.error("Failed to fetch survey responses:", error);
    return [];
  }
  return (data ?? []) as DoctorSurveyResponse[];
}

// ─── expandDateRange ──────────────────────────────────────────

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

// ─── mapResponseToPreference ──────────────────────────────────

function mapResponseToPreference(resp: DoctorSurveyResponse): DoctorPreference {
  const annualLeave = Array.isArray(resp.annual_leave) ? resp.annual_leave : [];
  const studyLeave = Array.isArray(resp.study_leave) ? resp.study_leave : [];

  const nocDates = Array.isArray(resp.noc_dates)
    ? resp.noc_dates.flatMap((n: any) => {
        if (typeof n === "string") return [n];
        const start = n?.startDate ?? n?.start_date ?? n?.date ?? "";
        const end = n?.endDate ?? n?.end_date ?? n?.date ?? "";
        if (!start) return [];
        if (!end || end === start) return [start];
        return expandDateRange(start, end);
      })
    : [];

  const ltftNightFlex = Array.isArray(resp.ltft_night_flexibility) ? resp.ltft_night_flexibility : [];

  const parentalLeaveDates: string[] = (() => {
    if (!resp.parental_leave_expected) return [];
    const start = resp.parental_leave_start;
    const end = resp.parental_leave_end;
    if (!start) return [];
    if (!end || end === start) return [start];
    return expandDateRange(start, end);
  })();

  return {
    doctorId: resp.doctor_id,
    name: resp.full_name ?? "",
    grade: resp.grade ?? "",
    wtePct: resp.wte_percent ?? 100,
    ltftDaysOff: (resp.ltft_days_off ?? []).map((d: string) => d.toLowerCase()),
    ltftNightFlexibility: ltftNightFlex.map((f: any) => ({
      ...f,
      day: (f.day ?? "").toLowerCase(),
    })),
    maxConsecNights: 0, // replaced in buildFinalRotaInput with WTR value
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
    parentalLeaveNotes: resp.parental_leave_notes ?? undefined,
    exemptFromNights: resp.exempt_from_nights ?? false,
    exemptFromWeekends: resp.exempt_from_weekends ?? false,
    exemptFromOncall: resp.exempt_from_oncall ?? false,
    additionalNotes: [resp.other_requests, resp.additional_restrictions].filter(Boolean).join("\n"),
  };
}

// ─── buildFinalRotaInput ──────────────────────────────────────

export async function buildFinalRotaInput(configId: string): Promise<FinalRotaInput> {
  const preRotaInput = await buildPreRotaInput(configId);
  const cfg = await getRotaConfig(configId);
  const totalWeeks = preRotaInput.period.totalWeeks || 1;

  const maxConsecNights = cfg.wtr?.maxConsecNights ?? 4;

  const responses = await getSurveyResponsesForConfig(configId);
  const submittedResponses = responses.filter((r) => r.status === "submitted");

  const doctors = submittedResponses.map((r) => {
    const pref = mapResponseToPreference(r);
    pref.maxConsecNights = maxConsecNights;
    return pref;
  });

  // ── Total slot counts for fairness target computation ──
  // Uses the new per-day shape — counts (dayKey × shiftKey) pairs × totalWeeks
  const totalNightSlots = countTotalSlots(preRotaInput.shiftSlots, (s) => s.badges.includes("night"), totalWeeks);
  const totalWeekendSlots = countTotalSlots(
    preRotaInput.shiftSlots,
    (s) => s.dayKey === "sat" || s.dayKey === "sun",
    totalWeeks,
  );
  const totalOncallSlots = countTotalSlots(preRotaInput.shiftSlots, (s) => s.isOncall, totalWeeks);

  const doctorCount = doctors.length || 1;

  // ── Shift targets for distribution ──
  const shiftTargetShifts = cfg.shifts.map((s) => ({
    id: s.id,
    name: s.name,
    shiftKey: s.shiftKey,
    isOncall: s.isOncall,
    targetPercentage: s.targetPercentage ?? 0,
    durationHours: s.durationHours,
  }));

  // ── Per-doctor targets ──
  const doctorTargets = doctors.map((doc) => {
    const resp = submittedResponses.find((r) => r.doctor_id === doc.doctorId);
    const compJson = resp?.competencies_json ?? {};

    const targets = cfg.wtr
      ? computeShiftTargets({
          maxHoursPerWeek: cfg.wtr.maxHoursPerWeek,
          maxHoursPer168h: cfg.wtr.maxHoursPer168h,
          rotaWeeks: totalWeeks,
          globalOncallPct: cfg.distribution.globalOncallPct,
          globalNonOncallPct: cfg.distribution.globalNonOncallPct,
          shiftTypes: shiftTargetShifts,
          wtePercent: doc.wtePct,
        })
      : null;

    const weekendCap = cfg.wtr
      ? computeWeekendCap({
          rotaWeeks: totalWeeks,
          weekendFrequency: cfg.wtr.weekendFrequency,
          wtePercent: doc.wtePct,
        })
      : null;

    return {
      doctorId: doc.doctorId,
      shiftTargets: targets?.targets ?? [],
      totalMaxHours: targets?.totalMaxTargetHours ?? 0,
      weekendCap: weekendCap?.maxWeekends ?? 0,
      hardWeeklyCap: targets?.hardWeeklyCap ?? 72,
      hasIac: compJson?.iac?.achieved === true,
      hasIaoc: compJson?.iaoc?.achieved === true,
      hasIcu: compJson?.icu?.achieved === true,
      hasTransfer: compJson?.transfer?.achieved === true,
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
        hasIac: dt?.hasIac ?? false,
        hasIaoc: dt?.hasIaoc ?? false,
        hasIcu: dt?.hasIcu ?? false,
        hasTransfer: dt?.hasTransfer ?? false,
        ltft: {
          isLtft: doc.wtePct < 100,
          daysOff: doc.ltftDaysOff,
          nightFlexibility: doc.ltftNightFlexibility,
        },
        constraints: {
          hard: {
            annualLeaveDates,
            studyLeaveDates,
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
          targetTotalHours: (doc.wtePct / 100) * 40 * totalWeeks,
          targetNightShiftCount: Math.round((totalNightSlots / doctorCount) * proportion),
          targetWeekendShiftCount: Math.round((totalWeekendSlots / doctorCount) * proportion),
          targetOncallCount: Math.round((totalOncallSlots / doctorCount) * proportion),
          proportionFactor: proportion,
        },
        shiftTargets: dt?.shiftTargets ?? [],
        totalMaxHours: dt?.totalMaxHours ?? 0,
        weekendCap: dt?.weekendCap ?? 0,
        hardWeeklyCap: dt?.hardWeeklyCap ?? 72,
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
        "PARENTAL_LEAVE_DATES_BLOCKED",
        "LTFT_DAYS_BLOCKED",
        "NIGHT_EXEMPTIONS_RESPECTED",
        "WEEKEND_EXEMPTIONS_RESPECTED",
        "ONCALL_EXEMPTIONS_RESPECTED",
        "MIN_STAFFING_MET_ALL_SHIFTS",
        "ONCALL_MAX_PER_7_DAYS",
        "ONCALL_DAY_AFTER_MAX_HOURS",
        "NO_SIMULTANEOUS_ONCALL_AND_SHIFT",
        "SLOT_ELIGIBILITY_MET",
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

// ─── validateFinalRotaInput ───────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  blockers: string[];
}

export async function validateFinalRotaInput(configId: string): Promise<ValidationResult> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const responses = await getSurveyResponsesForConfig(configId);

  if (responses.length === 0) {
    blockers.push("No doctors have any survey responses. Cannot generate rota.");
  }

  const submitted = responses.filter((r) => r.status === "submitted");
  if (submitted.length === 0) {
    blockers.push("No submitted survey responses found. All doctors must complete surveys before generating.");
  }

  const unsubmitted = responses.filter((r) => r.status !== "submitted");
  if (unsubmitted.length > 0) {
    warnings.push(`${unsubmitted.length} doctor(s) have not submitted their survey.`);
  }

  return {
    isValid: blockers.length === 0,
    warnings,
    blockers,
  };
}
