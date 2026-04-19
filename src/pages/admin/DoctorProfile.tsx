import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2,
  ArrowLeft,
  Check,
  User,
  ClipboardList,
  CalendarDays,
  ExternalLink,
  Send,
  Copy,
  Pencil,
  Trash2,
  ShieldAlert,
  Star,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_OPTIONS } from "@/lib/gradeOptions";
import { format, parseISO } from "date-fns";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildSurveyLink } from "@/lib/surveyLinks";

// ─── Types ────────────────────────────────────────────────────

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
  other_interests: any;
  want_pain_sessions: boolean | null;
  pain_session_notes: string | null;
  want_preop: boolean | null;
  signature_name: string | null;
  signature_date: string | null;
}

// ─── Small helpers ─────────────────────────────────────────────

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

function CompetencyChip({
  achieved,
  working,
  remote,
  label,
}: {
  achieved: boolean | null | undefined;
  working: boolean | null | undefined;
  remote: boolean | null | undefined;
  label: string;
}) {
  if (achieved === true) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
          ✓ {label} achieved
        </span>
        {remote === true && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">
            Remote ✓
          </span>
        )}
        {remote === false && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs font-medium">
            Remote ✗
          </span>
        )}
      </div>
    );
  }
  if (achieved === false && working === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-medium">
        ⟳ Working towards {label}
      </span>
    );
  }
  if (achieved === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium">
        ✗ {label} not achieved
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

function LeavePill({
  start,
  end,
  notes,
  location,
}: {
  start: string;
  end: string;
  notes?: string | null;
  location?: string | null;
}) {
  const fmtD = (d: string) => {
    try {
      return format(parseISO(d), "d MMM yyyy");
    } catch {
      return d;
    }
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted border border-border px-2 py-0.5 text-xs text-foreground">
      {fmtD(start)} → {fmtD(end)}
      {location ? ` · ${location}` : ""}
      {notes ? ` · ${notes}` : ""}
    </span>
  );
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Main component ────────────────────────────────────────────

export default function DoctorProfile() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { restoredConfig } = useRotaContext();
  const { accountSettings, user } = useAuth();

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
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [resetSurveyDialogOpen, setResetSurveyDialogOpen] = useState(false);
  const [resettingSurvey, setResettingSurvey] = useState(false);

  // Relational data state
  const [unavailBlocks, setUnavailBlocks] = useState<any[]>([]);
  const [ltftPats, setLtftPats] = useState<any[]>([]);
  const [trainingReqs, setTrainingReqs] = useState<any[]>([]);
  const [dualSpecs, setDualSpecs] = useState<any[]>([]);

  useEffect(() => {
    if (!doctorId) {
      setError(true);
      setLoading(false);
      return;
    }
    loadAll();
  }, [doctorId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: doc, error: docErr } = await supabase
        .from("doctors")
        .select(
          "id, first_name, last_name, email, grade, is_active, rota_config_id, survey_status, survey_submitted_at, survey_token, survey_invite_count",
        )
        .eq("id", doctorId!)
        .maybeSingle();

      if (docErr || !doc) {
        setError(true);
        setLoading(false);
        return;
      }
      setDoctor(doc);
      setFirstName(doc.first_name);
      setLastName(doc.last_name);
      setNhsEmail(doc.email ?? "");
      setGrade(doc.grade ?? "");
      setIsActive(doc.is_active);

      const [srvResult, blocksResult, ltftResult, reqsResult, dualsResult] = await Promise.all([
        supabase
          .from("doctor_survey_responses")
          .select(
            "personal_email, phone_number, wte_percent, wte_other_value, al_entitlement, ltft_days_off, ltft_night_flexibility, annual_leave, study_leave, noc_dates, other_unavailability, competencies_json, exempt_from_nights, exempt_from_weekends, exempt_from_oncall, exemption_details, other_restrictions, additional_restrictions, parental_leave_expected, parental_leave_start, parental_leave_end, parental_leave_notes, specialties_requested, special_sessions, signoff_needs, dual_specialty, dual_specialty_types, additional_notes, iac_achieved, iac_working, iac_remote, iaoc_achieved, iaoc_working, iaoc_remote, icu_achieved, icu_working, icu_remote, transfer_achieved, transfer_working, transfer_remote, other_interests, want_pain_sessions, pain_session_notes, want_preop, signature_name, signature_date",
          )
          .eq("doctor_id", doctorId!)
          .eq("rota_config_id", doc.rota_config_id)
          .maybeSingle(),
        supabase
          .from("unavailability_blocks")
          .select("*")
          .eq("doctor_id", doctorId!)
          .eq("rota_config_id", doc.rota_config_id)
          .order("start_date"),
        supabase.from("ltft_patterns").select("*").eq("doctor_id", doctorId!).eq("rota_config_id", doc.rota_config_id),
        supabase
          .from("training_requests")
          .select("*")
          .eq("doctor_id", doctorId!)
          .eq("rota_config_id", doc.rota_config_id),
        supabase
          .from("dual_specialties")
          .select("*")
          .eq("doctor_id", doctorId!)
          .eq("rota_config_id", doc.rota_config_id),
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

      setDoctor((prev) =>
        prev
          ? {
              ...prev,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: nhsEmail.trim() || null,
              grade: grade || null,
              is_active: isActive,
            }
          : prev,
      );

      setSurvey((prev) =>
        prev
          ? {
              ...prev,
              personal_email: personalEmail.trim() || null,
              phone_number: phoneNumber.trim() || null,
            }
          : prev,
      );

      setSaveState("saved");
      toast.success("Profile saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error("Profile save failed:", err);
      toast.error("Failed to save \u2014 please try again");
      setSaveState("idle");
    }
  };

  const handleSendInvite = async () => {
    if (!doctor) return;
    if (!doctor.survey_token) {
      toast.error("No survey token \u2014 cannot send invite");
      return;
    }
    if (!doctor.email) {
      toast.error("No email address on file");
      return;
    }
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
        coordinatorEmail: user?.email ?? null,
      };
      const { data, error } = await supabase.functions.invoke("send-survey-invite", { body });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? "Send failed");
      await supabase
        .from("doctors")
        .update({
          survey_invite_sent_at: new Date().toISOString(),
          survey_invite_count: (doctor.survey_invite_count ?? 0) + 1,
        })
        .eq("id", doctor.id);
      toast.success(`\u2713 Survey invite sent to ${doctor.first_name} ${doctor.last_name}`);
      loadAll();
    } catch (err: any) {
      toast.error("Failed to send invite \u2014 please try again");
      console.error(err);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResetSurvey = async () => {
    if (!doctor) return;
    setResettingSurvey(true);
    try {
      await Promise.all([
        supabase.from("unavailability_blocks").delete().eq("doctor_id", doctor.id).eq("rota_config_id", doctor.rota_config_id),
        supabase.from("ltft_patterns").delete().eq("doctor_id", doctor.id).eq("rota_config_id", doctor.rota_config_id),
        supabase.from("training_requests").delete().eq("doctor_id", doctor.id).eq("rota_config_id", doctor.rota_config_id),
        supabase.from("dual_specialties").delete().eq("doctor_id", doctor.id).eq("rota_config_id", doctor.rota_config_id),
        supabase.from("resolved_availability").delete().eq("doctor_id", doctor.id).eq("rota_config_id", doctor.rota_config_id),
      ]);
      await supabase
        .from("doctor_survey_responses")
        .update({
          status: "not_started",
          submitted_at: null,
          signature_name: null,
          signature_date: null,
          wte_percent: null,
          wte_other_value: null,
          al_entitlement: null,
          ltft_days_off: null,
          ltft_night_flexibility: null,
          annual_leave: null,
          study_leave: null,
          noc_dates: null,
          other_unavailability: null,
          competencies_json: null,
          exempt_from_nights: null,
          exempt_from_weekends: null,
          exempt_from_oncall: null,
          exemption_details: null,
          other_restrictions: null,
          additional_restrictions: null,
          parental_leave_expected: null,
          parental_leave_start: null,
          parental_leave_end: null,
          parental_leave_notes: null,
          specialties_requested: null,
          special_sessions: null,
          signoff_needs: null,
          dual_specialty: null,
          dual_specialty_types: null,
          additional_notes: null,
          other_interests: null,
          want_pain_sessions: null,
          pain_session_notes: null,
          want_preop: null,
          iac_achieved: null,
          iac_working: null,
          iac_remote: null,
          iaoc_achieved: null,
          iaoc_working: null,
          iaoc_remote: null,
          icu_achieved: null,
          icu_working: null,
          icu_remote: null,
          transfer_achieved: null,
          transfer_working: null,
          transfer_remote: null,
          updated_at: new Date().toISOString(),
        })
        .eq("doctor_id", doctor.id)
        .eq("rota_config_id", doctor.rota_config_id);
      await supabase
        .from("doctors")
        .update({ survey_status: "not_started", survey_submitted_at: null })
        .eq("id", doctor.id);
      toast.success("Survey reset — all responses cleared");
      setResetSurveyDialogOpen(false);
      loadAll();
    } catch (err) {
      console.error("Reset survey failed:", err);
      toast.error("Failed to reset survey — please try again");
    } finally {
      setResettingSurvey(false);
    }
  };

  const fmtDate = (d: string | null | undefined): string => {
    if (!d) return "\u2014";
    try {
      return format(parseISO(d), "d MMM yyyy");
    } catch {
      return d;
    }
  };

  const fmtRange = (start: string | null, end: string | null): string => {
    if (!start) return "\u2014";
    if (!end) return fmtDate(start);
    return `${fmtDate(start)} \u2192 ${fmtDate(end)}`;
  };

  // ─── Loading / error states ──────────────────────────────────

  if (loading) {
    return (
      <AdminLayout title="Doctor Profile" accentColor="teal" pageIcon={User}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !doctor) {
    return (
      <AdminLayout title="Doctor Profile" accentColor="teal" pageIcon={User}>
        <div className="mx-auto max-w-3xl space-y-4 py-10 text-center">
          <p className="text-muted-foreground">Doctor not found.</p>
          <Button variant="outline" onClick={() => navigate("/admin/roster")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Roster
          </Button>
        </div>
      </AdminLayout>
    );
  }

  // ─── Derived data for calendar summary ──────────────────────

  const unavailSummary = (["annual", "study", "noc", "rotation", "parental", "other"] as const)
    .map((reason) => {
      const blocks = unavailBlocks.filter((b) => b.reason === reason);
      const labels: Record<string, string> = {
        annual: "Annual leave",
        study: "Study leave",
        noc: "NOC",
        rotation: "Rotation",
        parental: "Parental leave",
        other: "Other",
      };
      return { reason, label: labels[reason], count: blocks.length, blocks };
    })
    .filter((s) => s.count > 0);

  const UNAVAIL_COLOURS: Record<string, string> = {
    annual: "bg-green-100 text-green-700 border-green-200",
    study: "bg-blue-100 text-blue-700 border-blue-200",
    noc: "bg-pink-100 text-pink-700 border-pink-200",
    rotation: "bg-orange-100 text-orange-700 border-orange-200",
    parental: "bg-violet-100 text-violet-700 border-violet-200",
    other: "bg-muted text-muted-foreground border-border",
  };

  // ─── Survey derived data ─────────────────────────────────────

  const isLtft = survey?.wte_percent != null && survey.wte_percent < 100;
  const effectiveWte = survey?.wte_percent === 0 ? survey?.wte_other_value : survey?.wte_percent;

  const dayOffPats = ltftPats
    .filter((p) => p.is_day_off)
    .sort(
      (a: any, b: any) =>
        DAY_ORDER.indexOf(a.day.charAt(0).toUpperCase() + a.day.slice(1)) -
        DAY_ORDER.indexOf(b.day.charAt(0).toUpperCase() + b.day.slice(1)),
    );

  const getCompetency = (key: "iac" | "iaoc" | "icu" | "transfer") => {
    const cj = survey?.competencies_json ?? {};
    return {
      achieved: (survey as any)?.[`${key}_achieved`] ?? cj[key]?.achieved ?? null,
      working: (survey as any)?.[`${key}_working`] ?? cj[key]?.workingTowards ?? null,
      remote: (survey as any)?.[`${key}_remote`] ?? cj[key]?.remoteSupervision ?? null,
    };
  };

  const specReqs = trainingReqs.filter((r) => r.category === "specialty");
  const sessionReqs = trainingReqs.filter((r) => r.category === "session");
  const interestReqs = trainingReqs.filter((r) => r.category === "interest");

  // other_interests JSONB fallback (array of {name, notes})
  const otherInterestsFallback: { name: string; notes?: string }[] = Array.isArray(survey?.other_interests)
    ? survey.other_interests
    : [];

  // ─── Render ──────────────────────────────────────────────────

  return (
    <AdminLayout
      title="Doctor Profile"
      subtitle={`${doctor.first_name} ${doctor.last_name}`}
      accentColor="teal"
      pageIcon={User}
    >
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
        {/* Back + status header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/roster")} className="text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Roster
          </Button>
          <StatusBadge status={doctor.survey_status} />
        </div>

        {/* ── SECTION 1 — Doctor Details ───────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-base">Doctor Details</CardTitle>
            </div>
            <CardDescription>Changes here update both the doctor record and their survey profile.</CardDescription>
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select grade</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-muted-foreground">Status: {doctor.is_active ? "Active" : "Inactive"}</p>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saveState === "saving"}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {saveState === "saving" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {saveState === "saved" && <Check className="mr-1.5 h-4 w-4" />}
                {saveState === "idle" ? "Save changes" : saveState === "saving" ? "Saving\u2026" : "Saved \u2713"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 2 — Availability Calendar ───────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-600" />
                <CardTitle className="text-base">Availability Calendar</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/doctor-calendar/${doctor.id}`)}
                className="gap-1.5 text-teal-600 border-teal-200 hover:bg-teal-50 shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open full calendar</span>
                <span className="sm:hidden">Open</span>
              </Button>
            </div>
            <CardDescription>Leave, unavailability, and coordinator overrides for this rota period.</CardDescription>
          </CardHeader>
          <CardContent>
            {unavailSummary.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                No unavailability blocks recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary chips */}
                <div className="flex flex-wrap gap-2">
                  {unavailSummary.map(({ reason, label, count }) => (
                    <span
                      key={reason}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${UNAVAIL_COLOURS[reason]}`}
                    >
                      {label}: {count} {count === 1 ? "block" : "blocks"}
                    </span>
                  ))}
                </div>

                {/* Block detail list */}
                <div className="divide-y divide-border rounded-lg border border-border">
                  {unavailSummary.map(({ reason, label, blocks }) => (
                    <div key={reason} className="px-3 py-2.5 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {blocks.map((b: any, i: number) => (
                          <LeavePill
                            key={i}
                            start={b.start_date}
                            end={b.end_date}
                            notes={b.notes}
                            location={b.location}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 3 — Survey Results ───────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-base">Survey Results</CardTitle>
            </div>
            <CardDescription>
              From the doctor\u2019s preference survey. Use \u201CEdit survey\u201D to make changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!survey ? (
              <div className="px-6 pb-6">
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No survey data yet \u2014 invite this doctor to complete their preferences.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* A — Working Pattern */}
                <div className="px-6 py-4 space-y-3">
                  <p className="text-sm font-semibold text-card-foreground">Working Pattern</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {effectiveWte != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200 px-3 py-0.5 text-sm font-semibold">
                        WTE {effectiveWte}%
                      </span>
                    )}
                    {isLtft ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-medium">
                        LTFT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium">
                        Full-time
                      </span>
                    )}
                    {survey.al_entitlement != null && (
                      <span className="text-sm text-muted-foreground">AL: {survey.al_entitlement} days</span>
                    )}
                  </div>

                  {isLtft && dayOffPats.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">LTFT days off &amp; night flexibility</p>
                      <div className="space-y-1">
                        {dayOffPats.map((p: any) => (
                          <div key={p.day} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium capitalize w-24 shrink-0">{p.day}</span>
                            <span className="text-xs text-muted-foreground">
                              Start nights:{" "}
                              {p.can_start_nights === true ? "✓" : p.can_start_nights === false ? "✗" : "—"}
                              {" · "}
                              End nights: {p.can_end_nights === true ? "✓" : p.can_end_nights === false ? "✗" : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* B — Competencies */}
                <div className="px-6 py-4 space-y-3">
                  <p className="text-sm font-semibold text-card-foreground">Competencies</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(["iac", "iaoc", "icu", "transfer"] as const).map((key) => {
                      const labels: Record<string, string> = {
                        iac: "IAC",
                        iaoc: "IAOC",
                        icu: "ICU",
                        transfer: "Transfer",
                      };
                      const comp = getCompetency(key);
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <p className="text-xs font-medium text-muted-foreground">{labels[key]}</p>
                          <CompetencyChip
                            achieved={comp.achieved}
                            working={comp.working}
                            remote={comp.remote}
                            label={labels[key]}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* C — Leave & Unavailability */}
                <div className="px-6 py-4 space-y-3">
                  <p className="text-sm font-semibold text-card-foreground">Leave &amp; Unavailability</p>
                  <div className="space-y-3">
                    {(["annual", "study", "noc", "rotation", "parental"] as const).map((reason) => {
                      const reasonBlocks = unavailBlocks.filter((b) => b.reason === reason);
                      const labels: Record<string, string> = {
                        annual: "Annual leave",
                        study: "Study leave",
                        noc: "NOC dates",
                        rotation: "Rotations / other",
                        parental: "Parental leave",
                      };
                      return (
                        <div key={reason}>
                          <p className="text-xs font-medium text-muted-foreground mb-1">{labels[reason]}</p>
                          {reasonBlocks.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {reasonBlocks.map((b: any, i: number) => (
                                <LeavePill
                                  key={i}
                                  start={b.start_date}
                                  end={b.end_date}
                                  notes={b.notes}
                                  location={b.location}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">None</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* D — Exemptions & Restrictions */}
                <div className="px-6 py-4 space-y-3">
                  <p className="text-sm font-semibold text-card-foreground">Exemptions &amp; Restrictions</p>

                  {/* Medical exemptions */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Medical exemptions</p>
                    {survey.exemption_details ? (
                      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">{survey.exemption_details}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">None declared</p>
                    )}
                  </div>

                  {/* Parental leave */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Parental leave during rota</p>
                    {survey.parental_leave_expected ? (
                      <div className="space-y-1">
                        <LeavePill start={survey.parental_leave_start ?? ""} end={survey.parental_leave_end ?? ""} />
                        {survey.parental_leave_notes && (
                          <p className="text-xs text-muted-foreground ml-1">{survey.parental_leave_notes}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not expected</p>
                    )}
                  </div>

                  {/* Other scheduling restrictions */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Other scheduling restrictions</p>
                    {survey.additional_restrictions ? (
                      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                        <p className="text-sm text-foreground">{survey.additional_restrictions}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">None</p>
                    )}
                  </div>
                </div>

                {/* E — Specialties & Sessions */}
                <div className="px-6 py-4 space-y-3">
                  <p className="text-sm font-semibold text-card-foreground">Specialties &amp; Sessions</p>

                  {/* Dual specialty */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Dual specialty</p>
                    {dualSpecs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {dualSpecs.map((d: any, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-0.5 text-xs font-medium"
                          >
                            {d.specialty_name}
                          </span>
                        ))}
                      </div>
                    ) : survey.dual_specialty ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(survey.dual_specialty_types ?? []).map((t: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-0.5 text-xs font-medium"
                          >
                            {t}
                          </span>
                        ))}
                        {(survey.dual_specialty_types ?? []).length === 0 && (
                          <p className="text-sm text-foreground">Yes</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No</p>
                    )}
                  </div>

                  {/* Specialty preferences */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Specialty preferences</p>
                    {specReqs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {specReqs.map((r: any, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-medium"
                          >
                            {r.name}
                            {r.notes ? ` \u2014 ${r.notes}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">None</p>
                    )}
                  </div>

                  {/* Special sessions */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Special sessions</p>
                    {sessionReqs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sessionReqs.map((r: any, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-teal-100 text-teal-700 border border-teal-200 px-2.5 py-0.5 text-xs font-medium"
                          >
                            {r.name}
                            {r.notes ? ` \u2014 ${r.notes}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : survey.special_sessions && survey.special_sessions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {survey.special_sessions.map((s: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-teal-100 text-teal-700 border border-teal-200 px-2.5 py-0.5 text-xs font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">None</p>
                    )}
                  </div>

                  {/* Other interests */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Other interests</p>
                    {interestReqs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {interestReqs.map((r: any, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium"
                          >
                            {r.name}
                            {r.notes ? ` \u2014 ${r.notes}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : otherInterestsFallback.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {otherInterestsFallback.map((r, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium"
                          >
                            {r.name}
                            {r.notes ? ` \u2014 ${r.notes}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">None</p>
                    )}
                  </div>

                  {/* Sign-off needs */}
                  {survey.signoff_needs && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Sign-off needs</p>
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <p className="text-sm text-foreground italic">{survey.signoff_needs}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* F — Additional Notes */}
                {survey.additional_notes && (
                  <div className="px-6 py-4 space-y-2">
                    <p className="text-sm font-semibold text-card-foreground">Additional Notes</p>
                    <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                      <p className="text-sm text-teal-800">{survey.additional_notes}</p>
                    </div>
                  </div>
                )}

                {/* G — Submission footer */}
                <div className="px-6 py-4 space-y-3">
                  {/* Submission timestamp + signature */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    {doctor.survey_submitted_at && (
                      <span>Submitted: {format(parseISO(doctor.survey_submitted_at), "d MMM yyyy, HH:mm")}</span>
                    )}
                    {survey.signature_name && survey.signature_date && (
                      <span>
                        Signed: {survey.signature_name} — {fmtDate(survey.signature_date)}
                      </span>
                    )}
                  </div>

                  {/* Already-submitted warning */}
                  {doctor.survey_status === "submitted" && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      This doctor has already submitted their survey. Sending a new invite allows them to edit their
                      responses.
                    </p>
                  )}

                  {/* Survey action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          onClick={handleSendInvite}
                          disabled={sendingInvite || !doctor.survey_token || !doctor.email}
                          className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                        >
                          {sendingInvite ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Send invite
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!doctor.survey_token
                          ? "No survey token available"
                          : !doctor.email
                            ? "No email on file"
                            : "Send survey invite email"}
                      </TooltipContent>
                    </Tooltip>

                    {(doctor.survey_invite_count ?? 0) > 0 && (
                      <span className="inline-flex items-center text-xs text-muted-foreground self-center">
                        Sent {doctor.survey_invite_count} {doctor.survey_invite_count === 1 ? "time" : "times"}
                      </span>
                    )}

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
                      <TooltipContent>
                        {doctor.survey_token ? "Copy survey link to clipboard" : "No survey link available"}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            doctor.survey_token && window.open(buildSurveyLink(doctor.survey_token), "_blank")
                          }
                          disabled={!doctor.survey_token}
                          className="gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {doctor.survey_token ? "Open survey in new tab" : "No survey link available"}
                      </TooltipContent>
                    </Tooltip>

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
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── DOCTOR MANAGEMENT ─────────────────────────── */}
        <div className="border-t border-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Doctor Management</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetSurveyDialogOpen(true)}
              className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Reset survey
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRemoveDialogOpen(true)}
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove doctor
            </Button>
          </div>
        </div>
      </div>

      {/* ── Remove Doctor Dialog ─────────────────────────── */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {doctor.first_name}?</DialogTitle>
            <DialogDescription>Choose how you would like to remove this doctor from the rota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              className="w-full justify-start text-sm"
              onClick={async () => {
                const { error } = await supabase.from("doctors").update({ is_active: false }).eq("id", doctor.id);
                if (error) {
                  toast.error("Failed to deactivate doctor");
                  return;
                }
                toast.success("Doctor moved to inactive");
                setRemoveDialogOpen(false);
                navigate("/admin/roster");
              }}
            >
              Move to inactive
              <span className="ml-auto text-xs text-muted-foreground font-normal">Keeps their data</span>
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start text-sm"
              onClick={async () => {
                await supabase.from("doctor_survey_responses").delete().eq("doctor_id", doctor.id);
                const { error } = await supabase.from("doctors").delete().eq("id", doctor.id);
                if (error) {
                  toast.error("Failed to delete doctor");
                  return;
                }
                toast("Doctor permanently deleted");
                setRemoveDialogOpen(false);
                navigate("/admin/roster");
              }}
            >
              Delete permanently
              <span className="ml-auto text-xs text-red-200 font-normal">Cannot be undone</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Survey Dialog ──────────────────────────── */}
      <Dialog open={resetSurveyDialogOpen} onOpenChange={setResetSurveyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset {doctor.first_name}'s survey?</DialogTitle>
            <DialogDescription>
              This will permanently delete all survey responses, leave blocks, LTFT patterns, training requests, and availability overrides for this rota period. The doctor will need to complete their survey again. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setResetSurveyDialogOpen(false)} disabled={resettingSurvey}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetSurvey}
              disabled={resettingSurvey}
              className="gap-1.5"
            >
              {resettingSurvey && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Yes, reset survey
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
