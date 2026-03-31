import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import type { PreRotaResult, PreRotaStatus } from "@/lib/preRotaTypes";

// ─── Account Settings ───
export function useAccountSettingsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account_settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("account_settings")
        .select("department_name, trust_name")
        .eq("owned_by", user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user?.id,
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

      const [{ data: liveDoctors }, { data: latestSurveys }] = await Promise.all([
        supabase
          .from("doctors")
          .select("id, first_name, last_name, grade, updated_at")
          .eq("rota_config_id", currentRotaConfigId),
        supabase
          .from("doctor_survey_responses")
          .select("updated_at")
          .eq("rota_config_id", currentRotaConfigId)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      const generatedAt = new Date(pr.generated_at);

      let latestDoctorUpdate: Date | null = null;
      if (liveDoctors && liveDoctors.length > 0) {
        const maxTime = Math.max(...liveDoctors.map(d => new Date(d.updated_at!).getTime()));
        latestDoctorUpdate = new Date(maxTime);
      }
      const latestSurveyUpdate = latestSurveys?.[0]?.updated_at ? new Date(latestSurveys[0].updated_at) : null;
      result.isStale = !!(
        (latestDoctorUpdate && latestDoctorUpdate > generatedAt) ||
        (latestSurveyUpdate && latestSurveyUpdate > generatedAt)
      );

      // Read-time hydration: patch snapshot doctor names/grades with live data
      if (liveDoctors) {
        const liveDocMap = new Map(liveDoctors.map(d => [d.id, d]));
        const hydrateDoctor = (doc: any) => {
          const docId = doc.id || doc.doctorId;
          const liveDoc = liveDocMap.get(docId);
          if (liveDoc) {
            return {
              ...doc,
              doctorName: `Dr ${liveDoc.first_name} ${liveDoc.last_name}`.trim(),
              grade: liveDoc.grade ?? doc.grade,
            };
          }
          return doc;
        };
        if (result.calendarData?.doctors) {
          (result.calendarData as any).doctors = (result.calendarData as any).doctors.map(hydrateDoctor);
        }
        if (result.targetsData?.doctors) {
          (result.targetsData as any).doctors = (result.targetsData as any).doctors.map(hydrateDoctor);
        }
      }

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
        .select("survey_deadline, bh_same_as_weekend, bh_shift_rules")
        .eq("id", currentRotaConfigId)
        .single();
      return data ?? null;
    },
    enabled: !!currentRotaConfigId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Calendar: Shift Types ───
export function useCalendarShiftTypesQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["calendar_shift_types", currentRotaConfigId],
    queryFn: async () => {
      if (!currentRotaConfigId) return [];
      const { data } = await supabase
        .from("shift_types")
        .select("id, name, min_doctors, badge_night, badge_oncall")
        .eq("rota_config_id", currentRotaConfigId);
      return data ?? [];
    },
    enabled: !!currentRotaConfigId,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Calendar: Bank Holidays ───
export function useCalendarBankHolidaysQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["calendar_bank_holidays", currentRotaConfigId],
    queryFn: async () => {
      if (!currentRotaConfigId) return [];
      const { data } = await supabase
        .from("bank_holidays")
        .select("date, is_active")
        .eq("rota_config_id", currentRotaConfigId);
      return data ?? [];
    },
    enabled: !!currentRotaConfigId,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Calendar: Survey LTFT fields ───
export function useCalendarSurveysQuery() {
  const { currentRotaConfigId } = useRotaContext();
  return useQuery({
    queryKey: ["calendar_surveys", currentRotaConfigId],
    queryFn: async () => {
      if (!currentRotaConfigId) return [];
      const { data } = await supabase
        .from("doctor_survey_responses")
        .select("doctor_id, ltft_days_off, ltft_night_flexibility")
        .eq("rota_config_id", currentRotaConfigId);
      return data ?? [];
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
    invalidateCalendarAuxData: () => {
      qc.invalidateQueries({ queryKey: ["calendar_shift_types"] });
      qc.invalidateQueries({ queryKey: ["calendar_bank_holidays"] });
      qc.invalidateQueries({ queryKey: ["calendar_surveys"] });
    },
  };
}
