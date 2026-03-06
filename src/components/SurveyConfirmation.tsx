import { Stethoscope, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { supabase } from "@/integrations/supabase/client";

// ✅ Section 12 complete

export function SurveyConfirmation() {
  const ctx = useSurveyContext();
  if (!ctx) return null;
  const { doctor, rotaInfo, submittedAt, formData, setSubmittedAt, setLoadState, setStep } = ctx;

  if (!doctor) return null;

  const formatDate = (d: string | null) => {
    if (!d) return "TBC";
    try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
  };

  const now = new Date();
  const deadlineDate = rotaInfo?.surveyDeadline ? new Date(rotaInfo.surveyDeadline) : null;
  const canEdit = deadlineDate ? now <= deadlineDate : false;

  const handleEdit = async () => {
    // Set status back to in_progress
    try {
      await supabase
        .from("doctor_survey_responses")
        .update({ status: "in_progress", submitted_at: null })
        .eq("doctor_id", doctor.id)
        .eq("rota_config_id", doctor.rotaConfigId);
      await supabase
        .from("doctors")
        .update({ survey_status: "in_progress", survey_submitted_at: null })
        .eq("id", doctor.id);
    } catch (err) {
      console.error("Failed to reopen survey:", err);
    }
    setSubmittedAt(null);
    setLoadState("ready");
    setStep(1);
  };

  const wteLabel = formData.wtePercent === 100
    ? "Full-time (100%)"
    : `${formData.wtePercent === 0 ? formData.wteOtherValue : formData.wtePercent}% LTFT`;

  return (
    <div className="flex flex-col items-center justify-start min-h-full px-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-6">
        <Stethoscope className="h-10 w-10 text-emerald-600" />
      </div>

      <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Survey submitted successfully</h1>
      <p className="text-slate-600 mb-6">
        Thank you, {doctor.firstName}. Your preferences have been saved to RotaEngine.
      </p>

      {/* Summary box */}
      <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-sm p-5 text-left space-y-3 mb-6">
        {submittedAt && (
          <Row label="Submitted" value={format(parseISO(submittedAt), "d MMM yyyy, HH:mm")} />
        )}
        <Row label="Rota period" value={`${formatDate(rotaInfo?.startDate ?? null)} – ${formatDate(rotaInfo?.endDate ?? null)}`} />
        {(rotaInfo?.departmentName || rotaInfo?.trustName) && (
          <Row label="Department" value={[rotaInfo?.departmentName, rotaInfo?.trustName].filter(Boolean).join(", ")} />
        )}
        {rotaInfo?.surveyDeadline && (
          <Row label="Deadline was" value={formatDate(rotaInfo.surveyDeadline)} />
        )}
      </div>

      {/* Full submitted data summary */}
      <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-sm p-5 text-left space-y-2 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Your Submissions</h3>
        <SmallRow label="Working pattern" value={wteLabel} />
        <SmallRow label="Annual leave" value={formData.annualLeave.length ? `${formData.annualLeave.length} period(s)` : "None"} />
        <SmallRow label="Study leave" value={formData.studyLeave.length ? `${formData.studyLeave.length} period(s)` : "None"} />
        <SmallRow label="Not on-call" value={formData.nocDates.length ? `${formData.nocDates.length} date(s)` : "None"} />
        <SmallRow label="Parental leave" value={formData.parentalLeaveExpected ? `${formData.parentalLeaveStart} to ${formData.parentalLeaveEnd}` : "None"} />
        <SmallRow label="Specialties" value={formData.specialtiesRequested.length ? formData.specialtiesRequested.map((s) => s.name).join(", ") : "None"} />
      </div>

      {/* Edit button */}
      {canEdit ? (
        <button
          onClick={handleEdit}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors mb-4"
        >
          <Pencil className="h-4 w-4" /> Edit my responses
        </button>
      ) : deadlineDate ? (
        <p className="text-sm text-slate-500 mb-4">The survey deadline has passed. Contact your coordinator to request changes.</p>
      ) : null}

      <div className="text-sm text-slate-500 leading-relaxed max-w-sm space-y-3">
        <p>The rota coordinator will use your responses to generate a fair, WTR-compliant rota.</p>
        <p>If you need to make changes after the deadline, contact your coordinator — they can edit your responses from the admin panel.</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SmallRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}
