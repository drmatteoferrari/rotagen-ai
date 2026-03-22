import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ArrowLeft, Check, User, ClipboardList, ExternalLink, Send, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_OPTIONS } from "@/lib/gradeOptions";
import { format, parseISO } from "date-fns";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildSurveyLink } from "@/lib/surveyLinks";

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
  survey_token: string | null;
  survey_invite_count: number | null;
}

interface SurveyRow {
  personal_email: string | null;
  phone_number: string | null;
  wte_percent: number | null;
  wte_other_value: number | null;
  al_entitlement: number | null;
  ltft_days_off: string[] | null;
  ltft_night_flexibility: any;
  annual_leave: any;
  study_leave: any;
  noc_dates: any;
  other_unavailability: any;
  competencies_json: any;
  exempt_from_nights: boolean | null;
  exempt_from_weekends: boolean | null;
  exempt_from_oncall: boolean | null;
  exemption_details: string | null;
  other_restrictions: string | null;
  additional_restrictions: string | null;
  parental_leave_expected: boolean | null;
  parental_leave_start: string | null;
  parental_leave_end: string | null;
  parental_leave_notes: string | null;
  specialties_requested: any;
  special_sessions: string[] | null;
  signoff_needs: string | null;
  dual_specialty: boolean | null;
  dual_specialty_types: string[] | null;
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

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorProfile() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { restoredConfig } = useRotaContext();
  const { accountSettings } = useAuth();

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
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [removePopoverOpen, setRemovePopoverOpen] = useState(false);

  useEffect(() => {
    if (!doctorId) { setError(true); setLoading(false); return; }
    loadAll();
  }, [doctorId]);

  // Relational data state
  const [unavailBlocks, setUnavailBlocks] = useState<any[]>([]);
  const [ltftPats, setLtftPats] = useState<any[]>([]);
  const [trainingReqs, setTrainingReqs] = useState<any[]>([]);
  const [dualSpecs, setDualSpecs] = useState<any[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: doc, error: docErr } = await supabase
        .from("doctors")
        .select("id, first_name, last_name, email, grade, is_active, rota_config_id, survey_status, survey_submitted_at, survey_token, survey_invite_count")
        .eq("id", doctorId!)
        .maybeSingle();

      if (docErr || !doc) { setError(true); setLoading(false); return; }
      setDoctor(doc);
      setFirstName(doc.first_name);
      setLastName(doc.last_name);
      setNhsEmail(doc.email ?? "");
      setGrade(doc.grade ?? "");
      setIsActive(doc.is_active);

      const [srvResult, blocksResult, ltftResult, reqsResult, dualsResult] = await Promise.all([
        supabase
          .from("doctor_survey_responses")
          .select("personal_email, phone_number, wte_percent, wte_other_value, al_entitlement, ltft_days_off, ltft_night_flexibility, annual_leave, study_leave, noc_dates, other_unavailability, competencies_json, exempt_from_nights, exempt_from_weekends, exempt_from_oncall, exemption_details, other_restrictions, additional_restrictions, parental_leave_expected, parental_leave_start, parental_leave_end, parental_leave_notes, specialties_requested, special_sessions, signoff_needs, dual_specialty, dual_specialty_types, additional_notes, iac_achieved, iac_working, iac_remote, iaoc_achieved, iaoc_working, iaoc_remote, icu_achieved, icu_working, icu_remote, transfer_achieved, transfer_working, transfer_remote")
          .eq("doctor_id", doctorId!)
          .eq("rota_config_id", doc.rota_config_id)
          .maybeSingle(),
        supabase.from("unavailability_blocks").select("*").eq("doctor_id", doctorId!).eq("rota_config_id", doc.rota_config_id).order("start_date"),
        supabase.from("ltft_patterns").select("*").eq("doctor_id", doctorId!).eq("rota_config_id", doc.rota_config_id),
        supabase.from("training_requests").select("*").eq("doctor_id", doctorId!).eq("rota_config_id", doc.rota_config_id),
        supabase.from("dual_specialties").select("*").eq("doctor_id", doctorId!).eq("rota_config_id", doc.rota_config_id),
      ]);

      const srv = srvResult.data;
      setSurvey(srv ?? null);
      setPersonalEmail(srv?.personal_email ?? "");
      setPhoneNumber(srv?.phone_number ?? "");
      setUnavailBlocks(blocksResult.data ?? []);
      setLtftPats(ltftResult.data ?? []);
      setTrainingReqs(reqsResult.data ?? []);
      setDualSpecs(dualsResult.data ?? []);
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

      // Only update survey row if it already exists — no partial row creation
      const { data: existingRow } = await supabase
        .from("doctor_survey_responses")
        .select("id")
        .eq("doctor_id", doctor.id)
        .eq("rota_config_id", doctor.rota_config_id)
        .maybeSingle();

      if (existingRow) {
        const { error: srvErr } = await supabase
          .from("doctor_survey_responses")
          .update({
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            nhs_email: nhsEmail.trim() || null,
            personal_email: personalEmail.trim() || null,
            phone_number: phoneNumber.trim() || null,
            grade: grade || null,
            updated_at: new Date().toISOString(),
          })
          .eq("doctor_id", doctor.id)
          .eq("rota_config_id", doctor.rota_config_id);
        if (srvErr) throw srvErr;
      }

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

  const handleSendInvite = async () => {
    if (!doctor) return;
    if (!doctor.survey_token) { toast.error("No survey token — cannot send invite"); return; }
    if (!doctor.email) { toast.error("No email address on file"); return; }
    const departmentName = accountSettings?.departmentName ?? "";
    const hospitalName = accountSettings?.trustName ?? "";
    if (!departmentName || !hospitalName) {
      toast.error("Please set your department and hospital name on the Dashboard first.");
      return;
    }
    setSendingInvite(true);
    try {
      const surveyLink = buildSurveyLink(doctor.survey_token);
      const body = {
        to: doctor.email,
        doctorName: `${doctor.first_name} ${doctor.last_name}`,
        doctorId: doctor.id,
        rotaPeriod: {
          startDate: restoredConfig?.rotaPeriod?.startDate
            ? format(parseISO(restoredConfig.rotaPeriod.startDate), "dd MMM yyyy")
            : "TBC",
          endDate: restoredConfig?.rotaPeriod?.endDate
            ? format(parseISO(restoredConfig.rotaPeriod.endDate), "dd MMM yyyy")
            : "TBC",
          durationWeeks: restoredConfig?.rotaPeriod?.durationWeeks ?? 0,
        },
        departmentName,
        hospitalName,
        surveyDeadline: "See Roster page for deadline",
        surveyLink,
      };
      const { data, error } = await supabase.functions.invoke("send-survey-invite", { body });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? "Send failed");
      await supabase.from("doctors").update({
        survey_invite_sent_at: new Date().toISOString(),
        survey_invite_count: (doctor.survey_invite_count ?? 0) + 1,
      }).eq("id", doctor.id);
      toast.success(`✓ Survey invite sent to ${doctor.first_name} ${doctor.last_name}`);
      loadAll();
    } catch (err: any) {
      toast.error("Failed to send invite — please try again");
      console.error(err);
    } finally {
      setSendingInvite(false);
    }
  };

  const fmtDate = (d: string | null | undefined): string => {
    if (!d) return "—";
    try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
  };

  const fmtRange = (start: string | null, end: string | null): string => {
    if (!start) return "—";
    if (!end) return fmtDate(start);
    return `${fmtDate(start)} → ${fmtDate(end)}`;
  };

  const renderLeaveList = (arr: any): React.ReactNode => {
    if (!Array.isArray(arr) || arr.length === 0) return <span className="text-muted-foreground">None</span>;
    return (
      <ul className="space-y-0.5">
        {arr.map((entry: any, i: number) => (
          <li key={i} className="text-sm">{fmtRange(entry.startDate, entry.endDate)}</li>
        ))}
      </ul>
    );
  };

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

        {/* Action bar */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Send invite */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendInvite}
                    disabled={sendingInvite || !doctor.survey_token || !doctor.email}
                    className="gap-1.5"
                  >
                    {sendingInvite
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />}
                    Send invite
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!doctor.survey_token ? "No survey token available" : !doctor.email ? "No email on file" : "Send survey invite email"}
                </TooltipContent>
              </Tooltip>

              {/* Copy link */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!doctor.survey_token) return;
                      navigator.clipboard.writeText(buildSurveyLink(doctor.survey_token));
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    disabled={!doctor.survey_token}
                    className="gap-1.5"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? "Copied!" : "Copy link"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{doctor.survey_token ? "Copy survey link to clipboard" : "No survey link available"}</TooltipContent>
              </Tooltip>

              {/* Open survey */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => doctor.survey_token && window.open(buildSurveyLink(doctor.survey_token), "_blank")}
                    disabled={!doctor.survey_token}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open survey
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{doctor.survey_token ? "Open survey in new tab" : "No survey link available"}</TooltipContent>
              </Tooltip>

              {/* Edit survey */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/survey-override/${doctor.id}/1?from=/admin/doctor/${doctor.id}`)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit survey
              </Button>

              {/* Remove button */}
              <Popover open={removePopoverOpen} onOpenChange={setRemovePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 pointer-events-auto" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Remove {doctor.first_name}?</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={async () => {
                        const { error } = await supabase.from("doctors").update({ is_active: false }).eq("id", doctor.id);
                        if (error) { toast.error("Failed to deactivate doctor"); return; }
                        toast.success("Doctor moved to inactive");
                        setRemovePopoverOpen(false);
                        navigate("/admin/roster");
                      }}
                    >
                      Move to inactive
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full justify-start"
                      onClick={async () => {
                        await supabase.from("doctor_survey_responses").delete().eq("doctor_id", doctor.id);
                        const { error } = await supabase.from("doctors").delete().eq("id", doctor.id);
                        if (error) { toast.error("Failed to delete doctor"); return; }
                        toast("Doctor permanently deleted");
                        setRemovePopoverOpen(false);
                        navigate("/admin/roster");
                      }}
                    >
                      Delete permanently
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {doctor.survey_status === "submitted" && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                This doctor has already submitted their survey. Sending a new invite allows them to edit their responses.
              </p>
            )}
          </CardContent>
        </Card>

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
            <p className="text-xs text-muted-foreground">Status: {doctor.is_active ? "Active" : "Inactive"}</p>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saveState === "saving"}>
                {saveState === "saving" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {saveState === "saved" && <Check className="mr-1.5 h-4 w-4" />}
                {saveState === "idle" ? "Save changes" : saveState === "saving" ? "Saving\u2026" : "Saved \u2713"}
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
          <CardContent>
            {!survey ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No survey data yet — invite this doctor to complete their preferences.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* A — Working Pattern */}
                <div className="space-y-2 py-4">
                  <p className="text-sm font-semibold text-card-foreground">Working Pattern</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">WTE</dt>
                    <dd>{survey.wte_percent === 0 ? `${survey.wte_other_value ?? "?"}% (custom)` : survey.wte_percent != null ? `${survey.wte_percent}%` : "—"}</dd>
                    <dt className="text-muted-foreground">LTFT</dt>
                    <dd>{survey.wte_percent != null && survey.wte_percent < 100 ? "Yes" : "No"}</dd>
                    <dt className="text-muted-foreground">AL entitlement</dt>
                    <dd>{survey.al_entitlement != null ? `${survey.al_entitlement} days` : "—"}</dd>
                    {ltftPats.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">Days off</dt>
                        <dd>{ltftPats.filter(p => p.is_day_off).map(p => p.day).sort((a: string, b: string) => DAY_ORDER.indexOf(a.charAt(0).toUpperCase() + a.slice(1)) - DAY_ORDER.indexOf(b.charAt(0).toUpperCase() + b.slice(1))).join(", ")}</dd>
                      </>
                    )}
                    {ltftPats.filter(p => p.is_day_off).length > 0 && (
                      <>
                        <dt className="text-muted-foreground">Night flexibility</dt>
                        <dd>
                          {ltftPats.filter(p => p.is_day_off).map((p: any, i: number) => (
                            <span key={i} className="block text-xs">
                              {p.day}: start {p.can_start_nights ? "✓" : "✗"} / end {p.can_end_nights ? "✓" : "✗"}
                            </span>
                          ))}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>

                {/* B — Competencies (from flat bools, fallback to JSONB) */}
                <div className="space-y-2 py-4">
                  <p className="text-sm font-semibold text-card-foreground">Competencies</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {(["iac", "iaoc", "icu", "transfer"] as const).map((key) => {
                      const flatKey = (k: string, suffix: string) => (survey as any)?.[`${k}_${suffix}`] as boolean | null | undefined;
                      const cj = survey.competencies_json ?? {};
                      // Prefer flat bools, fallback to JSONB
                      const achieved = flatKey(key, "achieved") ?? cj[key]?.achieved ?? null;
                      const workingTowards = flatKey(key, "working") ?? cj[key]?.workingTowards ?? null;
                      const remoteSupervision = flatKey(key, "remote") ?? cj[key]?.remoteSupervision ?? null;
                      const labels: Record<string, string> = { iac: "IAC", iaoc: "IAOC", icu: "ICU", transfer: "Transfer" };
                      let val = "—";
                      if (achieved === true) {
                        val = `✓ Achieved${remoteSupervision === true ? " · Remote ✓" : remoteSupervision === false ? " · Remote ✗" : ""}`;
                      } else if (achieved === false && workingTowards === true) {
                        val = "Working towards";
                      } else if (achieved === false) {
                        val = "✗ Not achieved";
                      }
                      return (
                        <React.Fragment key={key}>
                          <dt className="text-muted-foreground">{labels[key]}</dt>
                          <dd>{val}</dd>
                        </React.Fragment>
                      );
                    })}
                  </dl>
                </div>

                {/* C — Leave & Unavailability (from relational tables) */}
                <div className="space-y-2 py-4">
                  <p className="text-sm font-semibold text-card-foreground">Leave & Unavailability</p>
                  <div className="space-y-1.5 text-sm">
                    {(["annual", "study", "noc", "rotation", "parental"] as const).map((reason) => {
                      const reasonBlocks = unavailBlocks.filter(b => b.reason === reason);
                      const labels: Record<string, string> = { annual: "Annual leave", study: "Study leave", noc: "NOC dates", rotation: "Rotations / other", parental: "Parental leave" };
                      return (
                        <p key={reason}>
                          <span className="text-muted-foreground">{labels[reason]}: </span>
                          {reasonBlocks.length > 0 ? (
                            <span>
                              {reasonBlocks.map((b: any, i: number) => (
                                <span key={i} className="block text-xs ml-2">
                                  {fmtRange(b.start_date, b.end_date)}
                                  {b.location ? ` (${b.location})` : ""}
                                  {b.notes ? ` — ${b.notes}` : ""}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* D — Exemptions & Restrictions */}
                <div className="space-y-2 py-4">
                  <p className="text-sm font-semibold text-card-foreground">Exemptions & Restrictions</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Exempt from nights</dt>
                    <dd>{survey.exempt_from_nights ? "Yes" : "No"}</dd>
                    <dt className="text-muted-foreground">Exempt from weekends</dt>
                    <dd>{survey.exempt_from_weekends ? "Yes" : "No"}</dd>
                    <dt className="text-muted-foreground">Exempt from on-call</dt>
                    <dd>{survey.exempt_from_oncall ? "Yes" : "No"}</dd>
                    {survey.exemption_details && (
                      <>
                        <dt className="text-muted-foreground">Exemption details</dt>
                        <dd>{survey.exemption_details}</dd>
                      </>
                    )}
                    {survey.other_restrictions && (
                      <>
                        <dt className="text-muted-foreground">Other restrictions</dt>
                        <dd>{survey.other_restrictions}</dd>
                      </>
                    )}
                    {survey.additional_restrictions && (
                      <>
                        <dt className="text-muted-foreground">Additional scheduling</dt>
                        <dd>{survey.additional_restrictions}</dd>
                      </>
                    )}
                  </dl>
                </div>

                {/* E — Preferences & Sessions (from relational tables) */}
                <div className="space-y-2 py-4">
                  <p className="text-sm font-semibold text-card-foreground">Preferences & Sessions</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Dual specialty</dt>
                    <dd>{dualSpecs.length > 0 ? `Yes (${dualSpecs.map(d => d.specialty_name).join(", ")})` : survey.dual_specialty ? `Yes${survey.dual_specialty_types?.length ? ` (${survey.dual_specialty_types.join(", ")})` : ""}` : "No"}</dd>
                    <dt className="text-muted-foreground">Specialties</dt>
                    <dd>
                      {trainingReqs.filter(r => r.category === "specialty").length > 0
                        ? trainingReqs.filter(r => r.category === "specialty").map((r: any, i: number) => (
                            <span key={i} className="block text-xs">{r.name}{r.notes ? ` — ${r.notes}` : ""}</span>
                          ))
                        : <span className="text-muted-foreground">None</span>
                      }
                    </dd>
                    <dt className="text-muted-foreground">Special sessions</dt>
                    <dd>
                      {trainingReqs.filter(r => r.category === "session").length > 0
                        ? trainingReqs.filter(r => r.category === "session").map((r: any, i: number) => (
                            <span key={i} className="block text-xs">{r.name}{r.notes ? ` — ${r.notes}` : ""}</span>
                          ))
                        : <span className="text-muted-foreground">—</span>
                      }
                    </dd>
                    <dt className="text-muted-foreground">Other interests</dt>
                    <dd>
                      {trainingReqs.filter(r => r.category === "interest").length > 0
                        ? trainingReqs.filter(r => r.category === "interest").map((r: any, i: number) => (
                            <span key={i} className="block text-xs">{r.name}{r.notes ? ` — ${r.notes}` : ""}</span>
                          ))
                        : <span className="text-muted-foreground">—</span>
                      }
                    </dd>
                    <dt className="text-muted-foreground">Sign-off needs</dt>
                    <dd>{survey.signoff_needs || <span className="text-muted-foreground">—</span>}</dd>
                    <dt className="text-muted-foreground">Additional notes</dt>
                    <dd>{survey.additional_notes || <span className="text-muted-foreground">—</span>}</dd>
                  </dl>
                </div>
              </div>
            )}

            {doctor.survey_submitted_at && (
              <p className="text-xs text-muted-foreground mt-3">
                Survey submitted: {format(parseISO(doctor.survey_submitted_at), "d MMM yyyy, HH:mm")}
              </p>
            )}
            <div className="flex justify-end pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/survey-override/${doctor.id}/1?from=/admin/doctor/${doctor.id}`)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit survey
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
