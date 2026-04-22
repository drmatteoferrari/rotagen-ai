import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  Trash2,
  UserPlus,
  Send,
  Users,
  Pencil,
  CalendarIcon,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ListFilter,
  Search,
  CircleDashed,
  MoreVertical,
  CalendarDays,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildSurveyLink } from "@/lib/surveyLinks";
import {
  useDoctorsQuery,
  useInactiveDoctorsQuery,
  useRotaConfigDetailsQuery,
  useInvalidateQuery,
} from "@/hooks/useAdminQueries";
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

/** Display helper — SURNAME in full caps, Firstname in sentence case */
const formatDoctorName = (first: string, last: string): string => {
  const surname = last.toUpperCase();
  const givenName = first
    .split(" ")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
  return `${surname}, ${givenName}`;
};

// ── Expanded panel component ──
function ExpandedDoctorPanel({
  doctor,
  surveyData,
  isLoading,
  invitedAt,
  onNavigateProfile,
  onNavigateCalendar,
}: {
  doctor: Doctor;
  surveyData: any;
  isLoading: boolean;
  invitedAt: string | null;
  onNavigateProfile: () => void;
  onNavigateCalendar: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!surveyData) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-sm">
          <span className="text-muted-foreground">Grade</span>
          <span className="font-medium text-foreground">{doctor.grade || "—"}</span>
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium text-foreground truncate">{doctor.email || "—"}</span>
        </div>
        <p className="text-xs text-muted-foreground italic mt-2">
          Survey not yet started — no preference data available.
        </p>
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact & Identity — always shown */}
        <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[90px_1fr] gap-x-2 gap-y-1.5 text-sm">
          <span className="text-muted-foreground">Grade</span>
          <span className="font-medium text-foreground truncate">{displayGrade}</span>
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium text-foreground truncate">{displayEmail}</span>
          {displayPhone !== "—" && (
            <>
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium text-foreground truncate">{displayPhone}</span>
            </>
          )}
        </div>

        {/* Working pattern — only if survey data exists */}
        {surveyData && (
          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[90px_1fr] gap-x-2 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">WTE</span>
            <span className="font-medium text-foreground truncate">{wte !== null ? `${wte}%` : "—"}</span>
            {sortedDays.length > 0 && (
              <>
                <span className="text-muted-foreground">Days off</span>
                <span className="font-medium text-foreground truncate">{sortedDays.join(", ")}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Competencies — only if survey data exists */}
      {surveyData && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Competencies</p>
          <div className="flex flex-wrap gap-1.5">
            {(["iac", "iaoc", "icu", "transfer"] as const).map((key) => {
              const achieved = flatKey(key, "achieved") ?? cj[key]?.achieved ?? null;
              const workingTowards = flatKey(key, "working") ?? cj[key]?.workingTowards ?? null;
              const colour =
                achieved === true
                  ? "bg-emerald-100 text-emerald-700"
                  : workingTowards === true
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700";
              return (
                <span
                  key={key}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${colour}`}
                >
                  {key === "transfer" ? "TR" : key.toUpperCase()} {achieved === true ? "✓" : "✗"}
                  {workingTowards === true ? " – working towards" : ""}
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

      {/* Navigation Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onNavigateProfile}
          className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 transition-colors"
        >
          <User className="h-4 w-4" /> Profile
        </button>
        <button
          type="button"
          onClick={onNavigateCalendar}
          className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 transition-colors"
        >
          <CalendarDays className="h-4 w-4" /> Calendar
        </button>
      </div>
    </div>
  );
}

export default function Roster() {
  const navigate = useNavigate();
  const { currentRotaConfigId, restoredConfig } = useRotaContext();
  const { accountSettings, user } = useAuth();
  const { invalidateDoctors, invalidateInactiveDoctors, invalidateRotaConfigDetails } = useInvalidateQuery();

  // Add Doctor modal state
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addGrade, setAddGrade] = useState("");
  const [addPhone, setAddPhone] = useState("");

  // Cached doctors from React Query
  const { data: doctorsData, isLoading: loading, refetch: refetchDoctors } = useDoctorsQuery();
  const doctors = (doctorsData as Doctor[]) ?? [];

  // Inactive doctors
  const { data: inactiveDoctorsData } = useInactiveDoctorsQuery();
  const inactiveDoctors = (inactiveDoctorsData as Doctor[]) ?? [];
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

  // Dialog states for generic actions
  const [doctorToSend, setDoctorToSend] = useState<Doctor | null>(null);
  const [doctorToRemove, setDoctorToRemove] = useState<Doctor | null>(null);

  // Copy tooltip state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Expand / survey cache / sort / bulk state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [surveyCache, setSurveyCache] = useState<Record<string, any>>({});
  const [surveyLoading, setSurveyLoading] = useState<Record<string, boolean>>({});
  type SortKey = "surname_asc" | "surname_desc" | "status" | "grade";
  const [sortKey, setSortKey] = useState<SortKey>("surname_asc");
  const [bulkSending, setBulkSending] = useState(false);

  // Smart send modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  type SendMode = "never_invited" | "not_started" | "in_progress";
  const [sendMode, setSendMode] = useState<SendMode>("never_invited");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Inactive section state
  const [inactiveExpandedIds, setInactiveExpandedIds] = useState<Set<string>>(new Set());
  const [reactivatePopoverId, setReactivatePopoverId] = useState<string | null>(null);

  // Read from accountSettings context
  const departmentName = accountSettings.departmentName ?? "";
  const hospitalName = accountSettings.trustName ?? "";

  // ─── Reload doctors (invalidate cache) ───
  const loadDoctors = useCallback(async () => {
    invalidateDoctors();
  }, [invalidateDoctors]);

  // ─── Auto-fetch Survey Data for all doctors upfront ───
  useEffect(() => {
    if (!currentRotaConfigId) return;

    const fetchAllSurveys = async () => {
      const { data, error } = await supabase
        .from("doctor_survey_responses")
        .select(
          "doctor_id, wte_percent, ltft_days_off, competencies_json, grade, nhs_email, phone_number, iac_achieved, iac_working, iac_remote, iaoc_achieved, iaoc_working, iaoc_remote, icu_achieved, icu_working, icu_remote, transfer_achieved, transfer_working, transfer_remote",
        )
        .eq("rota_config_id", currentRotaConfigId);

      if (data) {
        const newCache: Record<string, any> = {};
        data.forEach((row) => {
          newCache[row.doctor_id] = row;
        });
        setSurveyCache((prev) => ({ ...prev, ...newCache }));
      }
    };

    fetchAllSurveys();
  }, [currentRotaConfigId, doctorsData, inactiveDoctorsData]);

  // ─── Backfill null survey tokens ───
  const backfillRan = useRef(false);
  useEffect(() => {
    if (backfillRan.current) return;
    const nullTokenDoctors = doctors.filter((d) => !d.survey_token);
    if (nullTokenDoctors.length === 0) return;
    backfillRan.current = true;
    (async () => {
      for (const d of nullTokenDoctors) {
        await supabase.from("doctors").update({ survey_token: crypto.randomUUID() }).eq("id", d.id);
      }
      invalidateDoctors();
    })();
  }, [doctors]);

  // ─── Add doctor to DB ───
  const addDoctor = async () => {
    if (!addFirstName.trim() || !addLastName.trim() || !addEmail.trim()) {
      toast.error("Please fill in first name, last name, and email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!currentRotaConfigId) {
      toast.error("No active rota config — please complete setup first");
      return;
    }
    const { error } = await supabase.from("doctors").insert({
      rota_config_id: currentRotaConfigId,
      first_name: addFirstName.trim(),
      last_name: addLastName.trim(),
      email: addEmail.trim(),
      grade: addGrade.trim() || null,
      survey_status: "not_started",
      survey_token: crypto.randomUUID(),
    });
    if (error) {
      toast.error("Failed to add doctor");
      console.error(error);
      return;
    }

    setAddFirstName("");
    setAddLastName("");
    setAddEmail("");
    setAddGrade("");
    setAddPhone("");
    setIsAddDoctorOpen(false);
    toast.success(`${addFirstName.trim()} ${addLastName.trim()} added to the roster`);
    loadDoctors();
  };

  // ─── Remove doctor from DB (permanent delete) ───
  const removeDoctor = async (id: string) => {
    await supabase.from("doctor_survey_responses").delete().eq("doctor_id", id);
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove doctor");
      return;
    }
    invalidateDoctors();
    toast.success("Doctor permanently deleted");
    setDoctorToRemove(null);
  };

  // ─── Deactivate doctor (move to inactive) ───
  const deactivateDoctor = async (id: string) => {
    const { error } = await supabase.from("doctors").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error("Failed to deactivate doctor");
      return;
    }
    invalidateDoctors();
    invalidateInactiveDoctors();
    toast.success("Doctor moved to inactive");
    setDoctorToRemove(null);
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
    if (error) {
      toast.error("Failed to save deadline");
      console.error(error);
    }
  };

  // Formatted deadline for email
  const formattedDeadline = surveyDeadline ? format(surveyDeadline, "EEEE, d MMMM yyyy") : null;

  // ─── Send invite core — all guards and DB/edge logic ───
  const sendInviteCore = async (doctor: Doctor, isReminder = false): Promise<void> => {
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
      isReminder,
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

    toast.success(`✓ Survey invite sent to ${doctor.first_name} ${doctor.last_name}`);
  };

  const sendInvite = async (doctor: Doctor) => {
    try {
      await sendInviteCore(doctor);
      loadDoctors();
    } catch (err: any) {
      console.error("Send invite error:", err);
      const msg =
        err?.message?.includes("FunctionsFetchError") || err?.message?.includes("fetch")
          ? "Could not reach email service — check your connection and try again"
          : `Failed to send invite to ${doctor.first_name} ${doctor.last_name} — please try again`;
      toast.error(msg);
    }
  };

  const copyMagicLink = (doctor: Doctor) => {
    if (!doctor.survey_token) {
      toast.error("No survey token available");
      return;
    }
    const link = buildSurveyLink(doctor.survey_token);
    navigator.clipboard.writeText(link);
    setCopiedId(doctor.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Survey link copied to clipboard");
  };

  // ─── Toggle expand for Mobile/Tablet ───
  const toggleExpand = async (doctorId: string) => {
    const isCurrentlyExpanded = expandedIds.has(doctorId);

    if (isCurrentlyExpanded) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(doctorId);
        return next;
      });
      return;
    }

    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(doctorId);
      return next;
    });
  };

  // ─── Bulk send handler ───
  const handleBulkSend = async (mode: SendMode) => {
    const eligible = getSendModeRecipients(mode);
    if (eligible.length === 0) return;
    setSendModalOpen(false);
    setBulkSending(true);
    let successCount = 0;
    for (const doctor of eligible) {
      try {
        await sendInviteCore(doctor, mode === "in_progress");
        successCount++;
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        // individual failures already toasted inside sendInviteCore
      }
    }
    setBulkSending(false);
    invalidateDoctors();
    if (successCount > 0) {
      toast.success(`✓ Sent to ${successCount} doctor${successCount > 1 ? "s" : ""}`);
    }
  };

  // Survey status counts
  const submitted = doctors.filter((d) => d.survey_status === "submitted").length;
  const inProgress = doctors.filter((d) => d.survey_status === "in_progress").length;
  const notStarted = doctors.filter((d) => !["submitted", "in_progress"].includes(d.survey_status)).length;
  const progressPct = doctors.length > 0 ? Math.round((submitted / doctors.length) * 100) : 0;

  const noEmailCount = doctors.filter(
    (d) => !d.email && d.survey_status !== "submitted"
  ).length;

  const getSendModeRecipients = (mode: SendMode): Doctor[] => {
    switch (mode) {
      case "never_invited":
        return doctors.filter(
          (d) => !d.survey_invite_sent_at && d.email && d.survey_status !== "submitted"
        );
      case "not_started":
        return doctors.filter(
          (d) =>
            d.survey_status !== "submitted" &&
            d.survey_status !== "in_progress" &&
            d.email
        );
      case "in_progress":
        return doctors.filter(
          (d) => d.survey_status === "in_progress" && d.email
        );
    }
  };

  const sendModeRecipients = getSendModeRecipients(sendMode);

  const actionableDoctors = doctors.filter(
    (d) => d.survey_status !== "submitted" && d.email
  );

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
        return (
          (STATUS_ORDER[a.survey_status ?? "not_started"] ?? 0) - (STATUS_ORDER[b.survey_status ?? "not_started"] ?? 0)
        );
      case "grade":
        return (GRADE_ORDER[a.grade ?? ""] ?? 99) - (GRADE_ORDER[b.grade ?? ""] ?? 99);
      default:
        return 0;
    }
  });

  const deadlineIsPast = surveyDeadline
    ? (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dl = new Date(surveyDeadline);
        dl.setHours(0, 0, 0, 0);
        return dl < today;
      })()
    : false;

  // Determine send icon state
  const getSendIconState = (doctor: Doctor): { disabled: boolean; tooltip: string } => {
    if (!surveyDeadline) {
      return { disabled: true, tooltip: "Set a survey deadline above before sending invites" };
    }
    if (!doctor.email) {
      return { disabled: true, tooltip: "No email address on file — add email to enable" };
    }
    return { disabled: false, tooltip: "" };
  };

  const renderDoctorMenu = (doctor: Doctor) => {
    const sendState = getSendIconState(doctor);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 pointer-events-auto">
          <DropdownMenuItem disabled={sendState.disabled} onClick={() => setDoctorToSend(doctor)}>
            <Send className="mr-2 h-4 w-4" /> {doctor.survey_invite_sent_at ? "Resend survey" : "Send survey"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyMagicLink(doctor)}>
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!doctor.survey_token}
            onClick={() => doctor.survey_token && window.open(buildSurveyLink(doctor.survey_token), "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Open survey
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/survey-override/${doctor.id}/1?from=/admin/roster`)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit survey
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-teal-600 focus:bg-teal-50 focus:text-teal-700 font-medium cursor-pointer"
            onClick={() => navigate(`/admin/doctor/${doctor.id}`)}
          >
            <User className="mr-2 h-4 w-4" /> Go to profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-teal-600 focus:bg-teal-50 focus:text-teal-700 font-medium cursor-pointer"
            onClick={() => navigate(`/admin/doctor-calendar/${doctor.id}`)}
          >
            <CalendarDays className="mr-2 h-4 w-4" /> Go to calendar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:bg-red-50 focus:text-red-700 font-medium cursor-pointer"
            onClick={() => setDoctorToRemove(doctor)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remove doctor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // DEV TOOLS — state for loading
  const [fillingAll, setFillingAll] = useState(false);
  const [cancellingAll, setCancellingAll] = useState(false);

  // Helper functions for realistic data generation
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const buildSurveyPayload = (
    doctor: { id: string; first_name: string; last_name: string; email: string | null; grade: string | null },
    rotaConfigId: string,
    rotaStart: string,
    rotaEnd: string,
  ) => {
    const GRADE_POOL = [
      "CT1 (or ACCS)",
      "CT2 (or ACCS)",
      "CT3 (or ACCS)",
      "ST4",
      "ST5",
      "ST6",
      "ST7",
      "SAS",
      "Post-CCT Fellow",
      "Consultant",
    ];
    const grade =
      doctor.grade && doctor.grade !== "—" ? doctor.grade : GRADE_POOL[Math.floor(Math.random() * GRADE_POOL.length)];

    const wteRoll = Math.random();
    const wte = wteRoll < 0.1 ? 60 : wteRoll < 0.4 ? 80 : 100;
    const isLtft = wte < 100;

    const isCT1 = (g: string) => g.includes("CT1") && !g.includes("CT2") && !g.includes("CT3");
    const isCT2up = (g: string) =>
      ["CT2", "CT3", "ST4", "ST5", "ST6", "ST7", "ST8", "ST9", "SAS", "Fellow", "Consultant"].some((x) =>
        g.includes(x),
      );
    const isCT3up = (g: string) =>
      ["CT3", "ST4", "ST5", "ST6", "ST7", "ST8", "ST9", "SAS", "Fellow", "Consultant"].some((x) => g.includes(x));
    const isSeniorLocal = (g: string) =>
      ["ST6", "ST7", "ST8", "ST9", "SAS", "Fellow", "Consultant"].some((x) => g.includes(x));

    const iacAchieved = isCT2up(grade);
    const iaocAchieved = isCT3up(grade);
    const icuAchieved = isCT3up(grade);
    const transferAchieved = isCT3up(grade);

    const competencies_json = {
      iac: {
        achieved: iacAchieved,
        workingTowards: iacAchieved ? null : isCT1(grade) ? Math.random() < 0.7 : false,
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

    const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const shuffledDays = [...WEEKDAYS].sort(() => Math.random() - 0.5);
    const ltft_days_off: string[] = isLtft ? (wte === 80 ? [shuffledDays[0]] : [shuffledDays[0], shuffledDays[1]]) : [];
    const ltft_night_flexibility = ltft_days_off.map((day) => ({
      day,
      canStart: Math.random() < 0.8,
      canEnd: Math.random() < 0.8,
    }));

    const rotaStartMs = new Date(rotaStart).getTime();
    const rotaEndMs = new Date(rotaEnd).getTime();
    const rotaWeeks = (rotaEndMs - rotaStartMs) / (7 * 86400000);
    const effectiveWte = isLtft ? wte : 100;
    const al_entitlement = Math.random() < 0.5 ? 27 : 32;
    const proRataAL = Math.max(1, Math.round((rotaWeeks / 52) * al_entitlement * (effectiveWte / 100)));

    const booked: { start: number; end: number }[] = [];
    const hasOverlap = (sMs: number, eMs: number): boolean => booked.some((r) => sMs < r.end && eMs > r.start);
    const registerBlock = (sMs: number, eMs: number) => booked.push({ start: sMs, end: eMs });

    const placeBlock = (
      lengthDays: number,
      maxAttempts = 60,
    ): { id: string; startDate: string; endDate: string; reason: string } | null => {
      const blockMs = lengthDays * 86400000;
      const maxStart = rotaEndMs - blockMs;
      if (maxStart <= rotaStartMs) return null;
      const window = maxStart - rotaStartMs;
      for (let i = 0; i < maxAttempts; i++) {
        const sMs = rotaStartMs + Math.floor(Math.random() * window);
        const eMs = sMs + blockMs;
        if (!hasOverlap(sMs, eMs)) {
          registerBlock(sMs, eMs);
          return {
            id: crypto.randomUUID(),
            startDate: new Date(sMs).toISOString().split("T")[0],
            endDate: new Date(eMs - 86400000).toISOString().split("T")[0],
            reason: "",
          };
        }
      }
      return null;
    };

    const numALBlocks = rand(2, 5);
    const annual_leave: { id: string; startDate: string; endDate: string; reason: string }[] = [];
    let alBudget = proRataAL;
    for (let i = 0; i < numALBlocks && alBudget > 0; i++) {
      const remaining = numALBlocks - i - 1;
      const maxLen = Math.min(5, alBudget - remaining);
      const blockLen = maxLen <= 1 ? 1 : rand(1, maxLen);
      const entry = placeBlock(blockLen);
      if (entry) {
        annual_leave.push(entry);
        alBudget -= blockLen;
      }
    }

    const numSLBlocks = rand(2, 4);
    const slReasons = ["FRCA Primary", "FRCA Final", "ALS Course", "ATLS Course", "Conference", "Exam", "Teaching"];
    const study_leave: { id: string; startDate: string; endDate: string; reason: string }[] = [];
    let slBudget = rand(3, 10);
    for (let i = 0; i < numSLBlocks && slBudget > 0; i++) {
      const remaining = numSLBlocks - i - 1;
      const maxLen = Math.min(3, slBudget - remaining);
      const blockLen = maxLen <= 1 ? 1 : rand(1, maxLen);
      const entry = placeBlock(blockLen);
      if (entry) {
        study_leave.push({ ...entry, reason: pick(slReasons) });
        slBudget -= blockLen;
      }
    }

    const numNOCBlocks = rand(2, 5);
    const noc_dates: { id: string; startDate: string; endDate: string; reason: string }[] = [];
    let nocBudget = rand(5, 15);
    for (let i = 0; i < numNOCBlocks && nocBudget > 0; i++) {
      const remaining = numNOCBlocks - i - 1;
      const maxLen = Math.min(5, nocBudget - remaining);
      const blockLen = maxLen <= 1 ? 1 : rand(1, maxLen);
      const entry = placeBlock(blockLen);
      if (entry) {
        noc_dates.push(entry);
        nocBudget -= blockLen;
      }
    }

    const other_unavailability: { id: string; startDate: string; endDate: string; location: string }[] = [];
    if (Math.random() < 0.2) {
      const maxOffsetDays = Math.max(0, Math.floor((rotaEndMs - rotaStartMs) / 86400000) - 14);
      for (let attempt = 0; attempt < 60; attempt++) {
        const offsetDays = Math.floor(Math.random() * maxOffsetDays);
        const candidate = new Date(rotaStartMs + offsetDays * 86400000);
        const dow = candidate.getDay();
        const toMonday = dow === 1 ? 0 : (8 - dow) % 7 || 7;
        const monMs = candidate.getTime() + toMonday * 86400000;
        const sunMs = monMs + 13 * 86400000;
        if (sunMs + 86400000 <= rotaEndMs && !hasOverlap(monMs, sunMs + 86400000)) {
          registerBlock(monMs, sunMs + 86400000);
          other_unavailability.push({
            id: crypto.randomUUID(),
            startDate: new Date(monMs).toISOString().split("T")[0],
            endDate: new Date(sunMs).toISOString().split("T")[0],
            location: pick([
              "Royal Liverpool Hospital",
              "Aintree University Hospital",
              "Arrowe Park Hospital",
              "Warrington Hospital",
              "Countess of Chester Hospital",
            ]),
          });
          break;
        }
      }
    }

    const exempt_from_nights = Math.random() < 0.04;
    const exempt_from_weekends = Math.random() < 0.03;
    const exemption_details = exempt_from_nights
      ? "Exempt from night shifts — Occupational Health recommendation."
      : exempt_from_weekends
        ? "Exempt from weekend shifts — Occupational Health recommendation."
        : "";

    const ALL_SPECIALTIES = [
      "Paediatric",
      "Obstetric",
      "Cardiothoracic",
      "Neuro",
      "Vascular",
      "T&O and regional anaesthesia",
      "ENT and maxillofacial",
      "Ophthalmology",
      "Plastics and reconstructive",
      "Gynaecology",
      "Urology",
      "Hepatobiliary",
      "Breast surgery",
      "Remote anaesthesia (MRI, radiology, cardioversions)",
    ];
    const specialties_requested = [...ALL_SPECIALTIES]
      .sort(() => Math.random() - 0.5)
      .slice(0, rand(3, 6))
      .map((name) => ({ name, notes: "" }));

    const signoff_needs =
      Math.random() < 0.5
        ? pick([
            "10 T&O cases for regional anaesthesia sign-off",
            "5 obstetric epidurals",
            "Fibreoptic intubation sign-off — need 3 supervised cases",
            "Cardiac anaesthesia level 1 sign-off",
            "Neuroanaesthesia introductory sign-off",
            "Paediatric anaesthesia — 10 cases under 5 years",
          ])
        : "";

    const special_sessions: string[] =
      isSeniorLocal(grade) && Math.random() < 0.3 ? [pick(["Pain medicine", "Pre-op clinics"])] : [];

    return {
      doctor_id: doctor.id,
      rota_config_id: rotaConfigId,
      full_name: `${doctor.first_name} ${doctor.last_name}`,
      nhs_email: doctor.email ?? `${doctor.first_name.toLowerCase()}.${doctor.last_name.toLowerCase()}@nhs.net`,
      personal_email: null,
      phone_number: `07${Math.floor(700000000 + Math.random() * 299999999)}`,
      grade,
      dual_specialty: false,
      dual_specialty_types: [] as string[],
      competencies_json,
      comp_ip_anaesthesia: false,
      comp_ip_anaesthesia_here: false,
      comp_obstetric: false,
      comp_obstetric_here: false,
      comp_icu: false,
      comp_icu_here: false,
      wte_percent: wte,
      wte_other_value: null,
      ltft_days_off,
      ltft_night_flexibility,
      al_entitlement,
      annual_leave,
      study_leave,
      noc_dates,
      other_unavailability,
      exempt_from_nights,
      exempt_from_weekends,
      exempt_from_oncall: false,
      specific_days_off: [] as string[],
      exemption_details,
      other_restrictions: "",
      additional_restrictions: "",
      parental_leave_expected: false,
      parental_leave_start: null,
      parental_leave_end: null,
      parental_leave_notes: "",
      preferred_shift_types: [] as string[],
      preferred_days_off: [] as string[],
      dates_to_avoid: [] as string[],
      other_requests: null,
      specialties_requested,
      special_sessions,
      want_pain_sessions: special_sessions.includes("Pain medicine"),
      pain_session_notes: null,
      want_preop: special_sessions.includes("Pre-op clinics"),
      signoff_needs,
      signoff_requirements: null,
      additional_notes: "",
      confirmed_accurate: true,
      confirm_algorithm_understood: true,
      confirm_exemptions_understood: true,
      confirm_fairness_understood: true,
      signature_name: `${doctor.first_name} ${doctor.last_name}`,
      signature_date: new Date().toISOString().split("T")[0],
      status: "submitted",
      submitted_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString(),
    };
  };

  const handleFillAllSurveys = async () => {
    const rotaConfigId = currentRotaConfigId;
    if (!rotaConfigId) {
      toast.error("No active rota config");
      return;
    }

    setFillingAll(true);

    try {
      const { data: rotaConfig, error: rotaError } = await supabase
        .from("rota_configs")
        .select("rota_start_date, rota_end_date")
        .eq("id", rotaConfigId)
        .single();

      if (rotaError || !rotaConfig?.rota_start_date || !rotaConfig?.rota_end_date) {
        toast.error("Could not fetch rota period dates — ensure start and end dates are set");
        setFillingAll(false);
        return;
      }

      const rotaStart = rotaConfig.rota_start_date;
      const rotaEnd = rotaConfig.rota_end_date;

      const eligible = doctors.filter((d) => d.survey_status !== "submitted");
      if (eligible.length === 0) {
        toast("All doctors have already submitted");
        setFillingAll(false);
        return;
      }

      let successCount = 0;

      for (const doctor of eligible) {
        const payload = buildSurveyPayload(doctor, rotaConfigId, rotaStart, rotaEnd);

        const { error: upsertError } = await supabase
          .from("doctor_survey_responses")
          .upsert(payload, { onConflict: "doctor_id,rota_config_id" });

        if (upsertError) {
          console.error(`Survey fill failed for ${doctor.first_name} ${doctor.last_name}:`, upsertError);
          continue;
        }

        const { error: statusError } = await supabase
          .from("doctors")
          .update({
            survey_status: "submitted",
            survey_submitted_at: new Date().toISOString(),
            grade: payload.grade,
          })
          .eq("id", doctor.id);

        if (statusError) {
          console.error(`Status update failed for ${doctor.first_name} ${doctor.last_name}:`, statusError);
        } else {
          successCount++;
        }
      }

      await loadDoctors();
      toast.success(`✅ Filled ${successCount}/${eligible.length} surveys with realistic data`);
    } catch (err) {
      console.error("handleFillAllSurveys failed:", err);
      toast.error(`Failed to fill surveys: ${String(err)}`);
    } finally {
      setFillingAll(false);
    }
  };

  const handleCancelAllSurveys = async () => {
    const rotaConfigId = currentRotaConfigId;
    if (!rotaConfigId) {
      toast.error("No active rota config");
      return;
    }

    setCancellingAll(true);

    try {
      const relationalDeletes = await Promise.all([
        supabase.from("unavailability_blocks").delete().eq("rota_config_id", rotaConfigId),
        supabase.from("ltft_patterns").delete().eq("rota_config_id", rotaConfigId),
        supabase.from("training_requests").delete().eq("rota_config_id", rotaConfigId),
        supabase.from("dual_specialties").delete().eq("rota_config_id", rotaConfigId),
      ]);

      for (const result of relationalDeletes) {
        if (result.error) throw result.error;
      }

      const { error: deleteError } = await supabase
        .from("doctor_survey_responses")
        .delete()
        .eq("rota_config_id", rotaConfigId);
      if (deleteError) throw deleteError;

      const { error: resetError } = await supabase
        .from("doctors")
        .update({
          survey_status: "not_started",
          survey_submitted_at: null,
          survey_invite_sent_at: null,
          survey_invite_count: 0,
        })
        .eq("rota_config_id", rotaConfigId);
      if (resetError) throw resetError;

      await loadDoctors();
      toast.success("All surveys cancelled and reset");
    } catch (err) {
      console.error("handleCancelAllSurveys failed:", err);
      toast.error(`Failed to cancel surveys: ${String(err)}`);
    } finally {
      setCancellingAll(false);
    }
  };

  return (
    <AdminLayout title="Team Roster" subtitle="Manage doctors" accentColor="blue" pageIcon={Users}>
      <div className="mx-auto max-w-[1200px] w-full overflow-x-hidden space-y-4 animate-fadeSlideUp">
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
        {import.meta.env.DEV && (
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
        )}

        {/* ── STATS CARD ── */}
        {doctors.length > 0 && (
          <div className="bg-card border border-border rounded-lg px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-4 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm sm:text-base text-emerald-600 leading-none">{submitted}</span>
                  <span className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-wider">Submitted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm sm:text-base text-amber-600 leading-none">{inProgress}</span>
                  <span className="text-[9px] font-bold text-amber-600/70 uppercase tracking-wider">In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm sm:text-base text-muted-foreground leading-none">{notStarted}</span>
                  <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider">Not Started</span>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-48 shrink-0">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {progressPct}% Done
                </span>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTROL ROW: Deadline · Add · Send · Search · Sort ── */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Deadline picker */}
          <div className="flex items-center gap-1 shrink-0">
            <CalendarIcon className="hidden sm:block h-3.5 w-3.5 text-primary shrink-0" />
            <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 sm:h-8 text-[11px] sm:text-xs font-normal px-2 sm:px-3 gap-1.5 min-w-0 sm:min-w-[110px] sm:max-w-[160px] justify-start",
                    !surveyDeadline && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="sm:hidden h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    {surveyDeadline ? format(surveyDeadline, "d MMM yyyy") : "Set deadline"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={surveyDeadline}
                  onSelect={handleDeadlineSelect}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {deadlineIsPast && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-700 shrink-0">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">Deadline passed</span>
                <span className="sm:hidden">Passed</span>
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-border shrink-0" />

          {/* Add Doctor — icon-only on mobile */}
          <Button
            size="sm"
            className="gap-1.5 h-7 sm:h-8 text-xs shrink-0 px-2 sm:px-3"
            onClick={() => setIsAddDoctorOpen(true)}
            title="Add Doctor"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Doctor</span>
          </Button>

          {/* Send Invites — icon-only on mobile */}
          {doctors.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={bulkSending}
              title="Send Invites"
              className={cn(
                "gap-1.5 h-7 sm:h-8 text-xs shrink-0 px-2 sm:px-3",
                actionableDoctors.length > 0
                  ? "border-primary text-primary hover:bg-primary/5"
                  : "text-muted-foreground",
              )}
              onClick={() => {
                if (!surveyDeadline) {
                  toast.error("Set a survey deadline before sending invites");
                  return;
                }
                setSendMode("never_invited");
                setSendModalOpen(true);
              }}
            >
              {bulkSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{bulkSending ? "Sending…" : "Send Invites"}</span>
            </Button>
          )}

          {/* No-email warning — inline chip, only on sm+ to save mobile space */}
          {noEmailCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium shrink-0">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {noEmailCount} no email
            </span>
          )}

          {/* Spacer — pushes search+sort to right on sm+ */}
          <div className="flex-1 hidden sm:block min-w-0" />

          {/* Search — flexes to fill remaining space on mobile, capped on sm+ */}
          <div className="relative flex items-center flex-1 min-w-[100px] sm:flex-none sm:w-44 md:w-52 shrink">
            <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 sm:pl-8 h-7 sm:h-8 text-[11px] sm:text-xs w-full"
            />
          </div>

          {/* Sort dropdown — icon-only on mobile */}
          {doctors.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 sm:h-8 text-xs gap-1 shrink-0 px-1.5 sm:px-2.5">
                  <ListFilter className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {{ surname_asc: "A–Z", surname_desc: "Z–A", status: "Status", grade: "Grade" }[sortKey]}
                  </span>
                  <ChevronDown className="hidden sm:inline-block h-3 w-3 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 pointer-events-auto">
                {(["surname_asc", "surname_desc", "status", "grade"] as const).map((key) => {
                  const labels: Record<SortKey, string> = {
                    surname_asc: "A → Z",
                    surname_desc: "Z → A",
                    status: "Status",
                    grade: "Grade",
                  };
                  return (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => setSortKey(key)}
                      className={cn("text-xs cursor-pointer", sortKey === key && "font-semibold text-primary")}
                    >
                      <span className="mr-2 w-3 inline-flex shrink-0">
                        {sortKey === key && <Check className="h-3 w-3 text-primary" />}
                      </span>
                      {labels[key]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {/* ── END CONTROL ROW ── */}

        {/* Main List Container */}
        <div className="space-y-0 divide-y divide-border rounded-lg border border-border overflow-hidden bg-card">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && doctors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1.5 mb-6">
                <p className="text-base font-semibold text-foreground">No doctors added yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Add your first doctor to start collecting survey preferences.
                </p>
              </div>
              <Button onClick={() => setIsAddDoctorOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Add First Doctor
              </Button>
            </div>
          )}
          {!loading && doctors.length > 0 && sortedDoctors.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No doctors match your search.</p>
          )}

          {sortedDoctors.map((doctor) => {
            const isExpanded = expandedIds.has(doctor.id);
            const cached = surveyCache[doctor.id];

            return (
              <div key={doctor.id} className="bg-card">
                {/* ── Desktop Row (lg and up) ── no collapse, full 1-line view */}
                <div className="hidden lg:flex items-center gap-2 py-2.5 px-4 w-full min-w-0 overflow-hidden text-sm hover:bg-muted/30 transition-colors group">
                  {/* Name */}
                  <div className="flex-[2] min-w-0 font-semibold truncate text-[13px]">
                    {formatDoctorName(doctor.first_name, doctor.last_name)}
                  </div>
                  {/* Grade */}
                  <div className="w-16 shrink-0 text-muted-foreground text-xs truncate">
                    {doctor.grade || "—"}
                  </div>
                  {/* Email */}
                  <div className="flex-[2] min-w-0 text-muted-foreground text-xs truncate">
                    {cached?.nhs_email ?? doctor.email ?? "—"}
                  </div>
                  {/* Phone */}
                  <div className="w-24 shrink-0 text-muted-foreground text-xs truncate">
                    {cached?.phone_number ?? "—"}
                  </div>
                  {/* WTE */}
                  <div className="w-16 shrink-0 text-muted-foreground text-xs">
                    {cached ? `${cached.wte_percent ?? 100}%` : "—"}
                  </div>
                  {/* Competencies */}
                  <div className="w-[15%] min-w-[100px] flex flex-wrap gap-0.5 items-center">
                    {cached &&
                      (["iac", "iaoc", "icu", "transfer"] as const).map((k) => {
                        const achieved = cached[`${k}_achieved`] ?? cached.competencies_json?.[k]?.achieved;
                        const working = cached[`${k}_working`] ?? cached.competencies_json?.[k]?.workingTowards;
                        const label = k === "transfer" ? "TR" : k.toUpperCase();
                        const colour =
                          achieved === true
                            ? "bg-emerald-100 text-emerald-700"
                            : working === true
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700";
                        return (
                          <span key={k} className={`px-1 py-0.5 rounded text-[8px] font-bold leading-tight ${colour}`}>
                            {label}
                          </span>
                        );
                      })}
                  </div>
                  {/* Survey status */}
                  <div className="w-20 shrink-0">
                    {doctor.survey_status === "submitted" && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 shadow-none pointer-events-none text-[10px] px-1.5 py-0">
                        Submitted
                      </Badge>
                    )}
                    {doctor.survey_status === "in_progress" && (
                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 shadow-none pointer-events-none text-[10px] px-1.5 py-0">
                        In Progress
                      </Badge>
                    )}
                    {(!doctor.survey_status || doctor.survey_status === "not_started") && (
                      <Badge className="bg-muted text-muted-foreground border-border shadow-none pointer-events-none text-[10px] px-1.5 py-0">
                        Not Started
                      </Badge>
                    )}
                  </div>
                  {/* Invite counter icon — fixed width, no layout shift */}
                  <div className="w-7 shrink-0 flex items-center justify-center">
                    {(doctor.survey_invite_count ?? 0) > 0 && (
                      <span
                        title={`${doctor.survey_invite_count} invite${doctor.survey_invite_count !== 1 ? "s" : ""} sent`}
                        className="relative inline-flex items-center justify-center h-6 w-6"
                      >
                        <Send className="h-3 w-3 text-muted-foreground/50" />
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground leading-none">
                          {(doctor.survey_invite_count ?? 0) > 9 ? "9+" : doctor.survey_invite_count}
                        </span>
                      </span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title="View Profile"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-teal-600 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/doctor/${doctor.id}`); }}
                    >
                      <User className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="View Calendar"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-teal-600 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/doctor-calendar/${doctor.id}`); }}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                    </button>
                    {renderDoctorMenu(doctor)}
                  </div>
                </div>

                {/* ── Mobile/Tablet Row (below lg) ── */}
                <div className="flex flex-col lg:hidden py-1.5 px-3">
                  {/* Tap target: chevron + name/email column + status + menu */}
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => toggleExpand(doctor.id)}
                  >
                    {/* Explicit expand/collapse cue */}
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}

                    {/* Survey status icon — moved before name */}
                    <div className="shrink-0">
                      {doctor.survey_status === "submitted" && <Check className="h-4 w-4 text-emerald-600" />}
                      {doctor.survey_status === "in_progress" && <Pencil className="h-4 w-4 text-amber-600" />}
                      {(!doctor.survey_status || doctor.survey_status === "not_started") && (
                        <CircleDashed className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Name + sub-line stacked tightly */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-[13px] leading-tight flex-1 min-w-0 truncate">
                          {formatDoctorName(doctor.first_name, doctor.last_name)}
                        </span>
                        {/* Grade — visible on sm and up only to save mobile space */}
                        <span className="hidden sm:inline text-[11px] text-muted-foreground font-medium shrink-0">
                          {doctor.grade || "—"}
                        </span>
                      </div>
                      {!isExpanded && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground truncate">
                          {/* Grade — mobile only */}
                          <span className="sm:hidden shrink-0 font-medium">{doctor.grade || "—"}</span>
                          <span className="sm:hidden w-1 h-1 rounded-full bg-border shrink-0" />
                          {/* Email */}
                          <span className="truncate">
                            {cached?.nhs_email ?? doctor.email ?? "No email"}
                          </span>
                          {/* Phone — sm and up only */}
                          {cached?.phone_number && (
                            <>
                              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-border shrink-0" />
                              <span className="hidden sm:inline-block shrink-0">{cached.phone_number}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Invite counter icon */}
                    {(doctor.survey_invite_count ?? 0) > 0 && (
                      <span
                        title={`${doctor.survey_invite_count} invite${doctor.survey_invite_count !== 1 ? "s" : ""} sent`}
                        className="relative inline-flex items-center justify-center h-5 w-5 shrink-0"
                      >
                        <Send className="h-3 w-3 text-muted-foreground/50" />
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground leading-none">
                          {(doctor.survey_invite_count ?? 0) > 9 ? "9+" : doctor.survey_invite_count}
                        </span>
                      </span>
                    )}
                    {/* Kebab menu — stop propagation */}
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      {renderDoctorMenu(doctor)}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border pl-5">
                      <ExpandedDoctorPanel
                        doctor={doctor}
                        surveyData={cached}
                        isLoading={surveyLoading[doctor.id] ?? false}
                        invitedAt={doctor.survey_invite_sent_at}
                        onNavigateProfile={() => navigate(`/admin/doctor/${doctor.id}`)}
                        onNavigateCalendar={() => navigate(`/admin/doctor-calendar/${doctor.id}`)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inactive doctors section */}
        {inactiveDoctors.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm mt-8">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setInactiveSectionOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                Inactive / Previous Period Doctors
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground min-w-[1.5rem]">
                  {inactiveDoctors.length}
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${inactiveSectionOpen ? "rotate-180" : ""}`} />
            </button>
            {inactiveSectionOpen && (
              <div className="divide-y divide-border border-t border-border">
                {inactiveDoctors.map((doctor) => {
                  const isExpanded = inactiveExpandedIds.has(doctor.id);
                  const cached = surveyCache[doctor.id];
                  return (
                    <div key={doctor.id} className="bg-card">
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 sm:px-4 cursor-pointer"
                        onClick={() => {
                          if (isExpanded) {
                            setInactiveExpandedIds((prev) => {
                              const next = new Set(prev);
                              next.delete(doctor.id);
                              return next;
                            });
                          } else {
                            setInactiveExpandedIds((prev) => {
                              const next = new Set(prev);
                              next.add(doctor.id);
                              return next;
                            });
                          }
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                          {formatDoctorName(doctor.first_name, doctor.last_name)}
                        </span>

                        <div className="flex justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Popover
                            open={reactivatePopoverId === doctor.id}
                            onOpenChange={(open) => {
                              if (!open) setReactivatePopoverId(null);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-3 shadow-none"
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
                            <PopoverContent
                              className="w-72 pointer-events-auto"
                              align="end"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <div className="space-y-3">
                                <p className="text-sm font-medium">
                                  Reactivate {doctor.first_name} {doctor.last_name}?
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Previous survey data found. How would you like to proceed?
                                </p>
                                <div className="flex flex-col gap-2">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      await supabase.from("doctors").update({ is_active: true }).eq("id", doctor.id);
                                      toast.success("Doctor reactivated with previous survey data");
                                      setReactivatePopoverId(null);
                                      invalidateDoctors();
                                      invalidateInactiveDoctors();
                                    }}
                                  >
                                    Restore previous survey
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      await supabase
                                        .from("doctor_survey_responses")
                                        .delete()
                                        .eq("doctor_id", doctor.id);
                                      await supabase
                                        .from("doctors")
                                        .update({
                                          is_active: true,
                                          survey_status: "not_started",
                                          survey_submitted_at: null,
                                          survey_invite_sent_at: null,
                                          survey_invite_count: 0,
                                        })
                                        .eq("id", doctor.id);
                                      setReactivatePopoverId(null);
                                      invalidateDoctors();
                                      invalidateInactiveDoctors();
                                      toast.success("Doctor reactivated — survey reset");
                                    }}
                                  >
                                    Start fresh (clears survey)
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border bg-muted/30 px-3 py-3 sm:px-4">
                          <ExpandedDoctorPanel
                            doctor={doctor}
                            surveyData={cached}
                            isLoading={surveyLoading[doctor.id] ?? false}
                            invitedAt={doctor.survey_invite_sent_at}
                            onNavigateProfile={() => navigate(`/admin/doctor/${doctor.id}`)}
                            onNavigateCalendar={() => navigate(`/admin/doctor-calendar/${doctor.id}`)}
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

      {/* ── Smart Send Invites Modal ── */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-[480px] p-0 overflow-hidden rounded-2xl shadow-xl">
          <div className="bg-primary/5 p-6 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg text-foreground">Send Survey Invites</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Choose who to email</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              {(
                [
                  { mode: "never_invited" as SendMode, label: "Never invited", description: "Haven't received a survey link yet" },
                  { mode: "not_started" as SendMode, label: "Not started", description: "Got the link but haven't opened the survey" },
                  { mode: "in_progress" as SendMode, label: "In progress — reminder", description: "Started but haven't submitted yet" },
                ]
              ).map(({ mode, label, description }) => {
                const count = getSendModeRecipients(mode).length;
                const isSelected = sendMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSendMode(mode)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-4 w-4 rounded-full border-2 shrink-0",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      )} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold min-w-[1.5rem]",
                      count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {sendModeRecipients.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recipients ({sendModeRecipients.length})
                </p>
                <p className="text-sm text-foreground">
                  {sendModeRecipients.slice(0, 5).map((d) => `Dr ${d.last_name}`).join(", ")}
                  {sendModeRecipients.length > 5 && (
                    <span className="text-muted-foreground"> and {sendModeRecipients.length - 5} more</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">No doctors in this group to email.</p>
              </div>
            )}

            {formattedDeadline && (
              <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-medium text-foreground">Deadline in email:</span>
                <span className="text-muted-foreground">{formattedDeadline}</span>
              </div>
            )}

            {noEmailCount > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  {noEmailCount} doctor{noEmailCount > 1 ? "s have" : " has"} no email address and will not receive an invite.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setSendModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={sendModeRecipients.length === 0 || bulkSending}
                onClick={() => handleBulkSend(sendMode)}
              >
                {bulkSending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending…</>
                ) : (
                  `Send to ${sendModeRecipients.length} doctor${sendModeRecipients.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Add Doctor Dialog */}
      <Dialog open={isAddDoctorOpen} onOpenChange={setIsAddDoctorOpen}>
        <DialogContent className="w-[92vw] sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <Input value={addFirstName} onChange={(e) => setAddFirstName(e.target.value)} placeholder="e.g. John" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name *</label>
                <Input value={addLastName} onChange={(e) => setAddLastName(e.target.value)} placeholder="e.g. Smith" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="john.smith@nhs.net"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Grade (Optional)</label>
                <Input value={addGrade} onChange={(e) => setAddGrade(e.target.value)} placeholder="e.g. ST3" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone (Optional)</label>
                <Input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="07..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDoctorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addDoctor} disabled={!addFirstName || !addLastName || !addEmail}>
              Save Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Send Invite Dialog */}
      <Dialog open={!!doctorToSend} onOpenChange={(open) => !open && setDoctorToSend(null)}>
        <DialogContent className="w-[92vw] sm:max-w-[425px] p-0 overflow-hidden rounded-2xl shadow-xl">
          <div className="bg-primary/5 p-6 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg text-foreground">Send Survey Invite</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {doctorToSend?.first_name} {doctorToSend?.last_name}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4 bg-background">
            {formattedDeadline && (
              <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-medium text-foreground">Deadline</span>
                <span className="text-muted-foreground">{formattedDeadline}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              They will receive an email containing their unique, secure survey link.
            </p>
            {doctorToSend?.survey_status === "submitted" && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800 flex gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  This doctor has already submitted their survey. Resending will allow them to edit and resubmit their
                  responses.
                </p>
              </div>
            )}
            <div className="pt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDoctorToSend(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (doctorToSend) sendInvite(doctorToSend);
                  setDoctorToSend(null);
                }}
              >
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Remove Doctor Dialog */}
      <Dialog open={!!doctorToRemove} onOpenChange={(open) => !open && setDoctorToRemove(null)}>
        <DialogContent className="w-[92vw] sm:max-w-[425px] p-0 overflow-hidden rounded-2xl border-border shadow-xl">
          <div className="bg-red-50/50 p-6 border-b border-red-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-lg text-foreground">Remove Doctor</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {doctorToRemove?.first_name} {doctorToRemove?.last_name}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4 bg-background">
            <p className="text-sm text-foreground font-medium">What would you like to do?</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="flex flex-col items-start p-3 rounded-lg border border-border hover:border-muted-foreground/30 hover:bg-muted/30 transition-colors text-left w-full"
                onClick={() => doctorToRemove && deactivateDoctor(doctorToRemove.id)}
              >
                <span className="text-sm font-semibold text-foreground">Move to Inactive</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Keeps their data but removes them from the active scheduling.
                </span>
              </button>
              <button
                type="button"
                className="flex flex-col items-start p-3 rounded-lg border border-red-200 bg-red-50/30 hover:bg-red-50 hover:border-red-300 transition-colors text-left w-full group"
                onClick={() => doctorToRemove && removeDoctor(doctorToRemove.id)}
              >
                <span className="text-sm font-semibold text-red-600 group-hover:text-red-700">Delete Permanently</span>
                <span className="text-xs text-red-600/70 mt-1">
                  Deletes the doctor and ALL their survey responses entirely. Cannot be undone.
                </span>
              </button>
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDoctorToRemove(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
