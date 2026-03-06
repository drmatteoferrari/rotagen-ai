// ✅ Section 4 complete
// ✅ Section 5 complete

// === Shift Target Computation ===

export interface ShiftTargetInputs {
  maxHoursPerWeek: number;
  maxHoursPer168h: number;
  rotaWeeks: number;
  globalOncallPct: number;
  globalNonOncallPct: number;
  shiftTypes: ShiftTargetShift[];
  wtePercent: number;
}

export interface ShiftTargetShift {
  id: string;
  name: string;
  shiftKey: string;
  isOncall: boolean;
  targetPercentage: number;
  durationHours: number;
}

export interface ShiftTargetResult {
  shiftId: string;
  shiftName: string;
  shiftKey: string;
  maxTargetHours: number;
  bucketHours: number;
  estimatedShiftCount: number;
  wteScalingApplied: number;
  rotaWeeks: number;
  maxHoursPerWeek: number;
}

export interface ComputeShiftTargetsResult {
  targets: ShiftTargetResult[];
  totalMaxTargetHours: number;
  oncallBucketHours: number;
  nonOncallBucketHours: number;
  hardWeeklyCap: number;
}

export function computeShiftTargets(inputs: ShiftTargetInputs): ComputeShiftTargetsResult {
  const {
    maxHoursPerWeek,
    maxHoursPer168h,
    rotaWeeks,
    globalOncallPct,
    globalNonOncallPct,
    shiftTypes,
    wtePercent,
  } = inputs;

  const wteScaling = wtePercent / 100;
  const totalHourEnvelope = maxHoursPerWeek * rotaWeeks * wteScaling;
  const oncallBucketHours = totalHourEnvelope * (globalOncallPct / 100);
  const nonOncallBucketHours = totalHourEnvelope * (globalNonOncallPct / 100);

  const targets: ShiftTargetResult[] = shiftTypes.map((shift) => {
    const bucketHours = shift.isOncall ? oncallBucketHours : nonOncallBucketHours;
    const maxTargetHours = bucketHours * (shift.targetPercentage / 100);
    const estimatedShiftCount =
      shift.durationHours > 0 ? Math.round(maxTargetHours / shift.durationHours) : 0;

    return {
      shiftId: shift.id,
      shiftName: shift.name,
      shiftKey: shift.shiftKey,
      maxTargetHours: Math.round(maxTargetHours * 10) / 10,
      bucketHours: Math.round(bucketHours * 10) / 10,
      estimatedShiftCount,
      wteScalingApplied: wteScaling,
      rotaWeeks,
      maxHoursPerWeek,
    };
  });

  const totalMaxTargetHours = targets.reduce((sum, t) => sum + t.maxTargetHours, 0);

  return {
    targets,
    totalMaxTargetHours: Math.round(totalMaxTargetHours * 10) / 10,
    oncallBucketHours: Math.round(oncallBucketHours * 10) / 10,
    nonOncallBucketHours: Math.round(nonOncallBucketHours * 10) / 10,
    hardWeeklyCap: maxHoursPer168h,
  };
}

// === Weekend Cap Computation ===

export interface WeekendCapInputs {
  rotaWeeks: number;
  weekendFrequency: number;
  wtePercent: number;
}

export interface WeekendCapResult {
  maxWeekends: number;
  totalWeekendsInPeriod: number;
}

export function computeWeekendCap(inputs: WeekendCapInputs): WeekendCapResult {
  const { rotaWeeks, weekendFrequency, wtePercent } = inputs;
  const totalWeekendsInPeriod = rotaWeeks;
  const maxWeekendsFullTime = Math.floor(totalWeekendsInPeriod / weekendFrequency);
  const maxWeekends = Math.floor(maxWeekendsFullTime * (wtePercent / 100));

  return {
    maxWeekends,
    totalWeekendsInPeriod,
  };
}
