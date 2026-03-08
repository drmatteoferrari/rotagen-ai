// ✅ Section 5 complete

import { computeShiftTargets, computeWeekendCap } from './shiftTargets'
import type { TargetsData, DoctorTargets, TeamSummaryRow } from './preRotaTypes'

const GRADE_ORDER: Record<string, number> = {
  CT1: 1, CT2: 2, CT3: 3, ST4: 4, ST5: 5, SAS: 5, ST6: 6, ST7: 7, ST8: 8,
  ST9: 9, 'Post-CCT Fellow': 8, Consultant: 10, Other: 1,
}

interface TargetsBuilderInputs {
  wtrMaxHoursPerWeek: number
  wtrMaxHoursPer168h: number
  weekendFrequency: number
  rotaWeeks: number
  globalOncallPct: number
  globalNonOncallPct: number
  shiftTypes: {
    id: string
    name: string
    shiftKey: string
    isOncall: boolean
    targetPercentage: number
    durationHours: number
  }[]
  doctors: {
    id: string
    firstName: string
    lastName: string
    grade: string
    wte: number
  }[]
}

export function buildTargetsData(inputs: TargetsBuilderInputs): TargetsData {
  const { wtrMaxHoursPerWeek, wtrMaxHoursPer168h, weekendFrequency, rotaWeeks,
    globalOncallPct, globalNonOncallPct, shiftTypes, doctors } = inputs

  const sorted = [...doctors].sort((a, b) => (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0))

  const doctorTargets: DoctorTargets[] = sorted.map(doctor => {
    const result = computeShiftTargets({
      maxHoursPerWeek: wtrMaxHoursPerWeek,
      maxHoursPer168h: wtrMaxHoursPer168h,
      rotaWeeks,
      globalOncallPct,
      globalNonOncallPct,
      shiftTypes,
      wtePercent: doctor.wte,
    })

    const { maxWeekends } = computeWeekendCap({ rotaWeeks, weekendFrequency, wtePercent: doctor.wte })

    return {
      doctorId: doctor.id,
      doctorName: `Dr ${doctor.firstName} ${doctor.lastName}`,
      grade: doctor.grade,
      wte: doctor.wte,
      contractedHoursPerWeek: Math.round(wtrMaxHoursPerWeek * (doctor.wte / 100) * 10) / 10, // ✅ Section 6 complete
      hardWeeklyCap: wtrMaxHoursPer168h,
      weekendCap: maxWeekends,
      totalMaxHours: result.totalMaxTargetHours,
      shiftTargets: result.targets.map(t => ({
        shiftTypeId: t.shiftId,
        shiftName: t.shiftName,
        shiftKey: t.shiftKey,
        isOncall: shiftTypes.find(s => s.id === t.shiftId)?.isOncall ?? false,
        maxTargetHours: t.maxTargetHours,
        estimatedShiftCount: t.estimatedShiftCount,
      })),
    }
  })

  const n = doctorTargets.length || 1

  const teamTotal: TeamSummaryRow = {
    label: 'Team Total',
    totalMaxHours: doctorTargets.reduce((s, d) => s + d.totalMaxHours, 0),
    weekendCap: doctorTargets.reduce((s, d) => s + d.weekendCap, 0),
    shiftTargets: shiftTypes.map(st => ({
      shiftTypeId: st.id,
      value: doctorTargets.reduce((s, d) => s + (d.shiftTargets.find(x => x.shiftTypeId === st.id)?.maxTargetHours ?? 0), 0),
    })),
  }

  const teamAverage: TeamSummaryRow = {
    label: 'Team Average',
    totalMaxHours: Math.round((teamTotal.totalMaxHours / n) * 10) / 10,
    weekendCap: Math.round((teamTotal.weekendCap / n) * 10) / 10,
    shiftTargets: teamTotal.shiftTargets.map(t => ({
      shiftTypeId: t.shiftTypeId,
      value: Math.round((t.value / n) * 10) / 10,
    })),
  }

  return {
    wtrMaxHoursPerWeek,
    hardWeeklyCap: wtrMaxHoursPer168h,
    rotaWeeks,
    shiftTypes: shiftTypes.map(s => ({ id: s.id, name: s.name, isOncall: s.isOncall, durationHours: s.durationHours })),
    doctors: doctorTargets,
    teamTotal,
    teamAverage,
  }
}
