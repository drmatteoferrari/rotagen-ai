import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import type { CalendarData, CalendarDoctor, TargetsData, CellCode } from "@/lib/preRotaTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRotaContext } from "@/contexts/RotaContext";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, ArrowLeft, Loader2, AlertTriangle, ChevronDown,
} from "lucide-react";
// ✅ Section 5 complete (imports — useRotaContext replaces sessionStorage)

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ✅ Section 2.1 complete — UTC-safe day name derivation
const FULL_DAY_NAMES: Record<string, string> = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday',
  sunday: 'sunday', monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday',
  thursday: 'thursday', friday: 'friday', saturday: 'saturday',
};

function normaliseDayName(raw: string): string {
  return FULL_DAY_NAMES[raw.toLowerCase()] ?? raw.toLowerCase();
}
// ✅ Section 2.2 complete — case + abbreviation normalisation

function getDayNameFromISO(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return DAY_NAMES[d.getUTCDay()];
}

function getLtftDaysOff(doctor: any): string[] {
  const raw = doctor.ltftDaysOff ?? doctor.ltft_days_off ?? [];
  return (Array.isArray(raw) ? raw : []).map(normaliseDayName);
}
// ✅ Section 4 complete — snake_case vs camelCase safe accessor

function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().split('T')[0];
}

function availabilityColour(count: number, min: number): string {
  if (count < min) return '#dc2626';
  if (count === min) return '#d97706';
  return '#16a34a';
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
  const dayNameOfDate = getDayNameFromISO(date);
  const isLtftDayOff = getLtftDaysOff(doctor).includes(dayNameOfDate);

  if (!isNightShift) {
    return !isLtftDayOff;
  }

  if (isLtftDayOff) {
    if (!survey) return false;
    const flex = survey.ltftNightFlexibility.find(f => normaliseDayName(f.day) === dayNameOfDate);
    return flex?.canStart === true;
  }

  const nextDate = addDays(date, 1);
  const dayNameOfNextDate = getDayNameFromISO(nextDate);
  const isNextDayLtftOff = getLtftDaysOff(doctor).includes(dayNameOfNextDate);

  if (isNextDayLtftOff) {
    if (!survey) return false;
    const nextCell = doctor.availability[nextDate];
    const nextPrimary = nextCell?.primary ?? 'AVAILABLE';
    if (['AL', 'SL', 'ROT', 'PL'].includes(nextPrimary)) return false;
    const flex = survey.ltftNightFlexibility.find(f => normaliseDayName(f.day) === dayNameOfNextDate);
    return flex?.canEnd === true;
  }

  return true;
}
// ✅ Section 3.2 complete (eligibility)

// ── Badge components ──────────────────────────────────────────

const BADGE_STYLES = {
  AL:  { bg: '#16a34a', text: '#fff', label: 'AL'  },
  SL:  { bg: '#2563eb', text: '#fff', label: 'SL'  },
  ROT: { bg: '#c2410c', text: '#fff', label: 'ROT' },
  PL:  { bg: '#7c3aed', text: '#fff', label: 'PL'  },
} as const;

function LeaveBadge({ type }: { type: keyof typeof BADGE_STYLES }) {
  const s = BADGE_STYLES[type];
  return (
    <span style={{
      background: s.bg, color: s.text,
      fontSize: 10, fontWeight: 700,
      padding: '2px 7px', borderRadius: 5,
      letterSpacing: '0.04em', lineHeight: 1.4,
      display: 'inline-block',
    }}>{s.label}</span>
  );
}
// ✅ Section 2.4 complete (badge components)

// ── Cell background logic ─────────────────────────────────────

function getCellBackground(doctor: any, date: string, isBH: boolean, isWeekend: boolean): string {
  const cell = doctor.availability[date];
  const primary = cell?.primary ?? 'AVAILABLE';
  const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(date));

  if (primary === 'ROT') return '#ffedd5';
  if (primary === 'PL')  return '#ede9fe';
  // AL, SL, NOC → no background override
  if (isLtftDay) return '#fef9c3';
  if (isBH) return '#fee2e2';
  if (isWeekend) return '#f3f4f6';
  return '#ffffff';
}
// ✅ Section 2.2 complete (cell background)

function getColumnHeaderBg(isBH: boolean, isWeekend: boolean): string {
  if (isBH) return '#fecaca';
  if (isWeekend) return '#e5e7eb';
  return '#ffffff';
}

function getColumnHeaderTextColor(isBH: boolean, isWeekend: boolean): string {
  if (isBH) return '#b91c1c';
  if (isWeekend) return '#6b7280';
  return '#374151';
}

function getColumnBg(date: string, bankHolidays: Set<string>): string {
  const d = new Date(date + 'T00:00:00');
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  if (bankHolidays.has(date)) return '#fee2e2';
  if (isWeekend) return '#f3f4f6';
  return '#ffffff';
}
// ✅ Section 2.3 complete (column headers)

// ── Legend components ─────────────────────────────────────────

function LegendBadgeItem({ bg, label, text }: { bg: string; label: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        background: bg, color: '#fff',
        fontSize: 10, fontWeight: 700,
        padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em',
      }}>{label}</span>
      <span style={{ fontSize: 12, color: '#374151' }}>{text}</span>
    </div>
  );
}

function LegendFusedItem({ badgeBg, label, cellBg, cellBorder, text }: {
  badgeBg: string; label: string; cellBg: string; cellBorder: string; text: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 20, borderRadius: 4,
        background: cellBg, border: `1.5px solid ${cellBorder}`,
      }}>
        <span style={{
          background: badgeBg, color: '#fff',
          fontSize: 9, fontWeight: 700,
          padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em',
        }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, color: '#374151' }}>{text}</span>
    </div>
  );
}

function LegendSwatchItem({ color, border, text }: { color: string; border: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block', width: 13, height: 13, borderRadius: 3,
        background: color, border: `1.5px solid ${border}`, flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, color: '#374151' }}>{text}</span>
    </div>
  );
}

function CalendarLegend() {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '8px 16px',
      marginTop: 16, fontSize: 12, color: '#374151',
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 8, padding: '10px 16px', alignItems: 'center',
    }}>
      <LegendBadgeItem bg="#16a34a" label="AL" text="Annual Leave" />
      <LegendBadgeItem bg="#2563eb" label="SL" text="Study Leave" />
      <LegendFusedItem badgeBg="#c2410c" label="ROT" cellBg="#ffedd5" cellBorder="#ea580c" text="Rotation" />
      <LegendFusedItem badgeBg="#7c3aed" label="PL" cellBg="#ede9fe" cellBorder="#7c3aed" text="Parental Leave" />
      <LegendBadgeItem bg="#ec4899" label="NOC" text="Not On-Call" />
      <div style={{ width: 1, height: 16, background: '#e2e8f0', margin: '0 2px' }} />
      <LegendFusedItem badgeBg="#92400e" label="LTFT" cellBg="#fef9c3" cellBorder="#fde68a" text="LTFT day off" />
      <LegendSwatchItem color="#fee2e2" border="#fecaca" text="Bank Holiday" />
      <LegendSwatchItem color="#f3f4f6" border="#e5e7eb" text="Weekend" />
      <LegendSwatchItem color="#ffffff" border="#e2e8f0" text="Available" />
    </div>
  );
}
// ✅ Section 2.7 complete (legend)

export default function PreRotaCalendarPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // ✅ Section 5 complete — use RotaContext as single source of truth
  const { currentRotaConfigId: rotaConfigId } = useRotaContext();

  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeRow[]>([]);
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [surveysMap, setSurveysMap] = useState<Record<string, SurveyMap>>({});
  const [eligibility, setEligibility] = useState<Record<string, Record<string, number>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [deptName, setDeptName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // ✅ Section 6 complete — data load wrapped in try/catch
  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      if (!rotaConfigId) { setErrorMsg('No rota config found. Go back to the dashboard.'); setLoading(false); return; }

      try {

      const { data: preRota } = await supabase
        .from('pre_rota_results')
        .select('*')
        .eq('rota_config_id', rotaConfigId)
        .maybeSingle();

      if (!preRota) { setErrorMsg('No pre-rota generated yet. Go back to the dashboard and generate the pre-rota first.'); setLoading(false); return; }
      const pr = preRota as any;
      if (pr.status === 'blocked') { setErrorMsg('Pre-rota is blocked due to critical issues. Resolve them on the dashboard before viewing the calendar.'); setLoading(false); return; }

      const cd = pr.calendar_data as CalendarData;
      const td = pr.targets_data as TargetsData;
      // Merge ltftDaysOff from survey responses into calendar doctors (Section 3.3)
      // Done after surveys are loaded — see below
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
          ltftDaysOff: ((s as any).ltft_days_off ?? []).map(normaliseDayName),
          ltftNightFlexibility: ((s as any).ltft_night_flexibility ?? []).map((f: any) => ({
            ...f, day: normaliseDayName(f.day ?? ''),
          })),
        };
      }
      setSurveysMap(sMap);
      // ✅ Section 3.2 complete — survey map with normalised day names

      // Account settings
      const { data: config } = await supabase
        .from('rota_configs')
        .select('owned_by')
        .eq('id', rotaConfigId)
        .single();
      if (config) {
        // ✅ Section 1 complete — .maybeSingle() prevents crash when no account_settings exist
        const { data: acct } = await supabase
          .from('account_settings')
          .select('department_name, trust_name')
          .eq('owned_by', (config as any).owned_by)
          .maybeSingle();
        setDeptName((acct as any)?.department_name ?? cd.departmentName ?? 'Department');
        setHospitalName((acct as any)?.trust_name ?? cd.hospitalName ?? 'Trust');
      }

      // ✅ Section 3.3 complete — merge ltftDaysOff from surveys into calendar doctors
      const mergedDoctors = (cd.doctors ?? []).map((doc: any) => ({
        ...doc,
        ltftDaysOff: (
          (doc.ltftDaysOff ?? doc.ltft_days_off ?? sMap[doc.doctorId]?.ltftDaysOff ?? [])
        ).map(normaliseDayName),
      }));
      const mergedCd = { ...cd, doctors: mergedDoctors };
      setCalendarData(mergedCd);

      // Compute eligibility
      if (mergedCd?.doctors && mergedCd?.weeks) {
        const allDates: string[] = [];
        for (const w of mergedCd.weeks) allDates.push(...w.dates);
        const elig: Record<string, Record<string, number>> = {};
        for (const shift of shifts) {
          elig[shift.id] = {};
          for (const date of allDates) {
            let count = 0;
            for (const doctor of mergedCd.doctors) {
              if (isDoctorEligible(doctor, date, shift, sMap)) count++;
            }
            elig[shift.id][date] = count;
          }
        }
        setEligibility(elig);
      }

      } catch (err) {
        console.error('Failed to load calendar data:', err);
        setLoadError('Failed to load data. Please go back and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rotaConfigId]);

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

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => <AdminLayout title="Availability Calendar" accentColor="blue">{children}</AdminLayout>;

  if (loading) {
    return (
      <Wrapper>
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading calendar…</span>
        </div>
      </Wrapper>
    );
  }

  if (loadError || errorMsg || !calendarData) {
    return (
      <Wrapper>
        <div className="mx-auto max-w-lg mt-12">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-foreground">{loadError ?? errorMsg ?? 'No calendar data available.'}</p>
            <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </Wrapper>
    );
  }


  const { weeks, doctors } = calendarData;

  // ── MOBILE: single-day view ──

  if (isMobile) {
    const currentDate = allDates[currentDayIndex] ?? allDates[0];
    if (!currentDate) return null;
    const d = new Date(currentDate + 'T00:00:00');
    const isBH = bankHolidays.has(currentDate);
    const isWknd = d.getDay() === 0 || d.getDay() === 6;

    const totalAvailable = doctors.filter(doc => {
      const p = doc.availability[currentDate]?.primary ?? 'AVAILABLE';
      return !['AL', 'SL', 'ROT', 'PL', 'NOC'].includes(p);
    }).length;
    const nocOnlyCount = doctors.filter(doc => {
      const p = doc.availability[currentDate]?.primary ?? 'AVAILABLE';
      return p === 'NOC';
    }).length;

    return (
      <Wrapper>
        <div className="space-y-2 animate-fadeSlideUp">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> .xlsx
            </Button>
          </div>

          {/* Day navigator — tap date to open picker */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: getColumnHeaderBg(isBH, isWknd),
            border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 4px',
          }}>
            <button onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))} disabled={currentDayIndex === 0} className="p-2 rounded-md hover:bg-muted disabled:opacity-30 min-h-[36px]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              className="text-center relative cursor-pointer"
              style={{ padding: '2px 8px', flex: 1 }}
            >
              <p className="text-sm font-semibold" style={{ color: getColumnHeaderTextColor(isBH, isWknd) }}>
                {d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-[10px] text-muted-foreground">Day {currentDayIndex + 1} of {allDates.length} · tap to jump</p>
              {isBH && <span style={{ display: 'inline-block', background: '#b91c1c', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginTop: 2 }}>Bank Holiday</span>}
              <input
                ref={dateInputRef}
                type="date"
                min={allDates[0]}
                max={allDates[allDates.length - 1]}
                value={currentDate}
                onChange={e => {
                  const target = e.target.value;
                  if (!target) return;
                  const idx = allDates.indexOf(target);
                  if (idx !== -1) setCurrentDayIndex(idx);
                }}
                style={{
                  position: 'absolute', inset: 0,
                  opacity: 0, width: '100%', height: '100%',
                  cursor: 'pointer',
                }}
              />
            </div>
            <button onClick={() => setCurrentDayIndex(i => Math.min(allDates.length - 1, i + 1))} disabled={currentDayIndex >= allDates.length - 1} className="p-2 rounded-md hover:bg-muted disabled:opacity-30 min-h-[36px]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Doctor list first */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {doctors.map((doctor, idx) => {
              const cell = doctor.availability[currentDate];
              const primary = cell?.primary ?? 'AVAILABLE';
              const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(currentDate));
              const cellBg = getCellBackground(doctor, currentDate, isBH, isWknd);
              const isUnavailable = ['AL', 'SL', 'ROT', 'PL'].includes(primary);

              return (
                <div key={doctor.doctorId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px',
                  background: cellBg,
                  borderBottom: idx < doctors.length - 1 ? '1px solid #f1f5f9' : 'none',
                  opacity: isUnavailable ? 0.6 : 1,
                  minHeight: 30,
                }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {doctor.doctorName}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{doctor.grade} · {doctor.wte}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 4 }}>
                    {primary === 'AL' && <span style={{ background: '#16a34a', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>AL</span>}
                    {primary === 'SL' && <span style={{ background: '#2563eb', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>SL</span>}
                    {primary === 'ROT' && <span style={{ background: '#c2410c', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>ROT</span>}
                    {primary === 'PL' && <span style={{ background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>PL</span>}
                    {primary === 'NOC' && <span style={{ background: '#ec4899', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>NOC</span>}
                    {isLtftDay && <span style={{ background: 'rgba(253,230,138,0.7)', color: '#92400e', border: '1px solid #fde68a', fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3 }}>LTFT</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Availability summary — total only, tap to expand */}
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
            background: '#f8fafc',
          }}>
            <button
              onClick={() => setShowBreakdown(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 12px', background: 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  background: availabilityColour(totalAvailable, maxMinDoctors), color: '#fff',
                  fontSize: 13, fontWeight: 700,
                }}>{totalAvailable}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Available (all shifts)</span>
                {nocOnlyCount > 0 && (
                  <span style={{ fontSize: 10, color: '#ec4899', fontWeight: 600 }}>+{nocOnlyCount} NOC</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" style={{
                transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }} />
            </button>
            {showBreakdown && (
              <div style={{
                display: 'grid', gridTemplateColumns: `repeat(${Math.min(shiftTypes.length, 3)}, 1fr)`,
                gap: 6, padding: '4px 12px 10px',
                borderTop: '1px solid #e2e8f0',
              }}>
                {shiftTypes.map(shift => {
                  const count = eligibility[shift.id]?.[currentDate] ?? 0;
                  return (
                    <div key={shift.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 5,
                        background: availabilityColour(count, shift.min_doctors), color: '#fff',
                        fontSize: 12, fontWeight: 700,
                      }}>{count}</span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, lineHeight: 1.2 }}>{shift.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compact legend */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '4px 10px',
            fontSize: 10, color: '#374151', padding: '6px 10px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
          }}>
            <span><span style={{ background: '#16a34a', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>AL</span> Annual</span>
            <span><span style={{ background: '#2563eb', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>SL</span> Study</span>
            <span><span style={{ background: '#c2410c', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>ROT</span> Rotation</span>
            <span><span style={{ background: '#7c3aed', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>PL</span> Parental</span>
            <span><span style={{ background: '#ec4899', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>NOC</span> Not On-Call</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#fef9c3', border: '1px solid #fde68a', display: 'inline-block' }} /> LTFT</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#fee2e2', border: '1px solid #fecaca', display: 'inline-block' }} /> BH</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'inline-block' }} /> Weekend</span>
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── DESKTOP: weekly table ──
  const week = weeks[currentWeekIndex];
  if (!week) return null;

  return (
    <AdminLayout title="Availability Calendar" subtitle={`${deptName}${deptName && hospitalName ? ' · ' : ''}${hospitalName}`} accentColor="blue">
      <div className="space-y-4 animate-fadeSlideUp">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download .xlsx
          </Button>
        </div>

        {/* Week jump selector */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', background: '#f8fafc',
          borderRadius: 8, border: '1px solid #e2e8f0',
          marginBottom: 4, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Jump to week:</label>
            <select
              value={currentWeekIndex}
              onChange={e => setCurrentWeekIndex(Number(e.target.value))}
              style={{
                fontSize: 13, padding: '5px 10px', borderRadius: 6,
                border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
              }}
            >
              {weeks.map((w, idx) => (
                <option key={idx} value={idx}>
                  Week {w.weekNumber} — {new Date(w.dates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} to {new Date(w.dates[w.dates.length - 1] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </option>
              ))}
            </select>
          </div>
          <span style={{ color: '#cbd5e1', fontSize: 16 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Jump to date:</label>
            <input
              type="date"
              min={allDates[0]}
              max={allDates[allDates.length - 1]}
              onChange={e => {
                const target = e.target.value;
                if (!target) return;
                const idx = weeks.findIndex(w => w.dates.includes(target));
                if (idx !== -1) setCurrentWeekIndex(idx);
              }}
              style={{
                fontSize: 13, padding: '5px 10px', borderRadius: 6,
                border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginLeft: 'auto' }}>
            Week {currentWeekIndex + 1} of {weeks.length}
          </span>
        </div>
        {/* ✅ Section 1c complete — week/date jump selector */}

        {/* Week navigator (← → buttons preserved) */}
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

        {/* Calendar table — ✅ Section 1f: scrollable container with minWidth */}
        <div style={{ overflowX: 'hidden' }}>
          <table style={{ width: '100%', tableLayout: 'fixed' }} className="text-xs border-collapse">
            <thead>
              <tr>
                <th style={{ width: '18%', minWidth: 100, maxWidth: 140, position: 'sticky', left: 0, zIndex: 10, background: '#fff', textAlign: 'left', padding: '8px 6px', fontWeight: 500, color: '#6b7280', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                  Doctor
                </th>
                {week.dates.map(date => {
                  const dd = new Date(date + 'T00:00:00');
                  const isWknd = dd.getDay() === 0 || dd.getDay() === 6;
                  const isBH = bankHolidays.has(date);
                  return (
                    <th key={date} style={{
                      textAlign: 'center', padding: '8px 4px', fontWeight: 500,
                      background: getColumnHeaderBg(isBH, isWknd),
                      color: getColumnHeaderTextColor(isBH, isWknd),
                      borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0',
                      minWidth: 36,
                    }}>
                      <div style={{ fontSize: 10 }}>{dd.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                      <div style={{ fontSize: 10, fontWeight: 400 }}>{dd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                      {isBH && (
                        <span style={{
                          display: 'inline-block', background: '#b91c1c', color: '#fff',
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          letterSpacing: '0.04em', marginTop: 3,
                        }}>BH</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {doctors.map(doctor => (
                <tr key={doctor.doctorId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {/* Doctor name cell — 2.1 */}
                  <td style={{
                    width: '18%', minWidth: 100, maxWidth: 140,
                    position: 'sticky', left: 0, zIndex: 10, background: '#fff',
                    padding: '6px 6px',
                    borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9',
                    minHeight: 52, height: 1, verticalAlign: 'middle',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doctor.doctorName}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doctor.grade} · {doctor.wte}%
                    </div>
                    {getLtftDaysOff(doctor).length > 0 && (
                      <div style={{ marginTop: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#b45309',
                          background: '#fef3c7', borderRadius: 3, padding: '1px 5px',
                        }}>
                          LTFT: {getLtftDaysOff(doctor).map(d => d.slice(0, 3).charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                        </span>
                      </div>
                    )}
                  </td>
                  {/* ✅ Section 2.1 complete (doctor name column) */}

                  {week.dates.map(date => {
                    const cell = doctor.availability[date];
                    const primary = cell?.primary ?? 'AVAILABLE';
                    const isWknd = new Date(date + 'T00:00:00').getDay() === 0 || new Date(date + 'T00:00:00').getDay() === 6;
                    const isBH = bankHolidays.has(date);
                    const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(date));
                    const isNoc = primary === 'NOC';

                    const badgeEvents = (['AL', 'SL', 'ROT', 'PL'] as const).filter(e => primary === e);
                    const bg = getCellBackground(doctor, date, isBH, isWknd);

                    return (
                      <td key={date} style={{
                        background: bg,
                        borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #e2e8f0',
                        textAlign: 'center',
                        minHeight: 52, height: 1, verticalAlign: 'middle',
                        padding: 0,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 2px' }}>
                          {badgeEvents.map(event => <LeaveBadge key={event} type={event} />)}
                          {isNoc && (
                            <span style={{
                              background: '#ec4899', color: '#fff',
                              fontSize: 10, fontWeight: 700,
                              padding: '2px 7px', borderRadius: 5,
                              letterSpacing: '0.04em', lineHeight: 1.4,
                            }}>NOC</span>
                          )}
                          {isLtftDay && (
                            <span style={{
                              background: 'rgba(253,230,138,0.7)', color: '#92400e',
                              border: '1px solid #fde68a',
                              fontSize: 9, fontWeight: 600,
                              padding: '1px 5px', borderRadius: 4,
                              letterSpacing: '0.03em',
                            }}>LTFT</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* ✅ Section 2.4 complete (multi-badge cells) */}
              {/* ✅ Section 2.5 complete (consistent row heights) */}

              {/* Divider */}
              <tr>
                <td colSpan={week.dates.length + 1} style={{ padding: 0 }}>
                  <div style={{ height: 3, background: '#e2e8f0' }} />
                </td>
              </tr>

              {/* ✅ Section 2 complete — Total available row with NOC sub-count */}
              <tr style={{ background: '#f8fafc' }}>
                <td style={{
                  padding: '10px 12px', fontWeight: 700, fontSize: 13, color: '#1e293b',
                  borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                  position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1,
                  minHeight: 44, height: 1,
                }}>All shifts</td>
                {week.dates.map(date => {
                  const availableAll = doctors.filter(doc => {
                    const p = doc.availability[date]?.primary ?? 'AVAILABLE';
                    return !['AL', 'SL', 'ROT', 'PL', 'NOC'].includes(p);
                  }).length;
                  const availableNonOcOnly = doctors.filter(doc => {
                    const p = doc.availability[date]?.primary ?? 'AVAILABLE';
                    return p === 'NOC';
                  }).length;
                  const bg = availabilityColour(availableAll, maxMinDoctors);
                  return (
                    <td key={date} style={{
                      background: getColumnBg(date, bankHolidays),
                      borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0',
                      textAlign: 'center', minHeight: 44, height: 1,
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 6,
                          background: bg, color: '#fff', fontSize: 13, fontWeight: 700,
                        }}>{availableAll}</span>
                        {availableNonOcOnly > 0 && (
                          <span style={{ fontSize: 10, color: '#ec4899', fontWeight: 600 }}>
                            +{availableNonOcOnly} NOC
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Per-shift eligibility rows */}
              {shiftTypes.map((shift, si) => (
                <tr key={shift.id} style={{ background: si % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{
                    padding: '7px 12px 7px 20px',
                    fontSize: 12, color: '#64748b',
                    borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #e2e8f0',
                    position: 'sticky', left: 0, background: si % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1,
                    minHeight: 44, height: 1,
                  }}>{shift.name}</td>
                  {week.dates.map(date => {
                    const count = eligibility[shift.id]?.[date] ?? 0;
                    const color = availabilityColour(count, shift.min_doctors);
                    return (
                      <td key={date} style={{
                        background: getColumnBg(date, bankHolidays),
                        borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #e2e8f0',
                        textAlign: 'center', minHeight: 44, height: 1,
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* ✅ Section 2.6 complete (availability rows) */}
            </tbody>
          </table>
        </div>

        <CalendarLegend />
      </div>
    </AdminLayout>
  );
}
// ✅ Section 2 complete
// ✅ Section 5 complete (responsive design applied)