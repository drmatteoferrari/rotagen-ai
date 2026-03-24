import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SurveyProvider, useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyModeProvider } from "@/contexts/SurveyModeContext";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { DoctorLayout } from "@/components/DoctorLayout";
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import SurveyStep1 from "@/pages/doctor/SurveyStep1";
import SurveyStep2 from "@/pages/doctor/SurveyStep2";
import SurveyStep3 from "@/pages/doctor/SurveyStep3";
import SurveyStep4 from "@/pages/doctor/SurveyStep4";
import SurveyStep5 from "@/pages/doctor/SurveyStep5";
import SurveyStep6 from "@/pages/doctor/SurveyStep6";
import SurveyStep7 from "@/pages/doctor/SurveyStep7";

const stepComponents: Record<number, React.ComponentType> = {
  1: SurveyStep1,
  2: SurveyStep2,
  3: SurveyStep3,
  4: SurveyStep4,
  5: SurveyStep5,
  6: SurveyStep6,
  7: SurveyStep7,
};

function OverrideInner({ fromPath, doctorName }: { fromPath: string; doctorName: string }) {
  const ctx = useSurveyContext();
  const navigate = useNavigate();
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
    <div className="fixed inset-0 z-50 bg-teal-50 flex flex-col overflow-hidden">
      <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
        <button
          onClick={() => navigate(fromPath)}
          className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors mr-1 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="h-4 w-px bg-amber-400/50 mx-1" />
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-700 truncate">
          Admin Override — {doctorName}
        </span>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SurveyShell>
          <StepComponent />
        </SurveyShell>
      </div>
    </div>
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
  const [searchParams] = useSearchParams();
  const fromPath = searchParams.get("from") || "/admin/roster";
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

  const doctorName = `${doctor.first_name} ${doctor.last_name}`;

  return (
    <SurveyModeProvider
      isAdminMode
      doctorId={doctor.id}
      doctorName={doctorName}
      doctorEmail={doctor.email ?? undefined}
    >
      <SurveyProvider token={doctor.survey_token} adminMode>
        <OverrideInner fromPath={fromPath} doctorName={doctorName} />
      </SurveyProvider>
    </SurveyModeProvider>
  );
}
