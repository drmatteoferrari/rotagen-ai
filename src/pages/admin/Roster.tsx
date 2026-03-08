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

    // SECTION 6 COMPLETE — warn if VITE_APP_URL not set
    if (!import.meta.env.VITE_APP_URL) {
      toast.warning("Survey links will use the current URL origin. Set VITE_APP_URL in environment variables before sending production invites.");
    }

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

  return (
    <AdminLayout title="Roster & Invites" subtitle="Build the team and send survey invitations">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">

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
