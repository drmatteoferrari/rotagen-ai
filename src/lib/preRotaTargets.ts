import { computeWeekendCap } from './shiftTargets'
import type {
  TargetsData, DoctorTargets, TeamSummaryRow, LeaveSummary, CalendarDoctor,
} from './preRotaTypes'

// ─── Grade ordering ───────────────────────────────────────────
const GRADE_ORDER: Record<string, number> = {
  CT1: 1, CT2: 2, CT3: 3, ST4: 4, ST5: 5, SAS: 5, ST6: 6, ST7: 7, ST8: 8,
  ST9: 9, 'Post-CCT Fellow': 8, Consultant: 10, Other: 1,
}

// ─── Input types ──────────────────────────────────────────────
interface ShiftTypeInput {
  id: string
  name: string
  shiftKey: string
  isOncall: boolean
  targetPercentage: number
  durationHours: number
}

interface DoctorInput {
  id: string
  firstName: string
  lastName: string
  grade: string
  wte: number
}

export interface TargetsBuilderInputs {
  wtrMaxHoursPerWeek: number
  wtrMaxHoursPer168h: number
  weekendFrequency: number
  rotaWeeks: number
  globalOncallPct: number
  globalNonOncallPct: number
  shiftTypes: ShiftTypeInput[]
  doctors: DoctorInput[]
  calendarDoctors: CalendarDoctor[]
}

// ─── Helpers ──────────────────────────────────────────────────

function r1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

function isWeekday(isoDate: string): boolean {
  try {
    const [y, m, d] = isoDate.split('-').map(Number)
    if (!y || !m || !d) return false
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    return dow >= 1 && dow <= 5
  } catch {
    return false
  }
}

// ─── Leave computation ────────────────────────────────────────
function computeLeaveSummary(
  calDoc: CalendarDoctor | undefined,
  wte: number,
  standardDayHours: number,
  oncallPct: number,
  nonOncallPct: number,
  totalEnvelope: number,
): LeaveSummary {
  if (!calDoc?.availability) {
    return {
      alSlBhDays: 0, plRotDays: 0,
      alSlBhHoursDeducted: 0, plRotHoursDeducted: 0,
      availableHours: r1(totalEnvelope),
    }
  }

  let alSlBhDays = 0
  let plRotDays = 0

  for (const [date, cell] of Object.entries(calDoc.availability)) {
    if (!isWeekday(date)) continue
    const p = cell?.primary
    if (!p) continue

    if (p === 'BH' || p === 'SL' || p === 'AL') {
      alSlBhDays++
    } else if (p === 'PL' || p === 'ROT') {
      plRotDays++
    }
  }

  const alSlBhHoursDeducted = r1(alSlBhDays * standardDayHours)

  const wteScalar = Math.max(0, Math.min(1, wte / 100))
  const plRotHoursDeducted = r1(plRotDays * standardDayHours * wteScalar)

  const availableHours = Math.max(0, r1(totalEnvelope - alSlBhHoursDeducted - plRotHoursDeducted))

  return { alSlBhDays, plRotDays, alSlBhHoursDeducted, plRotHoursDeducted, availableHours }
}

// ─── Main builder ─────────────────────────────────────────────
export function buildTargetsData(inputs: TargetsBuilderInputs): TargetsData {
  const {
    wtrMaxHoursPerWeek, wtrMaxHoursPer168h, weekendFrequency, rotaWeeks,
    globalOncallPct, globalNonOncallPct, shiftTypes, doctors, calendarDoctors,
  } = inputs

  const safeMaxHoursPerWeek = wtrMaxHoursPerWeek > 0 ? wtrMaxHoursPerWeek : 48
  const standardDayHours = safeMaxHoursPerWeek / 5

  const rawBucketTotal = globalOncallPct + globalNonOncallPct
  const safeOncallPct = rawBucketTotal > 0 ? (globalOncallPct / rawBucketTotal) * 100 : 50
  const safeNonOncallPct = rawBucketTotal > 0 ? (globalNonOncallPct / rawBucketTotal) * 100 : 50

  const sorted = [...doctors].sort(
    (a, b) => (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0)
  )

  const doctorTargets: DoctorTargets[] = sorted.map(doctor => {
    const wteScaling = Math.max(0, Math.min(1, doctor.wte / 100))
    const totalEnvelope = r1(safeMaxHoursPerWeek * rotaWeeks * wteScaling)

    const calDoc = calendarDoctors.find(c => c.doctorId === doctor.id)

    const leave = computeLeaveSummary(
      calDoc, doctor.wte, standardDayHours,
      safeOncallPct, safeNonOncallPct, totalEnvelope,
    )

    let oncallBucket = r1(totalEnvelope * (safeOncallPct / 100))
    let nonOncallBucket = r1(totalEnvelope * (safeNonOncallPct / 100))

    const plRotOncallShare = r1(leave.plRotHoursDeducted * (safeOncallPct / 100))
    const plRotNonOncallShare = r1(leave.plRotHoursDeducted * (safeNonOncallPct / 100))
    oncallBucket = Math.max(0, r1(oncallBucket - plRotOncallShare))
    nonOncallBucket = Math.max(0, r1(nonOncallBucket - plRotNonOncallShare))

    nonOncallBucket = Math.max(0, r1(nonOncallBucket - leave.alSlBhHoursDeducted))

    const shiftTargets = shiftTypes.map(shift => {
      const bucket = shift.isOncall ? oncallBucket : nonOncallBucket
      const pct = Math.max(0, shift.targetPercentage)
      const maxTargetHours = r1(bucket * (pct / 100))
      const estimatedShiftCount =
        shift.durationHours > 0 ? Math.round(maxTargetHours / shift.durationHours) : 0
      return {
        shiftTypeId: shift.id,
        shiftName: shift.name,
        shiftKey: shift.shiftKey,
        isOncall: shift.isOncall,
        maxTargetHours,
        estimatedShiftCount,
      }
    })

    const totalMaxHours = r1(shiftTargets.reduce((s, t) => s + t.maxTargetHours, 0))

    const { maxWeekends } = computeWeekendCap({
      rotaWeeks,
      weekendFrequency,
      wtePercent: Math.max(0, Math.min(100, doctor.wte)),
    })

    return {
      doctorId: doctor.id,
      doctorName: `Dr ${doctor.firstName} ${doctor.lastName}`,
      grade: doctor.grade,
      wte: doctor.wte,
      contractedHoursPerWeek: r1(safeMaxHoursPerWeek * wteScaling),
      hardWeeklyCap: wtrMaxHoursPer168h,
      weekendCap: maxWeekends,
      totalMaxHours,
      leaveSummary: leave,
      shiftTargets,
    }
  })

  const n = doctorTargets.length || 1

  const teamTotal: TeamSummaryRow = {
    label: 'Team Total',
    totalMaxHours: r1(doctorTargets.reduce((s, d) => s + d.totalMaxHours, 0)),
    weekendCap: doctorTargets.reduce((s, d) => s + d.weekendCap, 0),
    shiftTargets: shiftTypes.map(st => ({
      shiftTypeId: st.id,
      value: r1(doctorTargets.reduce(
        (s, d) => s + (d.shiftTargets.find(x => x.shiftTypeId === st.id)?.maxTargetHours ?? 0), 0
      )),
    })),
  }

  const teamAverage: TeamSummaryRow = {
    label: 'Team Average',
    totalMaxHours: r1(teamTotal.totalMaxHours / n),
    weekendCap: Math.round(teamTotal.weekendCap / n),
    shiftTargets: teamTotal.shiftTargets.map(t => ({
      shiftTypeId: t.shiftTypeId,
      value: r1(t.value / n),
    })),
  }

  return {
    wtrMaxHoursPerWeek: safeMaxHoursPerWeek,
    hardWeeklyCap: wtrMaxHoursPer168h,
    rotaWeeks,
    shiftTypes: shiftTypes.map(s => ({
      id: s.id, name: s.name, isOncall: s.isOncall, durationHours: s.durationHours,
    })),
    doctors: doctorTargets,
    teamTotal,
    teamAverage,
  }
}
