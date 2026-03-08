// SECTION 2 COMPLETE
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SurveyProvider, useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyModeProvider } from "@/contexts/SurveyModeContext";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { DoctorLayout } from "@/components/DoctorLayout";
import { Loader2, ShieldAlert } from "lucide-react";
import SurveyStep1 from "@/pages/doctor/SurveyStep1";
import SurveyStep2 from "@/pages/doctor/SurveyStep2";
import SurveyStep3 from "@/pages/doctor/SurveyStep3";
import SurveyStep4 from "@/pages/doctor/SurveyStep4";
import SurveyStep5 from "@/pages/doctor/SurveyStep5";
import SurveyStep6 from "@/pages/doctor/SurveyStep6";

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

interface DoctorRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  survey_token: string | null;
}

export default function SurveyOverride() {
  const { doctorId } = useParams();
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadDoctor() {
      if (!doctorId) { setError(true); setLoading(false); return; }
      const { data, error: err } = await supabase
        .from("doctors")
        .select("id, first_name, last_name, email, survey_token")
        .eq("id", doctorId)
        .maybeSingle();
      if (err || !data) {
        setError(true);
      } else {
        setDoctor(data);
      }
      setLoading(false);
    }
    loadDoctor();
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

  if (error || !doctor || !doctor.survey_token) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center min-h-full text-slate-500">
          Doctor not found. Please return to the Roster.
        </div>
      </DoctorLayout>
    );
  }

  return (
    <SurveyModeProvider
      isAdminMode
      doctorId={doctor.id}
      doctorName={`${doctor.first_name} ${doctor.last_name}`}
      doctorEmail={doctor.email ?? undefined}
    >
      <SurveyProvider token={doctor.survey_token} adminMode>
        <OverrideInner />
      </SurveyProvider>
    </SurveyModeProvider>
  );
}
