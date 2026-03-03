import { supabase } from "@/integrations/supabase/client";

// SECTION 2 — Survey link utilities

export function buildSurveyLink(surveyToken: string): string {
  const base = (import.meta.env.VITE_APP_URL as string | undefined) ?? window.location.origin;
  return `${base}/doctor/survey?token=${surveyToken}`;
}

export async function getSurveyLinkForDoctor(doctorId: string): Promise<string> {
  const { data, error } = await supabase
    .from("doctors")
    .select("survey_token")
    .eq("id", doctorId)
    .single();

  if (error || !data?.survey_token) {
    throw new Error("Could not find survey token for doctor");
  }

  return buildSurveyLink(data.survey_token);
}

// SECTION 2 COMPLETE
