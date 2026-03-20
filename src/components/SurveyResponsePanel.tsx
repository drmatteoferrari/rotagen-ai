import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_OPTIONS } from "@/lib/gradeOptions";

// SECTION 8 — Admin edit slide-over panel

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

      // Sync identity fields back to doctors table (single source of truth)
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

            {/* Step 2: Competencies */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 2: Competencies</h3>
              <div className="space-y-3">
                {[
                  { key: "comp_ip_anaesthesia", label: "IP Anaesthesia" },
                  { key: "comp_ip_anaesthesia_here", label: "IP Anaesthesia (here)" },
                  { key: "comp_obstetric", label: "Obstetric" },
                  { key: "comp_obstetric_here", label: "Obstetric (here)" },
                  { key: "comp_icu", label: "ICU" },
                  { key: "comp_icu_here", label: "ICU (here)" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <Switch checked={!!data[key]} onCheckedChange={(v) => setField(key, v)} />
                  </div>
                ))}
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

            {/* Step 4: Leave */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 4: Leave & Unavailability</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Annual Leave (JSON)</label>
                  <Textarea
                    value={JSON.stringify(data.annual_leave ?? [], null, 2)}
                    onChange={(e) => { try { setField("annual_leave", JSON.parse(e.target.value)); } catch {} }}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Study Leave (JSON)</label>
                  <Textarea
                    value={JSON.stringify(data.study_leave ?? [], null, 2)}
                    onChange={(e) => { try { setField("study_leave", JSON.parse(e.target.value)); } catch {} }}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">NOC Dates (JSON)</label>
                  <Textarea
                    value={JSON.stringify(data.noc_dates ?? [], null, 2)}
                    onChange={(e) => { try { setField("noc_dates", JSON.parse(e.target.value)); } catch {} }}
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* Step 5: Exemptions */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 5: Exemptions & Restrictions</h3>
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

            {/* Step 6: Preferences */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Step 6: Preferences & Training</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Preferred Shift Types (comma-separated)</label>
                  <Input
                    value={(data.preferred_shift_types ?? []).join(", ")}
                    onChange={(e) => setField("preferred_shift_types", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Other Requests</label>
                  <Textarea value={data.other_requests ?? ""} onChange={(e) => setField("other_requests", e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sign-off Requirements</label>
                  <Textarea value={data.signoff_requirements ?? ""} onChange={(e) => setField("signoff_requirements", e.target.value)} rows={2} />
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

// SECTION 8 COMPLETE
