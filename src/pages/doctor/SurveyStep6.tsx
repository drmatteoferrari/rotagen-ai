import { useState } from "react";
import { useSurveyContext, type SpecialtyEntry, type SurveyFormData } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { FieldError } from "@/components/survey/FieldError";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Pencil, ClipboardCheck, Info } from "lucide-react";

const SPECIALTIES = [
  "Paediatric", "Obstetric", "Cardiothoracic", "Neuro", "Vascular",
  "T&O and regional anaesthesia", "ENT and maxillofacial", "Ophthalmology",
  "Plastics and reconstructive", "Gynaecology", "Urology", "Hepatobiliary",
  "Breast surgery", "Remote anaesthesia (MRI, radiology, cardioversions)",
];

const SPECIAL_SESSION_OPTIONS = ["Pain medicine", "Pre-op clinics", "Other"];

export default function SurveyStep6() {
  const ctx = useSurveyContext();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [otherSession, setOtherSession] = useState("");

  if (!ctx) return null;
  const { formData, setField, submitSurvey, submitting, submitError, saveDraft, setStep } = ctx;

  const isSpecSelected = (name: string) => formData.specialtiesRequested.some((s) => s.name === name);
  const getSpecNotes = (name: string) => formData.specialtiesRequested.find((s) => s.name === name)?.notes || "";

  const toggleSpec = (name: string, checked: boolean) => {
    if (checked) {
      setField("specialtiesRequested", [...formData.specialtiesRequested, { name, notes: "" }]);
    } else {
      setField("specialtiesRequested", formData.specialtiesRequested.filter((s) => s.name !== name));
    }
  };

  const updateSpecNotes = (name: string, notes: string) => {
    setField("specialtiesRequested", formData.specialtiesRequested.map((s) =>
      s.name === name ? { ...s, notes } : s
    ));
  };

  const toggleSession = (session: string, checked: boolean) => {
    if (checked) {
      setField("specialSessions", [...formData.specialSessions, session]);
    } else {
      setField("specialSessions", formData.specialSessions.filter((s) => s !== session));
    }
  };

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
    await submitSurvey();
  };

  const handleSaveAndReturn = async () => {
    await saveDraft();
    setSaveMessage("✓ Progress saved — return anytime using the link in your invite email");
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const wteLabel = formData.wtePercent === 100
    ? "Full-time (100%)"
    : `${formData.wtePercent === 0 ? formData.wteOtherValue : formData.wtePercent}% LTFT`;

  return (
    <>
      <div className="p-4 pb-32 space-y-6">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 text-teal-600" />
          Review all sections before submitting. You can go back to edit any step.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
              Review & Submit
            </CardTitle>
            <CardDescription>Check your answers before submitting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Specialty Preferences */}
            <SurveySection number={1} title="Specialty Preferences">
              <div className="space-y-3">
                <InfoBox type="info">Soft preferences — listing too many may dilute the weight each carries.</InfoBox>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SPECIALTIES.map((name) => (
                    <div key={name} className={`rounded-lg border p-3 transition-colors ${isSpecSelected(name) ? "border-teal-300 bg-teal-50" : "border-border"}`}>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSpecSelected(name)} onCheckedChange={(v) => toggleSpec(name, !!v)} />
                        <span className="text-sm text-card-foreground">{name}</span>
                      </div>
                      {isSpecSelected(name) && (
                        <Input
                          placeholder="Notes / sign-offs needed (optional)"
                          value={getSpecNotes(name)}
                          onChange={(e) => updateSpecNotes(name, e.target.value)}
                          className="mt-2 bg-muted border-border text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </SurveySection>

            {/* Special Sessions */}
            <SurveySection number={2} title="Special Interest Sessions">
              <div className="space-y-2">
                {SPECIAL_SESSION_OPTIONS.map((s) => (
                  <div key={s}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={s === "Other" ? formData.specialSessions.some((ss) => ss !== "Pain medicine" && ss !== "Pre-op clinics") : formData.specialSessions.includes(s)}
                        onCheckedChange={(v) => {
                          if (s === "Other") {
                            if (!v) {
                              setField("specialSessions", formData.specialSessions.filter((ss) => ss === "Pain medicine" || ss === "Pre-op clinics"));
                              setOtherSession("");
                            } else {
                              setField("specialSessions", [...formData.specialSessions, ""]);
                            }
                          } else {
                            toggleSession(s, !!v);
                          }
                        }}
                      />
                      <span className="text-sm text-card-foreground">{s}</span>
                    </div>
                    {s === "Other" && formData.specialSessions.some((ss) => ss !== "Pain medicine" && ss !== "Pre-op clinics") && (
                      <Input
                        placeholder="Please specify"
                        value={otherSession}
                        onChange={(e) => {
                          setOtherSession(e.target.value);
                          const base = formData.specialSessions.filter((ss) => ss === "Pain medicine" || ss === "Pre-op clinics");
                          setField("specialSessions", e.target.value ? [...base, e.target.value] : [...base, ""]);
                        }}
                        className="bg-muted border-border ml-6 mt-1 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </SurveySection>

            {/* Sign-offs */}
            <SurveySection number={3} title="Sign-offs & Assessments">
              <div>
                <label className="text-sm font-semibold text-card-foreground block mb-1">Sign-offs & assessments needed this rotation</label>
                <Textarea
                  value={formData.signoffNeeds}
                  onChange={(e) => setField("signoffNeeds", e.target.value)}
                  placeholder="e.g. 10 T&O cases, 5 obstetric epidurals, DOPS for nerve blocks"
                  className="bg-muted border-border min-h-[60px]"
                />
              </div>
            </SurveySection>

            {/* Additional */}
            <SurveySection number={4} title="Additional Information">
              <div>
                <label className="text-sm font-semibold text-card-foreground block mb-1">Anything else the coordinator should know</label>
                <Textarea
                  value={formData.additionalNotes}
                  onChange={(e) => setField("additionalNotes", e.target.value)}
                  placeholder="e.g. Returning from maternity leave in week 4 — prefer lighter start."
                  className="bg-muted border-border min-h-[60px]"
                />
              </div>
            </SurveySection>

            {/* Review Summary */}
            <SurveySection number={5} title="Review Summary">
              <div className="divide-y divide-border">
                <SummaryRow icon="📋" label="Personal Details" value={`${formData.fullName} · ${formData.grade}${formData.dualSpecialty ? ` · Dual: ${formData.dualSpecialtyTypes.join(", ")}` : ""}`} onEdit={() => setStep(1)} />
                <SummaryRow icon="⚙️" label="Competencies" value={compSummary(formData)} onEdit={() => setStep(2)} />
                <SummaryRow icon="🗓️" label="Working Pattern" value={`${wteLabel}${formData.ltftDaysOff.length ? ` · ${formData.ltftDaysOff.join(", ")} off` : ""}`} onEdit={() => setStep(3)} />
                <SummaryRow icon="📅" label="Annual Leave" value={formData.annualLeave.length ? `${formData.annualLeave.length} period(s)` : "None"} onEdit={() => setStep(4)} />
                <SummaryRow icon="📅" label="Study Leave" value={formData.studyLeave.length ? `${formData.studyLeave.length} period(s)` : "None"} onEdit={() => setStep(4)} />
                <SummaryRow icon="🔕" label="Prefer not on-call" value={formData.nocDates.length ? `${formData.nocDates.length} date(s)` : "None"} onEdit={() => setStep(4)} />
                <SummaryRow icon="🔁" label="Rotations" value={formData.rotations.length ? `${formData.rotations.length} rotation(s)` : "None"} onEdit={() => setStep(4)} />
                <SummaryRow icon="🚫" label="Additional info" value={formData.otherRestrictions || formData.otherSchedulingRestrictions || formData.parentalLeaveExpected ? "Entered" : "None entered"} onEdit={() => setStep(5)} />
                <SummaryRow icon="🎓" label="Specialties & Training" value={formData.specialtiesRequested.length ? formData.specialtiesRequested.map((s) => s.name).join(", ") : "None selected"} onEdit={() => setStep(6)} />
              </div>

              {/* Warnings */}
              {!formData.fullName && <InfoBox type="warn">⚠️ Personal Details — you left this blank. <button className="underline font-medium" onClick={() => setStep(1)}>Edit →</button></InfoBox>}
              {formData.iacAchieved === null && formData.iaocAchieved === null && formData.icuAchieved === null && formData.transferAchieved === null && (
                <InfoBox type="warn">⚠️ Competencies section is blank. <button className="underline font-medium" onClick={() => setStep(2)}>Edit →</button></InfoBox>
              )}
              {formData.wtePercent !== 100 && formData.ltftDaysOff.length === 0 && (
                <InfoBox type="warn">⚠️ LTFT selected but no days off entered. <button className="underline font-medium" onClick={() => setStep(3)}>Edit →</button></InfoBox>
              )}
            </SurveySection>

            {/* Confirmations */}
            <SurveySection number={6} title="Confirmation">
              <div className="space-y-3">
                <ConfirmCheck
                  checked={formData.confirmedAccurate}
                  onChange={(v) => setField("confirmedAccurate", v)}
                  label="I confirm all information above is accurate to the best of my knowledge"
                  error={errors.confirmed}
                />
                <ConfirmCheck
                  checked={formData.confirmAlgorithmUnderstood}
                  onChange={(v) => setField("confirmAlgorithmUnderstood", v)}
                  label="I understand the algorithm will try to respect all my requests, but this cannot always be guaranteed — the final rota balances the preferences of the whole team"
                  error={errors.algorithm}
                />
                <ConfirmCheck
                  checked={formData.confirmExemptionsUnderstood}
                  onChange={(v) => setField("confirmExemptionsUnderstood", v)}
                  label="I understand that medical exemptions may require Occupational Health documentation"
                  error={errors.exemptions}
                />
                <ConfirmCheck
                  checked={formData.confirmFairnessUnderstood}
                  onChange={(v) => setField("confirmFairnessUnderstood", v)}
                  label="I understand that submitting inaccurate or excessive leave may negatively affect fairness for my colleagues"
                  error={errors.fairness}
                />
              </div>
            </SurveySection>

            {/* Signature */}
            <SurveySection number={7} title="Signature">
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Your name</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input value={formData.signatureName} onChange={(e) => setField("signatureName", e.target.value)} className="w-[180px] bg-muted border-border" />
                </div>
                <FieldError message={errors.sigName} />
                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">Date submitted</span>
                    <span className="text-[11px] font-semibold text-teal-600 mt-0.5">Required</span>
                  </div>
                  <Input type="date" value={formData.signatureDate || new Date().toISOString().split("T")[0]} onChange={(e) => setField("signatureDate", e.target.value)} className="w-[180px] bg-muted border-border" />
                </div>
                <FieldError message={errors.sigDate} />
              </div>
            </SurveySection>

            {/* Save and return */}
            <button
              onClick={handleSaveAndReturn}
              className="w-full py-3 rounded-lg border border-border text-muted-foreground font-medium hover:bg-muted transition-colors"
            >
              Save and return later
            </button>
            {saveMessage && <p className="text-sm text-teal-600 text-center font-medium">{saveMessage}</p>}

            {submitError && <p className="text-sm text-destructive font-medium text-center">{submitError}</p>}
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

// Helper components
function SummaryRow({ icon, label, value, onEdit }: { icon: string; label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</span>
        <span className="text-xs text-card-foreground truncate">{value}</span>
      </div>
      <button onClick={onEdit} className="text-teal-600 hover:underline text-xs font-medium flex items-center gap-1 shrink-0">
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}

function ConfirmCheck({ checked, onChange, label, error }: { checked: boolean; onChange: (v: boolean) => void; label: string; error?: string }) {
  return (
    <div>
      <div className="flex items-start gap-2">
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
        <span className="text-sm text-card-foreground leading-relaxed">{label}</span>
      </div>
      <FieldError message={error} />
    </div>
  );
}

function compSummary(fd: SurveyFormData): string {
  const parts: string[] = [];
  if (fd.iacAchieved === true) parts.push("IAC ✓");
  else if (fd.iacAchieved === false) parts.push(fd.iacWorkingTowards ? "IAC (working towards)" : "IAC ✗");
  if (fd.iaocAchieved === true) parts.push("IAOC ✓");
  else if (fd.iaocAchieved === false) parts.push(fd.iaocWorkingTowards ? "IAOC (working towards)" : "IAOC ✗");
  if (fd.icuAchieved === true) parts.push("ICU ✓");
  else if (fd.icuAchieved === false) parts.push(fd.icuWorkingTowards ? "ICU (working towards)" : "ICU ✗");
  if (fd.transferAchieved === true) parts.push("Transfer ✓");
  else if (fd.transferAchieved === false) parts.push(fd.transferWorkingTowards ? "Transfer (working towards)" : "Transfer ✗");
  return parts.length ? parts.join(" · ") : "Not answered";
}
