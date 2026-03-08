import { useSearchParams, Link } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { SurveyProvider, useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyConfirmation } from "@/components/SurveyConfirmation";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { Loader2, AlertTriangle, ShieldCheck, ArrowLeft } from "lucide-react";
import SurveyStep1 from "./SurveyStep1";
import SurveyStep2 from "./SurveyStep2";
import SurveyStep3 from "./SurveyStep3";
import SurveyStep4 from "./SurveyStep4";
import SurveyStep5 from "./SurveyStep5";
import SurveyStep6 from "./SurveyStep6";
import SurveyStep7 from "./SurveyStep7";

const stepComponents: Record<number, React.ComponentType> = {
  1: SurveyStep1,
  2: SurveyStep2,
  3: SurveyStep3,
  4: SurveyStep4,
  5: SurveyStep5,
  6: SurveyStep6,
  7: SurveyStep7,
};

function SurveyInner() {
  const ctx = useSurveyContext();

  if (!ctx) return null;
  const { loadState, errorMessage, doctor, rotaInfo, currentStep, submittedAt, isAdminMode } = ctx;

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

  if (loadState === "submitted" && doctor && !isAdminMode) {
    return (
      <DoctorLayout>
        <SurveyConfirmation />
      </DoctorLayout>
    );
  }

  const StepComponent = stepComponents[currentStep] || SurveyStep1;

  return (
    <DoctorLayout>
      {isAdminMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="font-semibold">Admin Edit Mode</span>
          <span className="text-amber-600">— Editing {doctor?.firstName} {doctor?.lastName}'s survey</span>
          <Link to="/admin/roster" className="ml-auto flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Back to Roster
          </Link>
        </div>
      )}
      <SurveyShell>
        <StepComponent />
      </SurveyShell>
    </DoctorLayout>
  );
}

export default function Survey() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const adminMode = searchParams.get("admin") === "true";

  return (
    <SurveyProvider token={token} adminMode={adminMode}>
      <SurveyInner />
    </SurveyProvider>
  );
}
