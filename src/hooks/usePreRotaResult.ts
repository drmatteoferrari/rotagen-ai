import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import type { PreRotaResult } from "@/lib/preRotaTypes";

async function fetchPreRotaResult(rotaConfigId: string): Promise<{ result: PreRotaResult | null; isStale: boolean }> {
  const { data: pr } = await supabase
    .from("pre_rota_results")
    .select("*")
    .eq("rota_config_id", rotaConfigId)
    .maybeSingle();

  if (!pr) return { result: null, isStale: false };

  const result: PreRotaResult = {
    id: pr.id,
    rotaConfigId: pr.rota_config_id,
    generatedAt: pr.generated_at,
    generatedBy: pr.generated_by,
    status: pr.status as PreRotaResult["status"],
    validationIssues: (pr.validation_issues ?? []) as any,
    calendarData: (pr.calendar_data ?? {}) as any,
    targetsData: (pr.targets_data ?? {}) as any,
    isStale: false,
  };

  const generatedAt = new Date(pr.generated_at);

  const [{ data: latestDoctors }, { data: latestSurveys }] = await Promise.all([
    supabase
      .from("doctors")
      .select("updated_at")
      .eq("rota_config_id", rotaConfigId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("doctor_survey_responses")
      .select("updated_at")
      .eq("rota_config_id", rotaConfigId)
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  const latestDoctorUpdate = latestDoctors?.[0]?.updated_at ? new Date(latestDoctors[0].updated_at) : null;
  const latestSurveyUpdate = latestSurveys?.[0]?.updated_at ? new Date(latestSurveys[0].updated_at) : null;

  const isStale =
    !!(latestDoctorUpdate && latestDoctorUpdate > generatedAt) ||
    !!(latestSurveyUpdate && latestSurveyUpdate > generatedAt);

  result.isStale = isStale;
  return { result, isStale };
}

export function usePreRotaResult() {
  const { currentRotaConfigId } = useRotaContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["preRotaResult", currentRotaConfigId],
    queryFn: () => fetchPreRotaResult(currentRotaConfigId!),
    enabled: !!currentRotaConfigId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["preRotaResult", currentRotaConfigId] });
  };

  return {
    preRotaResult: query.data?.result ?? null,
    isStale: query.data?.isStale ?? false,
    isLoading: query.isLoading,
    invalidate,
  };
}
