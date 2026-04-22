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

const SHIFT_TARGETS_FT = [
  {
    shiftTypeId: 'st-night',
    shiftName: 'Night',
    shiftKey: 'night',
    isOncall: false,
    maxTargetHours: 156,
    estimatedShiftCount: 12,
  },
  {
    shiftTypeId: 'st-longday',
    shiftName: 'Long Day',
    shiftKey: 'long-day',
    isOncall: false,
    maxTargetHours: 200,
    estimatedShiftCount: 16,
  },
  {
    shiftTypeId: 'st-shortday',
    shiftName: 'Short Day',
    shiftKey: 'short-day',
    isOncall: false,
    maxTargetHours: 124,
    estimatedShiftCount: 14,
  },
];

// D3 is 0.8 WTE — shiftTargets scaled to sum to totalMaxHours = 384h.
const SHIFT_TARGETS_D3 = [
  {
    shiftTypeId: 'st-night',
    shiftName: 'Night',
    shiftKey: 'night',
    isOncall: false,
    maxTargetHours: 124.8,
    estimatedShiftCount: 10,
  },
  {
    shiftTypeId: 'st-longday',
    shiftName: 'Long Day',
    shiftKey: 'long-day',
    isOncall: false,
    maxTargetHours: 160,
    estimatedShiftCount: 13,
  },
  {
    shiftTypeId: 'st-shortday',
    shiftName: 'Short Day',
    shiftKey: 'short-day',
    isOncall: false,
    maxTargetHours: 99.2,
    estimatedShiftCount: 11,
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
        targetTotalHours: 480,
        targetNightShiftCount: 8,
        targetWeekendShiftCount: 4,
        targetOncallCount: 0,
        proportionFactor: 1.0,
      },
      shiftTargets: SHIFT_TARGETS_FT,
      totalMaxHours: 480,
      weekendCap: 8,
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
        targetTotalHours: 480,
        targetNightShiftCount: 8,
        targetWeekendShiftCount: 4,
        targetOncallCount: 0,
        proportionFactor: 1.0,
      },
      shiftTargets: SHIFT_TARGETS_FT,
      totalMaxHours: 480,
      weekendCap: 8,
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
        targetTotalHours: 384,
        targetNightShiftCount: 6,
        targetWeekendShiftCount: 3,
        targetOncallCount: 0,
        proportionFactor: 0.8,
      },
      shiftTargets: SHIFT_TARGETS_D3,
      totalMaxHours: 384,
      weekendCap: 6,
      hardWeeklyCap: 72,
    },
  ],
  constraints: {
    hard: [],
    soft: [],
  },
};
