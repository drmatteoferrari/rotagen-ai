import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '@/components/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useRotaContext } from '@/contexts/RotaContext'
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile'
import { getTodayISO, mapOverrideRow, mergeOverridesIntoAvailability, type CalendarOverride, type MergedCell } from '@/lib/calendarOverrides'
import type { CalendarData, CalendarDoctor } from '@/lib/preRotaTypes'
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Constants ────────────────────────────────────────────────
const CHIP_COLOURS: Record<string, string> = {
  AL: '#16a34a',
  SL: '#2563eb',
  NOC: '#ec4899',
  ROT: '#c2410c',
  PL: '#7c3aed',
  LTFT: '#92400e',
}

const EVENT_LABELS: Record<string, string> = {
  AL: 'Annual leave',
  SL: 'Study leave',
  NOC: 'Not on-call',
  ROT: 'Rotation',
  PL: 'Parental leave',
  LTFT: 'LTFT day off',
}

const SKIP_CODES = new Set(['AVAILABLE', 'BH'])

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ─── Date helpers ─────────────────────────────────────────────
function isoToUTCDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function addDaysISO(iso: string, n: number): string {
  const d = isoToUTCDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function getMondayOfWeek(iso: string): string {
  const d = isoToUTCDate(iso)
  const dow = d.getUTCDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().split('T')[0]
}

function getISOWeekNumber(iso: string): number {
  const d = isoToUTCDate(iso)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  return Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 86400000)) + 1
}

function getMonthWeekRows(yearMonth: string): string[][] {
  const [y, m] = yearMonth.split('-').map(Number)
  const firstDay = new Date(Date.UTC(y, m - 1, 1))
  const lastDay = new Date(Date.UTC(y, m, 0))
  const monday = getMondayOfWeek(firstDay.toISOString().split('T')[0])
  const rows: string[][] = []
  let cursor = monday
  while (cursor <= lastDay.toISOString().split('T')[0]) {
    const week: string[] = []
    for (let i = 0; i < 7; i++) week.push(addDaysISO(cursor, i))
    rows.push(week)
    cursor = addDaysISO(cursor, 7)
  }
  return rows
}

function fmtShort(iso: string): string {
  const d = isoToUTCDate(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

function fmtFull(iso: string): string {
  return isoToUTCDate(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── Override indicator ───────────────────────────────────────
function OverrideDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: '#ea580c', marginLeft: 2, flexShrink: 0,
    }} />
  )
}

function renderMergedChips(cell: MergedCell | undefined, compact: boolean): JSX.Element[] {
  if (!cell) return []
  const result: JSX.Element[] = []

  if (cell.isDeleted && cell.deletedCode) {
    result.push(
      <span
        key="deleted"
        className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
        style={{ backgroundColor: '#d1d5db', color: '#6b7280', textDecoration: 'line-through' }}
      >
        {compact ? cell.deletedCode : (EVENT_LABELS[cell.deletedCode] ?? cell.deletedCode)}
      </span>
    )
    return result
  }

  if (cell.primary && !SKIP_CODES.has(cell.primary)) {
    result.push(
      <span
        key={cell.primary}
        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
        style={{ backgroundColor: CHIP_COLOURS[cell.primary] ?? 'hsl(var(--muted-foreground))' }}
      >
        {compact ? cell.primary : (EVENT_LABELS[cell.primary] ?? cell.primary)}
        {(cell.overrideAction === 'add' || cell.overrideAction === 'modify') && <OverrideDot />}
      </span>
    )
  }

  if (cell.secondary && !SKIP_CODES.has(cell.secondary)) {
    result.push(
      <span
        key={cell.secondary}
        className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
        style={{ backgroundColor: CHIP_COLOURS[cell.secondary] ?? 'hsl(var(--muted-foreground))' }}
      >
        {compact ? cell.secondary : (EVENT_LABELS[cell.secondary] ?? cell.secondary)}
      </span>
    )
  }

  return result
}

// ─── Chip renderer ────────────────────────────────────────────
function renderChips(
  primary: string,
  secondary: string | null,
  compact: boolean
): JSX.Element[] {
  const codes = [primary, secondary].filter(
    (c): c is string => !!c && !SKIP_CODES.has(c)
  )
  return codes.map(code => (
    <span
      key={code}
      className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
      style={{ backgroundColor: CHIP_COLOURS[code] ?? 'hsl(var(--muted-foreground))' }}
    >
      {compact ? code : (EVENT_LABELS[code] ?? code)}
    </span>
  ))
}

// ─── Component ────────────────────────────────────────────────
export default function DoctorCalendarPage() {
  const navigate = useNavigate()
  const { doctorId } = useParams<{ doctorId: string }>()
  const { currentRotaConfigId } = useRotaContext()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  const todayISO = getTodayISO()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [doctor, setDoctor] = useState<CalendarDoctor | null>(null)
  const [bankHolidaySet, setBankHolidaySet] = useState<Set<string>>(new Set())

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month')
  const [currentDateISO, setCurrentDateISO] = useState('')
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
  const [currentMonthKey, setCurrentMonthKey] = useState('')
  const [overrides, setOverrides] = useState<CalendarOverride[]>([])

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  useEffect(() => {
    if (isMobile === true) setViewMode('day')
  }, [isMobile])

  // ─── Data load ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setErrorMsg(null)
      if (!currentRotaConfigId || !doctorId) {
        setErrorMsg('Missing configuration. Go back to the calendar.')
        setLoading(false)
        return
      }
      try {
        const { data: pr } = await supabase
          .from('pre_rota_results')
          .select('calendar_data, status')
          .eq('rota_config_id', currentRotaConfigId)
          .maybeSingle()

        if (!pr) {
          setErrorMsg('No pre-rota generated yet. Go back and generate it first.')
          setLoading(false)
          return
        }
        if (pr.status === 'blocked') {
          setErrorMsg('Pre-rota is blocked. Resolve issues on the dashboard first.')
          setLoading(false)
          return
        }

        const cd = pr.calendar_data as unknown as CalendarData
        const found = cd.doctors.find(d => d.doctorId === doctorId) ?? null
        if (!found) {
          setErrorMsg('Doctor not found in this rota.')
          setLoading(false)
          return
        }

        setCalendarData(cd)
        setDoctor(found)
        setBankHolidaySet(new Set(cd.bankHolidays))

        const initialDate = (todayISO >= cd.rotaStartDate && todayISO <= cd.rotaEndDate)
          ? todayISO : cd.rotaStartDate
        setCurrentDateISO(initialDate)
        setCurrentMonthKey(initialDate.slice(0, 7))
        const wIdx = cd.weeks.findIndex(
          w => w.startDate <= initialDate && initialDate <= w.endDate
        )
        setCurrentWeekIndex(wIdx >= 0 ? wIdx : 0)

        // Load coordinator overrides
        const { data: overrideRows } = await supabase
          .from('coordinator_calendar_overrides')
          .select('*')
          .eq('rota_config_id', currentRotaConfigId)
          .eq('doctor_id', doctorId)
        setOverrides((overrideRows ?? []).map(mapOverrideRow))
      } catch (err) {
        console.error('DoctorCalendarPage load error:', err)
        setErrorMsg('Failed to load data. Please go back and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentRotaConfigId, doctorId])

  // ─── Navigation ─────────────────────────────────────────────
  function navigateToDate(iso: string) {
    if (!calendarData) return
    const clamped = iso < calendarData.rotaStartDate
      ? calendarData.rotaStartDate
      : iso > calendarData.rotaEndDate
      ? calendarData.rotaEndDate
      : iso
    setCurrentDateISO(clamped)
    setCurrentMonthKey(clamped.slice(0, 7))
    const wIdx = calendarData.weeks.findIndex(
      w => w.startDate <= clamped && clamped <= w.endDate
    )
    setCurrentWeekIndex(wIdx >= 0 ? wIdx : 0)
  }

  function goPrev() {
    if (!calendarData) return
    if (viewMode === 'day') {
      navigateToDate(addDaysISO(currentDateISO, -1))
    } else if (viewMode === 'week') {
      const newIdx = Math.max(0, currentWeekIndex - 1)
      const newDate = calendarData.weeks[newIdx].dates[0]
      setCurrentWeekIndex(newIdx)
      setCurrentDateISO(newDate)
      setCurrentMonthKey(newDate.slice(0, 7))
    } else {
      const [y, m] = currentMonthKey.split('-').map(Number)
      const prev = new Date(Date.UTC(y, m - 2, 1))
      const key = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
      if (key >= calendarData.rotaStartDate.slice(0, 7)) setCurrentMonthKey(key)
    }
  }

  function goNext() {
    if (!calendarData) return
    if (viewMode === 'day') {
      navigateToDate(addDaysISO(currentDateISO, 1))
    } else if (viewMode === 'week') {
      const newIdx = Math.min(calendarData.weeks.length - 1, currentWeekIndex + 1)
      const newDate = calendarData.weeks[newIdx].dates[0]
      setCurrentWeekIndex(newIdx)
      setCurrentDateISO(newDate)
      setCurrentMonthKey(newDate.slice(0, 7))
    } else {
      const [y, m] = currentMonthKey.split('-').map(Number)
      const next = new Date(Date.UTC(y, m, 1))
      const key = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
      if (key <= calendarData.rotaEndDate.slice(0, 7)) setCurrentMonthKey(key)
    }
  }

  // ─── Swipe + keyboard ──────────────────────────────────────
  const navRef = useRef({ goPrev, goNext })
  useEffect(() => { navRef.current = { goPrev, goNext } })

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(dx) < 50 || Math.abs(dx) < dy) return
    dx < 0 ? navRef.current.goNext() : navRef.current.goPrev()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navRef.current.goPrev()
      if (e.key === 'ArrowRight') navRef.current.goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const mergedAvailability = useMemo<Record<string, MergedCell>>(() => {
    if (!doctor || !calendarData) return {}
    return mergeOverridesIntoAvailability(
      doctor.availability,
      overrides,
      calendarData.rotaStartDate,
      calendarData.rotaEndDate
    )
  }, [doctor, overrides, calendarData])

  // ─── Loading / error ───────────────────────────────────────
  if (loading) return (
    <AdminLayout title="Doctor Calendar">
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading…</span>
      </div>
    </AdminLayout>
  )

  if (errorMsg || !calendarData || !doctor) return (
    <AdminLayout title="Doctor Calendar">
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{errorMsg ?? 'Could not load calendar.'}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/pre-rota-calendar')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to calendar
          </Button>
        </div>
      </div>
    </AdminLayout>
  )

  // ─── Nav label ─────────────────────────────────────────────
  const currentWeek = calendarData.weeks[currentWeekIndex]
  const currentLabel =
    viewMode === 'day'
      ? fmtFull(currentDateISO)
      : viewMode === 'week' && currentWeek
      ? `Wk ${currentWeek.weekNumber} · ${fmtShort(currentWeek.dates[0])}–${fmtShort(currentWeek.dates[currentWeek.dates.length - 1])}`
      : `${MONTH_NAMES[Number(currentMonthKey.split('-')[1]) - 1]} ${currentMonthKey.split('-')[0]}`

  const prevDisabled = viewMode === 'month'
    ? currentMonthKey <= calendarData.rotaStartDate.slice(0, 7)
    : viewMode === 'week'
    ? currentWeekIndex === 0
    : currentDateISO <= calendarData.rotaStartDate

  const nextDisabled = viewMode === 'month'
    ? currentMonthKey >= calendarData.rotaEndDate.slice(0, 7)
    : viewMode === 'week'
    ? currentWeekIndex >= calendarData.weeks.length - 1
    : currentDateISO >= calendarData.rotaEndDate

  // ─── Sub-components ────────────────────────────────────────
  function MonthView() {
    const rows = getMonthWeekRows(currentMonthKey)
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="w-8 text-[10px] font-medium text-muted-foreground p-1">Wk</th>
              {DAY_ABBR.map(d => (
                <th key={d} className="text-[10px] font-medium text-muted-foreground p-1">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((week, ri) => (
              <tr key={ri}>
                <td className="text-[10px] text-muted-foreground text-center align-top p-1 border-b border-border/30">
                  {getISOWeekNumber(week[0])}
                </td>
                {week.map(date => {
                  const inRota = date >= calendarData!.rotaStartDate && date <= calendarData!.rotaEndDate
                  const inMonth = date.startsWith(currentMonthKey)
                  const isToday = date === todayISO
                  const isBH = inRota && bankHolidaySet.has(date)
                  const dow = isoToUTCDate(date).getUTCDay()
                  const isWeekend = dow === 0 || dow === 6
                  const cell = inRota ? doctor!.availability[date] : null
                  const cellOpacity = !inRota ? 0.2 : !inMonth ? 0.45 : 1

                  return (
                    <td
                      key={date}
                      onClick={() => { if (inRota) { navigateToDate(date); setViewMode('day') } }}
                      className="align-top p-0.5 border-b border-r border-border/30 cursor-pointer"
                      style={{ minHeight: 60, opacity: cellOpacity }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {isToday ? (
                          <span className="flex items-center justify-center w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-xs font-medium">
                            {isoToUTCDate(date).getUTCDate()}
                          </span>
                        ) : (
                          <span className={`text-xs font-medium ${isBH ? 'text-destructive' : isWeekend ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                            {isoToUTCDate(date).getUTCDate()}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {cell && renderChips(cell.primary, cell.secondary, true)}
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function WeekView() {
    const week = calendarData!.weeks[currentWeekIndex]
    if (!week) return null
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {week.dates.map(date => {
                const isToday = date === todayISO
                const isBH = bankHolidaySet.has(date)
                const dow = isoToUTCDate(date).getUTCDay()
                const isWeekend = dow === 0 || dow === 6
                const d = isoToUTCDate(date)
                return (
                  <th key={date} className="p-2 text-center border-b border-border">
                    <p className={`text-xs font-medium ${isWeekend ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                      {DAY_ABBR[(dow + 6) % 7]}
                    </p>
                    <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold mt-0.5 ${
                      isToday ? 'bg-primary text-primary-foreground' : isBH ? 'text-destructive' : isWeekend ? 'text-muted-foreground/60' : 'text-foreground'
                    }`}>
                      {d.getUTCDate()}
                    </div>
                    {isBH && <p className="text-[9px] text-destructive font-medium mt-0.5">BH</p>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {week.dates.map(date => {
                const cell = doctor!.availability[date]
                const compact = isMobile || isTablet
                return (
                  <td key={date} className="p-2 align-top border-b border-r border-border/30 min-h-[80px]">
                    <div className="flex flex-col gap-1">
                      {cell && renderChips(cell.primary, cell.secondary, compact)}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  function DayView() {
    const inRota = currentDateISO >= calendarData!.rotaStartDate && currentDateISO <= calendarData!.rotaEndDate
    const cell = doctor!.availability[currentDateISO]
    const codes = cell
      ? ([cell.primary, cell.secondary] as (string | null)[]).filter((c): c is string => !!c && !SKIP_CODES.has(c))
      : []

    return (
      <div className="space-y-4 py-2">
        <p className="text-base font-semibold text-foreground">{fmtFull(currentDateISO)}</p>
        {!inRota && (
          <p className="text-sm text-muted-foreground italic">This date is outside the rota period.</p>
        )}
        {inRota && codes.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No events — available</p>
        )}
        {inRota && codes.map(code => (
          <div
            key={code}
            className="rounded-lg border border-border bg-card p-3"
            style={{ borderLeft: `4px solid ${CHIP_COLOURS[code] ?? 'hsl(var(--muted-foreground))'}` }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: CHIP_COLOURS[code] ?? 'hsl(var(--muted-foreground))' }}
              >
                {EVENT_LABELS[code] ?? code}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── Main render ───────────────────────────────────────────
  return (
    <AdminLayout title="Doctor Calendar" accentColor="teal">
      <div
        className="space-y-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/admin/pre-rota-calendar')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Pre-rota calendar
          </button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{doctor.doctorName}</h2>
            <p className="text-sm text-muted-foreground">{doctor.grade} · {doctor.wte}% WTE</p>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            {(['day','week','month'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${viewMode === v
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Nav bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={prevDisabled} onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[180px] text-center">{currentLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={nextDisabled} onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <input
            type="date"
            min={calendarData.rotaStartDate}
            max={calendarData.rotaEndDate}
            value={currentDateISO}
            onChange={(e) => { if (e.target.value) navigateToDate(e.target.value) }}
            className="border border-border rounded-md px-2 py-1 text-xs text-foreground bg-background"
          />
        </div>

        {/* View content */}
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'day' && <DayView />}
      </div>
    </AdminLayout>
  )
}
