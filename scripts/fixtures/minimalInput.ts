// scripts/fixtures/minimalInput.ts
// Smallest useful FinalRotaInput fixture:
//   3 doctors × 4 weeks × 3 shift types (Night / Long Day / Short Day)
//   21 shift-slot entries (3 shifts × 7 days)
// Exercised by scripts/testAlgorithm.ts after every algorithm stage.

import type { FinalRotaInput, ShiftSlotEntry } from '../../src/lib/rotaGenInput';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const DEFAULT_SLOT = {
  slotIndex: 0,
  label: null,
  permittedGrades: [] as string[],
  reqIac: 0,
  reqIaoc: 0,
  reqIcu: 0,
  reqTransfer: 0,
};

type ShiftTemplate = {
  shiftId: string;
  shiftKey: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  badges: string[];
  targetPct: number;
};

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  {
    shiftId: 'st-night',
    shiftKey: 'night',
    name: 'Night',
    startTime: '19:00',
    endTime: '08:00',
    durationHours: 13,
    badges: ['night'],
    targetPct: 30,
  },
  {
    shiftId: 'st-longday',
    shiftKey: 'long-day',
    name: 'Long Day',
    startTime: '07:30',
    endTime: '20:00',
    durationHours: 12.5,
    badges: ['long'],
    targetPct: 40,
  },
  {
    shiftId: 'st-shortday',
    shiftKey: 'short-day',
    name: 'Short Day',
    startTime: '08:00',
    endTime: '17:00',
    durationHours: 9,
    badges: [],
    targetPct: 30,
  },
];

function buildShiftSlots(): ShiftSlotEntry[] {
  const out: ShiftSlotEntry[] = [];
  for (const t of SHIFT_TEMPLATES) {
    for (const dayKey of DAY_KEYS) {
      out.push({
        shiftId: t.shiftId,
        shiftKey: t.shiftKey,
        name: t.name,
        dayKey,
        startTime: t.startTime,
        endTime: t.endTime,
        durationHours: t.durationHours,
        isOncall: false,
        isNonResOncall: false,
        badges: [...t.badges],
        staffing: { min: 1, target: 1, max: 2 },
        slots: [{ ...DEFAULT_SLOT, permittedGrades: [...DEFAULT_SLOT.permittedGrades] }],
        targetPct: t.targetPct,
      });
    }
  }
  return out;
}

// 4-week WTR-feasible targets.
// FT: 52 + 75 + 45 = 172h over 4 weeks = 43h/week (under 48h WTR avg cap).
// Per-shift ceilings = estimatedShiftCount × durationHours:
//   4 × 13 = 52, 6 × 12.5 = 75, 5 × 9 = 45.
const SHIFT_TARGETS_FT = [
  {
    shiftTypeId: 'st-night',
    shiftName: 'Night',
    shiftKey: 'night',
    isOncall: false,
    maxTargetHours: 52,
    estimatedShiftCount: 4,
  },
  {
    shiftTypeId: 'st-longday',
    shiftName: 'Long Day',
    shiftKey: 'long-day',
    isOncall: false,
    maxTargetHours: 75,
    estimatedShiftCount: 6,
  },
  {
    shiftTypeId: 'st-shortday',
    shiftName: 'Short Day',
    shiftKey: 'short-day',
    isOncall: false,
    maxTargetHours: 45,
    estimatedShiftCount: 5,
  },
];

// D3 is 0.8 WTE. 39 + 62.5 + 36 = 137.5h over 4 weeks = 34.4h/week.
// Per-shift ceilings = estimatedShiftCount × durationHours:
//   3 × 13 = 39, 5 × 12.5 = 62.5, 4 × 9 = 36.
const SHIFT_TARGETS_D3 = [
  {
    shiftTypeId: 'st-night',
    shiftName: 'Night',
    shiftKey: 'night',
    isOncall: false,
    maxTargetHours: 39,
    estimatedShiftCount: 3,
  },
  {
    shiftTypeId: 'st-longday',
    shiftName: 'Long Day',
    shiftKey: 'long-day',
    isOncall: false,
    maxTargetHours: 62.5,
    estimatedShiftCount: 5,
  },
  {
    shiftTypeId: 'st-shortday',
    shiftName: 'Short Day',
    shiftKey: 'short-day',
    isOncall: false,
    maxTargetHours: 36,
    estimatedShiftCount: 4,
  },
];

const emptyHard = () => ({
  annualLeaveDates: [] as string[],
  studyLeaveDates: [] as string[],
  parentalLeaveDates: [] as string[],
  rotationDates: [] as string[],
  exemptFromNights: false,
  exemptFromWeekends: false,
  exemptFromOncall: false,
  ltftDaysBlocked: [] as string[],
});

const emptySoft = () => ({
  nocDates: [] as string[],
  maxConsecNights: 4,
  additionalNotes: '',
});

export const minimalInput: FinalRotaInput = {
  preRotaInput: {
    configId: 'test-config-minimal',
    period: {
      startDate: '2026-05-04',
      endDate: '2026-05-31',
      totalDays: 28,
      totalWeeks: 4,
      bankHolidayDates: [],
      bhSameAsWeekend: false,
      bhShiftRules: null,
    },
    shiftSlots: buildShiftSlots(),
    wtrConstraints: {
      maxAvgHoursPerWeek: 48,
      maxHoursIn168h: 72,
      maxShiftLengthH: 13,
      minInterShiftRestH: 11,
      maxConsecutive: { standard: 7, long: 4, nights: 4, longEvening: 4 },
      minRestHoursAfter: {
        nights: 46,
        longShifts: 48,
        standardShifts: 48,
        longEveningShifts: 48,
      },
      weekendFrequencyMax: 3,
      oncall: {
        maxPer7Days: 3,
        localAgreementMaxConsec: 7,
        dayAfterMaxHours: 10,
        restPer24hHours: 8,
        continuousRestHours: 5,
        continuousRestStart: '22:00',
        continuousRestEnd: '07:00',
        ifRestNotMetNextDayMaxHours: 5,
        noSimultaneousShift: true,
        noConsecExceptWknd: true,
        dayAfterLastConsecMaxH: 10,
      },
    },
    distributionTargets: {
      globalOncallPct: 0,
      globalNonOncallPct: 100,
      byShift: [
        { shiftKey: 'night', targetPct: 30, isOncall: false },
        { shiftKey: 'long-day', targetPct: 40, isOncall: false },
        { shiftKey: 'short-day', targetPct: 30, isOncall: false },
      ],
    },
  },
  doctors: [
    {
      doctorId: 'doc-1',
      name: 'Dr Alice Smith',
      grade: 'Consultant',
      wtePct: 100,
      contractedHoursPerWeek: 48,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: { hard: emptyHard(), soft: emptySoft() },
      fairnessTargets: {
        targetTotalHours: 172,
        targetNightShiftCount: 4,
        targetWeekendShiftCount: 3,
        targetOncallCount: 0,
        proportionFactor: 1.0,
      },
      shiftTargets: SHIFT_TARGETS_FT,
      totalMaxHours: 172,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-2',
      name: 'Dr Bob Jones',
      grade: 'SpR',
      wtePct: 100,
      contractedHoursPerWeek: 48,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: { hard: emptyHard(), soft: emptySoft() },
      fairnessTargets: {
        targetTotalHours: 172,
        targetNightShiftCount: 4,
        targetWeekendShiftCount: 3,
        targetOncallCount: 0,
        proportionFactor: 1.0,
      },
      shiftTargets: SHIFT_TARGETS_FT,
      totalMaxHours: 172,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-3',
      name: 'Dr Carol Lee',
      grade: 'SpR',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: { isLtft: true, daysOff: ['monday'], nightFlexibility: [] },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['monday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 137.5,
        targetNightShiftCount: 3,
        targetWeekendShiftCount: 2,
        targetOncallCount: 0,
        proportionFactor: 0.8,
      },
      shiftTargets: SHIFT_TARGETS_D3,
      totalMaxHours: 137.5,
      weekendCap: 3,
      hardWeeklyCap: 72,
    },
  ],
  constraints: {
    hard: [],
    soft: [],
  },
};

// Variant used by Stage 3d's V1-guard violating test. Clones minimalInput
// and overrides doc-1 with a deliberately small non-on-call floor plus
// enough weekday AL dates that the §5.2 leave deduction pushes the
// non-on-call bucket below zero:
//   standardDayHours = 48 / 5 = 9.6h
//   6 weekdays × 9.6h = 57.6h deducted from a 50h floor → -7.6h
// 50h is not a realistic 4-week target — the variant exists solely to
// exercise the V1 guard and is not reused elsewhere. fairnessTargets
// and the sole shiftTargets entry are kept in lockstep with totalMaxHours
// so the fixture is internally consistent for later stages.
export const minimalInputWithOverdeductedLeave: FinalRotaInput = {
  ...minimalInput,
  doctors: [
    {
      ...minimalInput.doctors[0],
      shiftTargets: [
        {
          shiftTypeId: 'st-shortday',
          shiftName: 'Short Day',
          shiftKey: 'short-day',
          isOncall: false,
          maxTargetHours: 50,
          estimatedShiftCount: 5,
        },
      ],
      totalMaxHours: 50,
      fairnessTargets: {
        ...minimalInput.doctors[0].fairnessTargets,
        targetTotalHours: 50,
      },
      constraints: {
        hard: {
          ...emptyHard(),
          annualLeaveDates: [
            '2026-05-04', '2026-05-05', '2026-05-06',
            '2026-05-07', '2026-05-08', '2026-05-11',
          ],
        },
        soft: emptySoft(),
      },
    },
    ...minimalInput.doctors.slice(1),
  ],
};

// Variant used by Stage 3d's V2-guard test. Appends a single on-call
// shift slot with no competency requirements and no grade restriction so
// `collectZeroCompetencyWarnings` emits exactly one warning. All other
// fields mirror minimalInput — no doctor changes are needed because the
// V2 guard inspects shiftSlots only.
const ON_CALL_UNCONSTRAINED_ENTRY: ShiftSlotEntry = {
  shiftId: 'st-oncall',
  shiftKey: 'oncall',
  name: 'Resident On-Call',
  dayKey: 'sat',
  startTime: '08:00',
  endTime: '20:00',
  durationHours: 12,
  isOncall: true,
  isNonResOncall: false,
  badges: ['oncall'],
  staffing: { min: 1, target: 1, max: 1 },
  slots: [
    {
      slotIndex: 0,
      label: null,
      permittedGrades: [],
      reqIac: 0,
      reqIaoc: 0,
      reqIcu: 0,
      reqTransfer: 0,
    },
  ],
  targetPct: 0,
};

export const minimalInputWithOncallSlot: FinalRotaInput = {
  ...minimalInput,
  preRotaInput: {
    ...minimalInput.preRotaInput,
    shiftSlots: [
      ...minimalInput.preRotaInput.shiftSlots,
      ON_CALL_UNCONSTRAINED_ENTRY,
    ],
  },
};

// Variant used by Stage 3e's NROC (A14–A18) tests. Appends one
// non-resident on-call shift type so Check Sequence A has an
// isNonResOncall = true slot to evaluate. 12h duration keeps it below
// wtrConstraints.maxShiftLengthH (13h) so A12's NROC-exempt branch is
// unambiguously the reason lengths > 13h still pass under NROC.
// Duration deliberately exceeds both oncall.dayAfterMaxHours (10h) and
// oncall.dayAfterLastConsecMaxH (10h) so it can double as the
// "day-after-NROC" probe if needed; the A16/A17 tests instead use the
// existing 12.5h Long Day for that purpose.
export const NROC_SHIFT_ENTRY: ShiftSlotEntry = {
  shiftId: 'st-nroc',
  shiftKey: 'nroc',
  name: 'Non-Resident On-Call',
  dayKey: 'sat',
  startTime: '17:00',
  endTime: '05:00',
  durationHours: 12,
  isOncall: true,
  isNonResOncall: true,
  badges: ['oncall', 'nonres'],
  staffing: { min: 1, target: 1, max: 1 },
  slots: [
    {
      slotIndex: 0,
      label: null,
      permittedGrades: [],
      reqIac: 0,
      reqIaoc: 0,
      reqIcu: 0,
      reqTransfer: 0,
    },
  ],
  targetPct: 0,
};

export const minimalInputWithNroc: FinalRotaInput = {
  ...minimalInput,
  preRotaInput: {
    ...minimalInput.preRotaInput,
    shiftSlots: [
      ...minimalInput.preRotaInput.shiftSlots,
      NROC_SHIFT_ENTRY,
    ],
  },
};

// ──────────────────────────────────────────────────────────────────
// Stage 3g.2b.1 — Weekend night-block sub-pass fixtures.
// One on-call night shift type across Fri/Sat/Sun for every week in
// the rota period. Three doctors: one full-time, two LTFT with
// blocking day-offs that exercise the Pass 1 → Pass 2 → Relaxation
// cascade.
// ──────────────────────────────────────────────────────────────────

// Day keys covered by the weekend-night fixture. Mon and Tue are
// included so the 3N_SUN_TUE bridge has landing slots; they are
// otherwise treated as pure bridge-support positions (unlike Fri/Sat/
// Sun these are NOT primary weekend targets).
const WEEKEND_NIGHT_DAY_KEYS = ['fri', 'sat', 'sun', 'mon', 'tue'] as const;

function buildWeekendNightSlots(): ShiftSlotEntry[] {
  const out: ShiftSlotEntry[] = [];
  for (const dayKey of WEEKEND_NIGHT_DAY_KEYS) {
    out.push({
      shiftId: 'st-wn-night',
      shiftKey: 'night',
      name: 'On-Call Night',
      dayKey,
      startTime: '19:00',
      endTime: '08:00',
      durationHours: 13,
      isOncall: true,
      isNonResOncall: false,
      badges: ['night', 'oncall'],
      staffing: { min: 1, target: 1, max: 1 },
      slots: [{ ...DEFAULT_SLOT, permittedGrades: [...DEFAULT_SLOT.permittedGrades] }],
      targetPct: 100,
    });
  }
  return out;
}

// Weekend-night variant: 4-week period (2026-05-04 Mon → 2026-05-31 Sun,
// 4 Saturdays: 05-09, 05-16, 05-23, 05-30). D1 is full-time, D2 and D3
// are LTFT with blocking day-offs (D2 Monday, D3 Friday). targetTotal/
// targetNight mirror the scale of the base minimalInput fairness
// targets; per-shift maxTargetHours kept ≥ 4 × 13h so D33 doesn't fire
// before the sub-pass Monte Carlo logic is exercised.
const WEEKEND_SHIFT_TARGETS_FT = [
  {
    shiftTypeId: 'st-wn-night',
    shiftName: 'On-Call Night',
    shiftKey: 'night',
    isOncall: true,
    maxTargetHours: 156,
    estimatedShiftCount: 12,
  },
];

const WEEKEND_SHIFT_TARGETS_LTFT = [
  {
    shiftTypeId: 'st-wn-night',
    shiftName: 'On-Call Night',
    shiftKey: 'night',
    isOncall: true,
    maxTargetHours: 117,
    estimatedShiftCount: 9,
  },
];

export const minimalInputWeekendNights: FinalRotaInput = {
  preRotaInput: {
    ...minimalInput.preRotaInput,
    shiftSlots: buildWeekendNightSlots(),
    distributionTargets: {
      globalOncallPct: 100,
      globalNonOncallPct: 0,
      byShift: [{ shiftKey: 'night', targetPct: 100, isOncall: true }],
    },
  },
  doctors: [
    {
      doctorId: 'doc-1',
      name: 'Dr Alice Smith',
      grade: 'Consultant',
      wtePct: 100,
      contractedHoursPerWeek: 48,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: { hard: emptyHard(), soft: emptySoft() },
      fairnessTargets: {
        targetTotalHours: 120,
        targetNightShiftCount: 4,
        targetWeekendShiftCount: 2,
        targetOncallCount: 4,
        proportionFactor: 1.0,
      },
      shiftTargets: WEEKEND_SHIFT_TARGETS_FT,
      totalMaxHours: 156,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-2',
      name: 'Dr Bob Jones',
      grade: 'ST5',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: {
        isLtft: true,
        daysOff: ['monday'],
        nightFlexibility: [
          { day: 'monday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['monday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 120,
        targetNightShiftCount: 4,
        targetWeekendShiftCount: 2,
        targetOncallCount: 4,
        proportionFactor: 0.8,
      },
      shiftTargets: WEEKEND_SHIFT_TARGETS_LTFT,
      totalMaxHours: 117,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-3',
      name: 'Dr Carol Lee',
      grade: 'ST5',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: {
        isLtft: true,
        daysOff: ['friday'],
        nightFlexibility: [
          { day: 'friday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['friday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 120,
        targetNightShiftCount: 4,
        targetWeekendShiftCount: 2,
        targetOncallCount: 4,
        proportionFactor: 0.8,
      },
      shiftTargets: WEEKEND_SHIFT_TARGETS_LTFT,
      totalMaxHours: 117,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
  ],
  constraints: { hard: [], soft: [] },
};

// ──────────────────────────────────────────────────────────────────
// Stage 3g.2b.2b — Weekday night-block sub-pass fixtures.
// Mon–Thu night demand only (no weekend), exercises residual-aware
// tiling with 4N / Tier 1.5 pair / 3N_MON_WED paths.
// ──────────────────────────────────────────────────────────────────

const WEEKDAY_NIGHT_DAY_KEYS = ['mon', 'tue', 'wed', 'thu'] as const;

function buildWeekdayNightSlots(): ShiftSlotEntry[] {
  const out: ShiftSlotEntry[] = [];
  for (const dayKey of WEEKDAY_NIGHT_DAY_KEYS) {
    out.push({
      shiftId: 'st-wd-night',
      shiftKey: 'night',
      name: 'Weekday Night',
      dayKey,
      startTime: '19:00',
      endTime: '08:00',
      durationHours: 13,
      isOncall: true,
      isNonResOncall: false,
      badges: ['night', 'oncall'],
      staffing: { min: 1, target: 1, max: 1 },
      slots: [{ ...DEFAULT_SLOT, permittedGrades: [...DEFAULT_SLOT.permittedGrades] }],
      targetPct: 100,
    });
  }
  return out;
}

const WEEKDAY_SHIFT_TARGETS_FT = [
  {
    shiftTypeId: 'st-wd-night',
    shiftName: 'Weekday Night',
    shiftKey: 'night',
    isOncall: true,
    maxTargetHours: 208, // 16 nights × 13h ceiling headroom
    estimatedShiftCount: 16,
  },
];

const WEEKDAY_SHIFT_TARGETS_LTFT = [
  {
    shiftTypeId: 'st-wd-night',
    shiftName: 'Weekday Night',
    shiftKey: 'night',
    isOncall: true,
    maxTargetHours: 156,
    estimatedShiftCount: 12,
  },
];

// Weekday-only fixture: 4 weeks, Mon–Thu night demand. D1 full-time
// Consultant, D2 LTFT-Wed (blocks 2N_B and 4N and 3N_MON_WED),
// D3 LTFT-Mon (blocks 2N_A and 4N and 3N_MON_WED). Both LTFT doctors
// have some viable pattern so pair-or-fallback scenarios can trigger.
export const minimalInputWeekdayNights: FinalRotaInput = {
  preRotaInput: {
    ...minimalInput.preRotaInput,
    shiftSlots: buildWeekdayNightSlots(),
    distributionTargets: {
      globalOncallPct: 100,
      globalNonOncallPct: 0,
      byShift: [{ shiftKey: 'night', targetPct: 100, isOncall: true }],
    },
  },
  doctors: [
    {
      doctorId: 'doc-1',
      name: 'Dr Alice Smith',
      grade: 'Consultant',
      wtePct: 100,
      contractedHoursPerWeek: 48,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: { hard: emptyHard(), soft: emptySoft() },
      fairnessTargets: {
        targetTotalHours: 208,
        targetNightShiftCount: 8,
        targetWeekendShiftCount: 0,
        targetOncallCount: 8,
        proportionFactor: 1.0,
      },
      shiftTargets: WEEKDAY_SHIFT_TARGETS_FT,
      totalMaxHours: 208,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-2',
      name: 'Dr Bob Jones',
      grade: 'ST5',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: {
        isLtft: true,
        daysOff: ['thursday'],
        nightFlexibility: [
          { day: 'thursday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['thursday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 156,
        targetNightShiftCount: 8,
        targetWeekendShiftCount: 0,
        targetOncallCount: 8,
        proportionFactor: 0.8,
      },
      shiftTargets: WEEKDAY_SHIFT_TARGETS_LTFT,
      totalMaxHours: 156,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-3',
      name: 'Dr Carol Lee',
      grade: 'ST5',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true,
      hasIaoc: true,
      hasIcu: true,
      hasTransfer: true,
      ltft: {
        isLtft: true,
        daysOff: ['monday'],
        nightFlexibility: [
          { day: 'monday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['monday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 156,
        targetNightShiftCount: 8,
        targetWeekendShiftCount: 0,
        targetOncallCount: 8,
        proportionFactor: 0.8,
      },
      shiftTargets: WEEKDAY_SHIFT_TARGETS_LTFT,
      totalMaxHours: 156,
      weekendCap: 4,
      hardWeeklyCap: 72,
    },
  ],
  constraints: { hard: [], soft: [] },
};

// maxConsecNights=3 variant — forces Tier 1.5 pair as primary for
// {Mon..Thu} residuals (4N not attempted per E44 gating).
export const minimalInputWeekdayMaxConsec3: FinalRotaInput = {
  ...minimalInputWeekdayNights,
  preRotaInput: {
    ...minimalInputWeekdayNights.preRotaInput,
    wtrConstraints: {
      ...minimalInputWeekdayNights.preRotaInput.wtrConstraints,
      maxConsecutive: {
        ...minimalInputWeekdayNights.preRotaInput.wtrConstraints.maxConsecutive,
        nights: 3,
      },
    },
  },
  doctors: minimalInputWeekdayNights.doctors.map(d => ({
    ...d,
    // Neutralise LTFT for the max-consec-3 scenarios so pair can form
    // with two full-time doctors as primary + partner.
    ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
    constraints: {
      hard: { ...d.constraints.hard, ltftDaysBlocked: [] },
      soft: d.constraints.soft,
    },
  })),
};

// Full-nights variant — Mon..Sun demand, used for weekend + weekday
// interplay integration tests.
const FULL_NIGHT_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function buildFullNightSlots(): ShiftSlotEntry[] {
  const out: ShiftSlotEntry[] = [];
  for (const dayKey of FULL_NIGHT_DAY_KEYS) {
    out.push({
      shiftId: 'st-full-night',
      shiftKey: 'night',
      name: 'Night',
      dayKey,
      startTime: '19:00',
      endTime: '08:00',
      durationHours: 13,
      isOncall: true,
      isNonResOncall: false,
      badges: ['night', 'oncall'],
      staffing: { min: 1, target: 1, max: 1 },
      slots: [{ ...DEFAULT_SLOT, permittedGrades: [...DEFAULT_SLOT.permittedGrades] }],
      targetPct: 100,
    });
  }
  return out;
}

const FULL_SHIFT_TARGETS = [
  {
    shiftTypeId: 'st-full-night',
    shiftName: 'Night',
    shiftKey: 'night',
    isOncall: true,
    maxTargetHours: 260,
    estimatedShiftCount: 20,
  },
];

export const minimalInputFullNights: FinalRotaInput = {
  preRotaInput: {
    ...minimalInput.preRotaInput,
    shiftSlots: buildFullNightSlots(),
    distributionTargets: {
      globalOncallPct: 100,
      globalNonOncallPct: 0,
      byShift: [{ shiftKey: 'night', targetPct: 100, isOncall: true }],
    },
  },
  doctors: [
    {
      doctorId: 'doc-1',
      name: 'Dr Alice Smith',
      grade: 'Consultant',
      wtePct: 100,
      contractedHoursPerWeek: 48,
      hasIac: true, hasIaoc: true, hasIcu: true, hasTransfer: true,
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: { hard: emptyHard(), soft: emptySoft() },
      fairnessTargets: {
        targetTotalHours: 260, targetNightShiftCount: 5,
        targetWeekendShiftCount: 2, targetOncallCount: 5,
        proportionFactor: 1.0,
      },
      shiftTargets: FULL_SHIFT_TARGETS,
      totalMaxHours: 260, weekendCap: 4, hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-2',
      name: 'Dr Bob Jones',
      grade: 'Consultant',
      wtePct: 100,
      contractedHoursPerWeek: 48,
      hasIac: true, hasIaoc: true, hasIcu: true, hasTransfer: true,
      ltft: { isLtft: false, daysOff: [], nightFlexibility: [] },
      constraints: { hard: emptyHard(), soft: emptySoft() },
      fairnessTargets: {
        targetTotalHours: 260, targetNightShiftCount: 5,
        targetWeekendShiftCount: 2, targetOncallCount: 5,
        proportionFactor: 1.0,
      },
      shiftTargets: FULL_SHIFT_TARGETS,
      totalMaxHours: 260, weekendCap: 4, hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-3',
      name: 'Dr Carol Lee',
      grade: 'ST5',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true, hasIaoc: true, hasIcu: true, hasTransfer: true,
      ltft: {
        isLtft: true, daysOff: ['monday'],
        nightFlexibility: [
          { day: 'monday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['monday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 208, targetNightShiftCount: 4,
        targetWeekendShiftCount: 2, targetOncallCount: 4,
        proportionFactor: 0.8,
      },
      shiftTargets: FULL_SHIFT_TARGETS,
      totalMaxHours: 208, weekendCap: 4, hardWeeklyCap: 72,
    },
    {
      doctorId: 'doc-4',
      name: 'Dr Dan Pool',
      grade: 'ST5',
      wtePct: 80,
      contractedHoursPerWeek: 38.4,
      hasIac: true, hasIaoc: true, hasIcu: true, hasTransfer: true,
      ltft: {
        isLtft: true, daysOff: ['friday'],
        nightFlexibility: [
          { day: 'friday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['friday'] },
        soft: emptySoft(),
      },
      fairnessTargets: {
        targetTotalHours: 208, targetNightShiftCount: 4,
        targetWeekendShiftCount: 2, targetOncallCount: 4,
        proportionFactor: 0.8,
      },
      shiftTargets: FULL_SHIFT_TARGETS,
      totalMaxHours: 208, weekendCap: 4, hardWeeklyCap: 72,
    },
  ],
  constraints: { hard: [], soft: [] },
};

// All-LTFT variant: every doctor is LTFT with a weekend-adjacent
// day-off that blocks 3N_FRI_SUN, forcing the orchestrator into Pass 2
// / Relaxation territory. D3 blocks both Mon and Fri so even 2N
// options become constrained.
export const minimalInputWeekendNightsAllLtft: FinalRotaInput = {
  ...minimalInputWeekendNights,
  doctors: [
    {
      ...minimalInputWeekendNights.doctors[0],
      grade: 'ST5',
      ltft: {
        isLtft: true,
        daysOff: ['monday'],
        nightFlexibility: [
          { day: 'monday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['monday'] },
        soft: emptySoft(),
      },
    },
    minimalInputWeekendNights.doctors[1],
    {
      ...minimalInputWeekendNights.doctors[2],
      ltft: {
        isLtft: true,
        daysOff: ['monday', 'friday'],
        nightFlexibility: [
          { day: 'monday', canStartNightsOnDay: false, canEndNightsOnDay: false },
          { day: 'friday', canStartNightsOnDay: false, canEndNightsOnDay: false },
        ],
      },
      constraints: {
        hard: { ...emptyHard(), ltftDaysBlocked: ['monday', 'friday'] },
        soft: emptySoft(),
      },
    },
  ],
};
