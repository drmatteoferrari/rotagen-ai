import { Stethoscope, Pencil, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

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
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 mb-6">
        <CheckCircle2 className="h-10 w-10 text-teal-600" />
      </div>

      <h1 className="text-2xl font-bold text-card-foreground mb-2">Survey submitted successfully</h1>
      <p className="text-muted-foreground mb-6">
        Thank you, {doctor.firstName}. Your preferences have been saved.
      </p>

      {/* Summary box */}
      <Card className="w-full max-w-sm mb-6">
        <CardContent className="p-5 space-y-3">
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
        </CardContent>
      </Card>

      {/* Full submitted data summary */}
      <Card className="w-full max-w-sm mb-6">
        <CardContent className="p-5 space-y-2">
          <h3 className="text-sm font-bold text-card-foreground mb-2">Your Submissions</h3>
          <SmallRow label="Working pattern" value={wteLabel} />
          <SmallRow label="Annual leave" value={formData.annualLeave.length ? `${formData.annualLeave.length} period(s)` : "None"} />
          <SmallRow label="Study leave" value={formData.studyLeave.length ? `${formData.studyLeave.length} period(s)` : "None"} />
          <SmallRow label="Not on-call" value={formData.nocDates.length ? `${formData.nocDates.length} date(s)` : "None"} />
          <SmallRow label="Parental leave" value={formData.parentalLeaveExpected ? `${formData.parentalLeaveStart} to ${formData.parentalLeaveEnd}` : "None"} />
          <SmallRow label="Specialties" value={formData.specialtiesRequested.length ? formData.specialtiesRequested.map((s) => s.name).join(", ") : "None"} />
        </CardContent>
      </Card>

      {/* Edit button */}
      {canEdit ? (
        <button
          onClick={handleEdit}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border text-card-foreground font-medium hover:bg-muted transition-colors mb-4"
        >
          <Pencil className="h-4 w-4" /> Edit my responses
        </button>
      ) : deadlineDate ? (
        <p className="text-sm text-muted-foreground mb-4">The survey deadline has passed. Contact your coordinator to request changes.</p>
      ) : null}

      <div className="text-sm text-muted-foreground leading-relaxed max-w-sm space-y-3">
        <p>The rota coordinator will use your responses to generate a fair, WTR-compliant rota.</p>
        <p>If you need to make changes after the deadline, contact your coordinator — they can edit your responses from the admin panel.</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground">{value}</span>
    </div>
  );
}

function SmallRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-card-foreground">{value}</span>
    </div>
  );
}
