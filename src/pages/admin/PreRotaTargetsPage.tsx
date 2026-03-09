import { useState, useEffect, useCallback, useMemo } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import { computeShiftTargets, type ComputeShiftTargetsResult } from "@/lib/shiftTargets";
import { useRotaConfig } from "@/lib/rotaConfig";
import { useRotaContext } from "@/contexts/RotaContext";
import type { CalendarData, TargetsData, DoctorTargets } from "@/lib/preRotaTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, AlertTriangle, BarChart3 } from "lucide-react";
// ✅ Section 5 complete (imports — useRotaContext replaces sessionStorage)

const displayContractedHours = (doctor: DoctorTargets, wtrMaxHoursPerWeek: number): number => {
  return Math.round(wtrMaxHoursPerWeek * (doctor.wte / 100) * 10) / 10;
};

export default function PreRotaTargetsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // ✅ Section 5 complete — use RotaContext as single source of truth
  const { currentRotaConfigId: rotaConfigId } = useRotaContext();

  const [loading, setLoading] = useState(true);
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deptName, setDeptName] = useState('');
  const [hospitalName, setHospitalName] = useState('');

  // Full-time baseline targets
  const { config: fullConfig } = useRotaConfig();

  const targetsResult = useMemo<ComputeShiftTargetsResult | null>(() => {
    if (!fullConfig?.wtr || !fullConfig.shifts.length) return null;
    const hasTargets = fullConfig.shifts.some((s) => s.targetPercentage != null && s.targetPercentage > 0);
    if (!hasTargets) return null;
    return computeShiftTargets({
      maxHoursPerWeek: fullConfig.wtr.maxHoursPerWeek,
      maxHoursPer168h: fullConfig.wtr.maxHoursPer168h,
      rotaWeeks: fullConfig.rotaPeriod.durationWeeks ?? 0,
      globalOncallPct: fullConfig.distribution.globalOncallPct,
      globalNonOncallPct: fullConfig.distribution.globalNonOncallPct,
      shiftTypes: fullConfig.shifts.map((s) => ({
        id: s.id, name: s.name, shiftKey: s.shiftKey, isOncall: s.isOncall,
        targetPercentage: s.targetPercentage ?? 0, durationHours: s.durationHours,
      })),
      wtePercent: 100,
    });
  }, [fullConfig]);

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
        if (pr.status === 'blocked') { setErrorMsg('Pre-rota is blocked due to critical issues. Resolve them on the dashboard before viewing targets.'); setLoading(false); return; }

        setTargetsData(pr.targets_data as TargetsData);
        setCalendarData(pr.calendar_data as CalendarData);

        // Account settings
        const { data: config } = await supabase.from('rota_configs').select('owned_by, rota_start_date, rota_end_date').eq('id', rotaConfigId).single();
        if (config) {
          // ✅ Section 1 complete — .maybeSingle() prevents crash when no account_settings exist
          const { data: acct } = await supabase.from('account_settings').select('department_name, trust_name').eq('owned_by', (config as any).owned_by).maybeSingle();
          setDeptName((acct as any)?.department_name ?? 'Department');
          setHospitalName((acct as any)?.trust_name ?? 'Trust');
        }
      } catch (err) {
        console.error('Failed to load targets data:', err);
        setLoadError('Failed to load data. Please go back and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rotaConfigId]);

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

  if (loading) {
    return (
      <AdminLayout title="Shift Hour Targets" accentColor="blue">
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading targets…</span>
        </div>
      </AdminLayout>
    );
  }

  if (loadError || errorMsg || !targetsData) {
    return (
      <AdminLayout title="Shift Hour Targets" accentColor="blue">
        <div className="mx-auto max-w-lg mt-12">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-foreground">{loadError ?? errorMsg ?? 'No targets data available.'}</p>
            <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { doctors, shiftTypes, wtrMaxHoursPerWeek, hardWeeklyCap } = targetsData;

  return (
    <AdminLayout title="Shift Hour Targets" subtitle={`${deptName}${deptName && hospitalName ? ' · ' : ''}${hospitalName}`} accentColor="blue">
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download .xlsx
          </Button>
        </div>

        {/* Per-doctor targets table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="sticky left-0 bg-card z-10 py-2 px-2 font-medium text-muted-foreground border-r border-border min-w-[140px]">Doctor</th>
                <th className="py-2 px-2 font-medium text-muted-foreground">Grade</th>
                <th className="py-2 px-2 font-medium text-muted-foreground">WTE</th>
                <th className="py-2 px-2 font-medium text-muted-foreground text-center">
                  <div>Hrs/wk</div><div className="font-normal text-[9px]">contracted</div>
                </th>
                {!isMobile && (
                  <th className="py-2 px-2 font-medium text-muted-foreground text-center">
                    <div>Hard cap</div><div className="font-normal text-[9px]">per 168h</div>
                  </th>
                )}
                {shiftTypes.map(st => (
                  <th key={st.id} className="py-2 px-2 font-medium text-muted-foreground text-center min-w-[80px]">
                    <div>{st.name}</div>
                    <div className="font-normal text-[9px]">{st.isOncall ? 'on-call' : 'non-oncall'}</div>
                  </th>
                ))}
                <th className="py-2 px-2 font-medium text-muted-foreground text-center">
                  <div>Weekends</div><div className="font-normal text-[9px]">max</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor, idx) => {
                const isLTFT = doctor.wte < 100;
                return (
                  <tr key={doctor.doctorId} className={`border-b border-border/50 ${isLTFT ? 'bg-amber-50/30 border-l-2 border-l-amber-400' : idx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="sticky left-0 bg-white z-10 py-2 px-2 border-r border-border min-w-[140px]">
                      <div className="font-medium text-foreground whitespace-nowrap">{doctor.doctorName}</div>
                      <div className="text-[10px] text-muted-foreground sm:hidden">{doctor.grade}</div>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{doctor.grade}</td>
                    <td className="py-2 px-2 text-muted-foreground">{doctor.wte}%</td>
                    <td className="py-2 px-2 text-center font-mono">{displayContractedHours(doctor, wtrMaxHoursPerWeek)}h</td>
                    {!isMobile && (
                      <td className="py-2 px-2 text-center font-mono">{doctor.hardWeeklyCap}h</td>
                    )}
                    {shiftTypes.map(st => {
                      const target = doctor.shiftTargets.find(t => t.shiftTypeId === st.id);
                      return (
                        <td key={st.id} className="py-2 px-2 text-center">
                          <div className="font-mono">{target?.maxTargetHours ?? 0}h</div>
                          <div className="text-[9px] text-muted-foreground">~{target?.estimatedShiftCount ?? 0} shifts</div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center font-mono">{doctor.weekendCap}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Divider */}
        {targetsResult && <hr className="border-border my-6" />}

        {/* Shift Hour Targets (Full-Time Baseline) — moved from dashboard */}
        {targetsResult && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Shift Hour Targets (Full-Time Baseline)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Shift name</th>
                    <th className="pb-2 font-medium">On-call?</th>
                    <th className="pb-2 font-medium text-right">Max target hours</th>
                    <th className="pb-2 font-medium text-right">Est. shifts</th>
                    <th className="pb-2 font-medium text-right">Avg duration</th>
                  </tr>
                </thead>
                <tbody>
                  {targetsResult.targets.map((t) => (
                    <tr key={t.shiftId} className="border-b border-border/50">
                      <td className="py-2 font-medium text-card-foreground">{t.shiftName}</td>
                      <td className="py-2 text-muted-foreground">{fullConfig?.shifts.find((s) => s.id === t.shiftId)?.isOncall ? "Yes" : "No"}</td>
                      <td className="py-2 text-right font-mono">{t.maxTargetHours}h</td>
                      <td className="py-2 text-right font-mono">~{t.estimatedShiftCount}</td>
                      <td className="py-2 text-right font-mono">{fullConfig?.shifts.find((s) => s.id === t.shiftId)?.durationHours ?? 0}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs font-semibold text-card-foreground mt-3">
              Total: {targetsResult.totalMaxTargetHours}h over {targetsResult.targets[0]?.rotaWeeks ?? 0} weeks
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              LTFT doctors receive pro-rata targets. WTE scaling applied per doctor at generation time.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Hard per-week cap: {targetsResult.hardWeeklyCap}h — checked during generation, not included in targets.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
// ✅ Section 4 complete
// ✅ Section 5 complete (responsive design applied)