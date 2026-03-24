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
import { getTodayISO, mapOverrideRow, mergeOverridesIntoAvailability, type CalendarOverride, type MergedCell } from "@/lib/calendarOverrides";
import { EventDetailPanel } from '@/components/calendar/EventDetailPanel'
import { AddEventModal } from '@/components/calendar/AddEventModal'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const FULL_DAY_NAMES: Record<string, string> = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday',
  sunday: 'sunday', monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday',
  thursday: 'thursday', friday: 'friday', saturday: 'saturday',
};

function normaliseDayName(raw: string): string {
  return FULL_DAY_NAMES[raw.toLowerCase()] ?? raw.toLowerCase();
}

function getDayNameFromISO(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return DAY_NAMES[d.getUTCDay()];
}

function getLtftDaysOff(doctor: any): string[] {
  const raw = doctor.ltftDaysOff ?? doctor.ltft_days_off ?? [];
  return (Array.isArray(raw) ? raw : []).map(normaliseDayName);
}

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

// ── Cell background logic ─────────────────────────────────────

function getCellBackground(doctor: any, date: string, isBH: boolean, isWeekend: boolean): string {
  const cell = doctor.availability[date];
  const primary = cell?.primary ?? 'AVAILABLE';
  const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(date));
  if (primary === 'ROT') return '#ffedd5';
  if (primary === 'PL') return '#ede9fe';
  if (isLtftDay) return '#fef9c3';
  return '#ffffff';
}

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
  return '#ffffff';
}

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
        }}>
          <span style={{
            background: '#2563eb', color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '1px 4px', borderRadius: 3,
          }}>SL</span>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#ea580c',
          }} />
        </span>
        <span style={{ fontSize: 12, color: '#374151' }}>Coordinator override</span>
      </div>
      <LegendSwatchItem color="#dbeafe" border="#bfdbfe" text="Today" />
      <LegendSwatchItem color="#fecaca" border="#fca5a5" text="Bank Holiday (header)" />
      <LegendSwatchItem color="#e5e7eb" border="#d1d5db" text="Weekend (header)" />
      <LegendSwatchItem color="#ffffff" border="#e2e8f0" text="Available" />
    </div>
  );
}

// ── Override helpers ──────────────────────────────────────────

function RotaOverrideDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: '#ea580c', marginLeft: 2, flexShrink: 0,
    }} />
  );
}

function getMergedCellBackground(mergedCell: MergedCell | undefined, isLtftDay: boolean): string {
  if (!mergedCell) return '#ffffff'
  const primary = mergedCell.isDeleted ? 'AVAILABLE' : mergedCell.primary
  if (primary === 'ROT') return '#ffedd5'
  if (primary === 'PL') return '#ede9fe'
  if (isLtftDay) return '#fef9c3'
  return '#ffffff'
}

// ── View Toggle ───────────────────────────────────────────────

function ViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: 'day' | 'week' | 'month';
  setViewMode: (v: 'day' | 'week' | 'month') => void;
}) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {(['day', 'week', 'month'] as const).map((v, i) => (
        <button
          key={v}
          onClick={() => setViewMode(v)}
          style={{
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: viewMode === v ? 600 : 400,
            background: viewMode === v ? '#2563eb' : '#fff',
            color: viewMode === v ? '#fff' : '#64748b',
            border: 'none',
            borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export default function PreRotaCalendarPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const todayISO = getTodayISO();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
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
  const [currentMonthKey, setCurrentMonthKey] = useState('')
  const [deptName, setDeptName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [overrides, setOverrides] = useState<CalendarOverride[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ doctorId: string; date: string } | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalPrefill, setModalPrefill] = useState<{
    eventType: string; startDate: string; endDate: string;
    note: string; overrideId: string; originalEventType: string | null
  } | null>(null)
  const [modalCopyFrom, setModalCopyFrom] = useState<{
    eventType: string; startDate: string; endDate: string
  } | null>(null)
  const [modalInitialDate, setModalInitialDate] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const navRef = useRef<{ goPrev: () => void; goNext: () => void }>({
    goPrev: () => {},
    goNext: () => {},
  });
  const panelRef = useRef<HTMLDivElement>(null)

  // Default to day view on mobile
  useEffect(() => {
    if (isMobile === true) setViewMode('day');
  }, [isMobile]);

  // Data load
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
        .select('date, is_active')
        .eq('rota_config_id', rotaConfigId);
      const bhSet = new Set(
        (bhRows ?? [])
          .filter((r: any) => r.is_active !== false)
          .map((r: any) => r.date as string)
      );
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
          .maybeSingle();
        setDeptName((acct as any)?.department_name ?? cd.departmentName ?? 'Department');
        setHospitalName((acct as any)?.trust_name ?? cd.hospitalName ?? 'Trust');
      }

      // Merge ltftDaysOff from surveys into calendar doctors
      const mergedDoctors = (cd.doctors ?? []).map((doc: any) => ({
        ...doc,
        ltftDaysOff: (
          (doc.ltftDaysOff ?? doc.ltft_days_off ?? sMap[doc.doctorId]?.ltftDaysOff ?? [])
        ).map(normaliseDayName),
      }));
      const mergedCd = { ...cd, doctors: mergedDoctors };
      setCalendarData(mergedCd);

      // Initialise navigation to today's position
      const initialDate = (todayISO >= mergedCd.rotaStartDate && todayISO <= mergedCd.rotaEndDate)
        ? todayISO : mergedCd.rotaStartDate;
      const initialWeekIdx = mergedCd.weeks.findIndex(
        w => w.startDate <= initialDate && initialDate <= w.endDate
      );
      setCurrentWeekIndex(initialWeekIdx >= 0 ? initialWeekIdx : 0);
      const allDatesFlat = mergedCd.weeks.flatMap(w => w.dates);
      const initialDayIdx = allDatesFlat.indexOf(initialDate);
      setCurrentDayIndex(initialDayIdx >= 0 ? initialDayIdx : 0);
      setCurrentMonthKey(initialDate.slice(0, 7))

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

      // Load coordinator overrides for all doctors in this rota
      const { data: overrideRows } = await supabase
        .from('coordinator_calendar_overrides')
        .select('*')
        .eq('rota_config_id', rotaConfigId)
      setOverrides((overrideRows ?? []).map(mapOverrideRow));

      } catch (err) {
        console.error('Failed to load calendar data:', err);
        setLoadError('Failed to load data. Please go back and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rotaConfigId]);

  // Keyboard navigation via navRef
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navRef.current.goPrev();
      if (e.key === 'ArrowRight') navRef.current.goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (panelOpen && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [panelOpen])

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) < 50 || Math.abs(dx) < dy) return;
    dx < 0 ? navRef.current.goNext() : navRef.current.goPrev();
  };

  const reloadOverrides = async () => {
    if (!rotaConfigId) return
    const { data } = await supabase
      .from('coordinator_calendar_overrides')
      .select('*')
      .eq('rota_config_id', rotaConfigId)
    setOverrides((data ?? []).map(mapOverrideRow))
  }

  const handleSaveOverride = async (payload: {
    eventType: string; startDate: string; endDate: string;
    note: string; overrideId: string | null; originalEventType: string | null
  }) => {
    if (!selectedCell || !rotaConfigId) return
    setModalSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setModalSaving(false); return }

      if (payload.overrideId) {
        await supabase.from('coordinator_calendar_overrides').delete().eq('id', payload.overrideId)
        await supabase.from('coordinator_calendar_overrides').insert({
          rota_config_id: rotaConfigId, doctor_id: selectedCell.doctorId,
          event_type: payload.eventType, start_date: payload.startDate, end_date: payload.endDate,
          action: 'modify', original_event_type: payload.originalEventType,
          note: payload.note || null, created_by: user.id,
        })
      } else {
        await supabase.from('coordinator_calendar_overrides').insert({
          rota_config_id: rotaConfigId, doctor_id: selectedCell.doctorId,
          event_type: payload.eventType, start_date: payload.startDate, end_date: payload.endDate,
          action: 'add', note: payload.note || null, created_by: user.id,
        })
      }
      await reloadOverrides()
      setModalOpen(false); setModalPrefill(null); setModalCopyFrom(null); setModalInitialDate(null)
      setPanelOpen(false); setSelectedCell(null)
    } catch (err) {
      console.error('Failed to save override:', err)
    } finally {
      setModalSaving(false)
    }
  }

  const handleDeleteOverride = async (override: CalendarOverride) => {
    if (!rotaConfigId || !selectedCell) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('coordinator_calendar_overrides').delete().eq('id', override.id)
      await reloadOverrides()
      setPanelOpen(false); setSelectedCell(null)
    } catch (err) {
      console.error('Failed to delete override:', err)
    }
  }

  const handleRemoveSurveyEvent = async () => {
    if (!selectedCell || !calendarData || !rotaConfigId) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const cellCode = mergedAvailabilityByDoctor[selectedCell.doctorId]?.[selectedCell.date]?.primary ?? 'AVAILABLE'
      if (cellCode === 'AVAILABLE') return
      await supabase.from('coordinator_calendar_overrides').insert({
        rota_config_id: rotaConfigId, doctor_id: selectedCell.doctorId,
        event_type: cellCode, start_date: selectedCell.date, end_date: selectedCell.date,
        action: 'delete', original_event_type: cellCode,
        original_start_date: selectedCell.date, original_end_date: selectedCell.date,
        note: null, created_by: user.id,
      })
      await reloadOverrides()
      setPanelOpen(false); setSelectedCell(null)
    } catch (err) {
      console.error('Failed to remove survey event:', err)
    }
  }

  const handleCellTap = (doctorId: string, date: string) => {
    if (selectedCell?.doctorId === doctorId && selectedCell?.date === date && panelOpen) {
      setPanelOpen(false); setSelectedCell(null)
    } else {
      setSelectedCell({ doctorId, date }); setPanelOpen(true); setModalOpen(false)
    }
  }


  const allDates = useMemo(() => calendarData?.weeks.flatMap(w => w.dates) ?? [], [calendarData]);
  const maxMinDoctors = useMemo(() => Math.max(...shiftTypes.map(s => s.min_doctors), 1), [shiftTypes]);

  const mergedAvailabilityByDoctor = useMemo<Record<string, Record<string, MergedCell>>>(() => {
    if (!calendarData) return {}
    const result: Record<string, Record<string, MergedCell>> = {}
    for (const doctor of calendarData.doctors) {
      const doctorOverrides = overrides.filter(o => o.doctorId === doctor.doctorId)
      result[doctor.doctorId] = mergeOverridesIntoAvailability(
        doctor.availability,
        doctorOverrides,
        calendarData.rotaStartDate,
        calendarData.rotaEndDate
      )
    }
    return result
  }, [calendarData, overrides])

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

  // Navigation derived values
  const currentWeek = weeks[currentWeekIndex];
  const currentDate = allDates[currentDayIndex] ?? allDates[0];

  const weekLabel = currentWeek
    ? `Wk ${currentWeek.weekNumber} · ${new Date(currentWeek.dates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}–${new Date(currentWeek.dates[currentWeek.dates.length - 1] + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    : '';
  const dayLabel = currentDate
    ? new Date(currentDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const navLabel = viewMode === 'week' ? weekLabel : viewMode === 'day' ? dayLabel : 'Month view';

  const prevDisabled = viewMode === 'week'
    ? currentWeekIndex === 0
    : viewMode === 'day'
    ? currentDayIndex === 0
    : false;
  const nextDisabled = viewMode === 'week'
    ? currentWeekIndex >= weeks.length - 1
    : viewMode === 'day'
    ? currentDayIndex >= allDates.length - 1
    : false;

  const goPrev = () => {
    if (viewMode === 'week') setCurrentWeekIndex(i => Math.max(0, i - 1));
    else if (viewMode === 'day') setCurrentDayIndex(i => Math.max(0, i - 1));
  };
  const goNext = () => {
    if (viewMode === 'week') setCurrentWeekIndex(i => Math.min(weeks.length - 1, i + 1));
    else if (viewMode === 'day') setCurrentDayIndex(i => Math.min(allDates.length - 1, i + 1));
  };

  // Keep navRef current every render so keyboard/swipe handlers never go stale
  navRef.current.goPrev = goPrev;
  navRef.current.goNext = goNext;

  const handleDateChange = (iso: string) => {
    const wIdx = weeks.findIndex(w => w.startDate <= iso && iso <= w.endDate);
    if (wIdx >= 0) setCurrentWeekIndex(wIdx);
    const dIdx = allDates.indexOf(iso);
    if (dIdx >= 0) setCurrentDayIndex(dIdx);
  };

  // Day view pre-computed values
  const isBHDay = bankHolidays.has(currentDate);
  const isWkndDay = (() => {
    const d = new Date(currentDate + 'T00:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
  })();
  const totalAvailable = doctors.filter(doc => {
    const mc = mergedAvailabilityByDoctor[doc.doctorId]?.[currentDate]
    const p = mc?.isDeleted ? 'AVAILABLE' : (mc?.primary ?? 'AVAILABLE')
    return !['AL', 'SL', 'ROT', 'PL', 'NOC'].includes(p)
  }).length
  const nocOnlyCount = doctors.filter(doc => {
    const mc = mergedAvailabilityByDoctor[doc.doctorId]?.[currentDate]
    const p = mc?.isDeleted ? 'AVAILABLE' : (mc?.primary ?? 'AVAILABLE')
    return p === 'NOC'
  }).length
  const isDayToday = currentDate === todayISO;
  const dayHeaderBg = isDayToday ? '#dbeafe' : isBHDay ? '#fee2e2' : isWkndDay ? '#f3f4f6' : '#f8fafc';
  const dayHeaderTextColor = isDayToday ? '#1d4ed8' : getColumnHeaderTextColor(isBHDay, isWkndDay);

  return (
    <Wrapper>
      <div className="space-y-3 animate-fadeSlideUp" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {/* Top bar — non-embedded only */}
        {!embedded && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Download .xlsx
            </Button>
          </div>
        )}

        {/* Unified nav bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 12px', background: '#f8fafc',
          borderRadius: 8, border: '1px solid #e2e8f0',
        }}>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <button onClick={goPrev} disabled={prevDisabled} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', minWidth: 120, textAlign: 'center' }}>
            {navLabel}
          </span>
          <button onClick={goNext} disabled={nextDisabled} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <input
            type="date"
            min={allDates[0]}
            max={allDates[allDates.length - 1]}
            onChange={e => { if (e.target.value) handleDateChange(e.target.value); }}
            style={{
              fontSize: 12, padding: '4px 8px',
              border: '1px solid #e2e8f0', borderRadius: 6,
              background: '#fff', cursor: 'pointer',
            }}
          />
        </div>

        {/* ── WEEK VIEW ── */}
        {viewMode === 'week' && currentWeek && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', tableLayout: 'fixed' }} className="text-xs border-collapse">
              <thead>
                <tr>
                  <th style={{ width: '18%', minWidth: 100, maxWidth: 140, position: 'sticky', left: 0, zIndex: 10, background: '#fff', textAlign: 'left', padding: '8px 6px', fontWeight: 500, color: '#6b7280', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                    Doctor
                  </th>
                  {currentWeek.dates.map(date => {
                    const dd = new Date(date + 'T00:00:00');
                    const isWknd = dd.getDay() === 0 || dd.getDay() === 6;
                    const isBH = bankHolidays.has(date);
                    const isToday = date === todayISO;
                    const hdrBg = isToday ? '#dbeafe' : isBH ? '#fecaca' : isWknd ? '#e5e7eb' : '#ffffff';
                    const hdrColor = isToday ? '#1d4ed8' : isBH ? '#b91c1c' : isWknd ? '#6b7280' : '#374151';
                    return (
                      <th key={date} style={{
                        textAlign: 'center', padding: '8px 4px', fontWeight: 500,
                        background: hdrBg,
                        color: hdrColor,
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
                    <td style={{
                      width: '18%', minWidth: 100, maxWidth: 140,
                      position: 'sticky', left: 0, zIndex: 10, background: '#fff',
                      padding: '6px 6px',
                      borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9',
                      minHeight: 52, height: 1, verticalAlign: 'middle',
                    }}>
                      <div
                        onClick={() => navigate(`/admin/doctor-calendar/${doctor.doctorId}`)}
                        style={{
                          fontWeight: 600, fontSize: 12, color: '#2563eb',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          cursor: 'pointer',
                        }}
                        title="View doctor calendar"
                      >
                        {doctor.doctorName} →
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
                    {currentWeek.dates.map(date => {
                      const mergedCell = mergedAvailabilityByDoctor[doctor.doctorId]?.[date]
                      const primary = mergedCell?.primary ?? 'AVAILABLE'
                      const isWknd = new Date(date + 'T00:00:00').getDay() === 0 || new Date(date + 'T00:00:00').getDay() === 6;
                      const isBH = bankHolidays.has(date);
                      const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(date));
                      const isNoc = primary === 'NOC';
                      const badgeEvents = (['AL', 'SL', 'ROT', 'PL'] as const).filter(e => primary === e);
                      const bg = getMergedCellBackground(mergedCell, isLtftDay);
                      return (
                        <td key={date} onClick={() => handleCellTap(doctor.doctorId, date)} style={{
                          background: bg,
                          borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #e2e8f0',
                          textAlign: 'center',
                          minHeight: 52, height: 1, verticalAlign: 'middle',
                          padding: 0, cursor: 'pointer',
                          outline: selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === date
                            ? '2px solid #2563eb' : 'none',
                          outlineOffset: -2,
                        }>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 2px' }}>
                            {mergedCell?.isDeleted && mergedCell.deletedCode ? (
                              <span style={{
                                background: '#d1d5db', color: '#6b7280',
                                fontSize: 10, fontWeight: 700,
                                padding: '2px 7px', borderRadius: 5,
                                textDecoration: 'line-through',
                              }}>{mergedCell.deletedCode}</span>
                            ) : (
                              <>
                                {badgeEvents.map(event => (
                                  <span key={event} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <LeaveBadge type={event} />
                                    {(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}
                                  </span>
                                ))}
                                {isNoc && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <span style={{
                                      background: '#ec4899', color: '#fff',
                                      fontSize: 10, fontWeight: 700,
                                      padding: '2px 7px', borderRadius: 5,
                                      letterSpacing: '0.04em', lineHeight: 1.4,
                                    }}>NOC</span>
                                    {(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}
                                  </span>
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
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Divider */}
                <tr>
                  <td colSpan={currentWeek.dates.length + 1} style={{ padding: 0 }}>
                    <div style={{ height: 3, background: '#e2e8f0' }} />
                  </td>
                </tr>

                {/* Total available row */}
                <tr style={{ background: '#f8fafc' }}>
                  <td style={{
                    padding: '10px 12px', fontWeight: 700, fontSize: 13, color: '#1e293b',
                    borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                    position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1,
                    minHeight: 44, height: 1,
                  }}>All shifts</td>
                  {currentWeek.dates.map(date => {
                    const availableAll = doctors.filter(doc =>
                      !['AL', 'SL', 'ROT', 'PL', 'NOC'].includes(doc.availability[date]?.primary ?? 'AVAILABLE')
                    ).length;
                    const availableNocOnly = doctors.filter(doc =>
                      (doc.availability[date]?.primary ?? 'AVAILABLE') === 'NOC'
                    ).length;
                    const bg = availabilityColour(availableAll, maxMinDoctors);
                    return (
                      <td key={date} style={{
                        background: '#ffffff',
                        borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0',
                        textAlign: 'center', minHeight: 44, height: 1,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6,
                            background: bg, color: '#fff', fontSize: 13, fontWeight: 700,
                          }}>{availableAll}</span>
                          {availableNocOnly > 0 && (
                            <span style={{ fontSize: 10, color: '#ec4899', fontWeight: 600 }}>
                              +{availableNocOnly} NOC
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
                    {currentWeek.dates.map(date => {
                      const count = eligibility[shift.id]?.[date] ?? 0;
                      const color = availabilityColour(count, shift.min_doctors);
                      return (
                        <td key={date} style={{
                          background: '#ffffff',
                          borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #e2e8f0',
                          textAlign: 'center', minHeight: 44, height: 1,
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DAY VIEW ── */}
        {viewMode === 'day' && (
          <div className="space-y-2">
            {/* Day navigator */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: dayHeaderBg,
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 4px',
            }}>
              <button
                onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))}
                disabled={currentDayIndex === 0}
                className="p-2 rounded-md hover:bg-muted disabled:opacity-30 min-h-[36px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div
                className="text-center relative cursor-pointer"
                style={{ padding: '2px 8px', flex: 1 }}
              >
                <p className="text-sm font-semibold" style={{ color: dayHeaderTextColor }}>
                  {new Date(currentDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[10px] text-muted-foreground">Day {currentDayIndex + 1} of {allDates.length} · tap to jump</p>
                {isBHDay && (
                  <span style={{ display: 'inline-block', background: '#b91c1c', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginTop: 2 }}>Bank Holiday</span>
                )}
                <input
                  ref={dateInputRef}
                  type="date"
                  min={allDates[0]}
                  max={allDates[allDates.length - 1]}
                  value={currentDate}
                  onChange={e => { if (e.target.value) handleDateChange(e.target.value); }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </div>
              <button
                onClick={() => setCurrentDayIndex(i => Math.min(allDates.length - 1, i + 1))}
                disabled={currentDayIndex >= allDates.length - 1}
                className="p-2 rounded-md hover:bg-muted disabled:opacity-30 min-h-[36px]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Doctor list */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              {doctors.map((doctor, idx) => {
                const mergedCell = mergedAvailabilityByDoctor[doctor.doctorId]?.[currentDate]
                const primary = mergedCell?.isDeleted ? 'AVAILABLE' : (mergedCell?.primary ?? 'AVAILABLE')
                const isLtftDay = getLtftDaysOff(doctor).includes(getDayNameFromISO(currentDate));
                const cellBg = getMergedCellBackground(mergedCell, isLtftDay);
                const isUnavailable = ['AL', 'SL', 'ROT', 'PL'].includes(primary);
                return (
                  <div key={doctor.doctorId} onClick={() => handleCellTap(doctor.doctorId, currentDate)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === currentDate
                      ? '#eff6ff' : cellBg,
                    borderBottom: idx < doctors.length - 1 ? '1px solid #f1f5f9' : 'none',
                    opacity: isUnavailable ? 0.6 : 1,
                    minHeight: 30, cursor: 'pointer',
                    outline: selectedCell?.doctorId === doctor.doctorId && selectedCell?.date === currentDate
                      ? '2px solid #2563eb' : 'none',
                    outlineOffset: -1,
                  }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <span
                        onClick={() => navigate(`/admin/doctor-calendar/${doctor.doctorId}`)}
                        style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', cursor: 'pointer' }}
                      >
                        {doctor.doctorName}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{doctor.grade} · {doctor.wte}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 4 }}>
                      {mergedCell?.isDeleted && mergedCell.deletedCode ? (
                        <span style={{
                          background: '#d1d5db', color: '#6b7280',
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          textDecoration: 'line-through',
                        }}>{mergedCell.deletedCode}</span>
                      ) : (
                        <>
                          {primary === 'AL' && <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ background: '#16a34a', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>AL</span>{(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}</span>}
                          {primary === 'SL' && <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ background: '#2563eb', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>SL</span>{(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}</span>}
                          {primary === 'ROT' && <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ background: '#c2410c', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>ROT</span>{(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}</span>}
                          {primary === 'PL' && <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>PL</span>{(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}</span>}
                          {primary === 'NOC' && <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ background: '#ec4899', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>NOC</span>{(mergedCell?.overrideAction === 'add' || mergedCell?.overrideAction === 'modify') && <RotaOverrideDot />}</span>}
                          {isLtftDay && <span style={{ background: 'rgba(253,230,138,0.7)', color: '#92400e', border: '1px solid #fde68a', fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3 }}>LTFT</span>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Availability summary */}
            <div style={{
              border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
              background: '#f8fafc',
            }}>
              <button
                onClick={() => setShowBreakdown(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#dbeafe', border: '1px solid #bfdbfe', display: 'inline-block' }} /> Today</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#fee2e2', border: '1px solid #fecaca', display: 'inline-block' }} /> BH</span>
            </div>
          </div>
        )}

        {panelOpen && selectedCell && calendarData && (() => {
          const selDoctor = calendarData.doctors.find(d => d.doctorId === selectedCell.doctorId)
          const mergedCell = mergedAvailabilityByDoctor[selectedCell.doctorId]?.[selectedCell.date]
          if (!selDoctor || !mergedCell) return null
          return (
            <>
              <EventDetailPanel
                mergedCell={mergedCell}
                date={selectedCell.date}
                doctorName={selDoctor.doctorName}
                overrides={overrides.filter(o => o.doctorId === selectedCell.doctorId)}
                onEdit={override => {
                  setModalPrefill({
                    eventType: override.eventType, startDate: override.startDate,
                    endDate: override.endDate, note: override.note ?? '',
                    overrideId: override.id, originalEventType: override.originalEventType,
                  })
                  setModalCopyFrom(null); setModalInitialDate(null); setModalOpen(true)
                }}
                onDelete={handleDeleteOverride}
                onCopy={override => {
                  setModalCopyFrom({ eventType: override.eventType, startDate: override.startDate, endDate: override.endDate })
                  setModalPrefill(null); setModalInitialDate(null); setModalOpen(true)
                }}
                onAddNew={() => {
                  setModalPrefill(null); setModalCopyFrom(null)
                  setModalInitialDate(selectedCell.date); setModalOpen(true)
                }}
                onRemoveSurveyEvent={handleRemoveSurveyEvent}
                onClose={() => { setPanelOpen(false); setSelectedCell(null) }}
              />
              {modalOpen && (
                <AddEventModal
                  prefill={modalPrefill ?? undefined}
                  copyFrom={modalCopyFrom ?? undefined}
                  initialDate={modalInitialDate ?? undefined}
                  doctorName={selDoctor.doctorName}
                  rotaStartDate={calendarData.rotaStartDate}
                  rotaEndDate={calendarData.rotaEndDate}
                  saving={modalSaving}
                  onSave={handleSaveOverride}
                  onClose={() => { setModalOpen(false); setModalPrefill(null); setModalCopyFrom(null); setModalInitialDate(null) }}
                />
              )}
            </>
          )
        })()}


        {viewMode === 'month' && (
          <div style={{
            padding: 40, textAlign: 'center',
            border: '1px solid #e2e8f0', borderRadius: 8,
            background: '#f8fafc', color: '#64748b', fontSize: 14,
          }}>
            Month view coming soon.
          </div>
        )}

        {/* Full legend — always shown */}
        <CalendarLegend />
      </div>
    </Wrapper>
  );
}
