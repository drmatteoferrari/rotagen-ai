import { useSearchParams } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { SurveyProvider, useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyConfirmation } from "@/components/SurveyConfirmation";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { Loader2, AlertTriangle } from "lucide-react";
import SurveyStep1 from "./SurveyStep1";
import SurveyStep2 from "./SurveyStep2";
import SurveyStep3 from "./SurveyStep3";
import SurveyStep4 from "./SurveyStep4";
import SurveyStep5 from "./SurveyStep5";
import SurveyStep6 from "./SurveyStep6";

const stepComponents: Record<number, React.ComponentType> = {
  1: SurveyStep1,
  2: SurveyStep2,
  3: SurveyStep3,
  4: SurveyStep4,
  5: SurveyStep5,
  6: SurveyStep6,
};

function SurveyInner() {
  const ctx = useSurveyContext();

  if (!ctx) return null;
  const { loadState, errorMessage, doctor, rotaInfo, currentStep, submittedAt } = ctx;

  if (loadState === "loading") {
    return (
      <DoctorLayout>
        <div className="flex flex-col items-center justify-center min-h-full gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-muted-foreground text-sm">Loading your survey…</p>
        </div>
      </DoctorLayout>
    );
  }

  if (loadState === "error") {
    return (
      <DoctorLayout>
        <div className="flex flex-col items-center justify-center min-h-full px-6 text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-card-foreground">Survey Unavailable</h1>
          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">{errorMessage}</p>
        </div>
      </DoctorLayout>
    );
  }

  if (loadState === "submitted" && doctor) {
    return (
      <DoctorLayout>
        <SurveyConfirmation />
      </DoctorLayout>
    );
  }

  const StepComponent = stepComponents[currentStep] || SurveyStep1;

  return (
    <DoctorLayout>
      <SurveyShell>
        <StepComponent />
      </SurveyShell>
    </DoctorLayout>
  );
}

export default function Survey() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <SurveyProvider token={token}>
      <SurveyInner />
    </SurveyProvider>
  );
}
