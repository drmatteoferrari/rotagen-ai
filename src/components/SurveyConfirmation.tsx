import { Pencil, CheckCircle2, User, Stethoscope, CalendarDays, CalendarX, ShieldAlert, Star } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useSurveyContext } from "@/contexts/SurveyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

function fmtDateRange(start: string, end: string): string {
  try {
    const s = format(parseISO(start), "d MMM");
    const e = format(parseISO(end), "d MMM yyyy");
    return `${s} → ${e}`;
  } catch {
    return `${start} → ${end}`;
  }
}

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

  const compStatus = (achieved: boolean | null, working: boolean | null, remote: boolean | null) => {
    if (achieved === true) return `✓ Achieved${remote === true ? " · Remote ✓" : remote === false ? " · Remote ✗" : ""}`;
    if (achieved === false) return working ? "Working towards" : "✗ Not achieved";
    return "Not answered";
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full px-4 py-6 overflow-y-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 mb-4">
        <CheckCircle2 className="h-8 w-8 text-teal-600" />
      </div>

      <h1 className="text-xl font-bold text-card-foreground mb-1 text-center">Survey submitted successfully</h1>
      <p className="text-muted-foreground text-sm mb-4 text-center">
        Thank you, {doctor.firstName}. Your preferences have been saved.
      </p>

      {/* Meta info */}
      <Card className="w-full max-w-sm mb-4">
        <CardContent className="p-4 space-y-2">
          {submittedAt && (
            <MetaRow label="Submitted" value={format(parseISO(submittedAt), "d MMM yyyy, HH:mm")} />
          )}
          <MetaRow label="Rota period" value={`${formatDate(rotaInfo?.startDate ?? null)} – ${formatDate(rotaInfo?.endDate ?? null)}`} />
          {(rotaInfo?.departmentName || rotaInfo?.trustName) && (
            <MetaRow label="Department" value={[rotaInfo?.departmentName, rotaInfo?.trustName].filter(Boolean).join(", ")} />
          )}
          {rotaInfo?.surveyDeadline && (
            <MetaRow label="Edit deadline" value={formatDate(rotaInfo.surveyDeadline)} />
          )}
        </CardContent>
      </Card>

      {/* Full summary */}
      <div className="w-full max-w-sm space-y-3 mb-4">

        {/* Personal Details */}
        <SummaryBlock icon={<User className="h-3.5 w-3.5" />} title="Personal Details">
          <SummaryItem label="Name" value={formData.fullName || "—"} />
          <SummaryItem label="NHS Email" value={formData.nhsEmail || "—"} />
          {formData.personalEmail && <SummaryItem label="Personal Email" value={formData.personalEmail} />}
          <SummaryItem label="Phone" value={formData.phoneNumber || "—"} />
          <SummaryItem label="Grade" value={formData.grade || "—"} />
          {formData.dualSpecialty && (
            <SummaryItem label="Dual Training" value={formData.dualSpecialtyTypes.join(", ") || "Yes"} />
          )}
        </SummaryBlock>

        {/* Competencies */}
        <SummaryBlock icon={<Stethoscope className="h-3.5 w-3.5" />} title="Competencies">
          <SummaryItem label="IAC" value={compStatus(formData.iacAchieved, formData.iacWorkingTowards, formData.iacRemoteSupervision)} />
          <SummaryItem label="IAOC" value={compStatus(formData.iaocAchieved, formData.iaocWorkingTowards, formData.iaocRemoteSupervision)} />
          <SummaryItem label="ICU" value={compStatus(formData.icuAchieved, formData.icuWorkingTowards, formData.icuRemoteSupervision)} />
          <SummaryItem label="Transfer" value={compStatus(formData.transferAchieved, formData.transferWorkingTowards, formData.transferRemoteSupervision)} />
        </SummaryBlock>

        {/* Working Pattern */}
        <SummaryBlock icon={<CalendarDays className="h-3.5 w-3.5" />} title="Working Pattern">
          <SummaryItem label="WTE" value={wteLabel} />
          {formData.ltftDaysOff.length > 0 && (
            <SummaryItem label="Days Off" value={formData.ltftDaysOff.map(d => d.slice(0, 3)).join(", ")} />
          )}
          {formData.ltftNightFlexibility.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Night Flexibility</span>
              {formData.ltftNightFlexibility.map(f => (
                <p key={f.day} className="text-xs text-card-foreground">
                  {f.day.slice(0, 3)}: start {f.canStart ? "✓" : "✗"} · end {f.canEnd ? "✓" : "✗"}
                </p>
              ))}
            </div>
          )}
        </SummaryBlock>

        {/* Leave */}
        <SummaryBlock icon={<CalendarX className="h-3.5 w-3.5" />} title="Leave & Unavailability">
          <SummaryItem label="AL Entitlement" value={formData.alEntitlement ? `${formData.alEntitlement} days` : "Not set"} />

          {formData.annualLeave.length > 0 ? (
            <DateList label="Annual Leave" count={formData.annualLeave.length} items={formData.annualLeave} />
          ) : (
            <SummaryItem label="Annual Leave" value="None" />
          )}

          {formData.studyLeave.length > 0 ? (
            <DateList label="Study Leave" count={formData.studyLeave.length} items={formData.studyLeave} />
          ) : (
            <SummaryItem label="Study Leave" value="None" />
          )}

          {formData.nocDates.length > 0 ? (
            <DateList label="Not On-Call" count={formData.nocDates.length} items={formData.nocDates} />
          ) : (
            <SummaryItem label="Not On-Call" value="None" />
          )}

          {formData.rotations.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Rotations ({formData.rotations.length})</span>
              {formData.rotations.map((e, i) => (
                <p key={i} className="text-xs text-card-foreground">
                  {e.startDate && e.endDate ? fmtDateRange(e.startDate, e.endDate) : "Dates not set"}
                  <span className="text-muted-foreground"> — {e.location || "No location"}</span>
                </p>
              ))}
            </div>
          )}
        </SummaryBlock>

        {/* Exemptions */}
        <SummaryBlock icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Exemptions & Restrictions">
          <SummaryItem label="Health Restrictions" value={formData.otherRestrictions || "None"} />
          <SummaryItem label="Parental Leave" value={
            formData.parentalLeaveExpected
              ? (formData.parentalLeaveStart && formData.parentalLeaveEnd
                  ? fmtDateRange(formData.parentalLeaveStart, formData.parentalLeaveEnd)
                  : "Expected — dates TBC")
              : "No"
          } />
          {formData.parentalLeaveExpected && formData.parentalLeaveNotes && (
            <SummaryItem label="PL Notes" value={formData.parentalLeaveNotes} />
          )}
          <SummaryItem label="Other Restrictions" value={formData.otherSchedulingRestrictions || "None"} />
        </SummaryBlock>

        {/* Preferences */}
        <SummaryBlock icon={<Star className="h-3.5 w-3.5" />} title="Preferences & Sessions">
          {formData.specialtiesRequested.length > 0 ? (
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Specialties ({formData.specialtiesRequested.length})</span>
              {formData.specialtiesRequested.map((s, i) => (
                <p key={i} className="text-xs text-card-foreground">
                  {s.name}{s.notes && <span className="text-muted-foreground"> — {s.notes}</span>}
                </p>
              ))}
            </div>
          ) : (
            <SummaryItem label="Specialties" value="None selected" />
          )}
          <SummaryItem label="Special Sessions" value={formData.specialSessions.length > 0 ? formData.specialSessions.join(", ") : "None"} />
          <SummaryItem label="Sign-offs Needed" value={formData.signoffNeeds || "None"} />
          <SummaryItem label="Additional Notes" value={formData.additionalNotes || "None"} />
        </SummaryBlock>
      </div>

      {/* Edit button */}
      {canEdit ? (
        <button
          onClick={handleEdit}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border text-card-foreground font-medium hover:bg-muted transition-colors mb-4"
        >
          <Pencil className="h-4 w-4" /> Edit my responses
        </button>
      ) : deadlineDate ? (
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">The survey deadline has passed. Contact your coordinator to request changes.</p>
      ) : null}

      <div className="text-xs text-muted-foreground leading-relaxed max-w-sm space-y-2 text-center pb-6">
        <p>The rota coordinator will use your responses to generate a fair, WTR-compliant rota.</p>
        <p>If you need to make changes after the deadline, contact your coordinator.</p>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground">{value}</span>
    </div>
  );
}

function SummaryBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-2 border-b border-border text-xs font-semibold text-card-foreground">
        {icon}
        {title}
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-xs text-card-foreground text-right break-words min-w-0">{value}</span>
    </div>
  );
}

function DateList({ label, count, items }: { label: string; count: number; items: { startDate: string; endDate: string; reason: string }[] }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase">{label} ({count})</span>
      {items.map((e, i) => (
        <p key={i} className="text-xs text-card-foreground">
          {e.startDate && e.endDate ? fmtDateRange(e.startDate, e.endDate) : "Dates not set"}
          {e.reason && <span className="text-muted-foreground"> — {e.reason}</span>}
        </p>
      ))}
    </div>
  );
}
