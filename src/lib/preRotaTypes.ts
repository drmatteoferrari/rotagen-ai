// ✅ Section 2 complete

// ─── Validation ───────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'warning' | 'info'

export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  doctorId: string | null      // null = team-level issue
  doctorName: string | null
  message: string
  field?: string               // optional — links to the survey field causing the issue
}

// ─── Calendar ─────────────────────────────────────────────────

export type CellCode = 'AL' | 'SL' | 'NOC' | 'ROT' | 'PL' | 'BH' | 'LTFT' | 'AVAILABLE'

export interface CalendarCell {
  primary: CellCode            // highest-priority event
  secondary: CellCode | null   // secondary label shown in brackets (e.g. [LTFT], [BH])
  label: string                // display string e.g. "AL", "AL [LTFT]", "NOC [BH]"
}

export interface CalendarDoctor {
  doctorId: string
  doctorName: string
  grade: string
  wte: number
  ltftDaysOff: string[]        // e.g. ['monday', 'tuesday']
  availability: Record<string, CalendarCell>  // key = ISO date string 'YYYY-MM-DD'
}

export interface CalendarWeek {
  weekNumber: number
  startDate: string            // ISO date, always a Monday
  endDate: string              // ISO date, always a Sunday
  dates: string[]              // 7 ISO date strings, Mon–Sun
}

export interface CalendarData {
  rotaStartDate: string
  rotaEndDate: string
  rotaWeeks: number
  departmentName: string
  hospitalName: string
  bankHolidays: string[]       // ISO date strings
  weeks: CalendarWeek[]
  doctors: CalendarDoctor[]
}

// ─── Targets ──────────────────────────────────────────────────

export interface LeaveSummary {
  alSlBhDays: number
  plRotDays: number
  alSlBhHoursDeducted: number
  plRotHoursDeducted: number
  availableHours: number
}

export interface DoctorShiftTarget {
  shiftTypeId: string
  shiftName: string
  shiftKey: string
  isOncall: boolean
  maxTargetHours: number
  estimatedShiftCount: number
}

export interface DoctorTargets {
  doctorId: string
  doctorName: string
  grade: string
  wte: number
  contractedHoursPerWeek: number   // = wtr maxHoursPerWeek
  hardWeeklyCap: number            // = wtr maxHoursPer168h
  weekendCap: number
  totalMaxHours: number
  shiftTargets: DoctorShiftTarget[]
}

export interface TeamSummaryRow {
  label: 'Team Total' | 'Team Average'
  totalMaxHours: number
  weekendCap: number
  shiftTargets: { shiftTypeId: string; value: number }[]
}

export interface TargetsData {
  wtrMaxHoursPerWeek: number
  hardWeeklyCap: number
  rotaWeeks: number
  shiftTypes: { id: string; name: string; isOncall: boolean; durationHours: number }[]
  doctors: DoctorTargets[]
  teamTotal: TeamSummaryRow
  teamAverage: TeamSummaryRow
}

// ─── Pre-rota result ──────────────────────────────────────────

export type PreRotaStatus = 'blocked' | 'complete_with_warnings' | 'complete'

export interface PreRotaResult {
  id: string
  rotaConfigId: string
  generatedAt: string          // ISO datetime
  generatedBy: string
  status: PreRotaStatus
  validationIssues: ValidationIssue[]
  calendarData: CalendarData
  targetsData: TargetsData
  isStale: boolean             // computed on load, not stored in DB
}
