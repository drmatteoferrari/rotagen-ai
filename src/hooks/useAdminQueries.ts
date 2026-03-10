import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import type { PreRotaResult, PreRotaStatus } from "@/lib/preRotaTypes";

// ─── Account Settings ───
export function useAccountSettingsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account_settings", user?.username],
    queryFn: async () => {
      if (!user?.username) return null;
      const { data } = await supabase
        .from("account_settings")
        .select("department_name, trust_name")
        .eq("owned_by", user.username)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user?.username,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Doctors List (active only) ───
export function useDoctorsQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["doctors", currentRotaConfigId],
    queryFn: async () => {
      if (!currentRotaConfigId) return [];
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("rota_config_id", currentRotaConfigId)
        .eq("is_active", true)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentRotaConfigId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Inactive Doctors List ───
export function useInactiveDoctorsQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["doctors_inactive", currentRotaConfigId],
    queryFn: async () => {
      if (!currentRotaConfigId) return [];
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("rota_config_id", currentRotaConfigId)
        .eq("is_active", false)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentRotaConfigId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Pre-Rota Result ───
export function usePreRotaResultQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["pre_rota_result", currentRotaConfigId],
    queryFn: async (): Promise<PreRotaResult | null> => {
      if (!currentRotaConfigId) return null;
      const { data: pr } = await supabase
        .from("pre_rota_results")
        .select("*")
        .eq("rota_config_id", currentRotaConfigId)
        .maybeSingle();
      if (!pr) return null;

      const result: PreRotaResult = {
        id: pr.id,
        rotaConfigId: pr.rota_config_id,
        generatedAt: pr.generated_at,
        generatedBy: pr.generated_by,
        status: pr.status as PreRotaStatus,
        validationIssues: (pr.validation_issues as any) ?? [],
        calendarData: (pr.calendar_data as any) ?? {},
        targetsData: (pr.targets_data as any) ?? {},
        isStale: false,
      };

      const [{ data: latestDoctors }, { data: latestSurveys }] = await Promise.all([
        supabase
          .from("doctors")
          .select("updated_at")
          .eq("rota_config_id", currentRotaConfigId)
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase
          .from("doctor_survey_responses")
          .select("updated_at")
          .eq("rota_config_id", currentRotaConfigId)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      const generatedAt = new Date(pr.generated_at);
      const latestDoctorUpdate = latestDoctors?.[0]?.updated_at ? new Date(latestDoctors[0].updated_at) : null;
      const latestSurveyUpdate = latestSurveys?.[0]?.updated_at ? new Date(latestSurveys[0].updated_at) : null;
      result.isStale = !!(
        (latestDoctorUpdate && latestDoctorUpdate > generatedAt) ||
        (latestSurveyUpdate && latestSurveyUpdate > generatedAt)
      );

      return result;
    },
    enabled: !!currentRotaConfigId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Survey Deadline + BH rules from rota_configs ───
export function useRotaConfigDetailsQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["rota_config_details", currentRotaConfigId],
    queryFn: async () => {
      if (!currentRotaConfigId) return null;
      const { data } = await supabase
        .from("rota_configs")
        .select("survey_deadline, bh_same_as_weekend, bh_custom_rules")
        .eq("id", currentRotaConfigId)
        .single();
      return data ?? null;
    },
    enabled: !!currentRotaConfigId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Invalidation helpers ───
export function useInvalidateQuery() {
  const qc = useQueryClient();
  return {
    invalidateDoctors: () => qc.invalidateQueries({ queryKey: ["doctors"] }),
    invalidateInactiveDoctors: () => qc.invalidateQueries({ queryKey: ["doctors_inactive"] }),
    invalidatePreRota: () => qc.invalidateQueries({ queryKey: ["pre_rota_result"] }),
    invalidateAccountSettings: () => qc.invalidateQueries({ queryKey: ["account_settings"] }),
    invalidateRotaConfigDetails: () => qc.invalidateQueries({ queryKey: ["rota_config_details"] }),
  };
}
