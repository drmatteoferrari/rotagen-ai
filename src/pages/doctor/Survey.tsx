import { useSearchParams } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { SurveyProvider, useSurveyContext } from "@/contexts/SurveyContext";
import { SurveyConfirmation } from "@/components/SurveyConfirmation";
import { Loader2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import SurveyStep1 from "./SurveyStep1";
import SurveyStep2 from "./SurveyStep2";
import SurveyStep3 from "./SurveyStep3";
import SurveyStep4 from "./SurveyStep4";
import SurveyStep5 from "./SurveyStep5";
import SurveyStep6 from "./SurveyStep6";

// SECTION 3 — Survey wrapper page with token resolution

const stepComponents: Record<number, React.ComponentType> = {
  1: SurveyStep1,
  2: SurveyStep2,
  3: SurveyStep3,
  4: SurveyStep4,
  5: SurveyStep5,
  6: SurveyStep6,
};

function SurveyInner() {
  const { loadState, errorMessage, doctor, rotaInfo, currentStep, draftSavedAt, submittedAt } = useSurveyContext();

  if (loadState === "loading") {
    return (
      <DoctorLayout>
        <div className="flex flex-col items-center justify-center min-h-full gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <p className="text-slate-500 text-sm">Loading your survey…</p>
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
          <h1 className="text-xl font-bold text-slate-900">Survey Unavailable</h1>
          <p className="text-slate-600 text-sm max-w-sm leading-relaxed">{errorMessage}</p>
        </div>
      </DoctorLayout>
    );
  }

  if (loadState === "submitted" && doctor) {
    return (
      <DoctorLayout>
        <SurveyConfirmation doctor={doctor} rotaInfo={rotaInfo} submittedAt={submittedAt} />
      </DoctorLayout>
    );
  }

  const StepComponent = stepComponents[currentStep] || SurveyStep1;

  const formatDate = (d: string | null) => {
    if (!d) return "TBC";
    try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
  };

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        {/* Rota period banner */}
        {rotaInfo && (
          <div className="bg-teal-500/10 border-b border-teal-500/20 px-4 py-2 text-xs text-teal-700 font-medium flex flex-wrap gap-x-4 gap-y-1">
            <span>Rota: {formatDate(rotaInfo.startDate)} – {formatDate(rotaInfo.endDate)}{rotaInfo.durationWeeks ? ` (${rotaInfo.durationWeeks} weeks)` : ""}</span>
            {rotaInfo.surveyDeadline && <span>Deadline: {formatDate(rotaInfo.surveyDeadline)}</span>}
          </div>
        )}

        {/* Draft saved indicator */}
        {draftSavedAt && (
          <div className="bg-slate-100 text-slate-500 text-xs text-center py-1 transition-opacity">
            Draft saved
          </div>
        )}

        <div className="flex-1">
          <StepComponent />
        </div>
      </div>
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

// SECTION 3 COMPLETE
