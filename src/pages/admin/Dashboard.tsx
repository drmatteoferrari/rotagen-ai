import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarWeeks, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, CheckCircle2, XCircle, ChevronRight, Building2, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDepartmentComplete, isWtrComplete, isPeriodComplete, restoredFromDb, rotaStartDate, rotaEndDate } = useAdminSetup();
  const { restoredConfig, currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();

  const [surveySubmitted, setSurveySubmitted] = useState(0);
  const [surveyTotal, setSurveyTotal] = useState(0);
  const [archivedConfigs, setArchivedConfigs] = useState<{id: string; rota_start_date: string | null; rota_end_date: string | null; created_at: string}[]>([]);
  const hasFinalRota = false;

  useEffect(() => {
    if (!currentRotaConfigId) return;
    supabase
      .from("doctors")
      .select("id, survey_status")
      .eq("rota_config_id", currentRotaConfigId)
      .eq("is_active", true)
      .then(({ data }) => {
        const docs = data ?? [];
        setSurveyTotal(docs.length);
        setSurveySubmitted(docs.filter(d => d.survey_status === "submitted").length);
      });
  }, [currentRotaConfigId]);

  useEffect(() => {
    if (!user?.username) return;
    supabase
      .from("rota_configs")
      .select("id, rota_start_date, rota_end_date, created_at")
      .eq("owned_by", user.username)
      .eq("is_archived", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setArchivedConfigs(data ?? []));
  }, [user?.username]);

  if (!restoredFromDb) {
    return (
      <AdminLayout title="Dashboard" subtitle="Overview of your rota" accentColor="blue">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  const start = rotaStartDate ?? (restoredConfig?.rotaPeriod?.startDate ? new Date(restoredConfig.rotaPeriod.startDate) : null);
  const end = rotaEndDate ?? (restoredConfig?.rotaPeriod?.endDate ? new Date(restoredConfig.rotaPeriod.endDate) : null);
  const weeks = start && end ? Math.ceil(differenceInCalendarWeeks(end, start)) : null;

  const deptAndRulesDone = isDepartmentComplete && isWtrComplete;
  const surveysDone = surveySubmitted === surveyTotal && surveyTotal > 0;

  const progressRows = [
    {
      label: "Department & Rules",
      done: deptAndRulesDone,
      icon: Building2,
      link: "/admin/department/step-1",
    },
    {
      label: "Rota Period",
      done: isPeriodComplete,
      icon: CalendarDays,
      link: "/admin/rota-period/step-1",
    },
    {
      label: `Doctor Surveys — ${surveySubmitted} / ${surveyTotal} submitted`,
      done: surveysDone,
      icon: Users,
      link: "/admin/roster",
    },
  ];

  const stepsComplete = [deptAndRulesDone, isPeriodComplete, surveysDone].filter(Boolean).length;

  return (
    <AdminLayout title="Dashboard" subtitle="Overview of your rota" accentColor="blue">
      <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">

        {/* Rota period badge */}
        {isPeriodComplete && start && end && (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium">
            <CalendarDays className="h-4 w-4" />
            {format(start, 'dd MMM yyyy')} – {format(end, 'dd MMM yyyy')} ({weeks} weeks)
          </div>
        )}

        {/* Progress summary card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="space-y-1">
            {progressRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(row.link)}
              >
                {row.done
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                }
                <row.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{row.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{stepsComplete} of 3 steps complete</span>
            </div>
            <Progress value={(stepsComplete / 3) * 100} className="h-2" />
          </div>
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
  );
}
