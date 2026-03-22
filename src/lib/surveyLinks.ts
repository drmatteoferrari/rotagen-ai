import { supabase } from "@/integrations/supabase/client";

// SECTION 6 COMPLETE
export function buildSurveyLink(surveyToken: string): string {
  const envUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (!envUrl) {
    console.warn("WARNING: VITE_APP_URL is not set. Survey links will use window.location.origin. Set VITE_APP_URL in your .env before sending real invites.");
  }
  // Prefer VITE_APP_URL, then fall back to the published domain, then window.location.origin
  const base = envUrl || "https://rotagen-ai.lovable.app";
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
