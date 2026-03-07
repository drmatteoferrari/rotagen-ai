// ✅ Section 4 complete

import type { CalendarData, CalendarDoctor, CalendarCell, CellCode } from './preRotaTypes'

// Priority: higher index = wins when multiple events on same date
const CELL_PRIORITY: CellCode[] = ['AVAILABLE', 'LTFT', 'BH', 'NOC', 'PL', 'ROT', 'SL', 'AL']
const priorityOf = (code: CellCode) => CELL_PRIORITY.indexOf(code)

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const endDt = new Date(end + 'T00:00:00')
  while (cur <= endDt) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
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
  const firstDate = new Date(rotaStartDate + 'T00:00:00')
  const dow = firstDate.getDay()
  const weekStartDate = new Date(firstDate)
  weekStartDate.setDate(weekStartDate.getDate() - ((dow + 6) % 7)) // align to Monday

  for (let w = 0; w < rotaWeeks + 2; w++) {
    const wEnd = new Date(weekStartDate)
    wEnd.setDate(weekStartDate.getDate() + 6)
    const dates = dateRange(
      weekStartDate.toISOString().split('T')[0],
      wEnd.toISOString().split('T')[0]
    ).filter(d => d >= rotaStartDate && d <= rotaEndDate)
    if (dates.length > 0) {
      weeks.push({
        weekNumber: weeks.length + 1,
        startDate: weekStartDate.toISOString().split('T')[0],
        endDate: wEnd.toISOString().split('T')[0],
        dates,
      })
    }
    weekStartDate.setDate(weekStartDate.getDate() + 7)
  }

  // Build per-doctor availability
  const calendarDoctors: CalendarDoctor[] = doctors.map(doctor => {
    const s = doctor.survey
    const availability: Record<string, CalendarCell> = {}

    for (const date of allDates) {
      const dayName = DAY_NAMES[new Date(date + 'T00:00:00').getDay()]
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
