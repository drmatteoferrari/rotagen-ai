// ✅ Section 3 complete

import type { ValidationIssue } from './preRotaTypes'

interface ValidationInputs {
  rotaConfig: {
    startDate: string
    endDate: string
    durationWeeks: number
    globalOncallPct: number
    globalNonOncallPct: number
    surveyDeadline: string | null
  }
  shiftTypes: {
    id: string
    name: string
    reqIac: number
    reqIaoc: number
    reqIcu: number
    reqTransfer: number
    reqMinGrade: string | null
    minDoctors: number
  }[]
  doctors: {
    id: string
    firstName: string
    lastName: string
    grade: string | null
    surveyStatus: string
    survey: {
      wtePercent: number | null
      annualLeave: { startDate: string; endDate: string }[]
      studyLeave: { startDate: string; endDate: string }[]
      nocDates: { startDate: string; endDate: string }[]
      rotations: { startDate: string; endDate: string; location: string }[]
      ltftDaysOff: string[]
      ltftNightFlexibility: { day: string; canStart: boolean | null; canEnd: boolean | null }[]
      alEntitlement: number | null
      parentalLeaveExpected: boolean
      parentalLeaveStart: string | null
      competencies: {
        iacAchieved: boolean | null
        iaocAchieved: boolean | null
        icuAchieved: boolean | null
        transferAchieved: boolean | null
      }
    } | null
  }[]
  bankHolidays: string[]
}

const GRADE_ORDER: Record<string, number> = {
  CT1: 1, CT2: 2, CT3: 3, ST4: 4, ST5: 5, SAS: 5, ST6: 6, ST7: 7, ST8: 8,
  ST9: 9, 'Post-CCT Fellow': 8, Consultant: 10, Other: 1,
}

export function runPreRotaValidation(inputs: ValidationInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { rotaConfig, shiftTypes, doctors } = inputs
  const rotaStart = new Date(rotaConfig.startDate)
  const rotaEnd = new Date(rotaConfig.endDate)
  const rotaDays = Math.round((rotaEnd.getTime() - rotaStart.getTime()) / 86400000) + 1

  const countDays = (periods: { startDate: string; endDate: string }[]) =>
    periods.reduce((sum, p) => {
      if (!p.startDate || !p.endDate) return sum
      return sum + Math.max(0, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000) + 1)
    }, 0)

  const inPeriod = (d: string) => { const dt = new Date(d); return dt >= rotaStart && dt <= rotaEnd }

  // ── CRITICAL ─────────────────────────────────────────────────

  // C1: on-call + non-oncall split must equal 100
  if (Math.round(rotaConfig.globalOncallPct + rotaConfig.globalNonOncallPct) !== 100) {
    issues.push({
      severity: 'critical', code: 'ONCALL_SPLIT_INVALID',
      doctorId: null, doctorName: null,
      message: `On-call split (${rotaConfig.globalOncallPct}%) + non-oncall (${rotaConfig.globalNonOncallPct}%) must equal 100%. Update in department setup.`,
    })
  }

  for (const doctor of doctors) {
    const name = `Dr ${doctor.firstName} ${doctor.lastName}`

    // C2: no survey submitted
    if (!doctor.survey || doctor.surveyStatus === 'not_started') {
      issues.push({ severity: 'critical', code: 'MISSING_SURVEY', doctorId: doctor.id, doctorName: name, message: `${name} has not submitted a survey.` })
      continue
    }

    // C3: WTE missing or zero
    if (!doctor.survey.wtePercent || doctor.survey.wtePercent === 0) {
      issues.push({ severity: 'critical', code: 'MISSING_WTE', doctorId: doctor.id, doctorName: name, message: `${name} has no WTE percentage recorded.`, field: 'wte_percent' })
    }

    // C4: leave dates outside rota period
    const allLeave = [
      ...doctor.survey.annualLeave.map(l => ({ ...l, type: 'AL' })),
      ...doctor.survey.studyLeave.map(l => ({ ...l, type: 'SL' })),
      ...doctor.survey.nocDates.map(l => ({ ...l, type: 'NOC' })),
    ]
    for (const leave of allLeave) {
      if (leave.startDate && !inPeriod(leave.startDate))
        issues.push({ severity: 'critical', code: 'LEAVE_OUTSIDE_PERIOD', doctorId: doctor.id, doctorName: name, message: `${name}: ${leave.type} start date ${leave.startDate} is outside the rota period.` })
      if (leave.endDate && !inPeriod(leave.endDate))
        issues.push({ severity: 'critical', code: 'LEAVE_OUTSIDE_PERIOD', doctorId: doctor.id, doctorName: name, message: `${name}: ${leave.type} end date ${leave.endDate} is outside the rota period.` })
    }

    // C5: total AL + SL exceeds full rota length
    const totalLeaveDays = countDays(doctor.survey.annualLeave) + countDays(doctor.survey.studyLeave)
    if (totalLeaveDays > rotaDays)
      issues.push({ severity: 'critical', code: 'LEAVE_EXCEEDS_PERIOD', doctorId: doctor.id, doctorName: name, message: `${name}: Total AL + SL (${totalLeaveDays} days) exceeds the rota length (${rotaDays} days).` })

    // C6: rotation covers entire rota period
    for (const rot of doctor.survey.rotations) {
      if (!rot.startDate || !rot.endDate) continue
      if (new Date(rot.startDate) <= rotaStart && new Date(rot.endDate) >= rotaEnd)
        issues.push({ severity: 'critical', code: 'ROTATION_FULL_OVERLAP', doctorId: doctor.id, doctorName: name, message: `${name}: Rotation to ${rot.location} covers the entire rota period — doctor has no availability.` })
    }

    // C7: overlapping leave periods for same doctor
    const checkOverlap = (periods: { startDate: string; endDate: string }[], type: string) => {
      for (let i = 0; i < periods.length; i++) {
        for (let j = i + 1; j < periods.length; j++) {
          const a = periods[i], b = periods[j]
          if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue
          if (new Date(a.startDate) <= new Date(b.endDate) && new Date(b.startDate) <= new Date(a.endDate))
            issues.push({ severity: 'critical', code: 'LEAVE_DATE_OVERLAP', doctorId: doctor.id, doctorName: name, message: `${name}: Two ${type} periods overlap (${a.startDate}–${a.endDate} and ${b.startDate}–${b.endDate}).` })
        }
      }
    }
    checkOverlap(doctor.survey.annualLeave, 'AL')
    checkOverlap(doctor.survey.studyLeave, 'SL')
  }

  // ── WARNINGS ─────────────────────────────────────────────────

  for (const doctor of doctors) {
    if (!doctor.survey || doctor.surveyStatus === 'not_started') continue
    const name = `Dr ${doctor.firstName} ${doctor.lastName}`
    const wte = doctor.survey.wtePercent ?? 100

    // W1: AL significantly exceeds pro-rata entitlement
    const entitlement = doctor.survey.alEntitlement ?? 27
    const proRata = Math.round((rotaConfig.durationWeeks / 52) * entitlement * (wte / 100))
    if (countDays(doctor.survey.annualLeave) > proRata * 1.25)
      issues.push({ severity: 'warning', code: 'AL_EXCEEDS_ENTITLEMENT', doctorId: doctor.id, doctorName: name, message: `${name}: AL entered (${countDays(doctor.survey.annualLeave)} days) significantly exceeds estimated pro-rata entitlement (${proRata} days).`, field: 'annual_leave' })

    // W2: LTFT days off selected but night flexibility incomplete
    for (const day of doctor.survey.ltftDaysOff) {
      const flex = doctor.survey.ltftNightFlexibility.find(f => f.day === day)
      if (!flex || flex.canStart === null || flex.canEnd === null)
        issues.push({ severity: 'warning', code: 'LTFT_MISSING_NIGHT_FLEX', doctorId: doctor.id, doctorName: name, message: `${name}: LTFT day off '${day}' is missing night flexibility answers.`, field: 'ltft_night_flexibility' })
    }

    // W3: all competencies blank on submitted survey
    const { iacAchieved, iaocAchieved, icuAchieved } = doctor.survey.competencies
    if (iacAchieved === null && iaocAchieved === null && icuAchieved === null)
      issues.push({ severity: 'warning', code: 'COMPETENCIES_BLANK', doctorId: doctor.id, doctorName: name, message: `${name}: All competency fields are blank — survey step 2 may not have been completed.`, field: 'competencies_json' })
  }

  // W4–W6: team-level shift requirement checks
  const teamIac  = doctors.filter(d => d.survey?.competencies.iacAchieved  === true).length
  const teamIaoc = doctors.filter(d => d.survey?.competencies.iaocAchieved === true).length
  const teamIcu  = doctors.filter(d => d.survey?.competencies.icuAchieved  === true).length

  for (const shift of shiftTypes) {
    if (shift.reqIac  > 0 && teamIac  < shift.reqIac)
      issues.push({ severity: 'warning', code: 'SHIFT_UNREACHABLE_IAC',  doctorId: null, doctorName: null, message: `Shift "${shift.name}" requires ${shift.reqIac} IAC-competent doctor(s) but only ${teamIac} in the team have IAC.` })
    if (shift.reqIaoc > 0 && teamIaoc < shift.reqIaoc)
      issues.push({ severity: 'warning', code: 'SHIFT_UNREACHABLE_IAOC', doctorId: null, doctorName: null, message: `Shift "${shift.name}" requires ${shift.reqIaoc} IAOC-competent doctor(s) but only ${teamIaoc} in the team have IAOC.` })
    if (shift.reqIcu  > 0 && teamIcu  < shift.reqIcu)
      issues.push({ severity: 'warning', code: 'SHIFT_UNREACHABLE_ICU',  doctorId: null, doctorName: null, message: `Shift "${shift.name}" requires ${shift.reqIcu} ICU-competent doctor(s) but only ${teamIcu} in the team have ICU.` })
    if (shift.reqMinGrade) {
      const required = GRADE_ORDER[shift.reqMinGrade] ?? 0
      if (!doctors.some(d => d.grade && (GRADE_ORDER[d.grade] ?? 0) >= required))
        issues.push({ severity: 'warning', code: 'SHIFT_GRADE_UNMET', doctorId: null, doctorName: null, message: `Shift "${shift.name}" requires grade ${shift.reqMinGrade}+ but no doctor in the team meets this grade.` })
    }
  }

  // W7: deadline passed, not all submitted
  if (rotaConfig.surveyDeadline) {
    const unsubmitted = doctors.filter(d => d.surveyStatus !== 'submitted').length
    if (new Date() > new Date(rotaConfig.surveyDeadline) && unsubmitted > 0)
      issues.push({ severity: 'warning', code: 'DEADLINE_PASSED_MISSING', doctorId: null, doctorName: null, message: `Survey deadline has passed but ${unsubmitted} doctor(s) have not submitted.` })
  }

  // ── INFO ─────────────────────────────────────────────────────

  for (const doctor of doctors) {
    if (!doctor.survey) continue
    const name = `Dr ${doctor.firstName} ${doctor.lastName}`
    const wte = doctor.survey.wtePercent ?? 100

    // I1: parental leave during rota
    if (doctor.survey.parentalLeaveExpected && doctor.survey.parentalLeaveStart)
      issues.push({ severity: 'info', code: 'PARENTAL_LEAVE_FLAGGED', doctorId: doctor.id, doctorName: name, message: `${name}: Parental leave expected from ${doctor.survey.parentalLeaveStart}.` })

    // I2: LTFT day count mismatch vs WTE
    if (doctor.survey.ltftDaysOff.length > 0 && wte < 100) {
      const expectedDays = Math.round((1 - wte / 100) * 5)
      if (doctor.survey.ltftDaysOff.length !== expectedDays)
        issues.push({ severity: 'info', code: 'LTFT_DAY_COUNT_MISMATCH', doctorId: doctor.id, doctorName: name, message: `${name}: ${doctor.survey.ltftDaysOff.length} LTFT day(s) off selected but ${expectedDays} expected for ${wte}% WTE.`, field: 'ltft_days_off' })
    }
  }

  // I3: high leave concentration (4+ doctors on AL/SL same week)
  const leaveCountByDate: Record<string, number> = {}
  for (const doctor of doctors) {
    if (!doctor.survey) continue
    for (const leave of [...doctor.survey.annualLeave, ...doctor.survey.studyLeave]) {
      if (!leave.startDate || !leave.endDate) continue
      const cur = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      while (cur <= end) {
        const key = cur.toISOString().split('T')[0]
        leaveCountByDate[key] = (leaveCountByDate[key] ?? 0) + 1
        cur.setDate(cur.getDate() + 1)
      }
    }
  }
  const flaggedWeeks = new Set<string>()
  for (const [date, count] of Object.entries(leaveCountByDate)) {
    if (count >= 4) {
      const d = new Date(date)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      flaggedWeeks.add(d.toISOString().split('T')[0])
    }
  }
  for (const weekStart of flaggedWeeks)
    issues.push({ severity: 'info', code: 'HIGH_LEAVE_CONCENTRATION', doctorId: null, doctorName: null, message: `Week starting ${weekStart}: 4 or more doctors have AL/SL — check coverage is sufficient.` })

  return issues
}
