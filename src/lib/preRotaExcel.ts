// ✅ Section 6 complete

import * as XLSX from 'xlsx'
import type { CalendarData, TargetsData, CellCode } from './preRotaTypes'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function dayOfWeek(iso: string): number {
  return new Date(iso + 'T00:00:00').getDay()
}

function isWeekend(iso: string): boolean {
  const dow = dayOfWeek(iso)
  return dow === 0 || dow === 6
}

export function generatePreRotaExcel(calendarData: CalendarData, targetsData: TargetsData): Blob {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary Calendar (rows=doctors, columns=dates) ──
  const allDates: string[] = []
  for (const week of calendarData.weeks) {
    for (const date of week.dates) {
      if (!allDates.includes(date)) allDates.push(date)
    }
  }

  const s1Data: (string | number)[][] = []

  // Row 1: Title
  const titleRow: string[] = [`RotaGen — Availability Calendar: ${calendarData.departmentName}, ${calendarData.hospitalName} | ${calendarData.rotaStartDate} – ${calendarData.rotaEndDate} | ${calendarData.rotaWeeks} weeks`]
  s1Data.push(titleRow)

  // Row 2: Headers
  const headerRow = ['Doctor', 'Grade', 'WTE', ...allDates.map(fmtDateShort)]
  s1Data.push(headerRow)

  // Doctor rows
  for (const doctor of calendarData.doctors) {
    const row: (string | number)[] = [doctor.doctorName, doctor.grade, `${doctor.wte}%`]
    for (const date of allDates) {
      const cell = doctor.availability[date]
      row.push(cell ? (cell.primary === 'AVAILABLE' ? '' : cell.label) : '')
    }
    s1Data.push(row)
  }

  // Blank row
  s1Data.push([])

  // Available count row
  const availRow: (string | number)[] = ['Doctors available', '', '']
  for (const date of allDates) {
    const count = calendarData.doctors.filter(d => d.availability[date]?.primary === 'AVAILABLE').length
    availRow.push(count)
  }
  s1Data.push(availRow)

  // % available row
  const pctRow: (string | number)[] = ['% available', '', '']
  const totalDoctors = calendarData.doctors.length || 1
  for (const date of allDates) {
    const count = calendarData.doctors.filter(d => d.availability[date]?.primary === 'AVAILABLE').length
    pctRow.push(`${Math.round((count / totalDoctors) * 100)}%`)
  }
  s1Data.push(pctRow)

  const ws1 = XLSX.utils.aoa_to_sheet(s1Data)

  // Column widths
  const s1Cols: XLSX.ColInfo[] = [
    { wch: 22 }, { wch: 8 }, { wch: 6 },
    ...allDates.map(() => ({ wch: 7 })),
  ]
  ws1['!cols'] = s1Cols

  // Merge title row
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 + allDates.length } }]

  XLSX.utils.book_append_sheet(wb, ws1, 'Summary Calendar')

  // ── Sheet 2: Doctor Detail View (rows=dates, columns=doctors) ──
  const s2Data: (string | number)[][] = []

  // Row 1: Title
  s2Data.push([`RotaGen — Doctor Detail View: ${calendarData.departmentName}, ${calendarData.hospitalName} | ${calendarData.rotaStartDate} – ${calendarData.rotaEndDate}`])

  // Row 2: Headers
  s2Data.push(['Date', 'Day', ...calendarData.doctors.map(d => d.doctorName)])

  // Row 3: WTE
  s2Data.push(['WTE', '', ...calendarData.doctors.map(d => `${d.wte}%`)])

  // Row 4: LTFT days
  s2Data.push(['LTFT days', '', ...calendarData.doctors.map(d =>
    d.ltftDaysOff.length > 0
      ? d.ltftDaysOff.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ')
      : '—'
  )])

  // Date rows
  for (const date of allDates) {
    const row: (string | number)[] = [
      fmtDateLong(date),
      DAYS_SHORT[dayOfWeek(date)],
    ]
    for (const doctor of calendarData.doctors) {
      const cell = doctor.availability[date]
      row.push(cell ? (cell.primary === 'AVAILABLE' ? '' : cell.label) : '')
    }
    s2Data.push(row)
  }

  // Blank row
  s2Data.push([])

  // Summary counts
  const countTypes: { label: string; code: CellCode }[] = [
    { label: 'AL days', code: 'AL' },
    { label: 'SL days', code: 'SL' },
    { label: 'NOC days', code: 'NOC' },
    { label: 'ROT days', code: 'ROT' },
    { label: 'PL days', code: 'PL' },
    { label: 'BH days', code: 'BH' },
  ]

  for (const ct of countTypes) {
    const row: (string | number)[] = [ct.label, '']
    for (const doctor of calendarData.doctors) {
      const count = allDates.filter(d => doctor.availability[d]?.primary === ct.code).length
      row.push(count)
    }
    s2Data.push(row)
  }

  // Total unavailable
  const unavailRow: (string | number)[] = ['Total unavailable', '']
  for (const doctor of calendarData.doctors) {
    const count = allDates.filter(d => doctor.availability[d]?.primary !== 'AVAILABLE').length
    unavailRow.push(count)
  }
  s2Data.push(unavailRow)

  // Total available
  const availRow2: (string | number)[] = ['Total available', '']
  for (const doctor of calendarData.doctors) {
    const count = allDates.filter(d => doctor.availability[d]?.primary === 'AVAILABLE').length
    availRow2.push(count)
  }
  s2Data.push(availRow2)

  const ws2 = XLSX.utils.aoa_to_sheet(s2Data)

  // Column widths
  ws2['!cols'] = [
    { wch: 18 }, { wch: 6 },
    ...calendarData.doctors.map(() => ({ wch: 14 })),
  ]

  // Merge title
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 + calendarData.doctors.length } }]

  XLSX.utils.book_append_sheet(wb, ws2, 'Doctor Detail View')

  // Generate blob
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
