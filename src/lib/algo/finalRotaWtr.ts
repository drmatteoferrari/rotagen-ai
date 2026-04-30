// src/lib/algo/finalRotaWtr.ts
// WTR enforcement engine.
// Pure TypeScript — no React, Supabase, or browser APIs.
// Exports exactly two functions: checkSingleShift and checkNightBlock.

import type {
  DoctorRunningTotals,
  ProposedShift,
  ProposedBlock,
  WtrConstraints,
  WtrResult,
} from './finalRotaTypes';

const MS_PER_HOUR = 3_600_000;
const MS_168H = 168 * MS_PER_HOUR;
const MS_7_DAYS = 7 * 24 * MS_PER_HOUR;
const MS_1_DAY = 86_400_000;

// ─── Helpers ──────────────────────────────────────────────────

function isoWeekKey(dateStr: string): string {
  // Returns 'YYYY-WNN' using ISO week calculation, UTC only.
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / MS_1_DAY + 1) / 7,
  );
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function hoursInWindow(
  shifts: ProposedShift[],
  windowStartMs: number,
  windowEndMs: number,
): number {
  return shifts.reduce((sum, s) => {
    const overlapStart = Math.max(s.startMs, windowStartMs);
    const overlapEnd = Math.min(s.endMs, windowEndMs);
    return sum + Math.max(0, (overlapEnd - overlapStart) / MS_PER_HOUR);
  }, 0);
}

function isConsecutiveStreak(dates: string[], newDate: string): boolean {
  // Returns true only if newDate is exactly 1 calendar day after the last entry.
  if (dates.length === 0) return false;
  const last = new Date(dates[dates.length - 1] + 'T00:00:00Z').getTime();
  const next = new Date(newDate + 'T00:00:00Z').getTime();
  return next - last === MS_1_DAY;
}

function dateToMs(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

// ─── checkSingleShift ─────────────────────────────────────────

export function checkSingleShift(
  doctor: DoctorRunningTotals,
  shift: ProposedShift,
  wtr: WtrConstraints,
): WtrResult {
  const PASS: WtrResult = { pass: true, rule: null, detail: null };

  // A0 — one shift per calendar date
  if (doctor.assignments.some((a) => a.date === shift.date)) {
    return {
      pass: false,
      rule: 'A0_DUPLICATE_DATE',
      detail: `Already has a shift on ${shift.date}`,
    };
  }

  // B27 — exempt from nights
  if (shift.isNight && doctor.exemptFromNights) {
    return { pass: false, rule: 'B27_EXEMPT_NIGHTS', detail: 'Exempt from night shifts' };
  }

  // B28 — exempt from weekends
  if (shift.isWeekend && doctor.exemptFromWeekends) {
    return { pass: false, rule: 'B28_EXEMPT_WEEKENDS', detail: 'Exempt from weekend shifts' };
  }

  // B29 — exempt from on-call
  if (shift.isOncall && doctor.exemptFromOncall) {
    return { pass: false, rule: 'B29_EXEMPT_ONCALL', detail: 'Exempt from on-call shifts' };
  }

  // A3 — rest period still active (stamped by previous block or shift)
  if (shift.startMs < doctor.restUntilMs) {
    const remainingH = ((doctor.restUntilMs - shift.startMs) / MS_PER_HOUR).toFixed(1);
    return {
      pass: false,
      rule: 'A3_MIN_REST',
      detail: `${remainingH}h mandatory rest remaining before ${shift.date}`,
    };
  }

  // A3 — gap to immediately preceding committed shift
  const minRestMs = wtr.minInterShiftRestH * MS_PER_HOUR;
  const prevShifts = doctor.assignments
    .filter((a) => a.endMs <= shift.startMs)
    .sort((a, b) => b.endMs - a.endMs);
  if (prevShifts.length > 0) {
    const gapMs = shift.startMs - prevShifts[0].endMs;
    if (gapMs < minRestMs) {
      return {
        pass: false,
        rule: 'A3_MIN_REST',
        detail: `${(gapMs / MS_PER_HOUR).toFixed(1)}h gap to previous shift (need ${wtr.minInterShiftRestH}h)`,
      };
    }
  }

  // A3 — gap to immediately following committed shift
  const nextShifts = doctor.assignments
    .filter((a) => a.startMs >= shift.endMs)
    .sort((a, b) => a.startMs - b.startMs);
  if (nextShifts.length > 0) {
    const gapMs = nextShifts[0].startMs - shift.endMs;
    if (gapMs < minRestMs) {
      return {
        pass: false,
        rule: 'A3_MIN_REST',
        detail: `${(gapMs / MS_PER_HOUR).toFixed(1)}h gap to next shift (need ${wtr.minInterShiftRestH}h)`,
      };
    }
  }

  // A2 — 72h in any 168h rolling window (backward and forward)
  const withShift = [...doctor.assignments, shift];
  const backwardHours = hoursInWindow(withShift, shift.endMs - MS_168H, shift.endMs);
  if (backwardHours > wtr.maxHoursIn168h) {
    return {
      pass: false,
      rule: 'A2_168H_WINDOW',
      detail: `${backwardHours.toFixed(1)}h in 168h backward window (max ${wtr.maxHoursIn168h}h)`,
    };
  }
  const forwardHours = hoursInWindow(withShift, shift.startMs, shift.startMs + MS_168H);
  if (forwardHours > wtr.maxHoursIn168h) {
    return {
      pass: false,
      rule: 'A2_168H_WINDOW',
      detail: `${forwardHours.toFixed(1)}h in 168h forward window (max ${wtr.maxHoursIn168h}h)`,
    };
  }

  // A4 — max consecutive nights
  if (shift.isNight) {
    const extending = isConsecutiveStreak(doctor.consecutiveNightDates, shift.date);
    const newStreak = extending ? doctor.consecutiveNightDates.length + 1 : 1;
    if (newStreak > wtr.maxConsecutive.nights) {
      return {
        pass: false,
        rule: 'A4_MAX_CONSEC_NIGHTS',
        detail: `Would be night ${newStreak} consecutive (max ${wtr.maxConsecutive.nights})`,
      };
    }
  }

  // A5 — max consecutive long shifts
  if (shift.isLong) {
    const extending = isConsecutiveStreak(doctor.consecutiveLongDates, shift.date);
    const newStreak = extending ? doctor.consecutiveLongDates.length + 1 : 1;
    if (newStreak > wtr.maxConsecutive.long) {
      return {
        pass: false,
        rule: 'A5_MAX_CONSEC_LONG',
        detail: `Would be long shift ${newStreak} consecutive (max ${wtr.maxConsecutive.long})`,
      };
    }
  }

  // A6 — max consecutive shifts of any type
  const extendingAny = isConsecutiveStreak(doctor.consecutiveDates, shift.date);
  const newConsec = extendingAny ? doctor.consecutiveDates.length + 1 : 1;
  if (newConsec > wtr.maxConsecutive.standard) {
    return {
      pass: false,
      rule: 'A6_MAX_CONSEC_SHIFTS',
      detail: `Would be shift ${newConsec} consecutive (max ${wtr.maxConsecutive.standard})`,
    };
  }

  // A7 — weekend frequency (only meaningful after ≥3 weeks elapsed)
  if (shift.isWeekend && doctor.totalWeeksInRota >= 3) {
    const weeksElapsed = Object.keys(doctor.weeklyHoursUsed).length;
    if (weeksElapsed >= 3) {
      const newWeekendDayCount = doctor.weekendDatesWorked.length + 1;
      // Each Sat+Sun pair = 1 weekend unit
      const weekendUnits = Math.ceil(newWeekendDayCount / 2);
      const freq = weekendUnits / weeksElapsed;
      if (freq > wtr.weekendFrequencyMax) {
        return {
          pass: false,
          rule: 'A7_WEEKEND_FREQ',
          detail: `Weekend frequency would be ${freq.toFixed(3)} (max ${wtr.weekendFrequencyMax.toFixed(3)})`,
        };
      }
    }
  }

  // A14 — max on-call per 7 days (rolling 168h window)
  if (shift.isOncall) {
    const shiftDateMs = dateToMs(shift.date);
    const windowStartMs = shiftDateMs - MS_7_DAYS;
    const recentOncall = doctor.oncallDatesLast7.filter(
      (d) => dateToMs(d) > windowStartMs,
    );
    if (recentOncall.length >= wtr.oncall.maxPer7Days) {
      return {
        pass: false,
        rule: 'A14_MAX_ONCALL_7D',
        detail: `Already ${recentOncall.length} on-call shifts in last 7 days (max ${wtr.oncall.maxPer7Days})`,
      };
    }
  }

  return PASS;
}

// ─── checkNightBlock ──────────────────────────────────────────

export function checkNightBlock(
  doctor: DoctorRunningTotals,
  block: ProposedBlock,
  wtr: WtrConstraints,
): WtrResult {

  // Blocks must be ≥2 nights — single nights are never permitted
  if (block.nights.length < 2) {
    return {
      pass: false,
      rule: 'BLOCK_TOO_SHORT',
      detail: 'Night blocks must be at least 2 nights. Single isolated nights are not permitted.',
    };
  }

  if (block.nights.length > wtr.maxConsecutive.nights) {
    return {
      pass: false,
      rule: 'BLOCK_TOO_LONG',
      detail: `Block length ${block.nights.length} exceeds maxConsecutive.nights (${wtr.maxConsecutive.nights})`,
    };
  }

  // 7-day minimum gap since last completed block
  if (doctor.nightBlockHistory.length > 0) {
    const lastBlock = doctor.nightBlockHistory[doctor.nightBlockHistory.length - 1];
    const lastBlockEndDateMs = dateToMs(lastBlock[lastBlock.length - 1]) + MS_1_DAY;
    const newBlockStartMs = block.nights[0].startMs;
    const gapMs = newBlockStartMs - lastBlockEndDateMs;
    if (gapMs < MS_7_DAYS) {
      return {
        pass: false,
        rule: 'BLOCK_GAP_7D',
        detail: `Only ${(gapMs / MS_1_DAY).toFixed(1)} days since last night block ended (need 7)`,
      };
    }
  }

  // Simulate committing each night sequentially — update all rolling state
  let simAssignments = [...doctor.assignments];
  let simRestUntilMs = doctor.restUntilMs;
  let simNightDates = [...doctor.consecutiveNightDates];
  let simConsecDates = [...doctor.consecutiveDates];
  let simOncallLast7 = [...doctor.oncallDatesLast7];  // updated per night to catch A14 across block

  for (const night of block.nights) {
    const tempDoctor: DoctorRunningTotals = {
      ...doctor,
      assignments: simAssignments,
      restUntilMs: simRestUntilMs,
      consecutiveNightDates: simNightDates,
      consecutiveDates: simConsecDates,
      oncallDatesLast7: simOncallLast7,
    };

    const result = checkSingleShift(tempDoctor, night, wtr);
    if (!result.pass) {
      return {
        pass: false,
        rule: result.rule,
        detail: `Block night ${night.date}: ${result.detail}`,
      };
    }

    // Advance simulated state for next night in block
    simAssignments = [...simAssignments, night];
    simNightDates = isConsecutiveStreak(simNightDates, night.date)
      ? [...simNightDates, night.date]
      : [night.date];
    simConsecDates = isConsecutiveStreak(simConsecDates, night.date)
      ? [...simConsecDates, night.date]
      : [night.date];
    if (night.isOncall) {
      simOncallLast7 = [...simOncallLast7, night.date];
    }
  }

  // A2 — 168h window check across the full block (all nights together)
  const allWithBlock = [...doctor.assignments, ...block.nights];
  for (const night of block.nights) {
    const backwardH = hoursInWindow(allWithBlock, night.endMs - MS_168H, night.endMs);
    if (backwardH > wtr.maxHoursIn168h) {
      return {
        pass: false,
        rule: 'A2_168H_WINDOW',
        detail: `Block night ${night.date}: ${backwardH.toFixed(1)}h in 168h backward window (max ${wtr.maxHoursIn168h}h)`,
      };
    }
    const forwardH = hoursInWindow(allWithBlock, night.startMs, night.startMs + MS_168H);
    if (forwardH > wtr.maxHoursIn168h) {
      return {
        pass: false,
        rule: 'A2_168H_WINDOW',
        detail: `Block night ${night.date}: ${forwardH.toFixed(1)}h in 168h forward window (max ${wtr.maxHoursIn168h}h)`,
      };
    }
  }

  // Post-block 46h rest — check nothing is already committed that would breach it
  const lastNight = block.nights[block.nights.length - 1];
  const requiredRestUntilMs = lastNight.endMs + wtr.minRestHoursAfter.nights * MS_PER_HOUR;
  const firstAfterBlock = doctor.assignments
    .filter((a) => a.startMs >= lastNight.endMs)
    .sort((a, b) => a.startMs - b.startMs)[0];
  if (firstAfterBlock && firstAfterBlock.startMs < requiredRestUntilMs) {
    return {
      pass: false,
      rule: 'A4_POST_BLOCK_REST',
      detail: `Committed shift on ${firstAfterBlock.date} is only ${((firstAfterBlock.startMs - lastNight.endMs) / MS_PER_HOUR).toFixed(1)}h after block end (need ${wtr.minRestHoursAfter.nights}h)`,
    };
  }

  return { pass: true, rule: null, detail: null };
}
