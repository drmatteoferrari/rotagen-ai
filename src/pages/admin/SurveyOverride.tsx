import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SurveyProvider, useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { DoctorLayout } from "@/components/DoctorLayout";
import { Loader2, ShieldAlert } from "lucide-react";
import SurveyStep1 from "@/pages/doctor/SurveyStep1";
import SurveyStep2 from "@/pages/doctor/SurveyStep2";
import SurveyStep3 from "@/pages/doctor/SurveyStep3";
import SurveyStep4 from "@/pages/doctor/SurveyStep4";
import SurveyStep5 from "@/pages/doctor/SurveyStep5";
import SurveyStep6 from "@/pages/doctor/SurveyStep6";

// ✅ Section 13 complete

const stepComponents: Record<number, React.ComponentType> = {
  1: SurveyStep1,
  2: SurveyStep2,
  3: SurveyStep3,
  4: SurveyStep4,
  5: SurveyStep5,
  6: SurveyStep6,
};

function OverrideInner() {
  const ctx = useSurveyContext();
  const { step } = useParams();

  useEffect(() => {
    if (ctx && step) {
      ctx.setStep(Number(step));
    }
  }, [step]);

  if (!ctx) return null;
  const { loadState, currentStep } = ctx;

  if (loadState === "loading") {
    return (
      <DoctorLayout>
        <div className="flex flex-col items-center justify-center min-h-full gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-slate-500 text-sm">Loading doctor data…</p>
        </div>
      </DoctorLayout>
    );
  }

  const StepComponent = stepComponents[currentStep] || SurveyStep1;

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
        </div>
        <SurveyShell>
          <StepComponent />
        </SurveyShell>
      </div>
    </DoctorLayout>
  );
}

export default function SurveyOverride() {
  const { doctorId } = useParams();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadToken() {
      if (!doctorId) return;
      const { data } = await supabase
        .from("doctors")
        .select("survey_token")
        .eq("id", doctorId)
        .maybeSingle();
      if (data?.survey_token) {
        setToken(data.survey_token);
      }
      setLoading(false);
    }
    loadToken();
  }, [doctorId]);

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center min-h-full">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      </DoctorLayout>
    );
  }

  if (!token) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center min-h-full text-slate-500">Doctor not found</div>
      </DoctorLayout>
    );
  }

  return (
    <SurveyProvider token={token}>
      <OverrideInner />
    </SurveyProvider>
  );
}
