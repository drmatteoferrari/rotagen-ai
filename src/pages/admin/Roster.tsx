import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Copy, Trash2, UserPlus, Send, Users, Pencil, CalendarIcon, Loader2, Check, AlertTriangle, Link2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, subDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildSurveyLink } from "@/lib/surveyLinks";


// SECTION 6 — Doctor interface from DB
interface Doctor {
  id: string;
  rota_config_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  grade: string;
  survey_status: string;
  survey_invite_sent_at: string | null;
  survey_invite_count: number;
  survey_token: string | null;
  survey_submitted_at: string | null;
}
// SECTION 6 COMPLETE

export default function Roster() {
  const navigate = useNavigate();
  const { currentRotaConfigId, restoredConfig } = useRotaContext();
  const { accountSettings } = useAuth();

  // Local form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // DB-backed doctors
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // SECTION 8 — Deadline picker state
  const [surveyDeadline, setSurveyDeadline] = useState<Date | undefined>(undefined);
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  // SECTION 5 — Send state per doctor
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [popoverId, setPopoverId] = useState<string | null>(null);


  // Copy tooltip state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rota period info from restored config
  const rotaStartDate = restoredConfig?.rotaPeriod?.startDate
    ? (() => { const [y, m, d] = restoredConfig.rotaPeriod.startDate!.split("-").map(Number); return new Date(y, m - 1, d); })()
    : null;

  // SECTION 5 — Read from accountSettings context
  const departmentName = accountSettings.departmentName ?? "";
  const hospitalName = accountSettings.trustName ?? "";
  // SECTION 5 COMPLETE

  // ─── Load doctors from DB ───
  const loadDoctors = useCallback(async () => {
    if (!currentRotaConfigId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("rota_config_id", currentRotaConfigId)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); toast.error("Failed to load doctors"); }
    setDoctors((data as Doctor[]) ?? []);
    setLoading(false);
  }, [currentRotaConfigId]);

  // ─── Load deadline from DB ───
  const loadDeadline = useCallback(async () => {
    if (!currentRotaConfigId) return;
    const { data } = await supabase
      .from("rota_configs")
      .select("survey_deadline")
      .eq("id", currentRotaConfigId)
      .single();
    if (data?.survey_deadline) {
      const [y, m, d] = data.survey_deadline.split("-").map(Number);
      setSurveyDeadline(new Date(y, m - 1, d));
    }
  }, [currentRotaConfigId]);

  useEffect(() => { loadDoctors(); loadDeadline(); }, [loadDoctors, loadDeadline]);

  // ─── Add doctor to DB ───
  const addDoctor = async () => {
    if (!firstName || !lastName || !email || !currentRotaConfigId) return;
    const { error } = await supabase.from("doctors").insert({
      rota_config_id: currentRotaConfigId,
      first_name: firstName,
      last_name: lastName,
      email,
      grade: "—",
      survey_status: "not_started",
    });
    if (error) { toast.error("Failed to add doctor"); console.error(error); return; }
    setFirstName(""); setLastName(""); setEmail("");
    toast.success(`${firstName} ${lastName} added to the roster`);
    loadDoctors();
  };

  // ─── Remove doctor from DB ───
  const removeDoctor = async (id: string) => {
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) { toast.error("Failed to remove doctor"); return; }
    setDoctors(doctors.filter((d) => d.id !== id));
    toast("Doctor removed from roster");
  };

  // SECTION 8 — Save deadline to DB on change
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
  // SECTION 8 COMPLETE

  // SECTION 4 — Formatted deadline for email
  const formattedDeadline = surveyDeadline
    ? format(surveyDeadline, "EEEE, d MMMM yyyy")
    : null;
  // SECTION 4 COMPLETE

  // SECTION 5 — Send invite handler (SECTION 9 — uses token-based URL)
  const sendInvite = async (doctor: Doctor) => {
    setPopoverId(null);

    if (!departmentName || !hospitalName) {
      toast.error("Please set your department and hospital name on the Dashboard before sending invites.");
      return;
    }

    if (!formattedDeadline) { toast.error("Set a survey deadline first."); return; }


    setSendingId(doctor.id);

    // SECTION 9 — Use real token-based URL
    const surveyLink = doctor.survey_token ? buildSurveyLink(doctor.survey_token) : "";

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

    try {
      const { data, error } = await supabase.functions.invoke("send-survey-invite", { body });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? "Send failed");

      await supabase
        .from("doctors")
        .update({
          survey_invite_sent_at: new Date().toISOString(),
          survey_invite_count: (doctor.survey_invite_count ?? 0) + 1,
          survey_status: doctor.survey_status === "not_started" ? "not_started" : doctor.survey_status,
        })
        .eq("id", doctor.id);

      setSendingId(null);
      setSuccessId(doctor.id);
      toast.success(`✓ Survey invite sent to ${doctor.first_name} ${doctor.last_name}`);
      setTimeout(() => setSuccessId(null), 3000);
      loadDoctors();
    } catch (err: any) {
      console.error("Send invite error:", err);
      setSendingId(null);
      const msg = err?.message?.includes("FunctionsFetchError") || err?.message?.includes("fetch")
        ? "Could not reach email service — check your connection and try again"
        : `Failed to send invite to ${doctor.first_name} ${doctor.last_name} — please try again`;
      toast.error(msg);
    }
  };
  // SECTION 5 COMPLETE
  // SECTION 9 COMPLETE

  const copyMagicLink = (doctor: Doctor) => {
    if (!doctor.survey_token) { toast.error("No survey token available"); return; }
    const link = buildSurveyLink(doctor.survey_token);
    navigator.clipboard.writeText(link);
    setCopiedId(doctor.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // SECTION 7 — Survey status counts
  const submitted = doctors.filter((d) => d.survey_status === "submitted").length;
  const inProgress = doctors.filter((d) => d.survey_status === "in_progress").length;
  const notStarted = doctors.filter((d) => !["submitted", "in_progress"].includes(d.survey_status)).length;

  // SECTION 7 — Status badge
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
  // SECTION 7 COMPLETE

  // SECTION 7 — Determine send icon state
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
    view: "desktop" | "mobile"
  ) => {
    if (isSending) return <Button variant="ghost" size="icon" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>;
    if (isSuccess) return <Button variant="ghost" size="icon" disabled><Check className="h-4 w-4 text-emerald-600" /></Button>;
    if (sendState.disabled) return (
      <Tooltip><TooltipTrigger asChild><span><Button variant="ghost" size="icon" disabled className="text-muted-foreground"><Send className="h-4 w-4" /></Button></span></TooltipTrigger><TooltipContent>{sendState.tooltip}</TooltipContent></Tooltip>
    );

    const popoverKey = `${doctor.id}:${view}`;

    return (
      <Popover open={popoverId === popoverKey} onOpenChange={(open) => setPopoverId(open ? popoverKey : null)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("relative", sendState.color)} title={sendState.tooltip}>
            <Send className="h-4 w-4" />
            {sendState.badge && <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-1">{sendState.badge}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 pointer-events-auto" align="end" side="bottom" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="space-y-3">
            <p className="text-sm font-medium">Send invite to {doctor.first_name} {doctor.last_name}?</p>
            {formattedDeadline && <p className="text-xs text-muted-foreground">Deadline: {formattedDeadline}</p>}
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
        <Button variant="ghost" size="icon" onClick={() => copyMagicLink(doctor)}>
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

    const wte = Math.random() < 0.88 ? 100 : pick([80, 60]);
    const isLtft = wte < 100;

    // ── GRADE GROUPS ──
    const isCT1   = (g: string) => g.includes('CT1');
    const isCT2up = (g: string) => ['CT2','CT3','ST4','ST5','ST6','ST7','ST8','ST9','SAS','Fellow','Consultant'].some(x => g.includes(x));
    const isCT3up = (g: string) => ['CT3','ST4','ST5','ST6','ST7','ST8','ST9','SAS','Fellow','Consultant'].some(x => g.includes(x));
    const isSeniorGrade = (g: string) => ['ST6','ST7','ST8','ST9','SAS','Fellow','Consultant'].some(x => g.includes(x));

    // ── STEP 2: COMPETENCIES ──
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

    // ── LTFT ──
    const ltft_days_off: string[] = isLtft
      ? (wte === 80 ? ['Wednesday'] : ['Wednesday', 'Friday'])
      : [];
    const ltft_night_flexibility = ltft_days_off.map(day => ({
      day,
      canStart: Math.random() < 0.8,
      canEnd:   Math.random() < 0.8,
    }));

    // ── STEP 4: LEAVE ──

    const rotaMs = new Date(rotaEnd).getTime() - new Date(rotaStart).getTime();

    const rotaWeeks = rotaMs / (7 * 86400000);

    const effectiveWte = isLtft ? wte : 100;

    const al_entitlement = Math.random() < 0.5 ? 27 : 32;

    // Pro-rata AL for this rota — this is the hard cap

    const proRataAL = Math.max(1, Math.round((rotaWeeks / 52) * al_entitlement * (effectiveWte / 100)));

    // Track all booked date ranges to prevent any overlap

    const bookedRanges: { start: number; end: number }[] = [];

    const overlaps = (s: Date, e: Date): boolean =>

      bookedRanges.some(r => s.getTime() <= r.end && e.getTime() >= r.start);

    const book = (s: Date, e: Date) =>

      bookedRanges.push({ start: s.getTime(), end: e.getTime() });

    // Try to place a leave block of exactly lengthDays without overlapping booked ranges

    // Returns a LeaveEntry or null if no gap found after maxAttempts

    const tryPlaceBlock = (

      lengthDays: number,

      maxAttempts = 40

    ): { id: string; startDate: string; endDate: string; reason: string } | null => {

      const rotaStartMs = new Date(rotaStart).getTime();

      const rotaEndMs   = new Date(rotaEnd).getTime();

      const blockMs     = lengthDays * 86400000;

      const window      = rotaEndMs - rotaStartMs - blockMs;

      if (window <= 0) return null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {

        const offset  = Math.floor(Math.random() * window);

        const s       = new Date(rotaStartMs + offset);

        const e       = new Date(rotaStartMs + offset + blockMs);

        if (!overlaps(s, e)) {

          book(s, e);

          return {

            id:        crypto.randomUUID(),

            startDate: s.toISOString().split('T')[0],

            endDate:   e.toISOString().split('T')[0],

            reason:    '',

          };

        }

      }

      return null;

    };

    // Annual Leave: 2-5 blocks, total days <= proRataAL

    const targetAL    = proRataAL; // never exceed pro-rata

    const numALBlocks = rand(2, 5);

    const annual_leave: { id: string; startDate: string; endDate: string; reason: string }[] = [];

    let alRemaining = targetAL;

    for (let i = 0; i < numALBlocks && alRemaining > 0; i++) {

      const isLast   = i === numALBlocks - 1;

      const maxBlock = Math.min(5, alRemaining - (isLast ? 0 : numALBlocks - i - 1));

      const blockLen = isLast ? Math.max(1, Math.min(5, alRemaining)) : rand(1, Math.max(1, maxBlock));

      const entry    = tryPlaceBlock(blockLen);

      if (entry) {

        annual_leave.push(entry);

        alRemaining -= blockLen;

      }

    }

    // Study Leave: 2-4 blocks, total 3-10 days, no overlap with AL

    const numSLBlocks = rand(2, 4);

    const targetSL    = rand(3, 10);

    const slReasons   = ['FRCA Primary', 'FRCA Final', 'ALS Course', 'ATLS Course', 'Conference', 'Exam', 'Teaching'];

    const study_leave: { id: string; startDate: string; endDate: string; reason: string }[] = [];

    let slRemaining = targetSL;

    for (let i = 0; i < numSLBlocks && slRemaining > 0; i++) {

      const isLast   = i === numSLBlocks - 1;

      const maxBlock = Math.min(3, slRemaining - (isLast ? 0 : numSLBlocks - i - 1));

      const blockLen = isLast ? Math.max(1, Math.min(3, slRemaining)) : rand(1, Math.max(1, maxBlock));

      const entry    = tryPlaceBlock(blockLen);

      if (entry) {

        study_leave.push({ ...entry, reason: pick(slReasons) });

        slRemaining -= blockLen;

      }

    }

    // NOC: 2-5 blocks, total 5-15 days, no overlap with AL or SL

    const numNOCBlocks = rand(2, 5);

    const targetNOC    = rand(5, 15);

    const noc_dates: { id: string; startDate: string; endDate: string; reason: string }[] = [];

    let nocRemaining = targetNOC;

    for (let i = 0; i < numNOCBlocks && nocRemaining > 0; i++) {

      const isLast   = i === numNOCBlocks - 1;

      const maxBlock = Math.min(5, nocRemaining - (isLast ? 0 : numNOCBlocks - i - 1));

      const blockLen = isLast ? Math.max(1, Math.min(5, nocRemaining)) : rand(1, Math.max(1, maxBlock));

      const entry    = tryPlaceBlock(blockLen);

      if (entry) {

        noc_dates.push(entry);

        nocRemaining -= blockLen;

      }

    }

    // Rotation: 1 in 5 doctors, exactly 14 days Mon→Sun, no overlap with AL/SL/NOC

    const hasRotation = Math.random() < 0.2;

    const other_unavailability: { id: string; startDate: string; endDate: string; location: string }[] = [];

    if (hasRotation) {

      const rotaStartMs   = new Date(rotaStart).getTime();

      const rotaEndMs     = new Date(rotaEnd).getTime();

      const maxOffsetDays = Math.max(0, Math.floor((rotaEndMs - rotaStartMs) / 86400000) - 14);

      let placed = false;

      for (let attempt = 0; attempt < 40 && !placed; attempt++) {

        const offsetDays    = Math.floor(Math.random() * maxOffsetDays);

        const candidate     = new Date(rotaStartMs + offsetDays * 86400000);

        const dow           = candidate.getDay();

        const toMonday      = dow === 1 ? 0 : (8 - dow) % 7 || 7;

        const mondayDate    = new Date(candidate.getTime() + toMonday * 86400000);

        const sundayDate    = new Date(mondayDate.getTime() + 13 * 86400000);

        if (sundayDate.getTime() <= rotaEndMs && !overlaps(mondayDate, sundayDate)) {

          book(mondayDate, sundayDate);

          other_unavailability.push({

            id:        crypto.randomUUID(),

            startDate: mondayDate.toISOString().split('T')[0],

            endDate:   sundayDate.toISOString().split('T')[0],

            location:  pick(['Royal Liverpool Hospital', 'Aintree University Hospital', 'Arrowe Park Hospital', 'Warrington Hospital', 'Countess of Chester Hospital']),

          });

          placed = true;

        }

      }

    }

    // ── STEP 5: EXEMPTIONS ──
    const exempt_from_nights   = Math.random() < 0.04;
    const exempt_from_weekends = Math.random() < 0.03;
    const exemption_details    = exempt_from_nights
      ? 'Exempt from night shifts — Occupational Health recommendation.'
      : exempt_from_weekends
        ? 'Exempt from weekend shifts — Occupational Health recommendation.'
        : '';

    // ── STEP 6: PREFERENCES ──
    const ALL_SPECIALTIES = [
      'Paediatric', 'Obstetric', 'Cardiothoracic', 'Neuro', 'Vascular',
      'T&O and regional anaesthesia', 'ENT and maxillofacial', 'Ophthalmology',
      'Plastics and reconstructive', 'Gynaecology', 'Urology', 'Hepatobiliary',
      'Breast surgery', 'Remote anaesthesia (MRI, radiology, cardioversions)',
    ];
    const shuffled = [...ALL_SPECIALTIES].sort(() => Math.random() - 0.5);
    const numSpecs = rand(3, 6);
    const specialties_requested = shuffled.slice(0, numSpecs).map(name => ({ name, notes: '' }));

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

    const special_sessions: string[] = isSeniorGrade(grade) && Math.random() < 0.3
      ? [pick(['Pain medicine', 'Pre-op clinics'])]
      : [];

    return {
      doctor_id:               doctor.id,
      rota_config_id:          rotaConfigId,
      full_name:               `${doctor.first_name} ${doctor.last_name}`,
      nhs_email:               doctor.email ?? `${doctor.first_name.toLowerCase()}.${doctor.last_name.toLowerCase()}@nhs.net`,
      personal_email:          null,
      phone_number:            `07${Math.floor(700000000 + Math.random() * 299999999)}`,
      grade,
      dual_specialty:          false,
      dual_specialty_types:    [] as string[],
      competencies_json,
      comp_ip_anaesthesia:     false,
      comp_ip_anaesthesia_here: false,
      comp_obstetric:          false,
      comp_obstetric_here:     false,
      comp_icu:                false,
      comp_icu_here:           false,
      wte_percent:             wte,
      wte_other_value:         null,
      ltft_days_off,
      ltft_night_flexibility,
      al_entitlement,
      annual_leave,
      study_leave,
      noc_dates,
      other_unavailability,
      exempt_from_nights,
      exempt_from_weekends,
      exempt_from_oncall:      false,
      specific_days_off:       [] as string[],
      exemption_details,
      other_restrictions:      '',
      additional_restrictions: '',
      parental_leave_expected: false,
      parental_leave_start:    null,
      parental_leave_end:      null,
      parental_leave_notes:    '',
      preferred_shift_types:   [] as string[],
      preferred_days_off:      [] as string[],
      dates_to_avoid:          [] as string[],
      other_requests:          null,
      specialties_requested,
      special_sessions,
      want_pain_sessions:      special_sessions.includes('Pain medicine'),
      pain_session_notes:      null,
      want_preop:              special_sessions.includes('Pre-op clinics'),
      signoff_needs,
      signoff_requirements:    null,
      additional_notes:        '',
      confirmed_accurate:      true,
      confirm_algorithm_understood:  true,
      confirm_exemptions_understood: true,
      confirm_fairness_understood:   true,
      signature_name:          `${doctor.first_name} ${doctor.last_name}`,
      signature_date:          new Date().toISOString().split('T')[0],
      status:                  'submitted',
      submitted_at:            new Date().toISOString(),
      last_saved_at:           new Date().toISOString(),
    };
  };

  const handleFillAllSurveys = async () => {
    // 1. Get rota config id from localStorage (matching RotaContext storage key)
    const rotaConfigId = currentRotaConfigId;
    if (!rotaConfigId) {
      toast.error('No active rota config');
      return;
    }

    setFillingAll(true);

    try {
      // 2. Fetch rota dates
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

      // 3. Fetch doctors
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

      // 4. Upsert survey response for each doctor — sequential for reliability
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

      // Assign parental leave to 2 random doctors — no overlap with their existing leave

      const plCandidates = [...doctorsList].sort(() => Math.random() - 0.5).slice(0, 2);

      for (const plDoctor of plCandidates) {

        const rotaStartMs = new Date(rotaStart).getTime();

        const rotaEndMs   = new Date(rotaEnd).getTime();

        // Fetch this doctor's existing survey to get their booked ranges

        const { data: existing } = await supabase

          .from('doctor_survey_responses')

          .select('annual_leave, study_leave, noc_dates, other_unavailability')

          .eq('doctor_id', plDoctor.id)

          .eq('rota_config_id', rotaConfigId)

          .single();

        const existingRanges: { start: number; end: number }[] = [];

        const addRanges = (arr: { startDate: string; endDate: string }[] | null) => {

          if (!arr) return;

          for (const e of arr) {

            if (e.startDate && e.endDate) {

              existingRanges.push({

                start: new Date(e.startDate).getTime(),

                end:   new Date(e.endDate).getTime(),

              });

            }

          }

        };

        if (existing) {

          addRanges(existing.annual_leave as any);

          addRanges(existing.study_leave as any);

          addRanges(existing.noc_dates as any);

          addRanges(existing.other_unavailability as any);

        }

        const plOverlaps = (s: Date, e: Date) =>

          existingRanges.some(r => s.getTime() <= r.end && e.getTime() >= r.start);

        // Try up to 40 times to find a non-overlapping Mon→Sun 14-day window

        const maxOffset = Math.max(0, Math.floor((rotaEndMs - rotaStartMs) / 86400000) - 14);

        let plPlaced = false;

        for (let attempt = 0; attempt < 40 && !plPlaced; attempt++) {

          const offsetDays = Math.floor(Math.random() * maxOffset);

          const candidate  = new Date(rotaStartMs + offsetDays * 86400000);

          const dow        = candidate.getDay();

          const toMonday   = dow === 1 ? 0 : (8 - dow) % 7 || 7;

          const plStart    = new Date(candidate.getTime() + toMonday * 86400000);

          const plEnd      = new Date(plStart.getTime() + 13 * 86400000);

          if (plEnd.getTime() <= rotaEndMs && !plOverlaps(plStart, plEnd)) {

            await supabase

              .from('doctor_survey_responses')

              .update({

                parental_leave_expected: true,

                parental_leave_start:    plStart.toISOString().split('T')[0],

                parental_leave_end:      plEnd.toISOString().split('T')[0],

                parental_leave_notes:    'Parental leave — dates confirmed with HR.',

              })

              .eq('doctor_id', plDoctor.id)

              .eq('rota_config_id', rotaConfigId);

            plPlaced = true;

          }

        }

      }

      // 5. Refresh roster
      await loadDoctors();

      // 6. Success toast — only fires if everything above succeeded
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
      // Delete all survey responses for this config
      const { error: deleteError } = await supabase
        .from('doctor_survey_responses')
        .delete()
        .eq('rota_config_id', rotaConfigId);

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw deleteError;
      }

      // Reset doctor statuses
      const { error: updateError } = await supabase
        .from('doctors')
        .update({
          survey_status: 'not_started',
          survey_submitted_at: null,
        })
        .eq('rota_config_id', rotaConfigId);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw updateError;
      }

      await loadDoctors();
      toast.success('🗑️ All survey responses cleared');

    } catch (err) {
      console.error('handleCancelAllSurveys failed:', err);
      toast.error(`Failed to cancel surveys: ${String(err)}`);
    } finally {
      setCancellingAll(false);
    }
  };

  return (
    <AdminLayout title="Roster & Invites" subtitle="Build the team and send survey invitations">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">

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
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const picked = new Date(date);
                      picked.setHours(0, 0, 0, 0);
                      if (picked < today) return true;
                      if (rotaStartDate) {
                        const maxAllowed = subDays(rotaStartDate, 1);
                        maxAllowed.setHours(0, 0, 0, 0);
                        if (maxAllowed >= today && picked > maxAllowed) return true;
                      }
                      return false;
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {!rotaStartDate && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Rota start date not set — set it in Rota Period settings.
              </p>
            )}
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
              {/* Inline summary stats */}
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
                    <p className="text-[10px] text-muted-foreground">Done</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/10">
                    <Pencil className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-bold text-card-foreground">{inProgress}</p>
                    <p className="text-[10px] text-muted-foreground">WIP</p>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Quick add row */}
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="sm:flex-1" />
                <Input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="sm:flex-1" />
              </div>
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:flex-[2]" />
              <Button onClick={addDoctor} disabled={!firstName || !lastName || !email} className="w-full sm:w-auto">
                <UserPlus className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Survey Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((doctor) => {
                    const sendState = getSendIconState(doctor);
                    const isSending = sendingId === doctor.id;
                    const isSuccess = successId === doctor.id;
                    const isCopied = copiedId === doctor.id;

                    return (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">{doctor.first_name} {doctor.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{doctor.email ?? "—"}</TableCell>
                        <TableCell>{doctor.grade}</TableCell>
                        <TableCell>{statusBadge(doctor)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {renderSendButton(doctor, sendState, isSending, isSuccess, "desktop")}
                            {renderCopyButton(doctor, isCopied)}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => doctor.survey_token && window.open(buildSurveyLink(doctor.survey_token), "_blank")} disabled={!doctor.survey_token}><ExternalLink className="h-4 w-4" /></Button>
                              </TooltipTrigger>
                              <TooltipContent>Open survey in new tab</TooltipContent>
                            </Tooltip>
                            <Button variant="ghost" size="icon" onClick={() => doctor.survey_token && navigate(`/doctor/survey?token=${doctor.survey_token}&admin=true`)} disabled={!doctor.survey_token} className={doctor.survey_status === "submitted" ? "text-amber-600 hover:text-amber-700" : ""}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => removeDoctor(doctor.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && doctors.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No doctors added yet.</TableCell></TableRow>
                  )}
                  {loading && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
              {loading && (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              )}
              {!loading && doctors.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">No doctors added yet.</p>
              )}
              {doctors.map((doctor) => {
                const sendState = getSendIconState(doctor);
                const isSending = sendingId === doctor.id;
                const isSuccess = successId === doctor.id;
                const isCopied = copiedId === doctor.id;

                return (
                  <div key={doctor.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{doctor.first_name} {doctor.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{doctor.email ?? "No email"}</p>
                      </div>
                      {statusBadge(doctor)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Grade: {doctor.grade}</span>
                      <div className="flex items-center gap-0.5">
                        {renderSendButton(doctor, sendState, isSending, isSuccess, "mobile")}
                        {renderCopyButton(doctor, isCopied)}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => doctor.survey_token && navigate(`/doctor/survey?token=${doctor.survey_token}&admin=true`)} disabled={!doctor.survey_token}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeDoctor(doctor.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </AdminLayout>
  );
}
