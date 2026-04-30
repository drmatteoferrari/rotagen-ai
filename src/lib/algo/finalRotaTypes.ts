// src/lib/algo/finalRotaTypes.ts
// Internal algorithm types — never imported by UI or worker boundary files.

export interface ProposedShift {
  date: string;            // YYYY-MM-DD UTC
  shiftKey: string;
  startMs: number;         // Unix ms UTC
  endMs: number;           // Unix ms UTC
  durationHours: number;
  isOncall: boolean;
  isNight: boolean;
  isLong: boolean;
  isWeekend: boolean;      // true if date falls Saturday or Sunday UTC
}

export interface ProposedBlock {
  nights: ProposedShift[];  // chronologically ordered, minimum 2 entries
}

export interface DoctorRunningTotals {
  doctorId: string;
  assignments: ProposedShift[];
  restUntilMs: number;                      // cannot assign before this timestamp
  consecutiveDates: string[];               // YYYY-MM-DD, rolling current streak (any shift type)
  consecutiveNightDates: string[];          // current night streak only
  consecutiveLongDates: string[];           // current long-shift streak only
  weekendDatesWorked: string[];             // all weekend dates worked in rota so far
  oncallDatesLast7: string[];               // on-call dates in last 7 days rolling
  nightBlockHistory: string[][];            // each inner array = dates of one completed block
  weeklyHoursUsed: Record<string, number>;  // ISO week 'YYYY-WNN' → hours committed
  totalWeeksInRota: number;                 // constant — full rota period length in weeks
  exemptFromNights: boolean;
  exemptFromWeekends: boolean;
  exemptFromOncall: boolean;
}

export interface WtrResult {
  pass: boolean;
  rule: string | null;    // e.g. 'A3_MIN_REST' — null when pass=true
  detail: string | null;  // human-readable explanation for test harness output
}

// Mirrors FinalRotaInput.preRotaInput.wtrConstraints exactly — same field names
export interface WtrConstraints {
  maxAvgHoursPerWeek: number;
  maxHoursIn168h: number;
  maxShiftLengthH: number;
  minInterShiftRestH: number;
  maxConsecutive: {
    standard: number;   // max consecutive shifts of ANY type (not just standard) — typically 7
    long: number;
    nights: number;
    longEvening: number;
  };
  minRestHoursAfter: {
    nights: number;       // 46h post-night-block rest
    longShifts: number;
    standardShifts: number;
    longEveningShifts: number;
  };
  weekendFrequencyMax: number;  // e.g. 0.3333 = 1-in-3
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
}

export interface AllocationState {
  assignments: Record<string, ProposedShift[]>;   // YYYY-MM-DD → shifts placed on that date
  doctorRunning: Map<string, DoctorRunningTotals>;
  unfilledSlots: UnfilledSlot[];
}

export interface UnfilledSlot {
  date: string;
  shiftKey: string;
  slotIndex: number;
  reason: string;
  severity: 'critical' | 'warning';
}

export interface AvailabilityRow {
  doctorId: string;
  date: string;    // YYYY-MM-DD
  status: string;  // 'AVAILABLE' | 'AL' | 'SL' | 'PL' | 'ROT' | 'NOC' | 'BH' | 'LTFT'
}
