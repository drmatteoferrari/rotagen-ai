import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Copy, Trash2, UserPlus, Send, Users, Pencil, CalendarIcon, Loader2, Check, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, ArrowUpDown, Search,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildSurveyLink } from "@/lib/surveyLinks";
import { useDoctorsQuery, useInactiveDoctorsQuery, useRotaConfigDetailsQuery, useInvalidateQuery } from "@/hooks/useAdminQueries";
import { GRADE_OPTIONS, GRADE_ORDER } from "@/lib/gradeOptions";

interface Doctor {
  id: string;
  rota_config_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  grade: string | null;
  survey_status: string;
  survey_invite_sent_at: string | null;
  survey_invite_count: number;
  survey_token: string | null;
  survey_submitted_at: string | null;
  is_active: boolean;
}

// ── Expanded panel component ──
function ExpandedDoctorPanel({
  doctor,
  surveyData,
  isLoading,
  invitedAt,
  onNavigateProfile,
}: {
  doctor: Doctor;
  surveyData: any;
  isLoading: boolean;
  invitedAt: string | null;
  onNavigateProfile: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const wte = surveyData?.wte_percent ?? null;

  // Prefer flat competency bools, fallback to JSONB
  const flatKey = (k: string, suffix: string) => surveyData?.[`${k}_${suffix}`] as boolean | null | undefined;
  const cj = surveyData?.competencies_json ?? {};
  const ltftDays: string[] = surveyData?.ltft_days_off ?? [];
  const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedDays = [...ltftDays].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

  const displayGrade = surveyData?.grade || doctor.grade || "—";
  const displayEmail = surveyData?.nhs_email || doctor.email || "—";
  const displayPhone = surveyData?.phone_number || "—";

  return (
    <div className="space-y-3">
      {/* Contact & Identity — always shown */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Grade</span>
        <span className="font-medium">{displayGrade}</span>
        <span className="text-muted-foreground">Email</span>
        <span className="font-medium truncate">{displayEmail}</span>
        {displayPhone !== "—" && (
          <>
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{displayPhone}</span>
          </>
        )}
      </div>

      {/* Working pattern — only if survey data exists */}
      {surveyData && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">WTE</span>
          <span className="font-medium">{wte !== null ? `${wte}%` : "—"}</span>
          {sortedDays.length > 0 && (
            <>
              <span className="text-muted-foreground">Days off</span>
              <span className="font-medium">{sortedDays.join(", ")}</span>
            </>
          )}
        </div>
      )}

      {/* Competencies — only if survey data exists */}
      {surveyData && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Competencies</p>
          <div className="flex flex-wrap gap-1.5">
            {(["iac", "iaoc", "icu", "transfer"] as const).map((key) => {
              const achieved = flatKey(key, "achieved") ?? cj[key]?.achieved ?? null;
              const workingTowards = flatKey(key, "working") ?? cj[key]?.workingTowards ?? null;
              const colour = achieved === true
                ? "bg-emerald-100 text-emerald-700"
                : workingTowards === true
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700";
              return (
                <span key={key} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${colour}`}>
                  {key.toUpperCase()} {achieved === true ? "✓" : "✗"}{workingTowards === true ? " – working towards" : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {invitedAt && (
        <p className="text-[10px] text-muted-foreground">
          Last invited: {format(parseISO(invitedAt), "d MMM yyyy, HH:mm")}
        </p>
      )}

      {/* Teal profile button */}
      <button
        type="button"
        onClick={onNavigateProfile}
        className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
      >
        See full profile →
      </button>
    </div>
  );
}

export default function Roster() {
  const navigate = useNavigate();
  const { currentRotaConfigId, restoredConfig } = useRotaContext();
  const { accountSettings } = useAuth();
  const { invalidateDoctors, invalidateInactiveDoctors, invalidateRotaConfigDetails } = useInvalidateQuery();

  // Local form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Cached doctors from React Query
  const { data: doctorsData, isLoading: queryLoading, refetch: refetchDoctors } = useDoctorsQuery();
  const loading = !!currentRotaConfigId && queryLoading;
  const doctors = (doctorsData as Doctor[]) ?? [];

  // Inactive doctors
  const { data: inactiveDoctorsData } = useInactiveDoctorsQuery();
  const inactiveDoctors = (inactiveDoctorsData as Doctor[]) ?? [];

  // Empty state: no rota config
  if (!currentRotaConfigId) {
    return (
      <AdminLayout title="Team Roster" accentColor="blue">
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">No rota configuration found. Please complete setup first.</p>
          <Button variant="outline" onClick={() => navigate("/admin/setup")}>Go to Setup</Button>
        </div>
      </AdminLayout>
    );
  }
  const [inactiveSectionOpen, setInactiveSectionOpen] = useState(false);

  // Cached deadline from React Query
  const { data: configDetails } = useRotaConfigDetailsQuery();

  // Deadline picker state
  const [surveyDeadline, setSurveyDeadline] = useState<Date | undefined>(undefined);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineInitialized, setDeadlineInitialized] = useState(false);

  // Sync deadline from cached query
  useEffect(() => {
    if (configDetails?.survey_deadline && !deadlineInitialized) {
      const [y, m, d] = configDetails.survey_deadline.split("-").map(Number);
      setSurveyDeadline(new Date(y, m - 1, d));
      setDeadlineInitialized(true);
    }
  }, [configDetails, deadlineInitialized]);

  // Send state per doctor
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [popoverId, setPopoverId] = useState<string | null>(null);

  // Copy tooltip state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Expand / survey cache / sort / bulk state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [surveyCache, setSurveyCache] = useState<Record<string, any>>({});
  const [surveyLoading, setSurveyLoading] = useState<Record<string, boolean>>({});
  type SortKey = "surname_asc" | "surname_desc" | "status" | "grade";
  const [sortKey, setSortKey] = useState<SortKey>("surname_asc");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkPopoverOpen, setBulkPopoverOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Inactive section state
  const [inactiveExpandedIds, setInactiveExpandedIds] = useState<Set<string>>(new Set());
  const [reactivatePopoverId, setReactivatePopoverId] = useState<string | null>(null);

  // Delete/Deactivate state
  const [removeDialogId, setRemoveDialogId] = useState<string | null>(null);

  // Read from accountSettings context
  const departmentName = accountSettings.departmentName ?? "";
  const hospitalName = accountSettings.trustName ?? "";

  // ─── Reload doctors (invalidate cache) ───
  const loadDoctors = useCallback(async () => {
    invalidateDoctors();
  }, [invalidateDoctors]);

  // ─── Backfill null survey tokens ───
  const backfillRan = useRef(false);
  useEffect(() => {
    if (backfillRan.current) return;
    const nullTokenDoctors = doctors.filter((d) => !d.survey_token);
    if (nullTokenDoctors.length === 0) return;
    backfillRan.current = true;
    (async () => {
      for (const d of nullTokenDoctors) {
        await supabase
          .from("doctors")
          .update({ survey_token: crypto.randomUUID() })
          .eq("id", d.id);
      }
      invalidateDoctors();
    })();
  }, [doctors]);

  // ─── Realtime subscription for survey status ───
  useEffect(() => {
    if (!currentRotaConfigId) return;
    const channel = supabase
      .channel(`doctors-roster-${currentRotaConfigId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "doctors",
          filter: `rota_config_id=eq.${currentRotaConfigId}`,
        },
        () => {
          invalidateDoctors();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRotaConfigId]);

  // ─── Add doctor to DB ───
  const addDoctor = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in first name, last name, and email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!currentRotaConfigId) {
      toast.error("No active rota config — please complete setup first");
      return;
    }
    const { error } = await supabase.from("doctors").insert({
      rota_config_id: currentRotaConfigId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      grade: null,
      survey_status: "not_started",
      survey_token: crypto.randomUUID(),
    });
    if (error) { toast.error("Failed to add doctor"); console.error(error); return; }
    setFirstName(""); setLastName(""); setEmail("");
    toast.success(`${firstName.trim()} ${lastName.trim()} added to the roster`);
    loadDoctors();
  };

  // ─── Remove doctor from DB (permanent delete) ───
  const removeDoctor = async (id: string) => {
    await supabase.from("doctor_survey_responses").delete().eq("doctor_id", id);
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) { toast.error("Failed to remove doctor"); return; }
    invalidateDoctors();
    toast("Doctor permanently deleted");
    setRemoveDialogId(null);
  };

  // ─── Deactivate doctor (move to inactive) ───
  const deactivateDoctor = async (id: string) => {
    const { error } = await supabase
      .from("doctors")
      .update({ is_active: false })
      .eq("id", id);
    if (error) { toast.error("Failed to deactivate doctor"); return; }
    invalidateDoctors();
    invalidateInactiveDoctors();
    toast("Doctor moved to inactive");
    setRemoveDialogId(null);
  };

  // Save deadline to DB on change
  const handleDeadlineSelect = async (date: Date | undefined) => {
    setSurveyDeadline(date);
    setDeadlineOpen(false);
    if (!currentRotaConfigId || !date) return;
    const { error } = await supabase
      .from("rota_configs")
      .update({ survey_deadline: format(date, "yyyy-MM-dd") })
      .eq("id", currentRotaConfigId);
    if (error) { toast.error("Failed to save deadline"); console.error(error); }
  };

  // Formatted deadline for email
  const formattedDeadline = surveyDeadline
    ? format(surveyDeadline, "EEEE, d MMMM yyyy")
    : null;

  // ─── Send invite core — all guards and DB/edge logic ───
  const sendInviteCore = async (doctor: Doctor): Promise<void> => {
    if (!doctor.survey_token) {
      toast.error("No survey link available for this doctor — token missing");
      return;
    }
    if (!doctor.email) {
      toast.error("No email address on file for this doctor");
      return;
    }
    if (!departmentName || !hospitalName) {
      toast.error("Please set your department and hospital name on the Dashboard before sending invites.");
      return;
    }
    if (!formattedDeadline) {
      toast.error("Set a survey deadline first.");
      return;
    }

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
      surveyDeadline: formattedDeadline,
      surveyLink,
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

    toast.success(`✓ Survey invite sent to ${doctor.first_name} ${doctor.last_name}`);
  };

  const sendInvite = async (doctor: Doctor) => {
    setPopoverId(null);
    setSendingId(doctor.id);
    try {
      await sendInviteCore(doctor);
      setSuccessId(doctor.id);
      setTimeout(() => setSuccessId(null), 3000);
      loadDoctors();
    } catch (err: any) {
      console.error("Send invite error:", err);
      const msg = err?.message?.includes("FunctionsFetchError") || err?.message?.includes("fetch")
        ? "Could not reach email service — check your connection and try again"
        : `Failed to send invite to ${doctor.first_name} ${doctor.last_name} — please try again`;
      toast.error(msg);
    } finally {
      setSendingId(null);
    }
  };

  const copyMagicLink = (doctor: Doctor) => {
    if (!doctor.survey_token) { toast.error("No survey token available"); return; }
    const link = buildSurveyLink(doctor.survey_token);
    navigator.clipboard.writeText(link);
    setCopiedId(doctor.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Toggle expand and lazy-load survey data ───
  const toggleExpand = async (doctorId: string) => {
    const isCurrentlyExpanded = expandedIds.has(doctorId);

    if (!isCurrentlyExpanded && !surveyCache[doctorId]) {
      setSurveyLoading((prev) => ({ ...prev, [doctorId]: true }));
    }

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(doctorId)) {
        next.delete(doctorId);
      } else {
        next.add(doctorId);
      }
      return next;
    });

    if (!isCurrentlyExpanded && !surveyCache[doctorId]) {
      const doctor = [...doctors, ...inactiveDoctors].find((d) => d.id === doctorId);
      if (doctor) {
        const { data } = await supabase
          .from("doctor_survey_responses")
          .select("wte_percent, ltft_days_off, competencies_json, grade, nhs_email, phone_number, iac_achieved, iac_working, iac_remote, iaoc_achieved, iaoc_working, iaoc_remote, icu_achieved, icu_working, icu_remote, transfer_achieved, transfer_working, transfer_remote")
          .eq("doctor_id", doctorId)
          .eq("rota_config_id", doctor.rota_config_id)
          .maybeSingle();
        setSurveyCache((prev) => ({ ...prev, [doctorId]: data ?? null }));
      }
      setSurveyLoading((prev) => ({ ...prev, [doctorId]: false }));
    }
  };

  // ─── Bulk send handler ───
  const handleBulkSend = async () => {
    const eligible = doctors.filter(
      (d) => !d.survey_invite_sent_at && d.email && d.survey_status !== "submitted"
    );
    if (eligible.length === 0) {
      setBulkPopoverOpen(false);
      return;
    }
    setBulkPopoverOpen(false);
    setBulkSending(true);
    let successCount = 0;
    for (const doctor of eligible) {
      try {
        await sendInviteCore(doctor);
        successCount++;
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        // individual failures already toasted inside sendInviteCore
      }
    }
    setBulkSending(false);
    invalidateDoctors();
    if (successCount > 0) {
      toast.success(`✓ Sent invites to ${successCount} doctor${successCount > 1 ? "s" : ""}`);
    }
  };


  // Survey status counts
  const submitted = doctors.filter((d) => d.survey_status === "submitted").length;
  const inProgress = doctors.filter((d) => d.survey_status === "in_progress").length;
  const notStarted = doctors.filter((d) => !["submitted", "in_progress"].includes(d.survey_status)).length;
  const progressPct = doctors.length > 0 ? Math.round((submitted / doctors.length) * 100) : 0;

  // Search + Sort
  const STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, submitted: 2 };
  const filteredDoctors = searchQuery.trim()
    ? doctors.filter((d) => {
        const q = searchQuery.toLowerCase();
        return (
          d.first_name.toLowerCase().includes(q) ||
          d.last_name.toLowerCase().includes(q) ||
          `${d.last_name} ${d.first_name}`.toLowerCase().includes(q)
        );
      })
    : doctors;

  const sortedDoctors = [...filteredDoctors].sort((a, b) => {
    switch (sortKey) {
      case "surname_asc":
        return a.last_name.localeCompare(b.last_name);
      case "surname_desc":
        return b.last_name.localeCompare(a.last_name);
      case "status":
        return (STATUS_ORDER[a.survey_status ?? "not_started"] ?? 0) -
               (STATUS_ORDER[b.survey_status ?? "not_started"] ?? 0);
      case "grade":
        return (GRADE_ORDER[a.grade ?? ""] ?? 99) - (GRADE_ORDER[b.grade ?? ""] ?? 99);
      default:
        return 0;
    }
  });

  const deadlineIsPast = surveyDeadline
    ? (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dl = new Date(surveyDeadline); dl.setHours(0, 0, 0, 0);
        return dl < today;
      })()
    : false;

  // Status badge
  const statusBadge = (doctor: Doctor) => {
    switch (doctor.survey_status) {
      case "submitted":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">✅ Submitted</Badge>
            </TooltipTrigger>
            {doctor.survey_submitted_at && (
              <TooltipContent>{format(parseISO(doctor.survey_submitted_at), "d MMM yyyy, HH:mm")}</TooltipContent>
            )}
          </Tooltip>
        );
      case "in_progress":
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">✏️ In progress</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted">○ Not started</Badge>;
    }
  };

  // Determine send icon state
  const getSendIconState = (doctor: Doctor): {
    disabled: boolean;
    tooltip: string;
    color: string;
    badge: string | null;
  } => {
    if (!surveyDeadline) {
      return { disabled: true, tooltip: "Set a survey deadline above before sending invites", color: "text-muted-foreground", badge: null };
    }
    if (!doctor.email) {
      return { disabled: true, tooltip: "No email address on file — add email to enable", color: "text-muted-foreground", badge: null };
    }
    if (doctor.survey_invite_sent_at) {
      const sentDate = format(parseISO(doctor.survey_invite_sent_at), "d MMM yyyy, HH:mm");
      return {
        disabled: false,
        tooltip: `Invite sent ${sentDate}. Click to resend.`,
        color: "text-emerald-600",
        badge: doctor.survey_invite_count > 1 ? `×${doctor.survey_invite_count}` : null,
      };
    }
    return { disabled: false, tooltip: "Send survey invite", color: "", badge: null };
  };

  const renderSendButton = (
    doctor: Doctor,
    sendState: ReturnType<typeof getSendIconState>,
    isSending: boolean,
    isSuccess: boolean,
    view: string
  ) => {
    if (isSending) return <Button variant="ghost" size="icon" disabled className="h-8 w-8"><Loader2 className="h-4 w-4 animate-spin" /></Button>;
    if (isSuccess) return <Button variant="ghost" size="icon" disabled className="h-8 w-8"><Check className="h-4 w-4 text-emerald-600" /></Button>;
    if (sendState.disabled) return (
      <Tooltip><TooltipTrigger asChild><span><Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground"><Send className="h-4 w-4" /></Button></span></TooltipTrigger><TooltipContent>{sendState.tooltip}</TooltipContent></Tooltip>
    );

    const popoverKey = `${doctor.id}:${view}`;

    return (
      <Popover open={popoverId === popoverKey} onOpenChange={(open) => setPopoverId(open ? popoverKey : null)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("relative h-8 w-8", sendState.color)} title={sendState.tooltip}>
            <Send className="h-4 w-4" />
            {sendState.badge && <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-1">{sendState.badge}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 pointer-events-auto" align="end" side="bottom" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="space-y-3">
            <p className="text-sm font-medium">Send invite to {doctor.first_name} {doctor.last_name}?</p>
            {formattedDeadline && <p className="text-xs text-muted-foreground">Deadline: {formattedDeadline}</p>}
            {doctor.survey_status === "submitted" && (
              <p className="text-xs text-amber-600">
                This doctor has already submitted. Resending allows them to edit their responses.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPopoverId(null)}>Cancel</Button>
              <Button size="sm" onClick={() => sendInvite(doctor)}>Send</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderCopyButton = (doctor: Doctor, isCopied: boolean) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyMagicLink(doctor)}>
          {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isCopied ? "Copied!" : doctor.survey_token ? buildSurveyLink(doctor.survey_token) : "No token"}</TooltipContent>
    </Tooltip>
  );

  // DEV TOOLS — state for loading
  const [fillingAll, setFillingAll] = useState(false);
  const [cancellingAll, setCancellingAll] = useState(false);

  // Helper functions for realistic data generation
  const juniorGrades = ['CT1', 'CT2', 'ACCS CT1', 'ACCS CT2'];
  const midGrades = ['CT3', 'ACCS CT3', 'ST4', 'ST5'];
  const seniorGrades = ['ST6', 'ST7', 'ST8', 'ST9', 'SAS', 'Post-CCT Fellow', 'Consultant'];

  const isJunior = (g: string) => juniorGrades.some(x => g.includes(x));
  const isMid = (g: string) => midGrades.some(x => g.includes(x));
  const isSenior = (g: string) => seniorGrades.some(x => g.includes(x));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  const randomLeaveBlock = (rotaStart: string, rotaEnd: string, lengthDays: number) => {
    const start = new Date(rotaStart).getTime();
    const end = new Date(rotaEnd).getTime();
    const blockMs = lengthDays * 86400000;
    const maxOffset = Math.max(1, end - start - blockMs);
    const offset = Math.floor(Math.random() * maxOffset);
    const s = new Date(start + offset);
    const e = new Date(start + offset + blockMs);
    return {
      id: crypto.randomUUID(),
      startDate: s.toISOString().split('T')[0],
      endDate: e.toISOString().split('T')[0],
      reason: "",
    };
  };

  const buildSurveyPayload = (
    doctor: { id: string; first_name: string; last_name: string; email: string | null; grade: string | null },
    rotaConfigId: string,
    rotaStart: string,
    rotaEnd: string
  ) => {
    const GRADE_POOL = ['CT1 (or ACCS)', 'CT2 (or ACCS)', 'CT3 (or ACCS)', 'ST4', 'ST5', 'ST6', 'ST7', 'SAS', 'Post-CCT Fellow', 'Consultant'];
    const grade = (doctor.grade && doctor.grade !== '—') ? doctor.grade : GRADE_POOL[Math.floor(Math.random() * GRADE_POOL.length)];

    const wteRoll = Math.random();
    const wte = wteRoll < 0.10 ? 60 : wteRoll < 0.40 ? 80 : 100;
    const isLtft = wte < 100;

    const isCT1    = (g: string) => g.includes('CT1') && !g.includes('CT2') && !g.includes('CT3');
    const isCT2up  = (g: string) => ['CT2','CT3','ST4','ST5','ST6','ST7','ST8','ST9','SAS','Fellow','Consultant'].some(x => g.includes(x));
    const isCT3up  = (g: string) => ['CT3','ST4','ST5','ST6','ST7','ST8','ST9','SAS','Fellow','Consultant'].some(x => g.includes(x));
    const isSeniorLocal = (g: string) => ['ST6','ST7','ST8','ST9','SAS','Fellow','Consultant'].some(x => g.includes(x));

    const iacAchieved      = isCT2up(grade);
    const iaocAchieved     = isCT3up(grade);
    const icuAchieved      = isCT3up(grade);
    const transferAchieved = isCT3up(grade);

    const competencies_json = {
      iac: {
        achieved: iacAchieved,
        workingTowards: iacAchieved ? null : (isCT1(grade) ? Math.random() < 0.7 : false),
        remoteSupervision: iacAchieved ? Math.random() < 0.7 : null,
      },
      iaoc: {
        achieved: iaocAchieved,
        workingTowards: iaocAchieved ? null : Math.random() < 0.5,
        remoteSupervision: iaocAchieved ? Math.random() < 0.7 : null,
      },
      icu: {
        achieved: icuAchieved,
        workingTowards: icuAchieved ? null : Math.random() < 0.4,
        remoteSupervision: icuAchieved ? Math.random() < 0.6 : null,
      },
      transfer: {
        achieved: transferAchieved,
        workingTowards: transferAchieved ? null : Math.random() < 0.4,
        remoteSupervision: transferAchieved ? Math.random() < 0.6 : null,
      },
    };

    const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const shuffledDays = [...WEEKDAYS].sort(() => Math.random() - 0.5);
    const ltft_days_off: string[] = isLtft
      ? (wte === 80 ? [shuffledDays[0]] : [shuffledDays[0], shuffledDays[1]])
      : [];
    const ltft_night_flexibility = ltft_days_off.map(day => ({
      day,
      canStart: Math.random() < 0.8,
      canEnd:   Math.random() < 0.8,
    }));

    const rotaStartMs  = new Date(rotaStart).getTime();
    const rotaEndMs    = new Date(rotaEnd).getTime();
    const rotaWeeks    = (rotaEndMs - rotaStartMs) / (7 * 86400000);
    const effectiveWte = isLtft ? wte : 100;
    const al_entitlement = Math.random() < 0.5 ? 27 : 32;
    const proRataAL    = Math.max(1, Math.round((rotaWeeks / 52) * al_entitlement * (effectiveWte / 100)));

    const booked: { start: number; end: number }[] = [];
    const hasOverlap = (sMs: number, eMs: number): boolean =>
      booked.some(r => sMs < r.end && eMs > r.start);
    const registerBlock = (sMs: number, eMs: number) =>
      booked.push({ start: sMs, end: eMs });

    const placeBlock = (lengthDays: number, maxAttempts = 60): { id: string; startDate: string; endDate: string; reason: string } | null => {
      const blockMs  = lengthDays * 86400000;
      const maxStart = rotaEndMs - blockMs;
      if (maxStart <= rotaStartMs) return null;
      const window   = maxStart - rotaStartMs;
      for (let i = 0; i < maxAttempts; i++) {
        const sMs = rotaStartMs + Math.floor(Math.random() * window);
        const eMs = sMs + blockMs;
        if (!hasOverlap(sMs, eMs)) {
          registerBlock(sMs, eMs);
          return {
            id:        crypto.randomUUID(),
            startDate: new Date(sMs).toISOString().split('T')[0],
            endDate:   new Date(eMs - 86400000).toISOString().split('T')[0],
            reason:    '',
          };
        }
      }
      return null;
    };

    const numALBlocks  = rand(2, 5);
    const annual_leave: { id: string; startDate: string; endDate: string; reason: string }[] = [];
    let alBudget = proRataAL;
    for (let i = 0; i < numALBlocks && alBudget > 0; i++) {
      const remaining  = numALBlocks - i - 1;
      const maxLen     = Math.min(5, alBudget - remaining);
      const blockLen   = maxLen <= 1 ? 1 : rand(1, maxLen);
      const entry      = placeBlock(blockLen);
      if (entry) { annual_leave.push(entry); alBudget -= blockLen; }
    }

    const numSLBlocks = rand(2, 4);
    const slReasons   = ['FRCA Primary', 'FRCA Final', 'ALS Course', 'ATLS Course', 'Conference', 'Exam', 'Teaching'];
    const study_leave: { id: string; startDate: string; endDate: string; reason: string }[] = [];
    let slBudget = rand(3, 10);
    for (let i = 0; i < numSLBlocks && slBudget > 0; i++) {
      const remaining = numSLBlocks - i - 1;
      const maxLen    = Math.min(3, slBudget - remaining);
      const blockLen  = maxLen <= 1 ? 1 : rand(1, maxLen);
      const entry     = placeBlock(blockLen);
      if (entry) { study_leave.push({ ...entry, reason: pick(slReasons) }); slBudget -= blockLen; }
    }

    const numNOCBlocks = rand(2, 5);
    const noc_dates: { id: string; startDate: string; endDate: string; reason: string }[] = [];
    let nocBudget = rand(5, 15);
    for (let i = 0; i < numNOCBlocks && nocBudget > 0; i++) {
      const remaining = numNOCBlocks - i - 1;
      const maxLen    = Math.min(5, nocBudget - remaining);
      const blockLen  = maxLen <= 1 ? 1 : rand(1, maxLen);
      const entry     = placeBlock(blockLen);
      if (entry) { noc_dates.push(entry); nocBudget -= blockLen; }
    }

    const other_unavailability: { id: string; startDate: string; endDate: string; location: string }[] = [];
    if (Math.random() < 0.2) {
      const maxOffsetDays = Math.max(0, Math.floor((rotaEndMs - rotaStartMs) / 86400000) - 14);
      for (let attempt = 0; attempt < 60; attempt++) {
        const offsetDays = Math.floor(Math.random() * maxOffsetDays);
        const candidate  = new Date(rotaStartMs + offsetDays * 86400000);
        const dow        = candidate.getDay();
        const toMonday   = dow === 1 ? 0 : (8 - dow) % 7 || 7;
        const monMs      = candidate.getTime() + toMonday * 86400000;
        const sunMs      = monMs + 13 * 86400000;
        if (sunMs + 86400000 <= rotaEndMs && !hasOverlap(monMs, sunMs + 86400000)) {
          registerBlock(monMs, sunMs + 86400000);
          other_unavailability.push({
            id:        crypto.randomUUID(),
            startDate: new Date(monMs).toISOString().split('T')[0],
            endDate:   new Date(sunMs).toISOString().split('T')[0],
            location:  pick(['Royal Liverpool Hospital', 'Aintree University Hospital', 'Arrowe Park Hospital', 'Warrington Hospital', 'Countess of Chester Hospital']),
          });
          break;
        }
      }
    }

    const exempt_from_nights   = Math.random() < 0.04;
    const exempt_from_weekends = Math.random() < 0.03;
    const exemption_details    = exempt_from_nights
      ? 'Exempt from night shifts — Occupational Health recommendation.'
      : exempt_from_weekends
        ? 'Exempt from weekend shifts — Occupational Health recommendation.'
        : '';

    const ALL_SPECIALTIES = [
      'Paediatric', 'Obstetric', 'Cardiothoracic', 'Neuro', 'Vascular',
      'T&O and regional anaesthesia', 'ENT and maxillofacial', 'Ophthalmology',
      'Plastics and reconstructive', 'Gynaecology', 'Urology', 'Hepatobiliary',
      'Breast surgery', 'Remote anaesthesia (MRI, radiology, cardioversions)',
    ];
    const specialties_requested = [...ALL_SPECIALTIES]
      .sort(() => Math.random() - 0.5)
      .slice(0, rand(3, 6))
      .map(name => ({ name, notes: '' }));

    const signoff_needs = Math.random() < 0.5
      ? pick([
          '10 T&O cases for regional anaesthesia sign-off',
          '5 obstetric epidurals',
          'Fibreoptic intubation sign-off — need 3 supervised cases',
          'Cardiac anaesthesia level 1 sign-off',
          'Neuroanaesthesia introductory sign-off',
          'Paediatric anaesthesia — 10 cases under 5 years',
        ])
      : '';

    const special_sessions: string[] = isSeniorLocal(grade) && Math.random() < 0.3
      ? [pick(['Pain medicine', 'Pre-op clinics'])]
      : [];

    return {
      doctor_id:                     doctor.id,
      rota_config_id:                rotaConfigId,
      full_name:                     `${doctor.first_name} ${doctor.last_name}`,
      nhs_email:                     doctor.email ?? `${doctor.first_name.toLowerCase()}.${doctor.last_name.toLowerCase()}@nhs.net`,
      personal_email:                null,
      phone_number:                  `07${Math.floor(700000000 + Math.random() * 299999999)}`,
      grade,
      dual_specialty:                false,
      dual_specialty_types:          [] as string[],
      competencies_json,
      comp_ip_anaesthesia:           false,
      comp_ip_anaesthesia_here:      false,
      comp_obstetric:                false,
      comp_obstetric_here:           false,
      comp_icu:                      false,
      comp_icu_here:                 false,
      wte_percent:                   wte,
      wte_other_value:               null,
      ltft_days_off,
      ltft_night_flexibility,
      al_entitlement,
      annual_leave,
      study_leave,
      noc_dates,
      other_unavailability,
      exempt_from_nights,
      exempt_from_weekends,
      exempt_from_oncall:            false,
      specific_days_off:             [] as string[],
      exemption_details,
      other_restrictions:            '',
      additional_restrictions:       '',
      parental_leave_expected:       false,
      parental_leave_start:          null,
      parental_leave_end:            null,
      parental_leave_notes:          '',
      preferred_shift_types:         [] as string[],
      preferred_days_off:            [] as string[],
      dates_to_avoid:                [] as string[],
      other_requests:                null,
      specialties_requested,
      special_sessions,
      want_pain_sessions:            special_sessions.includes('Pain medicine'),
      pain_session_notes:            null,
      want_preop:                    special_sessions.includes('Pre-op clinics'),
      signoff_needs,
      signoff_requirements:          null,
      additional_notes:              '',
      confirmed_accurate:            true,
      confirm_algorithm_understood:  true,
      confirm_exemptions_understood: true,
      confirm_fairness_understood:   true,
      signature_name:                `${doctor.first_name} ${doctor.last_name}`,
      signature_date:                new Date().toISOString().split('T')[0],
      status:                        'submitted',
      submitted_at:                  new Date().toISOString(),
      last_saved_at:                 new Date().toISOString(),
    };
  };

  const handleFillAllSurveys = async () => {
    const rotaConfigId = currentRotaConfigId;
    if (!rotaConfigId) {
      toast.error('No active rota config');
      return;
    }

    setFillingAll(true);

    try {
      const { data: rotaConfig, error: rotaError } = await supabase
        .from('rota_configs')
        .select('rota_start_date, rota_end_date')
        .eq('id', rotaConfigId)
        .single();

      if (rotaError) {
        console.error('Supabase rota_configs error:', rotaError);
        throw rotaError;
      }

      const rotaStart = rotaConfig.rota_start_date ??
        new Date().toISOString().split('T')[0];
      const rotaEnd = rotaConfig.rota_end_date ??
        new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

      const { data: doctorsList, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, first_name, last_name, email, grade')
        .eq('rota_config_id', rotaConfigId);

      if (doctorsError) {
        console.error('Supabase doctors error:', doctorsError);
        throw doctorsError;
      }

      if (!doctorsList || doctorsList.length === 0) {
        toast.error('No doctors found in roster');
        return;
      }

      for (const doctor of doctorsList) {
        const payload = buildSurveyPayload(doctor, rotaConfigId, rotaStart, rotaEnd);

        const { error: upsertError } = await supabase
          .from('doctor_survey_responses')
          .upsert(payload, { onConflict: 'doctor_id,rota_config_id' });

        if (upsertError) {
          console.error(`Survey upsert failed for ${doctor.id}:`, upsertError);
          throw upsertError;
        }

        const { error: statusError } = await supabase
          .from('doctors')
          .update({
            survey_status: 'submitted',
            survey_submitted_at: new Date().toISOString(),
            grade: payload.grade,
          })
          .eq('id', doctor.id);

        if (statusError) {
          console.error(`Status update failed for ${doctor.id}:`, statusError);
          throw statusError;
        }
      }

      const plCandidates = [...doctorsList].sort(() => Math.random() - 0.5).slice(0, 2);
      for (const plDoctor of plCandidates) {
        const { data: existing } = await supabase
          .from('doctor_survey_responses')
          .select('annual_leave, study_leave, noc_dates, other_unavailability')
          .eq('doctor_id', plDoctor.id)
          .eq('rota_config_id', rotaConfigId)
          .single();

        const takenMs: { start: number; end: number }[] = [];
        const addTaken = (arr: { startDate: string; endDate: string }[] | null) => {
          if (!arr) return;
          for (const e of arr) {
            if (e.startDate && e.endDate) {
              takenMs.push({
                start: new Date(e.startDate).getTime(),
                end:   new Date(e.endDate).getTime() + 86400000,
              });
            }
          }
        };
        if (existing) {
          addTaken(existing.annual_leave as any);
          addTaken(existing.study_leave as any);
          addTaken(existing.noc_dates as any);
          addTaken(existing.other_unavailability as any);
        }

        const plOverlaps = (sMs: number, eMs: number) =>
          takenMs.some(r => sMs < r.end && eMs > r.start);

        const rotaStartMs2 = new Date(rotaStart).getTime();
        const rotaEndMs2   = new Date(rotaEnd).getTime();
        const maxOffset    = Math.max(0, Math.floor((rotaEndMs2 - rotaStartMs2) / 86400000) - 14);
        for (let attempt = 0; attempt < 60; attempt++) {
          const offsetDays = Math.floor(Math.random() * maxOffset);
          const candidate  = new Date(rotaStartMs2 + offsetDays * 86400000);
          const dow        = candidate.getDay();
          const toMonday   = dow === 1 ? 0 : (8 - dow) % 7 || 7;
          const plStartMs  = candidate.getTime() + toMonday * 86400000;
          const plEndMs    = plStartMs + 13 * 86400000;
          if (plEndMs + 86400000 <= rotaEndMs2 && !plOverlaps(plStartMs, plEndMs + 86400000)) {
            await supabase
              .from('doctor_survey_responses')
              .update({
                parental_leave_expected: true,
                parental_leave_start:    new Date(plStartMs).toISOString().split('T')[0],
                parental_leave_end:      new Date(plEndMs).toISOString().split('T')[0],
                parental_leave_notes:    'Parental leave — dates confirmed with HR.',
              })
              .eq('doctor_id', plDoctor.id)
              .eq('rota_config_id', rotaConfigId);
            break;
          }
        }
      }

      await loadDoctors();
      toast.success(`✅ ${doctorsList.length} surveys filled with test data`);

    } catch (err) {
      console.error('handleFillAllSurveys failed:', err);
      toast.error(`Failed to fill surveys: ${String(err)}`);
    } finally {
      setFillingAll(false);
    }
  };

  const handleCancelAllSurveys = async () => {
    const rotaConfigId = currentRotaConfigId;
    if (!rotaConfigId) {
      toast.error('No active rota config');
      return;
    }

    setCancellingAll(true);

    try {
      const { error: deleteError } = await supabase
        .from('doctor_survey_responses')
        .delete()
        .eq('rota_config_id', rotaConfigId);

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw deleteError;
      }

      const { error: resetError } = await supabase
        .from('doctors')
        .update({
          survey_status: 'not_started',
          survey_submitted_at: null,
          survey_invite_sent_at: null,
          survey_invite_count: 0,
        })
        .eq('rota_config_id', rotaConfigId);

      if (resetError) {
        console.error('Supabase reset error:', resetError);
        throw resetError;
      }

      await loadDoctors();
      toast.success('All surveys cancelled and reset');

    } catch (err) {
      console.error('handleCancelAllSurveys failed:', err);
      toast.error(`Failed to cancel surveys: ${String(err)}`);
    } finally {
      setCancellingAll(false);
    }
  };

  return (
    <AdminLayout title="Team Roster" subtitle="Manage doctors and track survey completion" accentColor="blue">
      <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">

        {/* No config banner */}
        {!currentRotaConfigId && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">No active rota config</p>
              <p className="text-xs text-amber-700">Complete setup before managing the roster.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/admin/setup")} className="shrink-0">
              Go to Setup
            </Button>
          </div>
        )}

        {/* DEV TOOLS Banner */}
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-medium text-amber-800">⚙️ DEV TOOLS — not visible in production</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleFillAllSurveys}
              disabled={fillingAll || cancellingAll}
            >
              {fillingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              🧪 Fill All Surveys
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="bg-rose-500 hover:bg-rose-600"
              onClick={handleCancelAllSurveys}
              disabled={fillingAll || cancellingAll}
            >
              {cancellingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              🗑️ Cancel All Surveys
            </Button>
          </div>
        </div>

        {/* Deadline picker */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-sm sm:text-base font-semibold text-card-foreground">Survey deadline</span>
              </div>
              <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[280px] justify-start text-left font-normal",
                      !surveyDeadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formattedDeadline ?? "Select deadline date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={surveyDeadline}
                    onSelect={handleDeadlineSelect}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {deadlineIsPast && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Deadline passed
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Roster with integrated summary */}
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Team Roster</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Add doctors and track survey progress.</CardDescription>
              </div>
              {/* Inline summary stats + progress */}
              <div className="w-full sm:w-auto space-y-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                      <Users className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-card-foreground">{doctors.length}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-card-foreground">{submitted}</p>
                      <p className="text-[10px] text-muted-foreground">Submitted</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/10">
                      <Pencil className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-card-foreground">{inProgress}</p>
                      <p className="text-[10px] text-muted-foreground">In progress</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-card-foreground">{notStarted}</p>
                      <p className="text-[10px] text-muted-foreground">Not started</p>
                    </div>
                  </div>
                </div>
                {doctors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Survey completion</span>
                      <span className="text-[10px] font-semibold text-card-foreground">{progressPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Quick add row */}
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDoctor(); }} className="sm:flex-1" />
                <Input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDoctor(); }} className="sm:flex-1" />
              </div>
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDoctor(); }} className="sm:flex-[2]" />
              <Button onClick={addDoctor} disabled={!firstName || !lastName || !email} className="w-full sm:w-auto">
                <UserPlus className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </div>

            {/* Bulk send button */}
            {(() => {
              const neverInvited = doctors.filter(
                (d) => !d.survey_invite_sent_at && d.email && d.survey_status !== "submitted"
              );
              if (neverInvited.length === 0 || !surveyDeadline) return null;
              const label =
                neverInvited.length === doctors.length
                  ? `Send invites to all ${doctors.length} doctors`
                  : `Send invites to ${neverInvited.length} doctor${neverInvited.length > 1 ? "s" : ""} not yet invited`;
              return (
                <div className="flex justify-end">
                  <Popover open={bulkPopoverOpen} onOpenChange={setBulkPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" disabled={bulkSending} className="gap-1.5">
                        {bulkSending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Send className="h-3.5 w-3.5" />}
                        {bulkSending ? "Sending…" : label}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 pointer-events-auto" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Send invites to {neverInvited.length} doctor{neverInvited.length > 1 ? "s" : ""}?</p>
                        <p className="text-xs text-muted-foreground">Each doctor will receive an email with their personalised survey link.</p>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setBulkPopoverOpen(false)}>Cancel</Button>
                          <Button size="sm" onClick={handleBulkSend}>Send all</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })()}

            {/* Search input */}
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs h-8 text-sm"
              />
            </div>

            {/* Sort controls */}
            {doctors.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="sm:hidden flex-1">
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="surname_asc">Sort: A–Z</option>
                    <option value="surname_desc">Sort: Z–A</option>
                    <option value="status">Sort: Status</option>
                    <option value="grade">Sort: Grade</option>
                  </select>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" /> Sort:
                  </span>
                  {(["surname_asc", "surname_desc", "status", "grade"] as const).map((key) => {
                    const labels: Record<SortKey, string> = {
                      surname_asc: "A–Z",
                      surname_desc: "Z–A",
                      status: "Status",
                      grade: "Grade",
                    };
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSortKey(key)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                          sortKey === key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {labels[key]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unified doctor list */}
            <div className="space-y-0 divide-y divide-border rounded-lg border border-border overflow-hidden">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!loading && sortedDoctors.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No doctors added yet.</p>
              )}
              {sortedDoctors.map((doctor) => {
                const isExpanded = expandedIds.has(doctor.id);
                const sendState = getSendIconState(doctor);
                const isSending = sendingId === doctor.id;
                const isSuccess = successId === doctor.id;
                const isCopied = copiedId === doctor.id;

                return (
                  <div key={doctor.id} className="bg-card">
                    <div className="px-3 py-2 sm:px-4">
                      {/* Row 1 — always visible on all breakpoints */}
                      <div className="flex items-center gap-2">
                        {/* Chevron */}
                        <button type="button" onClick={() => toggleExpand(doctor.id)} className="shrink-0 p-0.5">
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                        {/* Name — flex-1, always visible, clicking also toggles */}
                        <button type="button" onClick={() => toggleExpand(doctor.id)} className="flex-1 min-w-0 text-left">
                          <span className="text-sm font-medium truncate block">{doctor.last_name}, {doctor.first_name}</span>
                        </button>
                        {/* Grade pill — sm+ only */}
                        <span className="hidden sm:block text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                          {doctor.grade || "\u2014"}
                        </span>
                        {/* Email — lg+ only */}
                        <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[160px] shrink-0">
                          {doctor.email ?? "No email"}
                        </span>
                        {/* Status badge — icon-only circle on mobile, full badge on sm+ */}
                        <div className="shrink-0">
                          <span className="sm:hidden">
                            {doctor.survey_status === "submitted" && (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100">
                                <Check className="h-3 w-3 text-emerald-600" />
                              </span>
                            )}
                            {doctor.survey_status === "in_progress" && (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-100">
                                <Pencil className="h-3 w-3 text-amber-600" />
                              </span>
                            )}
                            {(!doctor.survey_status || doctor.survey_status === "not_started") && (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                              </span>
                            )}
                          </span>
                          <span className="hidden sm:block">{statusBadge(doctor)}</span>
                        </div>
                        {/* Action icons — hidden on mobile (shown in row 2), visible sm+ */}
                        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                          {renderSendButton(doctor, sendState, isSending, isSuccess, "unified")}
                          {renderCopyButton(doctor, isCopied)}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => doctor.survey_token && window.open(buildSurveyLink(doctor.survey_token), "_blank")} disabled={!doctor.survey_token}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{doctor.survey_token ? "Open survey in new tab" : "No survey link"}</TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/survey-override/${doctor.id}/1?from=/admin/roster`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Popover open={removeDialogId === doctor.id} onOpenChange={(open) => setRemoveDialogId(open ? doctor.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 pointer-events-auto" align="end" side="bottom" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Remove {doctor.first_name}?</p>
                                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => deactivateDoctor(doctor.id)}>
                                  Move to inactive
                                </Button>
                                <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => removeDoctor(doctor.id)}>
                                  Delete permanently
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {/* Row 2 — mobile only: all 5 action icons */}
                      <div className="flex sm:hidden items-center justify-end gap-0.5 pt-1 pb-0.5">
                        {renderSendButton(doctor, sendState, isSending, isSuccess, "unified")}
                        {renderCopyButton(doctor, isCopied)}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => doctor.survey_token && window.open(buildSurveyLink(doctor.survey_token), "_blank")} disabled={!doctor.survey_token}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/survey-override/${doctor.id}/1?from=/admin/roster`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Popover open={removeDialogId === doctor.id} onOpenChange={(open) => setRemoveDialogId(open ? doctor.id : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-52 pointer-events-auto" align="end" side="bottom" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Remove {doctor.first_name}?</p>
                              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => deactivateDoctor(doctor.id)}>
                                Move to inactive
                              </Button>
                              <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => removeDoctor(doctor.id)}>
                                Delete permanently
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/30 px-3 py-3 sm:px-4">
                        <ExpandedDoctorPanel
                          doctor={doctor}
                          surveyData={surveyCache[doctor.id]}
                          isLoading={surveyLoading[doctor.id] ?? false}
                          invitedAt={doctor.survey_invite_sent_at}
                          onNavigateProfile={() => navigate(`/admin/doctor/${doctor.id}`)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Inactive doctors section */}
        {inactiveDoctors.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setInactiveSectionOpen(v => !v)}
            >
              Inactive / Previous Period Doctors ({inactiveDoctors.length})
              <ChevronDown className={`h-4 w-4 transition-transform ${inactiveSectionOpen ? 'rotate-180' : ''}`} />
            </button>
            {inactiveSectionOpen && (
              <div className="divide-y divide-border border-t border-border">
                {inactiveDoctors.map((doctor) => {
                  const isExpanded = inactiveExpandedIds.has(doctor.id);
                  const isCopied = copiedId === doctor.id;
                  return (
                    <div key={doctor.id} className="bg-card">
                      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                        {/* Chevron + name — clicking toggles expand */}
                        <button
                          type="button"
                          onClick={async () => {
                            const isCurrentlyExpanded = inactiveExpandedIds.has(doctor.id);
                            if (!isCurrentlyExpanded && !surveyCache[doctor.id]) {
                              setSurveyLoading((prev) => ({ ...prev, [doctor.id]: true }));
                              const found = [...doctors, ...inactiveDoctors].find((d) => d.id === doctor.id);
                              if (found) {
                                const { data } = await supabase
                                  .from("doctor_survey_responses")
                                  .select("wte_percent, ltft_days_off, competencies_json, grade, nhs_email, phone_number")
                                  .eq("doctor_id", doctor.id)
                                  .eq("rota_config_id", found.rota_config_id)
                                  .maybeSingle();
                                setSurveyCache((prev) => ({ ...prev, [doctor.id]: data ?? null }));
                              }
                              setSurveyLoading((prev) => ({ ...prev, [doctor.id]: false }));
                            }
                            setInactiveExpandedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(doctor.id)) { next.delete(doctor.id); } else { next.add(doctor.id); }
                              return next;
                            });
                          }}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                        >
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          <span className="text-sm font-medium truncate">{doctor.last_name}, {doctor.first_name}</span>
                        </button>
                        {/* Grade — sm+ only */}
                        <span className="hidden sm:block text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                          {doctor.grade || "\u2014"}
                        </span>
                        {/* Profile + Copy — sm+ only */}
                        <span className="hidden sm:flex items-center gap-0.5 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/doctor/${doctor.id}`)}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View full profile</TooltipContent>
                          </Tooltip>
                          {renderCopyButton(doctor, isCopied)}
                        </span>
                        {/* Reactivate — always visible */}
                        <Popover
                          open={reactivatePopoverId === doctor.id}
                          onOpenChange={(open) => { if (!open) setReactivatePopoverId(null); }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2 shrink-0"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { data: existingSurvey } = await supabase
                                  .from("doctor_survey_responses")
                                  .select("id")
                                  .eq("doctor_id", doctor.id)
                                  .eq("rota_config_id", doctor.rota_config_id)
                                  .maybeSingle();
                                if (!existingSurvey) {
                                  await supabase.from("doctors").update({ is_active: true }).eq("id", doctor.id);
                                  toast.success("Doctor reactivated");
                                  invalidateDoctors();
                                  invalidateInactiveDoctors();
                                } else {
                                  setReactivatePopoverId(doctor.id);
                                }
                              }}
                            >
                              Reactivate
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 pointer-events-auto" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Reactivate {doctor.first_name} {doctor.last_name}?</p>
                              <p className="text-xs text-muted-foreground">Previous survey data found. How would you like to proceed?</p>
                              <div className="flex flex-col gap-2">
                                <Button size="sm" onClick={async () => {
                                  await supabase.from("doctors").update({ is_active: true }).eq("id", doctor.id);
                                  toast.success("Doctor reactivated with previous survey data");
                                  setReactivatePopoverId(null);
                                  invalidateDoctors();
                                  invalidateInactiveDoctors();
                                }}>
                                  Restore previous survey
                                </Button>
                                <Button variant="outline" size="sm" onClick={async () => {
                                  await supabase.from("doctor_survey_responses").delete().eq("doctor_id", doctor.id);
                                  await supabase.from("doctors").update({
                                    is_active: true,
                                    survey_status: "not_started",
                                    survey_submitted_at: null,
                                    survey_invite_sent_at: null,
                                    survey_invite_count: 0,
                                  }).eq("id", doctor.id);
                                  setReactivatePopoverId(null);
                                  invalidateDoctors();
                                  invalidateInactiveDoctors();
                                  toast.success("Doctor reactivated \u2014 survey reset");
                                }}>
                                  Start fresh (clears survey)
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {/* Expanded panel */}
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/30 px-3 py-3 sm:px-4">
                          <ExpandedDoctorPanel
                            doctor={doctor}
                            surveyData={surveyCache[doctor.id]}
                            isLoading={surveyLoading[doctor.id] ?? false}
                            invitedAt={doctor.survey_invite_sent_at}
                            onNavigateProfile={() => navigate(`/admin/doctor/${doctor.id}`)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </AdminLayout>
  );
}
