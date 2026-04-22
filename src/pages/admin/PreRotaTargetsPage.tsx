import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { generatePreRotaExcel } from '@/lib/preRotaExcel'
import { computeShiftTargets } from '@/lib/shiftTargets'
import { useRotaConfig } from '@/lib/rotaConfig'
import { useRotaContext } from '@/contexts/RotaContext'
import { useIsMobile } from '@/hooks/use-mobile'
import type { CalendarData, TargetsData, DoctorTargets } from '@/lib/preRotaTypes'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Loader2, AlertTriangle, Target, ChevronDown, ChevronUp } from 'lucide-react'

function r1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

// ─── Leave notes popover (desktop) or inline block (mobile) ──
function LeaveNotes({ doctor, inline = false }: { doctor: DoctorTargets; inline?: boolean }) {
  const [open, setOpen] = useState(false)
  const ls = doctor.leaveSummary
  const hasLeave = (ls?.alSlBhDays ?? 0) > 0 || (ls?.plRotDays ?? 0) > 0
  const totalDeducted = r1((ls?.alSlBhHoursDeducted ?? 0) + (ls?.plRotHoursDeducted ?? 0))

  if (!hasLeave) {
    return <span className="text-[10px] text-muted-foreground">&mdash;</span>
  }

  const content = (
    <div className="space-y-2 text-xs">
      <p className="font-semibold text-foreground">Leave deductions</p>
      {(ls?.alSlBhDays ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            AL + SL + BH
          </span>
          <span className="font-mono">{ls!.alSlBhDays}d &middot; -{ls!.alSlBhHoursDeducted}h</span>
        </div>
      )}
      {(ls?.plRotDays ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
            PL + ROT
          </span>
          <span className="font-mono">{ls!.plRotDays}d &middot; -{ls!.plRotHoursDeducted}h</span>
        </div>
      )}
      <div className="border-t border-border pt-1.5 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total deducted</span>
          <span className="font-mono font-semibold text-destructive">-{totalDeducted}h</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Available hours</span>
          <span className="font-mono font-semibold text-foreground">{ls?.availableHours ?? 0}h</span>
        </div>
      </div>
    </div>
  )

  if (inline) {
    return (
      <div className="mt-2 rounded-lg bg-muted/40 border border-border p-3">
        {content}
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors whitespace-nowrap"
      >
        Notes
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg">
            {content}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Mobile accordion card ────────────────────────────────────
function DoctorCard({ doctor, shiftTypes }: {
  doctor: DoctorTargets
  shiftTypes: TargetsData['shiftTypes']
}) {
  const [expanded, setExpanded] = useState(false)
  const isLtft = doctor.wte < 100

  return (
    <div className={`rounded-lg border ${isLtft ? 'border-amber-300' : 'border-border'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 border-none cursor-pointer transition-colors ${expanded ? 'bg-green-50 border-b border-green-200' : 'bg-card'}`}
      >
        <div className="text-left">
          <div className="text-sm font-medium text-foreground">
            {doctor.doctorName.replace('Dr ', '')}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {doctor.grade}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <span className="text-xs font-mono text-foreground">
              {doctor.leaveSummary?.availableHours ?? 0}h
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isLtft ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
            {doctor.wte}%
          </span>
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
      </button>

      {expanded && (
        <div className="bg-card px-3 pb-3 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-muted/40 p-2">
              <p className="text-muted-foreground">h/week</p>
              <p className="font-mono font-medium text-foreground">{doctor.contractedHoursPerWeek}h</p>
            </div>
            <div className="rounded bg-muted/40 p-2">
              <p className="text-muted-foreground">Weekends</p>
              <p className="font-mono font-medium text-foreground">{doctor.weekendCap}</p>
            </div>
            {shiftTypes.map((st, idx) => {
              const target = doctor.shiftTargets.find(t => t.shiftTypeId === st.id)
              const isOdd = shiftTypes.length % 2 !== 0
              const isLast = idx === shiftTypes.length - 1
              return (
                <div key={st.id} className={`rounded bg-muted/40 p-2 ${isOdd && isLast ? 'col-span-2' : ''}`}>
                  <p className="text-muted-foreground">
                    {st.name}
                    <span className={`ml-1 text-[9px] ${st.isOncall ? 'text-rose-500' : 'text-sky-500'}`}>
                      {st.isOncall ? 'OC' : 'NOC'}
                    </span>
                  </p>
                  <p className="font-mono font-medium text-foreground">
                    {target?.maxTargetHours ?? 0}h{' '}
                    <span className="text-muted-foreground font-normal">~{target?.estimatedShiftCount ?? 0}</span>
                  </p>
                </div>
              )
            })}
          </div>
          <LeaveNotes doctor={doctor} inline />
        </div>
      )}
    </div>
  )
}

// ─── Reference panel ──────────────────────────────────────────
function ReferenceTargetsPanel({ config }: { config: NonNullable<ReturnType<typeof useRotaConfig>['config']> }) {
  const [open, setOpen] = useState(false)
  const [customWte, setCustomWte] = useState(75)

  const wteOptions = [100, 80, 60]
  const safeCustomWte = Math.min(100, Math.max(10, isNaN(customWte) ? 75 : customWte))
  const allWtes = [...wteOptions, safeCustomWte]

  const compute = (wte: number) => {
    if (!config.wtr || !config.shifts.length) return null
    const hasTargets = config.shifts.some(s => (s.targetPercentage ?? 0) > 0)
    if (!hasTargets) return null
    return computeShiftTargets({
      maxHoursPerWeek: config.wtr.maxHoursPerWeek,
      maxHoursPer168h: config.wtr.maxHoursPer168h,
      rotaWeeks: config.rotaPeriod.durationWeeks ?? 0,
      globalOncallPct: config.distribution.globalOncallPct,
      globalNonOncallPct: config.distribution.globalNonOncallPct,
      shiftTypes: config.shifts.map(s => ({
        id: s.id, name: s.name, shiftKey: s.shiftKey, isOncall: s.isOncall,
        targetPercentage: s.targetPercentage ?? 0, durationHours: s.durationHours,
      })),
      wtePercent: wte,
    })
  }

  const shifts = config.shifts.filter(s => (s.targetPercentage ?? 0) > 0)
  const results = allWtes.map(w => ({ wte: w, result: compute(w) }))

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors border-none cursor-pointer"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Target className="h-4 w-4 text-primary" />
          Reference targets (no leave adjustment)
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border bg-card px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Theoretical ceilings with no leave deducted. Use to sanity-check the per-doctor targets above.
          </p>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Custom WTE %</span>
            <input
              type="number"
              min={10}
              max={100}
              value={customWte}
              onChange={e => setCustomWte(Number(e.target.value))}
              className="w-16 border border-border rounded-md px-2 py-1 text-xs font-mono bg-card text-foreground"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 px-2 font-medium"></th>
                  {results.map(({ wte }) => {
                    const isCustom = wte === safeCustomWte && !wteOptions.includes(wte)
                    return (
                      <th key={wte} className={`py-1.5 px-2 font-medium font-mono ${isCustom ? 'text-primary' : ''}`}>
                        {wte}%{isCustom ? ' ✱' : ''}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-muted-foreground">h/wk</td>
                  {results.map(({ wte, result }) => (
                    <td key={wte} className="py-1.5 px-2 font-mono text-muted-foreground">
                      {result ? r1(config.wtr!.maxHoursPerWeek * wte / 100) : '—'}h
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-muted-foreground">Total h</td>
                  {results.map(({ wte, result }) => (
                    <td key={wte} className="py-1.5 px-2 font-mono text-foreground">
                      {result?.totalMaxTargetHours ?? '—'}h
                    </td>
                  ))}
                </tr>
                {shifts.map(s => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-medium text-foreground">{s.name}</td>
                    {results.map(({ wte, result }) => {
                      const t = result?.targets.find(x => x.shiftId === s.id)
                      return (
                        <td key={wte} className="py-1.5 px-2 font-mono text-muted-foreground">
                          {t ? `${t.maxTargetHours}h` : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground">✱ Custom WTE row</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function PreRotaTargetsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { currentRotaConfigId: rotaConfigId } = useRotaContext()
  const { config: fullConfig } = useRotaConfig()

  const [loading, setLoading] = useState(true)
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null)
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deptName, setDeptName] = useState('')
  const [hospitalName, setHospitalName] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!rotaConfigId) {
        setErrorMsg('No rota config found.')
        setLoading(false)
        return
      }
      try {
        const { data: preRota, error: preRotaErr } = await supabase
          .from('pre_rota_results')
          .select('*')
          .eq('rota_config_id', rotaConfigId)
          .maybeSingle()

        if (preRotaErr) throw preRotaErr

        if (!preRota) {
          setErrorMsg('No pre-rota generated yet. Go back and generate it first.')
          setLoading(false)
          return
        }

        const pr = preRota as any

        if (pr.status === 'blocked') {
          setErrorMsg('Pre-rota is blocked. Resolve critical issues on the pre-rota page first.')
          setLoading(false)
          return
        }

        const td = pr.targets_data as TargetsData
        if (!td?.doctors?.length) {
          setErrorMsg('Targets data is empty — re-generate the pre-rota to rebuild it.')
          setLoading(false)
          return
        }

        setTargetsData(td)
        setCalendarData(pr.calendar_data as CalendarData)

        const { data: cfg } = await supabase
          .from('rota_configs')
          .select('owned_by')
          .eq('id', rotaConfigId)
          .single()

        if (cfg) {
          const { data: acct } = await supabase
            .from('account_settings')
            .select('department_name, trust_name')
            .eq('owned_by', (cfg as any).owned_by)
            .maybeSingle()
          setDeptName((acct as any)?.department_name ?? '')
          setHospitalName((acct as any)?.trust_name ?? '')
        }
      } catch (err) {
        console.error('Failed to load targets:', err)
        setErrorMsg('Failed to load data. Please go back and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [rotaConfigId])

  const handleDownload = useCallback(() => {
    if (!calendarData || !targetsData) return
    const blob = generatePreRotaExcel(calendarData, targetsData)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RotaGen_PreRota_${calendarData.rotaStartDate}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }, [calendarData, targetsData])

  if (loading) return (
    <AdminLayout title="Shift Hour Targets" accentColor="green" pageIcon={Target}>
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading targets…</span>
      </div>
    </AdminLayout>
  )

  if (errorMsg || !targetsData) return (
    <AdminLayout title="Shift Hour Targets" accentColor="green" pageIcon={Target}>
      <div className="mx-auto max-w-lg mt-12">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="text-sm text-foreground">{errorMsg ?? 'No targets data available.'}</p>
          <Button variant="outline" onClick={() => navigate('/admin/pre-rota')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    </AdminLayout>
  )

  const { doctors, shiftTypes } = targetsData

  return (
    <AdminLayout
      title="Shift Hour Targets"
      subtitle={`${deptName}${deptName && hospitalName ? ' · ' : ''}${hospitalName}`}
      accentColor="green"
      pageIcon={Target}
    >
      <div className="space-y-4 animate-fadeSlideUp">

        {/* Header bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <button
            onClick={() => navigate('/admin/pre-rota')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Pre-rota
          </button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>

        {/* Info strip */}
        <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
          <Target className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Hours shown are hard ceilings &mdash; the algorithm will not exceed them.
            Leave and rotations are already deducted.
            {isMobile ? ' Tap a doctor to expand.' : ' Click Notes on any row to see the leave breakdown.'}
          </span>
        </div>

        {/* ── MOBILE: accordion cards ── */}
        {isMobile ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Per-doctor targets &middot; {doctors.length} doctors
            </p>
            {doctors.map(doctor => (
              <DoctorCard key={doctor.doctorId} doctor={doctor} shiftTypes={shiftTypes} />
            ))}
            {/* Team summary */}
            <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Team total</p>
                <p className="font-mono font-semibold text-foreground">{targetsData.teamTotal.totalMaxHours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Team average</p>
                <p className="font-mono font-semibold text-foreground">{targetsData.teamAverage.totalMaxHours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total weekends</p>
                <p className="font-mono font-semibold text-foreground">{targetsData.teamTotal.weekendCap}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ── DESKTOP: scrollable table ── */
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Per-doctor targets</span>
              <span className="text-xs text-muted-foreground ml-auto">{doctors.length} doctors</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="sticky left-0 bg-card z-10 py-2 px-2 font-medium text-muted-foreground border-r border-border min-w-[140px]">Doctor</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Grade</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-center">WTE</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-center">h/wk</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-center">Avail. h</th>
                    {shiftTypes.map(s => (
                      <th key={s.id} className="py-2 px-2 font-medium text-muted-foreground text-center min-w-[80px]">
                        {s.name}{' '}
                        <span className={`text-[9px] ${s.isOncall ? 'text-rose-500' : 'text-sky-500'}`}>
                          {s.isOncall ? 'OC' : 'NOC'}
                        </span>
                      </th>
                    ))}
                    <th className="py-2 px-2 font-medium text-muted-foreground text-center">Wknds</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-center">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor, i) => {
                    const rowBg = i % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                    return (
                      <tr key={doctor.doctorId} className={`border-b border-border/50 ${rowBg} ${doctor.wte < 100 ? 'border-l-2 border-l-amber-400' : ''}`}>
                        <td className={`sticky left-0 ${rowBg} z-10 py-2 px-2 border-r border-border min-w-[140px]`}>
                          <span className="font-medium text-foreground whitespace-nowrap">{doctor.doctorName.replace('Dr ', '')}</span>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{doctor.grade}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`font-mono ${doctor.wte < 100 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                            {doctor.wte}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-muted-foreground">{doctor.contractedHoursPerWeek}h</td>
                        <td className="py-2 px-2 text-center font-mono font-semibold text-foreground">
                          {doctor.leaveSummary?.availableHours ?? 0}h
                        </td>
                        {shiftTypes.map(s => {
                          const target = doctor.shiftTargets.find(t => t.shiftTypeId === s.id)
                          return (
                            <td key={s.id} className="py-2 px-2 text-center">
                              <p className="font-mono text-foreground">{target?.maxTargetHours ?? 0}h</p>
                              <p className="text-[9px] text-muted-foreground">~{target?.estimatedShiftCount ?? 0}</p>
                            </td>
                          )
                        })}
                        <td className="py-2 px-2 text-center font-mono text-foreground">{doctor.weekendCap}</td>
                        <td className="py-2 px-2 text-center">
                          <LeaveNotes doctor={doctor} />
                        </td>
                      </tr>
                    )
                  })}

                  {/* Team Total */}
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="sticky left-0 bg-muted/30 z-10 py-2 px-2 border-r border-border text-foreground">
                      Team Total
                    </td>
                    <td />
                    <td />
                    <td className="py-2 px-2 text-center font-mono text-foreground">
                      {r1(doctors.reduce((s, d) => s + (d.leaveSummary?.availableHours ?? 0), 0))}h
                    </td>
                    <td />
                    {shiftTypes.map(s => (
                      <td key={s.id} className="py-2 px-2 text-center font-mono text-foreground">
                        {targetsData.teamTotal.shiftTargets.find(t => t.shiftTypeId === s.id)?.value ?? 0}h
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center font-mono text-foreground">
                      {targetsData.teamTotal.weekendCap}
                    </td>
                    <td />
                  </tr>

                  {/* Team Average */}
                  <tr className="bg-muted/30">
                    <td className="sticky left-0 bg-muted/30 z-10 py-2 px-2 border-r border-border text-muted-foreground font-medium">
                      Team Average
                    </td>
                    <td />
                    <td />
                    <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                      {r1(doctors.reduce((s, d) => s + (d.leaveSummary?.availableHours ?? 0), 0) / (doctors.length || 1))}h
                    </td>
                    <td />
                    {shiftTypes.map(s => (
                      <td key={s.id} className="py-2 px-2 text-center font-mono text-muted-foreground">
                        {targetsData.teamAverage.shiftTargets.find(t => t.shiftTypeId === s.id)?.value ?? 0}h
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                      {targetsData.teamAverage.weekendCap}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground space-x-4">
              <span>Avail. h = contracted hours minus all leave</span>
              <span>~N = estimated shift count</span>
              <span>OC = on-call &middot; NOC = non-on-call</span>
            </div>
          </div>
        )}

        {/* Reference panel — shown on both breakpoints */}
        {fullConfig && <ReferenceTargetsPanel config={fullConfig} />}

      </div>
    </AdminLayout>
  )
}
// SECTION 1 COMPLETE
