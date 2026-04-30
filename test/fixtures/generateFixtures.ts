import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const endD = new Date(end + 'T00:00:00Z');
  while (cur <= endD) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function dayKey(date: string): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[new Date(date + 'T00:00:00Z').getUTCDay()];
}

function isWeekend(date: string): boolean {
  const d = new Date(date + 'T00:00:00Z').getUTCDay();
  return d === 0 || d === 6;
}

function countWeekdays(start: string, end: string): number {
  return dateRange(start, end).filter(d => !isWeekend(d)).length;
}

function calcTotalMaxHours(totalWeeks: number, wtePct: number, alSlWeekdays: number, plRotWeekdays: number): number {
  const base = totalWeeks * 48 * (wtePct / 100);
  const alSlDeduction = alSlWeekdays * (48 / 5);
  const plRotDeduction = plRotWeekdays * (48 / 5) * (wtePct / 100);
  return Math.round(base - alSlDeduction - plRotDeduction);
}

function calcTargetNightCount(totalDays: number, slotsPerNight: number, numDoctorsForNights: number, proportionFactor: number): number {
  return Math.round((totalDays * slotsPerNight / numDoctorsForNights) * proportionFactor);
}

function buildWtrConstraints() {
  return {
    maxAvgHoursPerWeek: 48,
    maxHoursIn168h: 72,
    maxShiftLengthH: 13,
    minInterShiftRestH: 11,
    maxConsecutive: { standard: 7, long: 4, nights: 4, longEvening: 4 },
    minRestHoursAfter: { nights: 46, longShifts: 48, standardShifts: 11, longEveningShifts: 11 },
    weekendFrequencyMax: 0.3333,
    oncall: {
      maxPer7Days: 3, localAgreementMaxConsec: 2, dayAfterMaxHours: 10,
      restPer24hHours: 8, continuousRestHours: 5,
      continuousRestStart: '22:00', continuousRestEnd: '07:00',
      ifRestNotMetNextDayMaxHours: 10, noSimultaneousShift: true,
      noConsecExceptWknd: true, dayAfterLastConsecMaxH: 10,
    },
  };
}

function buildNightShiftSlots(dayKeys: string[]) {
  return dayKeys.map(dk => ({
    shiftId: 'shift-night',
    shiftKey: 'night',
    name: 'Night Shift',
    dayKey: dk,
    startTime: '21:00',
    endTime: '08:00',
    durationHours: 11,
    isOncall: true,
    isNonResOncall: false,
    badges: ['night', 'long', 'ooh', 'oncall'],
    staffing: { min: 1, target: 2, max: 2 },
    slots: [
      { slotIndex: 0, label: 'Senior', permittedGrades: [], reqIac: 1, reqIaoc: 0, reqIcu: 0, reqTransfer: 0 },
      { slotIndex: 1, label: 'ICU cover', permittedGrades: [], reqIac: 0, reqIaoc: 0, reqIcu: 1, reqTransfer: 0 },
    ],
    targetPct: 100,
  }));
}

function buildAvailability(
  doctorIds: string[],
  allDates: string[],
  overrides: Map<string, Map<string, string>>,
) {
  const rows: Array<{ doctorId: string; date: string; status: string; source: string; canStartNights: null; canEndNights: null }> = [];
  for (const doctorId of doctorIds) {
    const docOverrides = overrides.get(doctorId) ?? new Map<string, string>();
    for (const date of allDates) {
      rows.push({
        doctorId,
        date,
        status: docOverrides.get(date) ?? 'AVAILABLE',
        source: 'survey',
        canStartNights: null,
        canEndNights: null,
      });
    }
  }
  return rows;
}

interface DoctorSpec {
  doctorId: string;
  name: string;
  grade: string;
  wtePct: number;
  hasIac: boolean;
  hasIaoc: boolean;
  hasIcu: boolean;
  hasTransfer: boolean;
  isLtft: boolean;
  daysOff: string[];
  exemptFromNights: boolean;
  exemptFromWeekends: boolean;
  exemptFromOncall: boolean;
  totalMaxHours: number;
  targetNightCount: number;
}

function buildDoctor(spec: DoctorSpec) {
  const proportion = spec.wtePct / 100;
  return {
    doctorId: spec.doctorId,
    name: spec.name,
    grade: spec.grade,
    wtePct: spec.wtePct,
    contractedHoursPerWeek: proportion * 48,
    hasIac: spec.hasIac,
    hasIaoc: spec.hasIaoc,
    hasIcu: spec.hasIcu,
    hasTransfer: spec.hasTransfer,
    ltft: { isLtft: spec.isLtft, daysOff: spec.daysOff },
    constraints: {
      hard: {
        exemptFromNights: spec.exemptFromNights,
        exemptFromWeekends: spec.exemptFromWeekends,
        exemptFromOncall: spec.exemptFromOncall,
      },
      soft: { maxConsecNights: 4, additionalNotes: '' },
    },
    fairnessTargets: {
      targetTotalHours: spec.totalMaxHours,
      targetNightShiftCount: spec.targetNightCount,
      targetWeekendShiftCount: Math.round(spec.targetNightCount * 0.28),
      targetOncallCount: spec.targetNightCount,
      proportionFactor: proportion,
    },
    shiftTargets: [{
      shiftTypeId: 'shift-night',
      shiftName: 'Night Shift',
      shiftKey: 'night',
      isOncall: true,
      maxTargetHours: spec.totalMaxHours,
      estimatedShiftCount: spec.targetNightCount,
    }],
    totalMaxHours: spec.totalMaxHours,
    weekendCap: Math.round(spec.totalMaxHours / 48 * 0.333),
    hardWeeklyCap: 72,
  };
}

function wrapFixture(configId: string, label: string, input: any) {
  return {
    exportedAt: new Date().toISOString(),
    configId,
    label,
    doctorCount: input.doctors.length,
    resolvedAvailabilityCount: input.resolvedAvailability.length,
    input,
  };
}

function buildT1() {
  const start = '2026-06-01'; const end = '2026-06-28';
  const allDates = dateRange(start, end);
  const totalWeeks = 4; const totalDays = 28; const numForNights = 3;
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const doctors = [
    buildDoctor({ doctorId: 'dr-alpha', name: 'Dr Alpha', grade: 'ST7', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: true,  hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0, 0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-beta',  name: 'Dr Beta',  grade: 'ST5', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: false, hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0, 0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-gamma', name: 'Dr Gamma', grade: 'ST4', wtePct: 100, hasIac: false, hasIaoc: false, hasIcu: true,  hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0, 0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
  ];

  const avail = buildAvailability(doctors.map(d => d.doctorId), allDates, new Map());
  return wrapFixture('t1-config', 'T1 — 3 doctors, 4 weeks, no leave, nights only', {
    preRotaInput: {
      configId: 't1-config',
      period: { startDate: start, endDate: end, totalDays, totalWeeks, bankHolidayDates: [], bhSameAsWeekend: false, bhShiftRules: [] },
      shiftSlots: buildNightShiftSlots(ALL_DAYS),
      wtrConstraints: buildWtrConstraints(),
      distributionTargets: { globalOncallPct: 100, globalNonOncallPct: 0, byShift: [{ shiftKey: 'night', targetPct: 100, isOncall: true }] },
    },
    doctors,
    resolvedAvailability: avail,
  });
}

function buildT2() {
  const start = '2026-06-01'; const end = '2026-08-30';
  const allDates = dateRange(start, end);
  const totalWeeks = 13; const totalDays = 91; const numForNights = 6;
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const alAlpha = countWeekdays('2026-06-15', '2026-06-21');
  const alBeta  = countWeekdays('2026-07-07', '2026-07-13');

  const doctors = [
    buildDoctor({ doctorId: 'dr-alpha',   name: 'Dr Alpha',   grade: 'ST7', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: true,  hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, alAlpha, 0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-beta',    name: 'Dr Beta',    grade: 'ST5', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: false, hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, alBeta,  0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-gamma',   name: 'Dr Gamma',   grade: 'ST4', wtePct: 100, hasIac: false, hasIaoc: false, hasIcu: true,  hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0,       0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-delta',   name: 'Dr Delta',   grade: 'ST6', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: true,  hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0,       0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-epsilon', name: 'Dr Epsilon', grade: 'ST5', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: false, hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0,       0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
    buildDoctor({ doctorId: 'dr-zeta',    name: 'Dr Zeta',    grade: 'ST3', wtePct: 100, hasIac: false, hasIaoc: false, hasIcu: true,  hasTransfer: false, isLtft: false, daysOff: [], exemptFromNights: false, exemptFromWeekends: false, exemptFromOncall: false, totalMaxHours: calcTotalMaxHours(totalWeeks, 100, 0,       0), targetNightCount: calcTargetNightCount(totalDays, 2, numForNights, 1) }),
  ];

  const overrides = new Map<string, Map<string, string>>();
  const setRange = (id: string, s: string, e: string, status: string) => {
    const m = overrides.get(id) ?? new Map<string, string>();
    dateRange(s, e).forEach(d => m.set(d, status));
    overrides.set(id, m);
  };
  setRange('dr-alpha', '2026-06-15', '2026-06-21', 'AL');
  setRange('dr-beta',  '2026-07-07', '2026-07-13', 'AL');
  setRange('dr-gamma', '2026-07-21', '2026-07-25', 'NOC');

  const avail = buildAvailability(doctors.map(d => d.doctorId), allDates, overrides);
  return wrapFixture('t2-config', 'T2 — 6 doctors, 13 weeks, AL + NOC', {
    preRotaInput: {
      configId: 't2-config',
      period: { startDate: start, endDate: end, totalDays, totalWeeks, bankHolidayDates: [], bhSameAsWeekend: false, bhShiftRules: [] },
      shiftSlots: buildNightShiftSlots(ALL_DAYS),
      wtrConstraints: buildWtrConstraints(),
      distributionTargets: { globalOncallPct: 100, globalNonOncallPct: 0, byShift: [{ shiftKey: 'night', targetPct: 100, isOncall: true }] },
    },
    doctors,
    resolvedAvailability: avail,
  });
}

function buildT3() {
  const start = '2026-06-01'; const end = '2026-11-29';
  const allDates = dateRange(start, end);
  const totalWeeks = 26; const totalDays = 182; const numForNights = 9;
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const specs = [
    { doctorId: 'dr-t3-01', name: 'Dr Ashworth', grade: 'ST7', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: true,  alSlWeekdays: countWeekdays('2026-07-20', '2026-07-31'), exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-02', name: 'Dr Baxter',   grade: 'ST6', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: true,  alSlWeekdays: countWeekdays('2026-09-07', '2026-09-18'), exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-03', name: 'Dr Chen',     grade: 'ST5', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: false, alSlWeekdays: countWeekdays('2026-08-03', '2026-08-07'), exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-04', name: 'Dr Davies',   grade: 'ST5', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: false, alSlWeekdays: countWeekdays('2026-10-05', '2026-10-16'), exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-05', name: 'Dr Evans',    grade: 'ST4', wtePct: 100, hasIac: false, hasIaoc: false, hasIcu: true,  alSlWeekdays: 0, exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-06', name: 'Dr Foster',   grade: 'ST4', wtePct: 100, hasIac: false, hasIaoc: false, hasIcu: true,  alSlWeekdays: 0, exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-07', name: 'Dr Green',    grade: 'ST3', wtePct: 80,  hasIac: true,  hasIaoc: false, hasIcu: true,  alSlWeekdays: 0, exemptFromNights: false, isLtft: true,  daysOff: ['friday'] },
    { doctorId: 'dr-t3-08', name: 'Dr Harris',   grade: 'ST3', wtePct: 80,  hasIac: false, hasIaoc: false, hasIcu: true,  alSlWeekdays: 0, exemptFromNights: false, isLtft: true,  daysOff: ['friday'] },
    { doctorId: 'dr-t3-09', name: 'Dr Ingram',   grade: 'ST7', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: true,  alSlWeekdays: 0, exemptFromNights: true,  isLtft: false, daysOff: [] as string[] },
    { doctorId: 'dr-t3-10', name: 'Dr James',    grade: 'ST6', wtePct: 100, hasIac: true,  hasIaoc: true,  hasIcu: false, alSlWeekdays: 0, exemptFromNights: false, isLtft: false, daysOff: [] as string[] },
  ];

  const doctors = specs.map(s => buildDoctor({
    ...s,
    hasTransfer: false,
    exemptFromWeekends: false,
    exemptFromOncall: false,
    totalMaxHours: calcTotalMaxHours(totalWeeks, s.wtePct, s.alSlWeekdays, 0),
    targetNightCount: s.exemptFromNights ? 0 : calcTargetNightCount(totalDays, 2, numForNights, s.wtePct / 100),
  }));

  const overrides = new Map<string, Map<string, string>>();
  const setRange = (id: string, s: string, e: string, status: string) => {
    const m = overrides.get(id) ?? new Map<string, string>();
    dateRange(s, e).forEach(d => m.set(d, status));
    overrides.set(id, m);
  };
  setRange('dr-t3-01', '2026-07-20', '2026-07-31', 'AL');
  setRange('dr-t3-02', '2026-09-07', '2026-09-18', 'AL');
  setRange('dr-t3-03', '2026-08-03', '2026-08-07', 'SL');
  setRange('dr-t3-04', '2026-10-05', '2026-10-16', 'AL');
  setRange('dr-t3-10', '2026-09-21', '2026-09-25', 'NOC');
  const fridays = allDates.filter(d => dayKey(d) === 'fri');
  for (const fri of fridays) {
    ['dr-t3-07', 'dr-t3-08'].forEach(id => {
      const m = overrides.get(id) ?? new Map<string, string>();
      m.set(fri, 'LTFT');
      overrides.set(id, m);
    });
  }

  const avail = buildAvailability(doctors.map(d => d.doctorId), allDates, overrides);
  return wrapFixture('t3-config', 'T3 — 10 doctors, 26 weeks, LTFT + exempt + complex leave', {
    preRotaInput: {
      configId: 't3-config',
      period: { startDate: start, endDate: end, totalDays, totalWeeks, bankHolidayDates: [], bhSameAsWeekend: false, bhShiftRules: [] },
      shiftSlots: buildNightShiftSlots(ALL_DAYS),
      wtrConstraints: buildWtrConstraints(),
      distributionTargets: { globalOncallPct: 100, globalNonOncallPct: 0, byShift: [{ shiftKey: 'night', targetPct: 100, isOncall: true }] },
    },
    doctors,
    resolvedAvailability: avail,
  });
}

const outDir = __dirname;

const t1 = buildT1();
fs.writeFileSync(path.join(outDir, 't1.json'), JSON.stringify(t1, null, 2));
console.log('T1:', t1.doctorCount, 'doctors,', t1.resolvedAvailabilityCount, 'rows');

const t2 = buildT2();
fs.writeFileSync(path.join(outDir, 't2.json'), JSON.stringify(t2, null, 2));
console.log('T2:', t2.doctorCount, 'doctors,', t2.resolvedAvailabilityCount, 'rows');

const t3 = buildT3();
fs.writeFileSync(path.join(outDir, 't3.json'), JSON.stringify(t3, null, 2));
console.log('T3:', t3.doctorCount, 'doctors,', t3.resolvedAvailabilityCount, 'rows');

console.log('All fixtures written.');
