import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";

async function fetchSurveyCounts(rotaConfigId: string) {
  const { data, error } = await supabase
    .from("doctors")
    .select("survey_status")
    .eq("rota_config_id", rotaConfigId);

  if (error) throw error;

  return {
    total: data?.length ?? 0,
    submitted: data?.filter((d) => d.survey_status === "submitted").length ?? 0,
  };
}

export function useSurveyCounts() {
  const { currentRotaConfigId } = useRotaContext();

  const query = useQuery({
    queryKey: ["surveyCounts", currentRotaConfigId],
    queryFn: () => fetchSurveyCounts(currentRotaConfigId!),
    enabled: !!currentRotaConfigId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    surveyTotal: query.data?.total ?? 0,
    surveySubmitted: query.data?.submitted ?? 0,
    isLoading: query.isLoading,
  };
}
