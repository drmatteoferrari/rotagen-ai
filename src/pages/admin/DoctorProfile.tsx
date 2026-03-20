import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Check, User, ClipboardList, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_OPTIONS } from "@/lib/gradeOptions";
import { format, parseISO } from "date-fns";

interface DoctorRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  grade: string | null;
  is_active: boolean;
  rota_config_id: string;
  survey_status: string | null;
  survey_submitted_at: string | null;
}

interface SurveyRow {
  personal_email: string | null;
  phone_number: string | null;
  wte_percent: number | null;
  ltft_days_off: string[] | null;
  annual_leave: any;
  study_leave: any;
  noc_dates: any;
  competencies_json: any;
  exempt_from_nights: boolean | null;
  exempt_from_weekends: boolean | null;
  exempt_from_oncall: boolean | null;
  additional_notes: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "submitted":
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">✅ Submitted</Badge>;
    case "in_progress":
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20">✏️ In progress</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground border-border">○ Not started</Badge>;
  }
}

export default function DoctorProfile() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [survey, setSurvey] = useState<SurveyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nhsEmail, setNhsEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [grade, setGrade] = useState("");
  const [isActive, setIsActive] = useState(true);

  type SaveState = "idle" | "saving" | "saved";
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (!doctorId) { setError(true); setLoading(false); return; }
    loadAll();
  }, [doctorId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: doc, error: docErr } = await supabase
        .from("doctors")
        .select("id, first_name, last_name, email, grade, is_active, rota_config_id, survey_status, survey_submitted_at")
        .eq("id", doctorId!)
        .maybeSingle();

      if (docErr || !doc) { setError(true); setLoading(false); return; }
      setDoctor(doc);
      setFirstName(doc.first_name);
      setLastName(doc.last_name);
      setNhsEmail(doc.email ?? "");
      setGrade(doc.grade ?? "");
      setIsActive(doc.is_active);

      const { data: srv } = await supabase
        .from("doctor_survey_responses")
        .select("personal_email, phone_number, wte_percent, ltft_days_off, annual_leave, study_leave, noc_dates, competencies_json, exempt_from_nights, exempt_from_weekends, exempt_from_oncall, additional_notes")
        .eq("doctor_id", doctorId!)
        .eq("rota_config_id", doc.rota_config_id)
        .maybeSingle();

      setSurvey(srv ?? null);
      setPersonalEmail(srv?.personal_email ?? "");
      setPhoneNumber(srv?.phone_number ?? "");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!doctor) return;

    if (nhsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nhsEmail)) {
      toast.error("Please enter a valid NHS email address");
      return;
    }

    setSaveState("saving");
    try {
      const { error: docErr } = await supabase
        .from("doctors")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: nhsEmail.trim() || null,
          grade: grade || null,
          is_active: isActive,
        })
        .eq("id", doctor.id);
      if (docErr) throw docErr;

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const now = new Date().toISOString();
      const { error: srvErr } = await supabase
        .from("doctor_survey_responses")
        .upsert(
          {
            doctor_id: doctor.id,
            rota_config_id: doctor.rota_config_id,
            full_name: fullName,
            nhs_email: nhsEmail.trim() || null,
            personal_email: personalEmail.trim() || null,
            phone_number: phoneNumber.trim() || null,
            grade: grade || null,
            updated_at: now,
            last_saved_at: now,
          },
          { onConflict: "doctor_id,rota_config_id" }
        );
      if (srvErr) throw srvErr;

      setDoctor((prev) => prev ? {
        ...prev,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: nhsEmail.trim() || null,
        grade: grade || null,
        is_active: isActive,
      } : prev);

      setSurvey((prev) => prev ? {
        ...prev,
        personal_email: personalEmail.trim() || null,
        phone_number: phoneNumber.trim() || null,
      } : prev);

      setSaveState("saved");
      toast.success("Profile saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error("Profile save failed:", err);
      toast.error("Failed to save — please try again");
      setSaveState("idle");
    }
  };

  const countItems = (arr: any) => (Array.isArray(arr) ? arr.length : 0);
  const compIcon = (val: boolean | null | undefined) =>
    val === true ? "✓" : val === false ? "✗" : "?";
  const compColor = (val: boolean | null | undefined) =>
    val === true ? "bg-emerald-100 text-emerald-700"
    : val === false ? "bg-red-100 text-red-700"
    : "bg-muted text-muted-foreground";

  if (loading) {
    return (
      <AdminLayout title="Doctor Profile" accentColor="blue">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !doctor) {
    return (
      <AdminLayout title="Doctor Profile" accentColor="blue">
        <div className="mx-auto max-w-3xl space-y-4 py-10 text-center">
          <p className="text-muted-foreground">Doctor not found.</p>
          <Button variant="outline" onClick={() => navigate("/admin/roster")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Roster
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const cj = survey?.competencies_json ?? {};

  return (
    <AdminLayout title="Doctor Profile" subtitle={`${doctor.first_name} ${doctor.last_name}`} accentColor="blue">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Back + status header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/roster")} className="text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Roster
          </Button>
          <StatusBadge status={doctor.survey_status} />
        </div>

        {/* Section A — Identity (editable) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Identity</CardTitle>
            </div>
            <CardDescription>
              Changes here update both the doctor record and their survey profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground">First name</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground">Last name</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">NHS / work email</label>
              <Input value={nhsEmail} onChange={(e) => setNhsEmail(e.target.value)} placeholder="name@nhs.net" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">Personal email</label>
              <Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">Phone number</label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select grade</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <label className="text-sm font-medium text-card-foreground">Active doctor</label>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${isActive ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saveState === "saving"}>
                {saveState === "saving" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {saveState === "saved" && <Check className="mr-1.5 h-4 w-4" />}
                {saveState === "idle" ? "Save changes" : saveState === "saving" ? "Saving…" : "Saved ✓"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section B — Rota preferences (read-only) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Rota preferences</CardTitle>
            </div>
            <CardDescription>
              From the doctor's survey. Edit via the survey override flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!survey ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No survey data yet — invite this doctor to complete their preferences.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-card-foreground">Working pattern</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">WTE</span>
                    <span>{survey.wte_percent != null ? `${survey.wte_percent}%` : "—"}</span>
                    <span className="text-muted-foreground">LTFT</span>
                    <span>{survey.wte_percent != null && survey.wte_percent < 100 ? "Yes" : "No"}</span>
                    <span className="text-muted-foreground">Days off</span>
                    <span>{(survey.ltft_days_off ?? []).length > 0 ? survey.ltft_days_off!.join(", ") : "—"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-card-foreground">Leave</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Annual leave periods</span>
                    <span>{countItems(survey.annual_leave)}</span>
                    <span className="text-muted-foreground">Study leave periods</span>
                    <span>{countItems(survey.study_leave)}</span>
                    <span className="text-muted-foreground">NOC dates</span>
                    <span>{countItems(survey.noc_dates)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-card-foreground">Competencies</p>
                  <div className="flex flex-wrap gap-2">
                    {(["iac", "iaoc", "icu", "transfer"] as const).map((key) => {
                      const val = cj[key]?.achieved;
                      return (
                        <span key={key} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${compColor(val)}`}>
                          {key.toUpperCase()} {compIcon(val)}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {(survey.exempt_from_nights || survey.exempt_from_weekends || survey.exempt_from_oncall) && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-card-foreground">Exemptions</p>
                    <div className="flex flex-wrap gap-2">
                      {survey.exempt_from_nights && <Badge variant="secondary">Nights</Badge>}
                      {survey.exempt_from_weekends && <Badge variant="secondary">Weekends</Badge>}
                      {survey.exempt_from_oncall && <Badge variant="secondary">On-call</Badge>}
                    </div>
                  </div>
                )}
                {survey.additional_notes && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-card-foreground">Additional notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{survey.additional_notes}</p>
                  </div>
                )}
                {doctor.survey_submitted_at && (
                  <p className="text-xs text-muted-foreground">
                    Survey submitted: {format(parseISO(doctor.survey_submitted_at), "d MMM yyyy, HH:mm")}
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/survey-override/${doctor.id}/1`)}
                className="flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Edit rota preferences
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
