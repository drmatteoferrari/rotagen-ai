// ✅ Section 4 complete

import type { CalendarData, CalendarDoctor, CalendarCell, CellCode } from './preRotaTypes'

// Priority: higher index wins as primary when multiple events fall on the same date.
// BH=7 — bank holiday beats all leave types. A BH on an AL, SL, PL, or ROT day wins.
// PL=6, ROT=5 — full absence, but lose to BH.
// SL=4 beats AL=3 — when both on same weekday, SL wins for auditing clarity.
// NOC=2 — scheduling preference only, never treated as absence.
// LTFT=1, AVAILABLE=0 — lowest priority.
const CELL_PRIORITY: CellCode[] = ['AVAILABLE', 'LTFT', 'NOC', 'AL', 'SL', 'ROT', 'PL', 'BH']
const priorityOf = (code: CellCode) => CELL_PRIORITY.indexOf(code)

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const cur = new Date(Date.UTC(sy, sm - 1, sd))
  const endDt = new Date(Date.UTC(ey, em - 1, ed))
  while (cur <= endDt) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

function inAnyPeriod(date: string, periods: { startDate: string; endDate: string }[]): boolean {
  return periods.some(p => p.startDate && p.endDate && p.startDate <= date && date <= p.endDate)
}

const GRADE_ORDER: Record<string, number> = {
  CT1: 1, CT2: 2, CT3: 3, ST4: 4, ST5: 5, SAS: 5, ST6: 6, ST7: 7, ST8: 8,
  ST9: 9, 'Post-CCT Fellow': 8, Consultant: 10, Other: 1,
}

interface CalendarBuilderInputs {
  rotaStartDate: string
  rotaEndDate: string
  rotaWeeks: number
  departmentName: string
  hospitalName: string
  bankHolidays: string[]
  doctors: {
    id: string
    firstName: string
    lastName: string
    grade: string
    wte: number
    survey: {
      ltftDaysOff: string[]
      annualLeave: { startDate: string; endDate: string }[]
      studyLeave: { startDate: string; endDate: string }[]
      nocDates: { startDate: string; endDate: string }[]
      rotations: { startDate: string; endDate: string }[]
      parentalLeaveExpected: boolean
      parentalLeaveStart: string | null
      parentalLeaveEnd: string | null
    } | null
  }[]
}

export function buildCalendarData(inputs: CalendarBuilderInputs): CalendarData {
  const { rotaStartDate, rotaEndDate, rotaWeeks, departmentName, hospitalName, bankHolidays, doctors } = inputs
  const bhSet = new Set(bankHolidays)
  const allDates = dateRange(rotaStartDate, rotaEndDate)

  // Build weeks (Mon–Sun, clipped to rota period)
  const weeks = []
  const [fY, fM, fD] = rotaStartDate.split('-').map(Number)
  const firstDate = new Date(Date.UTC(fY, fM - 1, fD))
  const dow = firstDate.getUTCDay()
  const weekStartDate = new Date(firstDate)
  weekStartDate.setUTCDate(firstDate.getUTCDate() - ((dow + 6) % 7)) // align to Monday

  for (let w = 0; w < rotaWeeks + 2; w++) {
    const wEnd = new Date(weekStartDate)
    wEnd.setUTCDate(weekStartDate.getUTCDate() + 6)
    const wStartISO = weekStartDate.toISOString().split('T')[0]
    const wEndISO = wEnd.toISOString().split('T')[0]
    const dates = dateRange(wStartISO, wEndISO)
      .filter(d => d >= rotaStartDate && d <= rotaEndDate)
    if (dates.length > 0) {
      weeks.push({
        weekNumber: weeks.length + 1,
        startDate: wStartISO,
        endDate: wEndISO,
        dates,
      })
    }
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() + 7)
  }

  // Build per-doctor availability
  const calendarDoctors: CalendarDoctor[] = doctors.map(doctor => {
    const s = doctor.survey
    const availability: Record<string, CalendarCell> = {}

    for (const date of allDates) {
      const [dy, dm, dd] = date.split('-').map(Number)
      const dayName = DAY_NAMES[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
      const events: CellCode[] = []

      if (bhSet.has(date)) events.push('BH')
      if (s?.ltftDaysOff.includes(dayName)) events.push('LTFT')
      if (s && inAnyPeriod(date, s.annualLeave)) events.push('AL')
      if (s && inAnyPeriod(date, s.studyLeave)) events.push('SL')
      if (s && inAnyPeriod(date, s.nocDates)) events.push('NOC')
      if (s && inAnyPeriod(date, s.rotations)) events.push('ROT')
      if (s?.parentalLeaveExpected && s.parentalLeaveStart && s.parentalLeaveEnd &&
          date >= s.parentalLeaveStart && date <= s.parentalLeaveEnd) events.push('PL')

      if (events.length === 0) {
        availability[date] = { primary: 'AVAILABLE', secondary: null, label: '' }
      } else {
        events.sort((a, b) => priorityOf(b) - priorityOf(a))
        const primary = events[0]
        const secondary = events.length > 1 ? events[1] : null
        const label = secondary && secondary !== 'AVAILABLE'
          ? `${primary} [${secondary}]`
          : primary
        availability[date] = { primary, secondary, label }
      }
    }

    return {
      doctorId: doctor.id,
      doctorName: `Dr ${doctor.firstName} ${doctor.lastName}`,
      grade: doctor.grade,
      wte: doctor.wte,
      ltftDaysOff: s?.ltftDaysOff ?? [],
      availability,
    }
  })

  // Sort most senior first
  calendarDoctors.sort((a, b) => (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0))

  return { rotaStartDate, rotaEndDate, rotaWeeks, departmentName, hospitalName, bankHolidays, weeks, doctors: calendarDoctors }
}
