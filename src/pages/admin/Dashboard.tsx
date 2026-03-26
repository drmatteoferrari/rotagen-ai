import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarWeeks, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, ChevronRight, Building2, Users, Info, LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePreRotaResultQuery, useCalendarShiftTypesQuery, useCalendarBankHolidaysQuery, useCalendarSurveysQuery } from "@/hooks/useAdminQueries";
import PreRotaCalendarPage from "./PreRotaCalendarPage";
import OnboardingModal from "@/components/OnboardingModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, restoredFromDb, rotaStartDate, rotaEndDate } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();

  const [archivedConfigs, setArchivedConfigs] = useState<{id: string; rota_start_date: string | null; rota_end_date: string | null; created_at: string}[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: preRotaResult, isLoading: preRotaLoading } = usePreRotaResultQuery();
  const { isLoading: shiftTypesLoading } = useCalendarShiftTypesQuery();
  const { isLoading: bankHolidaysLoading } = useCalendarBankHolidaysQuery();
  const { isLoading: surveysLoading } = useCalendarSurveysQuery();
  const hasPreRota = !!preRotaResult && preRotaResult.status !== 'blocked';
  const calendarReady = hasPreRota && !shiftTypesLoading && !bankHolidaysLoading && !surveysLoading;

  // Check onboarding status once
  useEffect(() => {
    if (!user?.id || !restoredFromDb) return;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.onboarding_completed === false) {
          setShowOnboarding(true);
        }
      });
  }, [user?.id, restoredFromDb]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("rota_configs")
      .select("id, rota_start_date, rota_end_date, created_at")
      .eq("owned_by", user.id)
      .eq("is_archived", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setArchivedConfigs(data ?? []));
  }, [user?.id]);

  if (!restoredFromDb || preRotaLoading || (hasPreRota && (shiftTypesLoading || bankHolidaysLoading || surveysLoading))) {
    return (
      <>
        {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
        <AdminLayout title="Dashboard" subtitle="Your active rota" accentColor="blue" pageIcon={LayoutDashboard}>
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </AdminLayout>
      </>
    );
  }

  const start = rotaStartDate ?? (restoredConfig?.rotaPeriod?.startDate ? new Date(restoredConfig.rotaPeriod.startDate) : null);
  const end = rotaEndDate ?? (restoredConfig?.rotaPeriod?.endDate ? new Date(restoredConfig.rotaPeriod.endDate) : null);
  const weeks = start && end ? Math.ceil(differenceInCalendarWeeks(end, start)) : null;

  // If pre-rota is ready, show the embedded calendar
  if (hasPreRota) {
    return (
      <>
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
      <AdminLayout title="Dashboard" subtitle="Your active rota" accentColor="blue" pageIcon={LayoutDashboard}>
        <div className="mx-auto max-w-7xl space-y-4 animate-fadeSlideUp">
          {/* Pre-allocation note */}
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
            <Info className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              This is the <span className="font-semibold">pre-allocation rota</span> — the final rota has not yet been generated.
            </p>
          </div>

          {/* Rota period badge */}
          {isPeriodComplete && start && end && (
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium">
              <CalendarDays className="h-4 w-4" />
              {format(start, 'dd MMM yyyy')} – {format(end, 'dd MMM yyyy')} ({weeks} weeks)
            </div>
          )}

          {/* Embedded pre-rota calendar */}
          <PreRotaCalendarPage embedded />

          {/* Previous Rotas */}
          {archivedConfigs.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-3">Previous Rotas</h3>
              <div className="space-y-2">
                {archivedConfigs.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2 border border-border">
                    <span className="text-sm text-foreground">
                      {c.rota_start_date ? format(new Date(c.rota_start_date), 'dd MMM yyyy') : '—'}
                      {' – '}
                      {c.rota_end_date ? format(new Date(c.rota_end_date), 'dd MMM yyyy') : '—'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => toast.info('Archived rota viewing coming soon.')}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
      </>
    );
  }

  // No pre-rota yet — show simple status overview (no progress bar)
  return (
    <>
    {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    <AdminLayout title="Dashboard" subtitle="Your active rota" accentColor="blue" pageIcon={LayoutDashboard}>
      <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">

        {/* Rota period badge */}
        {isPeriodComplete && start && end && (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium">
            <CalendarDays className="h-4 w-4" />
            {format(start, 'dd MMM yyyy')} – {format(end, 'dd MMM yyyy')} ({weeks} weeks)
          </div>
        )}

        {/* Getting started card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center space-y-3">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No rota generated yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Complete the setup steps — department, rules, rota period, and doctor surveys — then generate the pre-allocation rota.
          </p>
          <Button size="sm" onClick={() => navigate('/admin/setup')}>
            Go to Setup
          </Button>
        </div>

        {/* Previous Rotas */}
        {archivedConfigs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-3">Previous Rotas</h3>
            <div className="space-y-2">
              {archivedConfigs.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2 border border-border">
                  <span className="text-sm text-foreground">
                    {c.rota_start_date ? format(new Date(c.rota_start_date), 'dd MMM yyyy') : '—'}
                    {' – '}
                    {c.rota_end_date ? format(new Date(c.rota_end_date), 'dd MMM yyyy') : '—'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => toast.info('Archived rota viewing coming soon.')}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
    </>
  );
}
