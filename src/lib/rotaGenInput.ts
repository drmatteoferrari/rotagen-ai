import { getRotaConfig, type RotaConfig } from "./rotaConfig";

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

export async function buildFinalRotaInput(
  configId: string,
  doctors: DoctorPreference[],
): Promise<FinalRotaInput> {
  const preRotaInput = await buildPreRotaInput(configId);
  const totalWeeks = preRotaInput.period.totalWeeks || 1;

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

  return {
    preRotaInput,
    doctors: doctors.map((doc) => {
      const proportion = doc.wtePct / 100;
      const annualLeaveDates = doc.annualLeave.flatMap((l) => expandDateRange(l.startDate, l.endDate));
      const studyLeaveDates = doc.studyLeave.flatMap((l) => expandDateRange(l.startDate, l.endDate));

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
