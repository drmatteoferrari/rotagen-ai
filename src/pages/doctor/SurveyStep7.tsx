import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useSurveyContext, type SurveyFormData } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pencil, ClipboardCheck, Info, User, Stethoscope, CalendarDays, CalendarX, ShieldAlert, Heart, Star } from "lucide-react";

function fmtDateRange(start: string, end: string): string {
  try {
    const s = format(parseISO(start), "d MMM");
    const e = format(parseISO(end), "d MMM yyyy");
    return `${s} → ${e}`;
  } catch {
    return `${start} → ${end}`;
  }
}

export default function SurveyStep7() {
  const ctx = useSurveyContext();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState("");

  if (!ctx) return null;
  const { formData, setField, setFields, submitSurvey, submitting, submitError, saveDraft, setStep, isAdminMode, returnedFromEdit, setReturnedFromEdit } = ctx;

  // Auto-set signature date to today on mount
  useEffect(() => {
    if (!formData.signatureDate) {
      setField("signatureDate", new Date().toISOString().split("T")[0]);
    }
  }, []);

  // Re-confirmation after edits — reset all 4 declaration checkboxes
  useEffect(() => {
    if (returnedFromEdit) {
      setFields({
        confirmedAccurate: false,
        confirmAlgorithmUnderstood: false,
        confirmExemptionsUnderstood: false,
        confirmFairnessUnderstood: false,
      });
      setReturnedFromEdit(false);
    }
  }, [returnedFromEdit]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.confirmedAccurate) e.confirmed = "You must confirm this is accurate";
    if (!formData.confirmAlgorithmUnderstood) e.algorithm = "Required";
    if (!formData.confirmExemptionsUnderstood) e.exemptions = "Required";
    if (!formData.confirmFairnessUnderstood) e.fairness = "Required";
    if (!formData.signatureName.trim()) e.sigName = "Your name is required";
    if (!formData.signatureDate) e.sigDate = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const success = await submitSurvey();
    if (success && isAdminMode) {
      toast.success("Survey updated successfully");
      navigate("/admin/roster");
    }
  };

  const handleSaveAndReturn = async () => {
    await saveDraft();
    setSaveMessage("✓ Progress saved — return via your invite link");
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const wteLabel = formData.wtePercent === 100
    ? "Full-time (100%)"
    : `${formData.wtePercent === 0 ? formData.wteOtherValue : formData.wtePercent}% LTFT`;

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 pb-4 space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          Review everything carefully before submitting.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
              Review & Submit
            </CardTitle>
            <CardDescription className="text-xs">Full summary of your survey responses.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">

            {/* ── Full Summary ── */}
            <SurveySection number={1} title="Summary">
              <div className="space-y-3">

                {/* Personal Details */}
                <SummaryBlock
                  icon={<User className="h-3.5 w-3.5" />}
                  title="Personal Details"
                  onEdit={() => setStep(1)}
                >
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
                <SummaryBlock
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  title="Competencies"
                  onEdit={() => setStep(2)}
                >
                  <CompRow label="IAC" achieved={formData.iacAchieved} working={formData.iacWorkingTowards} remote={formData.iacRemoteSupervision} />
                  <CompRow label="IAOC" achieved={formData.iaocAchieved} working={formData.iaocWorkingTowards} remote={formData.iaocRemoteSupervision} />
                  <CompRow label="ICU" achieved={formData.icuAchieved} working={formData.icuWorkingTowards} remote={formData.icuRemoteSupervision} />
                  <CompRow label="Transfer" achieved={formData.transferAchieved} working={formData.transferWorkingTowards} remote={formData.transferRemoteSupervision} />
                </SummaryBlock>

                {/* Working Pattern */}
                <SummaryBlock
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  title="Working Pattern"
                  onEdit={() => setStep(3)}
                >
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

                {/* Leave & Unavailability */}
                <SummaryBlock
                  icon={<CalendarX className="h-3.5 w-3.5" />}
                  title="Leave & Unavailability"
                  onEdit={() => setStep(4)}
                >
                  <SummaryItem label="AL Entitlement" value={formData.alEntitlement ? `${formData.alEntitlement} days` : "Not set"} />

                  {formData.annualLeave.length > 0 ? (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Annual Leave ({formData.annualLeave.length})</span>
                      {formData.annualLeave.map((e, i) => (
                        <p key={i} className="text-xs text-card-foreground">
                          {e.startDate && e.endDate ? fmtDateRange(e.startDate, e.endDate) : "Dates not set"}
                          {e.reason && <span className="text-muted-foreground"> — {e.reason}</span>}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <SummaryItem label="Annual Leave" value="None" />
                  )}

                  {formData.studyLeave.length > 0 ? (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Study Leave ({formData.studyLeave.length})</span>
                      {formData.studyLeave.map((e, i) => (
                        <p key={i} className="text-xs text-card-foreground">
                          {e.startDate && e.endDate ? fmtDateRange(e.startDate, e.endDate) : "Dates not set"}
                          {e.reason && <span className="text-muted-foreground"> — {e.reason}</span>}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <SummaryItem label="Study Leave" value="None" />
                  )}

                  {formData.nocDates.length > 0 ? (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Not On-Call ({formData.nocDates.length})</span>
                      {formData.nocDates.map((e, i) => (
                        <p key={i} className="text-xs text-card-foreground">
                          {e.startDate && e.endDate ? fmtDateRange(e.startDate, e.endDate) : "Dates not set"}
                          {e.reason && <span className="text-muted-foreground"> — {e.reason}</span>}
                        </p>
                      ))}
                    </div>
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
                <SummaryBlock
                  icon={<ShieldAlert className="h-3.5 w-3.5" />}
                  title="Medical Exemptions"
                  onEdit={() => setStep(5)}
                >
                  <SummaryItem label="Exemption Details" value={formData.exemptionDetails || "None"} />
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

                {/* Preferences (from Step 6) */}
                <SummaryBlock
                  icon={<Star className="h-3.5 w-3.5" />}
                  title="Preferences & Sessions"
                  onEdit={() => setStep(6)}
                >
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
                  <SummaryItem
                    label="Special Sessions"
                    value={formData.specialSessions.length > 0
                      ? formData.specialSessions.map(s => s.notes ? `${s.name} — ${s.notes}` : s.name).join(", ")
                      : "None"}
                  />
                  {formData.otherInterests.length > 0 && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Other Interests</span>
                      {formData.otherInterests.map((i, idx) => (
                        <p key={idx} className="text-xs text-card-foreground">
                          {i.name}{i.notes && <span className="text-muted-foreground"> — {i.notes}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                  <SummaryItem label="Sign-offs Needed" value={formData.signoffNeeds || "None"} />
                  <SummaryItem label="Additional Notes" value={formData.additionalNotes || "None"} />
                </SummaryBlock>

                {/* Warnings */}
                {!formData.fullName && <InfoBox type="warn">Personal Details blank. <button className="underline font-medium" onClick={() => setStep(1)}>Edit →</button></InfoBox>}
                {formData.iacAchieved === null && formData.iaocAchieved === null && formData.icuAchieved === null && formData.transferAchieved === null && (
                  <InfoBox type="warn">Competencies blank. <button className="underline font-medium" onClick={() => setStep(2)}>Edit →</button></InfoBox>
                )}
                {formData.wtePercent !== 100 && formData.ltftDaysOff.length === 0 && (
                  <InfoBox type="warn">LTFT but no days off. <button className="underline font-medium" onClick={() => setStep(3)}>Edit →</button></InfoBox>
                )}
              </div>
            </SurveySection>

            {/* Confirmations */}
            <SurveySection number={2} title="Confirmation">
              <div className="space-y-3">
                <ConfirmCheck
                  checked={formData.confirmedAccurate}
                  onChange={(v) => setField("confirmedAccurate", v)}
                  label="I confirm all information is accurate"
                  error={errors.confirmed}
                />
                <ConfirmCheck
                  checked={formData.confirmAlgorithmUnderstood}
                  onChange={(v) => setField("confirmAlgorithmUnderstood", v)}
                  label="I understand the algorithm balances the whole team's preferences"
                  error={errors.algorithm}
                />
                <ConfirmCheck
                  checked={formData.confirmExemptionsUnderstood}
                  onChange={(v) => setField("confirmExemptionsUnderstood", v)}
                  label="I understand exemptions may require OH documentation"
                  error={errors.exemptions}
                />
                <ConfirmCheck
                  checked={formData.confirmFairnessUnderstood}
                  onChange={(v) => setField("confirmFairnessUnderstood", v)}
                  label="I understand inaccurate/excessive leave affects fairness"
                  error={errors.fairness}
                />
              </div>
            </SurveySection>

            {/* Signature */}
            <SurveySection number={3} title="Signature">
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Your name</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input value={formData.signatureName} onChange={(e) => setField("signatureName", e.target.value)} className="w-full bg-muted border-border" />
                </div>
                <FieldError message={errors.sigName} />
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Date</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input type="date" value={formData.signatureDate || new Date().toISOString().split("T")[0]} onChange={(e) => setField("signatureDate", e.target.value)} className="w-full bg-muted border-border" readOnly />
                </div>
                <FieldError message={errors.sigDate} />
              </div>
            </SurveySection>

            {/* Save and return */}
            <button
              onClick={handleSaveAndReturn}
              className="w-full py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              Save and return later
            </button>
            {saveMessage && <p className="text-xs text-teal-600 text-center font-medium">{saveMessage}</p>}
            {submitError && <p className="text-xs text-destructive font-medium text-center">{submitError}</p>}
          </CardContent>
        </Card>
      </div>

      <StepNav
        onBack={() => ctx.prevStep()}
        onNext={handleSubmit}
        nextLabel={submitting ? "Submitting…" : "Submit Survey"}
        nextDisabled={submitting}
        isSubmit
      />
    </>
  );
}

/* ── Helper Components ── */

function SummaryBlock({ icon, title, onEdit, children }: { icon: React.ReactNode; title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-card-foreground">
          {icon}
          {title}
        </div>
        <button onClick={onEdit} className="text-teal-600 hover:underline text-[10px] font-medium flex items-center gap-0.5">
          <Pencil className="h-3 w-3" /> Edit
        </button>
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

function CompRow({ label, achieved, working, remote }: { label: string; achieved: boolean | null; working: boolean | null; remote: boolean | null }) {
  let status = "Not answered";
  if (achieved === true) {
    status = `✓ Achieved${remote === true ? " · Remote supervision ✓" : remote === false ? " · Remote supervision ✗" : ""}`;
  } else if (achieved === false) {
    status = working ? "Working towards" : "✗ Not achieved";
  }
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-xs text-card-foreground text-right">{status}</span>
    </div>
  );
}

function ConfirmCheck({ checked, onChange, label, error }: { checked: boolean; onChange: (v: boolean) => void; label: string; error?: string }) {
  return (
    <div>
      <div className="flex items-start gap-2">
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="text-xs sm:text-sm text-card-foreground leading-relaxed">{label}</span>
      </div>
      <FieldError message={error} />
    </div>
  );
}
