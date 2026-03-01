/**
 * Shift duration calculation utilities.
 * All calculations convert HH:MM to "minutes from midnight" first.
 */

/** Parse "HH:MM" to total minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Does the shift cross midnight? */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/** Calculate shift duration in decimal hours */
export function calcDurationHours(startTime: string, endTime: string): number {
  const sm = timeToMinutes(startTime);
  const em = timeToMinutes(endTime);
  let diff = em - sm;
  if (diff <= 0) diff += 1440; // 24h in minutes
  return parseFloat((diff / 60).toFixed(2));
}

/** Day-preset definitions */
export type DaysPreset = "weekday" | "weekend" | "ext_weekend" | "any" | "custom";

export interface ApplicableDays {
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
}

const PRESET_DAYS: Record<Exclude<DaysPreset, "custom">, ApplicableDays> = {
  weekday: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  weekend: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true },
  ext_weekend: { mon: false, tue: false, wed: false, thu: false, fri: true, sat: true, sun: true },
  any: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
};

export function getDaysForPreset(preset: DaysPreset): ApplicableDays {
  if (preset === "custom") {
    return { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false };
  }
  return { ...PRESET_DAYS[preset] };
}
