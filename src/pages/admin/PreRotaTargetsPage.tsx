import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePreRotaExcel } from "@/lib/preRotaExcel";
import type { CalendarData, TargetsData, DoctorTargets } from "@/lib/preRotaTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, AlertTriangle } from "lucide-react";
// ✅ Section 1 complete (imports)

const SESSION_KEY = 'rotaConfigId';

const displayContractedHours = (doctor: DoctorTargets, wtrMaxHoursPerWeek: number): number => {
  return Math.round(wtrMaxHoursPerWeek * (doctor.wte / 100) * 10) / 10;
};
// ✅ Section 4.2 complete (contracted hours fix)

export default function PreRotaTargetsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deptName, setDeptName] = useState('');
  const [hospitalName, setHospitalName] = useState('');

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
      if (pr.status === 'blocked') { setErrorMsg('Pre-rota is blocked due to critical issues. Resolve them on the dashboard before viewing targets.'); setLoading(false); return; }

      setTargetsData(pr.targets_data as TargetsData);
      setCalendarData(pr.calendar_data as CalendarData);

      // Account settings
      const { data: config } = await supabase.from('rota_configs').select('owned_by, rota_start_date, rota_end_date').eq('id', rotaConfigId).single();
      if (config) {
        const { data: acct } = await supabase.from('account_settings').select('department_name, trust_name').eq('owned_by', (config as any).owned_by).single();
        if (acct) {
          setDeptName((acct as any).department_name ?? '');
          setHospitalName((acct as any).trust_name ?? '');
        }
      }

      setLoading(false);
    };
    load();
  }, []);

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
      <AdminLayout title="Shift Hour Targets">
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading targets…</span>
        </div>
      </AdminLayout>
    );
  }

  if (errorMsg || !targetsData) {
    return (
      <AdminLayout title="Shift Hour Targets">
        <div className="mx-auto max-w-lg mt-12">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-foreground">{errorMsg ?? 'No targets data available.'}</p>
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
    <AdminLayout title="Shift Hour Targets" subtitle={`${deptName}${deptName && hospitalName ? ' · ' : ''}${hospitalName}`}>
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

        {/* Targets table */}
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
      </div>
    </AdminLayout>
  );
}
// ✅ Section 4 complete
// ✅ Section 5 complete (responsive design applied)
