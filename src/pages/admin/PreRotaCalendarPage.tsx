import { useState, useEffect, useMemo, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import type { CalendarData, CalendarDoctor, TargetsData, CellCode } from "@/lib/preRotaTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, ArrowLeft, Loader2, AlertTriangle,
} from "lucide-react";
// ✅ Section 1 complete (imports)

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SESSION_KEY = 'rotaConfigId';

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function availabilityColour(count: number, min: number): string {
  if (count < min) return 'bg-red-500 text-white';
  if (count === min) return 'bg-amber-400 text-white';
  return 'bg-green-500 text-white';
}

interface ShiftTypeRow {
  id: string;
  name: string;
  min_doctors: number;
  badge_night: boolean;
  badge_oncall: boolean;
}

interface SurveyMap {
  ltftDaysOff: string[];
  ltftNightFlexibility: { day: string; canStart: boolean | null; canEnd: boolean | null }[];
}

function isDoctorEligible(
  doctor: CalendarDoctor,
  date: string,
  shift: { badge_night: boolean; badge_oncall: boolean },
  surveys: Record<string, SurveyMap>
): boolean {
  const cell = doctor.availability[date];
  const primary = cell?.primary ?? 'AVAILABLE';

  if (['AL', 'SL', 'ROT', 'PL'].includes(primary)) return false;
  if (primary === 'NOC') return shift.badge_oncall === false;

  const isNightShift = shift.badge_night === true;
  const survey = surveys[doctor.doctorId];
  const dayNameOfDate = DAY_NAMES[new Date(date + 'T00:00:00').getDay()];
  const isLtftDayOff = doctor.ltftDaysOff.includes(dayNameOfDate);

  if (!isNightShift) {
    return !isLtftDayOff;
  }

  // Night shift LTFT logic
  if (isLtftDayOff) {
    if (!survey) return false;
    const flex = survey.ltftNightFlexibility.find(f => f.day === dayNameOfDate);
    return flex?.canStart === true;
  }

  const nextDate = addDays(date, 1);
  const dayNameOfNextDate = DAY_NAMES[new Date(nextDate + 'T00:00:00').getDay()];
  const isNextDayLtftOff = doctor.ltftDaysOff.includes(dayNameOfNextDate);

  if (isNextDayLtftOff) {
    if (!survey) return false;
    const nextCell = doctor.availability[nextDate];
    const nextPrimary = nextCell?.primary ?? 'AVAILABLE';
    if (['AL', 'SL', 'ROT', 'PL'].includes(nextPrimary)) return false;
    const flex = survey.ltftNightFlexibility.find(f => f.day === dayNameOfNextDate);
    return flex?.canEnd === true;
  }

  return true;
}
// ✅ Section 3.2 complete (eligibility)

export default function PreRotaCalendarPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeRow[]>([]);
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [surveysMap, setSurveysMap] = useState<Record<string, SurveyMap>>({});
  const [eligibility, setEligibility] = useState<Record<string, Record<string, number>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [deptName, setDeptName] = useState('');
  const [hospitalName, setHospitalName] = useState('');

  // Load data
  useEffect(() => {
    const load = async () => {
      const rotaConfigId = sessionStorage.getItem(SESSION_KEY);
      if (!rotaConfigId) { setErrorMsg('No rota config found. Go back to the dashboard.'); setLoading(false); return; }

      const { data: preRota } = await supabase
        .from('pre_rota_results' as any)
        .select('*')
        .eq('rota_config_id', rotaConfigId)
        .single();

      if (!preRota) { setErrorMsg('No pre-rota generated yet. Go back to the dashboard and generate the pre-rota first.'); setLoading(false); return; }
      const pr = preRota as any;
      if (pr.status === 'blocked') { setErrorMsg('Pre-rota is blocked due to critical issues. Resolve them on the dashboard before viewing the calendar.'); setLoading(false); return; }

      const cd = pr.calendar_data as CalendarData;
      const td = pr.targets_data as TargetsData;
      setCalendarData(cd);
      setTargetsData(td);

      // Fetch shift types
      const { data: stRows } = await supabase
        .from('shift_types')
        .select('id, name, min_doctors, badge_night, badge_oncall')
        .eq('rota_config_id', rotaConfigId);
      const shifts: ShiftTypeRow[] = (stRows ?? []).map((s: any) => ({
        id: s.id, name: s.name, min_doctors: s.min_doctors ?? 1,
        badge_night: s.badge_night ?? false, badge_oncall: s.badge_oncall ?? false,
      }));
      setShiftTypes(shifts);

      // Bank holidays
      const { data: bhRows } = await supabase
        .from('bank_holidays')
        .select('date')
        .eq('rota_config_id', rotaConfigId);
      const bhSet = new Set((bhRows ?? []).map((r: any) => r.date as string));
      setBankHolidays(bhSet);

      // Surveys
      const { data: surveyRows } = await supabase
        .from('doctor_survey_responses')
        .select('doctor_id, ltft_days_off, ltft_night_flexibility')
        .eq('rota_config_id', rotaConfigId);
      const sMap: Record<string, SurveyMap> = {};
      for (const s of surveyRows ?? []) {
        sMap[(s as any).doctor_id] = {
          ltftDaysOff: (s as any).ltft_days_off ?? [],
          ltftNightFlexibility: (s as any).ltft_night_flexibility ?? [],
        };
      }
      setSurveysMap(sMap);

      // Account settings
      const { data: config } = await supabase
        .from('rota_configs')
        .select('owned_by')
        .eq('id', rotaConfigId)
        .single();
      if (config) {
        const { data: acct } = await supabase
          .from('account_settings')
          .select('department_name, trust_name')
          .eq('owned_by', (config as any).owned_by)
          .single();
        if (acct) {
          setDeptName((acct as any).department_name ?? cd.departmentName ?? '');
          setHospitalName((acct as any).trust_name ?? cd.hospitalName ?? '');
        }
      }

      // Compute eligibility
      if (cd?.doctors && cd?.weeks) {
        const allDates: string[] = [];
        for (const w of cd.weeks) allDates.push(...w.dates);
        const elig: Record<string, Record<string, number>> = {};
        for (const shift of shifts) {
          elig[shift.id] = {};
          for (const date of allDates) {
            let count = 0;
            for (const doctor of cd.doctors) {
              if (isDoctorEligible(doctor, date, shift, sMap)) count++;
            }
            elig[shift.id][date] = count;
          }
        }
        setEligibility(elig);
      }

      setLoading(false);
    };
    load();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!calendarData) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        if (isMobile) {
          setCurrentDayIndex(i => Math.max(0, i - 1));
        } else {
          setCurrentWeekIndex(i => Math.max(0, i - 1));
        }
      }
      if (e.key === 'ArrowRight') {
        if (isMobile) {
          const allDates = calendarData.weeks.flatMap(w => w.dates);
          setCurrentDayIndex(i => Math.min(allDates.length - 1, i + 1));
        } else {
          setCurrentWeekIndex(i => Math.min(calendarData.weeks.length - 1, i + 1));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [calendarData, isMobile]);

  const handleDownload = useCallback(() => {
    if (!calendarData || !targetsData) return;
    const blob = generatePreRotaExcel(calendarData, targetsData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RotaGen_PreRota_${calendarData.rotaStartDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [calendarData, targetsData]);

  const allDates = useMemo(() => calendarData?.weeks.flatMap(w => w.dates) ?? [], [calendarData]);
  const maxMinDoctors = useMemo(() => Math.max(...shiftTypes.map(s => s.min_doctors), 1), [shiftTypes]);

  if (loading) {
    return (
      <AdminLayout title="Availability Calendar">
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading calendar…</span>
        </div>
      </AdminLayout>
    );
  }

  if (errorMsg || !calendarData) {
    return (
      <AdminLayout title="Availability Calendar">
        <div className="mx-auto max-w-lg mt-12">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-foreground">{errorMsg ?? 'No calendar data available.'}</p>
            <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { weeks, doctors } = calendarData;

  // ── MOBILE: single-day view ──
  if (isMobile) {
    const currentDate = allDates[currentDayIndex] ?? allDates[0];
    if (!currentDate) return null;
    const d = new Date(currentDate + 'T00:00:00');
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isBH = bankHolidays.has(currentDate);

    const totalAvailable = doctors.filter(doc => {
      const p = doc.availability[currentDate]?.primary ?? 'AVAILABLE';
      return !['AL', 'SL', 'ROT', 'PL', 'NOC'].includes(p);
    }).length;

    return (
      <AdminLayout title="Availability Calendar">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
            </button>
            <p className="text-xs text-muted-foreground">{deptName}{deptName && hospitalName ? ' · ' : ''}{hospitalName}</p>
            <Button variant="outline" size="sm" onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Download .xlsx
            </Button>
          </div>

          {/* Day navigator */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))} disabled={currentDayIndex === 0} className="p-2 rounded-md hover:bg-muted disabled:opacity-30 min-h-[44px]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              {isBH && <span className="text-[10px] text-red-600 font-medium">Bank Holiday</span>}
            </div>
            <button onClick={() => setCurrentDayIndex(i => Math.min(allDates.length - 1, i + 1))} disabled={currentDayIndex >= allDates.length - 1} className="p-2 rounded-md hover:bg-muted disabled:opacity-30 min-h-[44px]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Doctor cards */}
          <div className="space-y-2">
            {doctors.map(doctor => {
              const cell = doctor.availability[currentDate];
              const primary = cell?.primary ?? 'AVAILABLE';
              const pillLabel = primary === 'AVAILABLE' ? 'Available'
                : primary === 'LTFT' ? 'LTFT day off'
                : primary === 'NOC' ? 'Not On-Call'
                : primary === 'BH' ? 'Bank Holiday'
                : primary;
              const pillClass = getCellBg(primary) + ' ' + getCellText(primary);

              return (
                <div key={doctor.doctorId} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between min-h-[44px]">
                  <div>
                    <p className="text-sm font-medium text-foreground">{doctor.doctorName}</p>
                    <p className="text-[11px] text-muted-foreground">{doctor.grade} · {doctor.wte}%</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded ${pillClass}`}>
                    {pillLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Availability chips */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded ${availabilityColour(totalAvailable, maxMinDoctors)}`}>
              Total: {totalAvailable} available
            </span>
            {shiftTypes.map(shift => {
              const count = eligibility[shift.id]?.[currentDate] ?? 0;
              return (
                <span key={shift.id} className={`text-xs font-semibold px-2.5 py-1 rounded ${availabilityColour(count, shift.min_doctors)}`}>
                  {shift.name}: {count}
                </span>
              );
            })}
          </div>

          {/* Legend */}
          <CalendarLegend />
        </div>
      </AdminLayout>
    );
  }

  // ── DESKTOP: weekly table ──
  const week = weeks[currentWeekIndex];
  if (!week) return null;

  const totalDoctors = doctors.length;

  return (
    <AdminLayout title="Availability Calendar" subtitle={`${deptName}${deptName && hospitalName ? ' · ' : ''}${hospitalName}`}>
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download .xlsx
          </Button>
        </div>

        {/* Week navigator */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentWeekIndex(i => Math.max(0, i - 1))} disabled={currentWeekIndex === 0} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-foreground">
            Week {week.weekNumber} of {weeks.length} —{' '}
            {new Date(week.dates[0] + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} to{' '}
            {new Date(week.dates[week.dates.length - 1] + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
          <button onClick={() => setCurrentWeekIndex(i => Math.min(weeks.length - 1, i + 1))} disabled={currentWeekIndex >= weeks.length - 1} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card z-10 text-left py-2 px-2 font-medium text-muted-foreground border-b border-r border-border min-w-[140px]">
                  Doctor
                </th>
                {week.dates.map(date => {
                  const dd = new Date(date + 'T00:00:00');
                  const isWknd = dd.getDay() === 0 || dd.getDay() === 6;
                  const isBH = bankHolidays.has(date);
                  return (
                    <th key={date} className={`text-center py-2 px-1 font-medium border-b border-border min-w-[56px] ${isBH ? 'bg-red-50 text-red-700' : isWknd ? 'bg-gray-100 text-muted-foreground' : 'bg-muted/30 text-muted-foreground'}`}>
                      <div className="text-[10px]">{dd.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                      <div className="text-[10px] font-normal">{dd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                      {isBH && <div className="text-[10px] text-red-500 font-medium">BH</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {doctors.map(doctor => (
                <tr key={doctor.doctorId} className="border-b border-border/50">
                  <td className="sticky left-0 bg-white z-10 px-2 py-1.5 border-r border-border min-w-[140px]">
                    <div className="font-medium text-foreground text-xs truncate">{doctor.doctorName}</div>
                    <div className="text-[10px] text-muted-foreground">{doctor.grade} · {doctor.wte}%</div>
                  </td>
                  {week.dates.map(date => {
                    const cell = doctor.availability[date];
                    const primary = cell?.primary ?? 'AVAILABLE';
                    const isWknd = new Date(date + 'T00:00:00').getDay() === 0 || new Date(date + 'T00:00:00').getDay() === 6;
                    const isBH = bankHolidays.has(date);
                    const dayName = DAY_NAMES[new Date(date + 'T00:00:00').getDay()];
                    const isLtftDay = doctor.ltftDaysOff.includes(dayName);

                    let bg = '';
                    let text = '';
                    let label = '';

                    if (['AL', 'SL', 'ROT', 'PL'].includes(primary)) {
                      bg = getCellBg(primary);
                      text = 'text-white';
                      label = primary;
                    } else if (primary === 'NOC') {
                      bg = 'bg-purple-100';
                      text = '';
                      label = '';
                    } else if (isLtftDay && (primary === 'AVAILABLE' || primary === 'BH')) {
                      bg = 'bg-amber-100';
                      text = '';
                      label = '';
                    } else if (isWknd) {
                      bg = 'bg-gray-100';
                      text = '';
                      label = '';
                    } else {
                      bg = 'bg-white';
                      text = '';
                      label = '';
                    }

                    return (
                      <td key={date} className={`text-center py-1 px-0.5 ${bg} ${isBH ? 'border-t-2 border-red-300' : ''}`}>
                        {label && <span className={`text-[9px] font-semibold ${text}`}>{label}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Divider */}
              <tr><td colSpan={week.dates.length + 1} className="h-1 bg-border"></td></tr>

              {/* Total available row */}
              <tr className="font-semibold">
                <td className="sticky left-0 bg-white z-10 px-2 py-1.5 border-r border-border text-xs text-foreground">Total available</td>
                {week.dates.map(date => {
                  const available = doctors.filter(doc => {
                    const p = doc.availability[date]?.primary ?? 'AVAILABLE';
                    return !['AL', 'SL', 'ROT', 'PL', 'NOC'].includes(p);
                  }).length;
                  return (
                    <td key={date} className="text-center py-1.5 px-0.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${availabilityColour(available, maxMinDoctors)}`}>
                        {available}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Per-shift eligibility rows */}
              {shiftTypes.map(shift => (
                <tr key={shift.id}>
                  <td className="sticky left-0 bg-white z-10 px-2 py-1 border-r border-border text-[10px] text-muted-foreground truncate">{shift.name}</td>
                  {week.dates.map(date => {
                    const count = eligibility[shift.id]?.[date] ?? 0;
                    return (
                      <td key={date} className="text-center py-1 px-0.5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${availabilityColour(count, shift.min_doctors)}`}>
                          {count}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <CalendarLegend />
      </div>
    </AdminLayout>
  );
}

function getCellBg(code: string): string {
  const map: Record<string, string> = {
    AL: 'bg-green-500', SL: 'bg-blue-500', NOC: 'bg-purple-100',
    ROT: 'bg-orange-500', PL: 'bg-pink-500', BH: 'bg-red-500',
    LTFT: 'bg-amber-100', AVAILABLE: 'bg-white',
  };
  return map[code] ?? 'bg-white';
}

function getCellText(code: string): string {
  const map: Record<string, string> = {
    AL: 'text-white', SL: 'text-white', ROT: 'text-white',
    PL: 'text-white', BH: 'text-white', NOC: 'text-purple-700',
    LTFT: 'text-amber-700', AVAILABLE: 'text-foreground',
  };
  return map[code] ?? 'text-foreground';
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
      <span><span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" />Annual Leave</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-500 mr-1" />Study Leave</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-orange-500 mr-1" />Rotation</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-pink-500 mr-1" />Parental Leave</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-purple-100 border border-purple-300 mr-1" />Not On-Call</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 mr-1" />LTFT day off</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-red-50 border border-red-300 mr-1" />Bank Holiday column</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 mr-1" />Weekend</span>
      <span><span className="inline-block w-3 h-3 rounded-sm bg-white border border-gray-200 mr-1" />Available</span>
    </div>
  );
}
// ✅ Section 3 complete
// ✅ Section 5 complete (responsive design applied)
