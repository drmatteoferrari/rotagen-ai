import { useParams } from "react-router-dom";
import { SurveyModeProvider } from "@/contexts/SurveyModeContext";
import SurveyStep1 from "@/pages/doctor/SurveyStep1";
import SurveyStep2 from "@/pages/doctor/SurveyStep2";
import SurveyStep3 from "@/pages/doctor/SurveyStep3";
import SurveyStep4 from "@/pages/doctor/SurveyStep4";
import SurveyStep5 from "@/pages/doctor/SurveyStep5";
import SurveyStep6 from "@/pages/doctor/SurveyStep6";

const stepComponents: Record<string, React.ComponentType> = {
  "1": SurveyStep1,
  "2": SurveyStep2,
  "3": SurveyStep3,
  "4": SurveyStep4,
  "5": SurveyStep5,
  "6": SurveyStep6,
};

// Static lookup for demo - in production this would come from a database
const doctorLookup: Record<string, { name: string; email: string }> = {
  "1": { name: "Dr. Sarah Chen", email: "s.chen@nhs.net" },
  "2": { name: "Dr. James Okafor", email: "j.okafor@nhs.net" },
  "3": { name: "Dr. Emily Wright", email: "e.wright@nhs.net" },
};

export default function SurveyOverride() {
  const { doctorId, step } = useParams();
  const StepComponent = stepComponents[step || "1"];
  const doctor = doctorLookup[doctorId || ""] || { name: "Unknown Doctor", email: "" };

  if (!StepComponent) return <div>Invalid step</div>;

  return (
    <SurveyModeProvider
      isAdminMode={true}
      doctorId={doctorId}
      doctorName={doctor.name}
      doctorEmail={doctor.email}
    >
      <StepComponent />
    </SurveyModeProvider>
  );
}
