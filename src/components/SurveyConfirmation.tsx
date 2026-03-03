import { Stethoscope } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { SurveyDoctorInfo, SurveyRotaInfo } from "@/contexts/SurveyContext";

// SECTION 6 — Post-submission confirmation screen

interface SurveyConfirmationProps {
  doctor: SurveyDoctorInfo;
  rotaInfo: SurveyRotaInfo | null;
  submittedAt: string | null;
}

export function SurveyConfirmation({ doctor, rotaInfo, submittedAt }: SurveyConfirmationProps) {
  const formatDate = (d: string | null) => {
    if (!d) return "TBC";
    try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/10 mb-6">
        <Stethoscope className="h-10 w-10 text-teal-500" />
      </div>

      <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Survey submitted successfully</h1>
      <p className="text-slate-600 mb-8">
        Thank you, {doctor.firstName} {doctor.lastName}. Your preferences have been saved to RotaEngine.
      </p>

      <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-sm p-5 text-left space-y-3 mb-8">
        {submittedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Submitted</span>
            <span className="font-medium text-slate-900">{format(parseISO(submittedAt), "d MMM yyyy, HH:mm")}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Rota period</span>
          <span className="font-medium text-slate-900">
            {formatDate(rotaInfo?.startDate ?? null)} – {formatDate(rotaInfo?.endDate ?? null)}
          </span>
        </div>
        {(rotaInfo?.departmentName || rotaInfo?.trustName) && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Department</span>
            <span className="font-medium text-slate-900">
              {[rotaInfo?.departmentName, rotaInfo?.trustName].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
        {rotaInfo?.surveyDeadline && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Deadline was</span>
            <span className="font-medium text-slate-900">{formatDate(rotaInfo.surveyDeadline)}</span>
          </div>
        )}
      </div>

      <div className="text-sm text-slate-500 leading-relaxed max-w-sm space-y-3">
        <p>The rota coordinator will use your responses to generate a fair, WTR-compliant rota. You will receive the draft rota for review once it has been generated.</p>
        <p>If you need to make changes, contact your rota coordinator directly — they can edit your responses from the admin panel.</p>
      </div>
    </div>
  );
}

// SECTION 6 COMPLETE
