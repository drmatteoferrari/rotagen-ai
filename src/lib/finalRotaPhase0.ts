// src/lib/finalRotaPhase0.ts
// Phase 0 of the rota algorithm (spec v2.9 §5): builds the Availability
// Matrix, derives per-doctor bucket floors from leave-adjusted ceilings,
// guards against infeasible floors, and surfaces zero-competency warnings.
//
// Boundary rules (Note 35 + Hard Rules):
//   - No imports from '@/types/finalRota' — this is an internal algorithm module.
//   - No imports from React, Supabase, or browser/Node globals. The generator
//     runs inside a Web Worker at runtime.
//   - All date arithmetic is UTC — never setDate/getDate.

import type { FinalRotaInput } from './rotaGenInput';
import type {
  AvailabilityMatrix,
  AvailabilityStatus,
  BucketFloors,
} from './finalRotaTypes';

// ─── Private: expandDateRange ─────────────────────────────────
// Inclusive start..end, both 'YYYY-MM-DD'. UTC only.

function expandDateRange(startISO: string, endISO: string): string[] {
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const out: string[] = [];
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// ─── Private: getDayOfWeek ────────────────────────────────────
// Lowercase English day name for the UTC date represented by isoDate.

const DOW_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
] as const;

function getDayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return DOW_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// ─── Private: isWeekdayUTC ────────────────────────────────────
// Spec §5.2 counts leave hours only on Mon–Fri UTC; weekend leave
// contributes zero to bucket deduction.

function isWeekdayUTC(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

// ─── buildAvailabilityMatrix ──────────────────────────────────
// Per spec §5.1 (test-harness translation): production reads
// `resolved_availability`; the harness equivalent is
// `FinalRotaInput.doctors[].constraints.hard` plus LTFT pattern and the
// period's bank-holiday list. NOC is a soft preference and leaves the
// status as 'available' — it is consulted during construction, not here.
// First match wins, priority order matching the stage spec.

export function buildAvailabilityMatrix(input: FinalRotaInput): AvailabilityMatrix {
  const { startDate, endDate, bankHolidayDates } = input.preRotaInput.period;
  const dates = expandDateRange(startDate, endDate);
  const bhSet = new Set(bankHolidayDates);

  const matrix: AvailabilityMatrix = {};

  for (const doctor of input.doctors) {
    const inner: Record<string, AvailabilityStatus> = {};

    const alSet = new Set(doctor.constraints.hard.annualLeaveDates);
    const slSet = new Set(doctor.constraints.hard.studyLeaveDates);
    const plSet = new Set(doctor.constraints.hard.parentalLeaveDates);
    const rotSet = new Set(doctor.constraints.hard.rotationDates);
    const ltftDaysOff = new Set(
      (doctor.ltft.daysOff ?? []).map((d) => d.toLowerCase()),
    );
    const isLtft = doctor.ltft.isLtft;

    for (const date of dates) {
      let status: AvailabilityStatus;
      if (alSet.has(date)) {
        status = 'annual_leave';
      } else if (slSet.has(date)) {
        status = 'study';
      } else if (plSet.has(date)) {
        status = 'parental';
      } else if (rotSet.has(date)) {
        status = 'rotation';
      } else if (isLtft && ltftDaysOff.has(getDayOfWeek(date))) {
        status = 'ltft_off';
      } else if (bhSet.has(date)) {
        status = 'bank_holiday';
      } else {
        status = 'available';
      }
      inner[date] = status;
    }

    matrix[doctor.doctorId] = inner;
  }

  return matrix;
}

// ─── computeBucketFloors ──────────────────────────────────────
// Floors are the leave-adjusted on-call / non-on-call ceilings already
// produced by `pre_rota_results.targets_data` and surfaced here via
// `FinalRotaInput.doctors[].shiftTargets`. The algorithm never
// recomputes targets (Hard Rule 6) — it reads and sums them.

export function computeBucketFloors(input: FinalRotaInput): BucketFloors {
  const floors: BucketFloors = {};
  for (const doctor of input.doctors) {
    let oncall = 0;
    let nonOncall = 0;
    for (const t of doctor.shiftTargets) {
      if (t.isOncall) oncall += t.maxTargetHours;
      else nonOncall += t.maxTargetHours;
    }
    floors[doctor.doctorId] = { oncall, nonOncall };
  }
  return floors;
}

// ─── validateBucketFloors ─────────────────────────────────────
// V1 guard (spec v2.9 §5.0 + §5.2): apply the leave deduction formula to
// each doctor's on-call / non-on-call starting buckets (read from their
// shiftTargets via computeBucketFloors) and HALT if either bucket is
// negative post-deduction. A negative bucket means entered leave exceeds
// contractual capacity in that bucket — a data-entry failure the spec
// treats as unrecoverable.
//
// Leave deduction rules (§5.2):
//   standardDayHours     = maxAvgHoursPerWeek / 5
//   alSlBhHoursDeducted  = alSlBhDays × standardDayHours            (no WTE scaling)
//   plRotHoursDeducted   = plRotDays × standardDayHours × wteScalar (WTE-scaled)
//   Oncall    bucket -= plRotHoursDeducted × (oncallPct / 100)
//   NonOncall bucket -= plRotHoursDeducted × (nonOncallPct / 100)
//   NonOncall bucket -= alSlBhHoursDeducted                          (AL/SL/BH hit non-on-call only)
// Only weekdays contribute. `ltft_off` and `noc` are not absences in §5.2
// terms and do not deduct from buckets. This is the spec guard — the
// build guide's availableDays × maxShiftLength formula was not in the
// spec and produced false violations against realistic fixtures.

export function validateBucketFloors(
  floors: BucketFloors,
  matrix: AvailabilityMatrix,
  input: FinalRotaInput,
): void {
  const { distributionTargets, wtrConstraints } = input.preRotaInput;
  const standardDayHours = wtrConstraints.maxAvgHoursPerWeek / 5;
  const oncallFrac = distributionTargets.globalOncallPct / 100;
  const nonOncallFrac = distributionTargets.globalNonOncallPct / 100;

  for (const doctor of input.doctors) {
    const floor = floors[doctor.doctorId];
    if (!floor) continue;

    const wteScalar = doctor.wtePct / 100;
    const doctorMatrix = matrix[doctor.doctorId] ?? {};

    let alSlBhDays = 0;
    let plRotDays = 0;
    for (const [date, status] of Object.entries(doctorMatrix)) {
      if (!isWeekdayUTC(date)) continue;
      if (
        status === 'annual_leave' ||
        status === 'study' ||
        status === 'bank_holiday'
      ) {
        alSlBhDays += 1;
      } else if (status === 'parental' || status === 'rotation') {
        plRotDays += 1;
      }
    }

    const alSlBhHoursDeducted = alSlBhDays * standardDayHours;
    const plRotHoursDeducted = plRotDays * standardDayHours * wteScalar;

    const oncallBucket = floor.oncall - plRotHoursDeducted * oncallFrac;
    const nonOncallBucket =
      floor.nonOncall - plRotHoursDeducted * nonOncallFrac - alSlBhHoursDeducted;

    if (oncallBucket < 0) {
      throw new Error(
        `Bucket floor violation for ${doctor.name}: on-call bucket is ` +
          `${oncallBucket.toFixed(1)}h after leave deduction (floor ${floor.oncall}h, ` +
          `PL/ROT ${plRotDays} weekday(s), AL/SL/BH ${alSlBhDays} weekday(s)).`,
      );
    }
    if (nonOncallBucket < 0) {
      throw new Error(
        `Bucket floor violation for ${doctor.name}: non-on-call bucket is ` +
          `${nonOncallBucket.toFixed(1)}h after leave deduction (floor ${floor.nonOncall}h, ` +
          `AL/SL/BH ${alSlBhDays} weekday(s), PL/ROT ${plRotDays} weekday(s)).`,
      );
    }
  }
}

// ─── collectZeroCompetencyWarnings ────────────────────────────
// Spec §5.0 V2 (v2.8 — F2): a slot is clinically unconstrained only if
// it has zero competency requirements AND no grade restriction. The
// second clause is the F2 fix — without it, grade-restricted slots
// produced false-positive warnings.
//
// Scope is on-call shifts only (spec line 721: `FOR each on-call shift
// S in ShiftSlotEntry[] (isOncall = true)`). A non-on-call slot with no
// competency requirements is a normal configuration (e.g. a short-day
// theatre list open to any grade) and must not generate warnings — the
// warning exists because unqualified cover of on-call is a specific
// clinical risk.

export function collectZeroCompetencyWarnings(input: FinalRotaInput): string[] {
  const warnings: string[] = [];
  for (const entry of input.preRotaInput.shiftSlots) {
    if (!entry.isOncall) continue;
    const unconstrained = entry.slots.some(
      (s) =>
        s.reqIac === 0 &&
        s.reqIaoc === 0 &&
        s.reqIcu === 0 &&
        s.reqTransfer === 0 &&
        s.permittedGrades.length === 0,
    );
    if (unconstrained) {
      warnings.push(
        `Shift "${entry.name}" on ${entry.dayKey} has an unconstrained on-call slot — any grade, no competency required.`,
      );
    }
  }
  return warnings;
}
