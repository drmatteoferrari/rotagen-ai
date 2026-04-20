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
        rotationDates: string[];           // expanded from unavailability_blocks reason='rotation'
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
    shiftTargets: DoctorShiftTarget[];
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
  // Flat competency columns — written by handle_survey_normalization on submit
  // These are the canonical source; competencies_json is the fallback only
  iac_achieved: boolean | null;
  iaoc_achieved: boolean | null;
  icu_achieved: boolean | null;
  transfer_achieved: boolean | null;
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
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const d = new Date(Date.UTC(sy, sm - 1, sd));
  const e = new Date(Date.UTC(ey, em - 1, ed));
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
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
  // ── 1. Parallel fetches — zero sequential round trips ──────────────
  const [preRotaInput, cfg, responsesRaw, preRotaRow, blocksRaw, ltftRaw] = await Promise.all([
    buildPreRotaInput(configId),
    getRotaConfig(configId),
    getSurveyResponsesForConfig(configId),
    supabase
      .from('pre_rota_results')
      .select('targets_data, status')
      .eq('rota_config_id', configId)
      .maybeSingle(),
    supabase
      .from('unavailability_blocks')
      .select('doctor_id, reason, start_date, end_date, location')
      .eq('rota_config_id', configId),
    supabase
      .from('ltft_patterns')
      .select('doctor_id, day, is_day_off, can_start_nights, can_end_nights')
      .eq('rota_config_id', configId)
      .eq('is_day_off', true),
  ]);

  const totalWeeks = preRotaInput.period.totalWeeks || 1;
  const maxConsecNights = cfg.wtr?.maxConsecNights ?? 4;
  const maxHoursPerWeek = cfg.wtr?.maxHoursPerWeek ?? 48;

  // ── 2. Submitted survey responses only ────────────────────────────
  const submittedResponses = responsesRaw.filter((r) => r.status === 'submitted');

  // ── 3. Read leave-adjusted, override-aware targets from pre_rota_results ──
  // pre_rota_results.targets_data is rebuilt by refreshPreRotaTargets on every
  // coordinator override — it is always current. Fall back to empty map if
  // pre-rota has not been generated yet (validateFinalRotaInput blocks this).
  const targetsData = (preRotaRow.data?.targets_data as unknown as TargetsData) ?? null;
  const doctorTargetsMap = new Map<string, DoctorShiftTarget[]>();
  const doctorMetaMap = new Map<string, {
    totalMaxHours: number;
    weekendCap: number;
    hardWeeklyCap: number;
    contractedHoursPerWeek: number;
  }>();

  if (targetsData?.doctors?.length) {
    for (const dt of targetsData.doctors) {
      doctorTargetsMap.set(dt.doctorId, dt.shiftTargets);
      doctorMetaMap.set(dt.doctorId, {
        totalMaxHours: dt.totalMaxHours,
        weekendCap: dt.weekendCap,
        hardWeeklyCap: dt.hardWeeklyCap,
        contractedHoursPerWeek: dt.contractedHoursPerWeek,
      });
    }
  }

  // ── 4. Group relational tables by doctor_id ───────────────────────
  const blocksByDoctor = new Map<string, NonNullable<typeof blocksRaw.data>>();
  for (const b of blocksRaw.data ?? []) {
    const arr = blocksByDoctor.get(b.doctor_id) ?? [];
    arr.push(b);
    blocksByDoctor.set(b.doctor_id, arr);
  }

  const ltftByDoctor = new Map<string, NonNullable<typeof ltftRaw.data>>();
  for (const l of ltftRaw.data ?? []) {
    const arr = ltftByDoctor.get(l.doctor_id) ?? [];
    arr.push(l);
    ltftByDoctor.set(l.doctor_id, arr);
  }

  // ── 5. Slot counts for fairness target estimates ──────────────────
  const totalNightSlots = countTotalSlots(
    preRotaInput.shiftSlots, (s) => s.badges.includes('night'), totalWeeks,
  );
  const totalWeekendSlots = countTotalSlots(
    preRotaInput.shiftSlots, (s) => s.dayKey === 'sat' || s.dayKey === 'sun', totalWeeks,
  );
  const totalOncallSlots = countTotalSlots(
    preRotaInput.shiftSlots, (s) => s.isOncall, totalWeeks,
  );
  const doctorCount = submittedResponses.length || 1;

  // ── 6. Build per-doctor entries ───────────────────────────────────
  const doctors = submittedResponses.map((resp) => {
    const doctorId = resp.doctor_id;
    const proportion = (resp.wte_percent ?? 100) / 100;
    const wtePct = resp.wte_percent ?? 100;

    const blocks = blocksByDoctor.get(doctorId) ?? [];
    const ltftRows = ltftByDoctor.get(doctorId) ?? [];

    // ── Leave: read from relational tables (canonical post-normalisation source)
    // Fall back to JSONB for doctors whose surveys haven't been normalised yet.
    const hasNormalized = blocks.length > 0 || ltftRows.length > 0 || resp.status === 'submitted';

    const annualLeaveDates = hasNormalized
      ? blocks
          .filter((b) => b.reason === 'annual')
          .flatMap((b) => expandDateRange(b.start_date, b.end_date))
      : (Array.isArray(resp.annual_leave) ? resp.annual_leave as any[] : [])
          .flatMap((l: any) => expandDateRange(l.startDate ?? l.start_date ?? '', l.endDate ?? l.end_date ?? ''));

    const studyLeaveDates = hasNormalized
      ? blocks
          .filter((b) => b.reason === 'study')
          .flatMap((b) => expandDateRange(b.start_date, b.end_date))
      : (Array.isArray(resp.study_leave) ? resp.study_leave as any[] : [])
          .flatMap((l: any) => expandDateRange(l.startDate ?? l.start_date ?? '', l.endDate ?? l.end_date ?? ''));

    const parentalBlock = blocks.find((b) => b.reason === 'parental');
    const parentalLeaveDates = hasNormalized
      ? (parentalBlock ? expandDateRange(parentalBlock.start_date, parentalBlock.end_date) : [])
      : (() => {
          if (!resp.parental_leave_expected || !resp.parental_leave_start) return [];
          return expandDateRange(resp.parental_leave_start, resp.parental_leave_end ?? resp.parental_leave_start);
        })();

    const rotationDates = hasNormalized
      ? blocks
          .filter((b) => b.reason === 'rotation')
          .flatMap((b) => expandDateRange(b.start_date, b.end_date))
      : (Array.isArray((resp as any).other_unavailability) ? (resp as any).other_unavailability as any[] : [])
          .flatMap((l: any) => expandDateRange(l.startDate ?? l.start_date ?? '', l.endDate ?? l.end_date ?? ''));

    const nocDates = hasNormalized
      ? blocks
          .filter((b) => b.reason === 'noc')
          .flatMap((b) => expandDateRange(b.start_date, b.end_date))
      : (Array.isArray(resp.noc_dates) ? resp.noc_dates as any[] : [])
          .flatMap((n: any) => {
            if (typeof n === 'string') return [n];
            const start = n?.startDate ?? n?.start_date ?? n?.date ?? '';
            const end = n?.endDate ?? n?.end_date ?? n?.date ?? '';
            if (!start) return [];
            return expandDateRange(start, end || start);
          });

    // ── LTFT: read from ltft_patterns (canonical) with JSONB fallback ──
    const ltftDaysOff = hasNormalized
      ? ltftRows.map((l) => l.day as string)
      : ((resp.ltft_days_off ?? []) as string[]).map((d: string) => d.toLowerCase());

    const ltftNightFlexibility = hasNormalized
      ? ltftRows.map((l) => ({
          day: l.day as string,
          canStartNightsOnDay: (l.can_start_nights ?? false) as boolean,
          canEndNightsOnDay: (l.can_end_nights ?? false) as boolean,
        }))
      : (Array.isArray(resp.ltft_night_flexibility) ? resp.ltft_night_flexibility as any[] : [])
          .map((f: any) => ({
            day: (f.day ?? '').toLowerCase(),
            canStartNightsOnDay: f.canStartNightsOnDay ?? f.canStart ?? false,
            canEndNightsOnDay: f.canEndNightsOnDay ?? f.canEnd ?? false,
          }));

    // ── Competency flags: flat columns first, JSONB fallback ──────────
    // Flat columns written by handle_survey_normalization on submission.
    const hasFlat =
      resp.iac_achieved != null ||
      resp.iaoc_achieved != null ||
      resp.icu_achieved != null ||
      resp.transfer_achieved != null;

    const compJson = (resp.competencies_json ?? {}) as Record<string, any>;
    const hasIac     = hasFlat ? (resp.iac_achieved ?? false)     : (compJson?.iac?.achieved === true);
    const hasIaoc    = hasFlat ? (resp.iaoc_achieved ?? false)    : (compJson?.iaoc?.achieved === true);
    const hasIcu     = hasFlat ? (resp.icu_achieved ?? false)     : (compJson?.icu?.achieved === true);
    const hasTransfer = hasFlat ? (resp.transfer_achieved ?? false) : (compJson?.transfer?.achieved === true);

    // ── Per-doctor shift targets from pre_rota_results.targets_data ──
    // These are leave-adjusted and coordinator-override-aware.
    // Fall back to zero-target sentinel values if pre-rota not yet generated
    // (validateFinalRotaInput will have blocked generation before this point).
    const meta = doctorMetaMap.get(doctorId);
    const shiftTargets: DoctorShiftTarget[] = doctorTargetsMap.get(doctorId) ?? [];
    const totalMaxHours = meta?.totalMaxHours ?? 0;
    const weekendCap = meta?.weekendCap ?? 0;
    const hardWeeklyCap = meta?.hardWeeklyCap ?? cfg.wtr?.maxHoursPer168h ?? 72;
    const contractedHoursPerWeek = meta?.contractedHoursPerWeek ?? (proportion * maxHoursPerWeek);

    return {
      doctorId,
      name: resp.full_name ?? '',
      grade: resp.grade ?? '',
      wtePct,
      contractedHoursPerWeek,
      hasIac,
      hasIaoc,
      hasIcu,
      hasTransfer,
      ltft: {
        isLtft: ltftDaysOff.length > 0,          // Bug 9 fix: was wtePct < 100
        daysOff: ltftDaysOff,
        nightFlexibility: ltftNightFlexibility,
      },
      constraints: {
        hard: {
          annualLeaveDates,
          studyLeaveDates,
          parentalLeaveDates,
          rotationDates,                           // Bug 4 fix: was missing entirely
          exemptFromNights: resp.exempt_from_nights ?? false,
          exemptFromWeekends: resp.exempt_from_weekends ?? false,
          exemptFromOncall: resp.exempt_from_oncall ?? false,
          ltftDaysBlocked: ltftDaysOff,
        },
        soft: {
          nocDates,
          maxConsecNights,
          additionalNotes: [resp.other_requests, resp.additional_restrictions]
            .filter(Boolean).join('\n'),
        },
      },
      fairnessTargets: {
        targetTotalHours: totalMaxHours,           // Bug 3 fix: was (wtePct/100)*40*weeks
        targetNightShiftCount: Math.round((totalNightSlots / doctorCount) * proportion),
        targetWeekendShiftCount: Math.round((totalWeekendSlots / doctorCount) * proportion),
        targetOncallCount: Math.round((totalOncallSlots / doctorCount) * proportion),
        proportionFactor: proportion,
      },
      shiftTargets,
      totalMaxHours,
      weekendCap,
      hardWeeklyCap,
    };
  });

  return {
    preRotaInput,
    doctors,
    constraints: {
      hard: [
        'WTR_MAX_HOURS_PER_WEEK', 'WTR_MAX_HOURS_PER_168H',
        'WTR_MIN_REST_AFTER_NIGHTS', 'WTR_MIN_REST_AFTER_LONG_SHIFTS',
        'WTR_MIN_REST_AFTER_STANDARD_SHIFTS', 'WTR_MAX_CONSEC_NIGHTS',
        'WTR_MAX_CONSEC_LONG', 'WTR_MAX_CONSEC_STANDARD',
        'ANNUAL_LEAVE_DATES_BLOCKED', 'STUDY_LEAVE_DATES_BLOCKED',
        'PARENTAL_LEAVE_DATES_BLOCKED', 'ROTATION_DATES_BLOCKED',
        'LTFT_DAYS_BLOCKED', 'NIGHT_EXEMPTIONS_RESPECTED',
        'WEEKEND_EXEMPTIONS_RESPECTED', 'ONCALL_EXEMPTIONS_RESPECTED',
        'MIN_STAFFING_MET_ALL_SHIFTS', 'ONCALL_MAX_PER_7_DAYS',
        'ONCALL_DAY_AFTER_MAX_HOURS', 'NO_SIMULTANEOUS_ONCALL_AND_SHIFT',
        'SLOT_ELIGIBILITY_MET', 'WEEKEND_CAP_RESPECTED',
      ],
      soft: [
        'SOFT_NOC_DATES_RESPECTED', 'SOFT_MAX_CONSEC_NIGHTS_PREFERENCE',
        'SOFT_WEEKEND_FREQUENCY_TARGET', 'SOFT_FAIR_NIGHT_DISTRIBUTION',
        'SOFT_FAIR_WEEKEND_DISTRIBUTION', 'SOFT_FAIR_ONCALL_DISTRIBUTION',
        'SOFT_FAIR_LONG_DAY_DISTRIBUTION', 'SOFT_LTFT_NIGHT_FLEXIBILITY',
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
