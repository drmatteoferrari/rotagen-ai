import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_OPTIONS } from "@/lib/gradeOptions";
import { DateRangePicker } from "@/components/survey/DateRangePicker";

interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  grade: string;
  rota_config_id: string;
  survey_status: string;
}

interface SurveyResponsePanelProps {
  doctor: Doctor | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SurveyResponsePanel({ doctor, open, onClose, onSaved }: SurveyResponsePanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open || !doctor) return;
    loadResponses();
  }, [open, doctor?.id]);

  const loadResponses = async () => {
    if (!doctor) return;
    setLoading(true);
    const { data: row } = await supabase
      .from("doctor_survey_responses")
      .select("*")
      .eq("doctor_id", doctor.id)
      .eq("rota_config_id", doctor.rota_config_id)
      .maybeSingle();

    setData(row ?? {
      full_name: `${doctor.first_name} ${doctor.last_name}`,
      nhs_email: doctor.email ?? "",
      grade: doctor.grade,
    });
    setLoading(false);
  };

  const setField = (key: string, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!doctor) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("doctor_survey_responses")
        .upsert(
          {
            doctor_id: doctor.id,
            rota_config_id: doctor.rota_config_id,
            ...data,
            last_saved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "doctor_id,rota_config_id" }
        );
      if (error) throw error;

      // Sync identity fields back to doctors table
      const fullName: string = data.full_name ?? "";
      const nameParts = fullName.trim().split(/\s+/);
      const syncFirst = nameParts[0] ?? "";
      const syncLast = nameParts.slice(1).join(" ");
      const { error: docSyncErr } = await supabase
        .from("doctors")
        .update({
          first_name: syncFirst || doctor.first_name,
          last_name: syncLast || doctor.last_name,
          email: (data.nhs_email as string | null) || doctor.email,
          grade: (data.grade as string | null) || doctor.grade,
        })
        .eq("id", doctor.id);
      if (docSyncErr) {
        console.error("Failed to sync doctors table:", docSyncErr);
      }

      toast.success(`✓ ${doctor.first_name} ${doctor.last_name}'s responses saved`);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save survey responses:", err);
      toast.error("Failed to save responses — please try again");
    } finally {
      setSaving(false);
    }
  };

  const statusColor = doctor?.survey_status === "submitted" ? "bg-emerald-500/15 text-emerald-600" :
    doctor?.survey_status === "in_progress" ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground";

  // Leave list helpers
  const getLeaveList = (key: string): { startDate: string; endDate: string; reason: string }[] => {
    const arr = data[key];
    return Array.isArray(arr) ? arr : [];
  };

  const updateLeaveEntry = (key: string, index: number, field: string, value: string) => {
    const list = [...getLeaveList(key)];
    list[index] = { ...list[index], [field]: value };
    setField(key, list);
  };

  const addLeaveEntry = (key: string) => {
    setField(key, [...getLeaveList(key), { startDate: "", endDate: "", reason: "" }]);
  };

  const removeLeaveEntry = (key: string, index: number) => {
    setField(key, getLeaveList(key).filter((_, i) => i !== index));
  };

  // Competency helpers
  const getCj = () => (data.competencies_json ?? {}) as Record<string, any>;

  const setCompField = (comp: string, subfield: string, value: boolean) => {
    const cj = getCj();
    setField("competencies_json", {
      ...cj,
      [comp]: { ...cj[comp], [subfield]: value },
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:min-w-[560px] sm:max-w-[640px] overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">
              Survey responses — {doctor?.first_name} {doctor?.last_name}
            </SheetTitle>
          </div>
          {doctor && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Grade: {doctor.grade}</span>
              <Badge className={statusColor}>{doctor.survey_status}</Badge>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-amber-700 text-left mt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            Changes here update both the survey record and the doctor's profile.
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8 py-6">
            {/* Step 1: Personal Details */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 1: Personal Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                  <Input value={data.full_name ?? ""} onChange={(e) => setField("full_name", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">NHS Email</label>
                  <Input value={data.nhs_email ?? ""} onChange={(e) => setField("nhs_email", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Grade</label>
                  <select
                    value={data.grade ?? ""}
                    onChange={(e) => setField("grade", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select grade</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Specialty</label>
                  <Input value={data.specialty ?? ""} onChange={(e) => setField("specialty", e.target.value)} />
                </div>
              </div>
            </section>

            {/* Step 2: Competencies — using competencies_json */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 2: Competencies</h3>
              <div className="space-y-4">
                {(["iac", "iaoc", "icu", "transfer"] as const).map((comp) => {
                  const cj = getCj();
                  const block = cj[comp] ?? {};
                  const labels: Record<string, string> = { iac: "IAC", iaoc: "IAOC", icu: "ICU", transfer: "Transfer" };
                  return (
                    <div key={comp} className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-sm font-semibold">{labels[comp]}</p>
                      {(["achieved", "workingTowards", "remoteSupervision"] as const).map((sub) => {
                        const subLabels: Record<string, string> = {
                          achieved: "Achieved",
                          workingTowards: "Working towards",
                          remoteSupervision: "Remote supervision",
                        };
                        const val = block[sub] as boolean | null | undefined;
                        return (
                          <div key={sub} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{subLabels[sub]}</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setCompField(comp, sub, true)}
                                className={`px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${val === true ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-background text-muted-foreground border-border hover:border-emerald-300"}`}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompField(comp, sub, false)}
                                className={`px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${val === false ? "bg-red-100 text-red-700 border-red-300" : "bg-background text-muted-foreground border-border hover:border-red-300"}`}
                              >
                                No
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Working Pattern */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 3: Working Pattern</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">WTE %</label>
                  <Input type="number" value={data.wte_percent ?? 100} onChange={(e) => setField("wte_percent", Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">LTFT Days Off (comma-separated)</label>
                  <Input
                    value={(data.ltft_days_off ?? []).join(", ")}
                    onChange={(e) => setField("ltft_days_off", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                  />
                </div>
              </div>
            </section>

            {/* Step 4: Leave — structured date-range UI */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 4: Leave & Unavailability</h3>
              <div className="space-y-4">
                {(["annual_leave", "study_leave", "noc_dates", "other_unavailability"] as const).map((key) => {
                  const labels: Record<string, string> = {
                    annual_leave: "Annual Leave",
                    study_leave: "Study Leave",
                    noc_dates: "NOC Dates",
                    other_unavailability: "Other Unavailability",
                  };
                  const list = getLeaveList(key);
                  return (
                    <div key={key} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">{labels[key]}</p>
                      {list.map((entry, idx) => (
                        <div key={idx} className="rounded-lg border border-border p-2.5 space-y-2">
                          <DateRangePicker
                            startDate={entry.startDate ?? ""}
                            endDate={entry.endDate ?? ""}
                            onChange={(s, e) => {
                              const updated = [...list];
                              updated[idx] = { ...updated[idx], startDate: s, endDate: e };
                              setField(key, updated);
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Reason (optional)"
                              value={entry.reason ?? ""}
                              onChange={(e) => updateLeaveEntry(key, idx, "reason", e.target.value)}
                              className="text-xs flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                              onClick={() => removeLeaveEntry(key, idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addLeaveEntry(key)}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add entry
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Step 5: Exemptions */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 5: Medical Exemptions</h3>
              <div className="space-y-3">
                {[
                  { key: "exempt_from_nights", label: "Exempt from nights" },
                  { key: "exempt_from_weekends", label: "Exempt from weekends" },
                  { key: "exempt_from_oncall", label: "Exempt from on-call" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <Switch checked={!!data[key]} onCheckedChange={(v) => setField(key, v)} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Exemption Details</label>
                  <Textarea value={data.exemption_details ?? ""} onChange={(e) => setField("exemption_details", e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Additional Restrictions</label>
                  <Textarea value={data.additional_restrictions ?? ""} onChange={(e) => setField("additional_restrictions", e.target.value)} rows={2} />
                </div>
              </div>
            </section>

            {/* Step 6: Preferences & Training */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 6: Preferences & Training</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Specialties Requested</label>
                  <div className="text-xs text-card-foreground bg-muted rounded-md p-2 mt-1">
                    {Array.isArray(data.specialties_requested) && data.specialties_requested.length > 0
                      ? data.specialties_requested.map((s: any, i: number) => (
                          <p key={i}>{s.name}{s.notes ? ` — ${s.notes}` : ""}</p>
                        ))
                      : <p className="text-muted-foreground">None</p>
                    }
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Special Sessions</label>
                  <div className="text-xs text-card-foreground bg-muted rounded-md p-2 mt-1">
                    {Array.isArray(data.special_sessions) && data.special_sessions.length > 0
                      ? data.special_sessions.map((s: any, i: number) => (
                          <p key={i}>{typeof s === "string" ? s : s.name}{typeof s !== "string" && s.notes ? ` — ${s.notes}` : ""}</p>
                        ))
                      : <p className="text-muted-foreground">None</p>
                    }
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sign-off Needs</label>
                  <Textarea value={data.signoff_needs ?? ""} onChange={(e) => setField("signoff_needs", e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Additional Notes</label>
                  <Textarea value={data.additional_notes ?? ""} onChange={(e) => setField("additional_notes", e.target.value)} rows={2} />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="sticky bottom-0 bg-background border-t pt-4 pb-4 flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : "Save Changes"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
