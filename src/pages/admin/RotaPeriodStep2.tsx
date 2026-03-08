import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, ArrowLeft, Info } from "lucide-react";
import { format, isWithinInterval, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BankHoliday {
  id: string;
  date: Date;
  name: string;
}

const UK_BANK_HOLIDAYS: { date: [number, number, number]; name: string }[] = [
  // 2025
  { date: [2025, 0, 1], name: "New Year's Day" },
  { date: [2025, 3, 18], name: "Good Friday" },
  { date: [2025, 3, 21], name: "Easter Monday" },
  { date: [2025, 4, 5], name: "Early May Bank Holiday" },
  { date: [2025, 4, 26], name: "Spring Bank Holiday" },
  { date: [2025, 7, 25], name: "Summer Bank Holiday" },
  { date: [2025, 11, 25], name: "Christmas Day" },
  { date: [2025, 11, 26], name: "Boxing Day" },
  // 2026
  { date: [2026, 0, 1], name: "New Year's Day" },
  { date: [2026, 3, 3], name: "Good Friday" },
  { date: [2026, 3, 6], name: "Easter Monday" },
  { date: [2026, 4, 4], name: "Early May Bank Holiday" },
  { date: [2026, 4, 25], name: "Spring Bank Holiday" },
  { date: [2026, 7, 31], name: "Summer Bank Holiday" },
  { date: [2026, 11, 25], name: "Christmas Day" },
  { date: [2026, 11, 28], name: "Boxing Day (substitute)" },
  // 2027
  { date: [2027, 0, 1], name: "New Year's Day" },
  { date: [2027, 2, 26], name: "Good Friday" },
  { date: [2027, 2, 29], name: "Easter Monday" },
  { date: [2027, 4, 3], name: "Early May Bank Holiday" },
  { date: [2027, 4, 31], name: "Spring Bank Holiday" },
  { date: [2027, 7, 30], name: "Summer Bank Holiday" },
  { date: [2027, 11, 27], name: "Christmas Day (substitute)" },
  { date: [2027, 11, 28], name: "Boxing Day (substitute)" },
];

export default function RotaPeriodStep2() {
  const navigate = useNavigate();
  const { setPeriodComplete, rotaStartDate, rotaEndDate } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date>();
  const [initialized, setInitialized] = useState(false);
  // ✅ Section 5b — BH rules state
  const [bhSameAsWeekend, setBhSameAsWeekend] = useState<boolean | null>(null);
  const [bhCustomRules, setBhCustomRules] = useState<string>("");

  useEffect(() => {
    if (initialized || !rotaStartDate || !rotaEndDate) return;
    const filtered = UK_BANK_HOLIDAYS
      .map((h) => ({ ...h, dateObj: new Date(h.date[0], h.date[1], h.date[2]) }))
      .filter((h) => isWithinInterval(h.dateObj, { start: rotaStartDate, end: rotaEndDate }))
      .map((h, i) => ({ id: `bh-${i}`, date: h.dateObj, name: h.name }));
    setBankHolidays(filtered);
    setInitialized(true);
  }, [rotaStartDate, rotaEndDate, initialized]);

  // ✅ Section 5d — restore BH rules from config on mount
  useEffect(() => {
    if (!currentRotaConfigId) return;
    const loadBhRules = async () => {
      const { data: config } = await supabase
        .from("rota_configs")
        .select("bh_same_as_weekend, bh_custom_rules")
        .eq("id", currentRotaConfigId)
        .maybeSingle();
      if (config) {
        if ((config as any).bh_same_as_weekend !== undefined && (config as any).bh_same_as_weekend !== null) {
          setBhSameAsWeekend((config as any).bh_same_as_weekend);
        }
        if ((config as any).bh_custom_rules) {
          setBhCustomRules((config as any).bh_custom_rules);
        }
      }
    };
    loadBhRules();
  }, [currentRotaConfigId]);

  const addBankHoliday = () => {
    if (newHolidayDate && newHolidayName) {
      setBankHolidays([...bankHolidays, { id: Date.now().toString(), date: newHolidayDate, name: newHolidayName }]);
      setNewHolidayName("");
      setNewHolidayDate(undefined);
    }
  };

  const removeBankHoliday = (id: string) => {
    setBankHolidays(bankHolidays.filter((h) => h.id !== id));
  };

  return (
    <AdminLayout title="Rota Period" subtitle="Step 2 of 2 — Bank Holidays">
      <div className="mx-auto max-w-3xl space-y-6">
        {bankHolidays.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
            <Info className="h-4 w-4 shrink-0" />
            {bankHolidays.length} bank holiday{bankHolidays.length !== 1 ? "s" : ""} included in this rota period.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-amber-500" />
              Bank Holidays
            </CardTitle>
            <CardDescription>Bank holidays within the rota period are auto-populated. You can modify or add custom dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Holiday Name</Label>
                <Input placeholder="e.g. Easter Monday" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full sm:w-[200px] justify-start text-left font-normal", !newHolidayDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newHolidayDate ? format(newHolidayDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={addBankHoliday} disabled={!newHolidayName || !newHolidayDate}>
                <Plus className="mr-1.5 h-4 w-4" />Add
              </Button>
            </div>

            {bankHolidays.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border">
                {bankHolidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{format(holiday.date, "EEEE, d MMMM yyyy")}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeBankHoliday(holiday.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-6">No bank holidays in this rota period.</p>
            )}
          </CardContent>
        </Card>

        {/* ✅ Section 5a — Bank Holiday Rules Card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-card-foreground">Bank Holiday Shift Rules</p>
              <p className="text-xs text-muted-foreground mt-1">Do bank holidays follow the same staffing rules as weekends?</p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setBhSameAsWeekend(true)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  bhSameAsWeekend === true ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                }`}
              >Yes</button>
              <button
                type="button"
                onClick={() => setBhSameAsWeekend(false)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  bhSameAsWeekend === false ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                }`}
              >No — different rules apply</button>
            </div>
            {bhSameAsWeekend === false && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Describe the bank holiday rules for your department:</label>
                <textarea
                  value={bhCustomRules}
                  onChange={e => setBhCustomRules(e.target.value)}
                  placeholder="e.g. BH are treated as standard weekdays with reduced staffing. Night shifts still run as normal."
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}
          </CardContent>
        </Card>
        {/* ✅ Section 5a complete */}
        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/rota-period/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" disabled={saving} onClick={async () => {
            // SECTION 5 — Save on /admin/rota-period/step-2
            setSaving(true);
            try {
              const startDateStr = rotaStartDate ? format(rotaStartDate, "yyyy-MM-dd") : null;
              const endDateStr = rotaEndDate ? format(rotaEndDate, "yyyy-MM-dd") : null;
              const durationDays = rotaStartDate && rotaEndDate ? differenceInDays(rotaEndDate, rotaStartDate) : null;
              const durationWeeks = durationDays != null ? Number((durationDays / 7).toFixed(1)) : null;

              let configId = currentRotaConfigId;
              const configFields = {
                rota_start_date: startDateStr,
                rota_end_date: endDateStr,
                rota_duration_days: durationDays,
                rota_duration_weeks: durationWeeks,
                rota_start_time: "08:00",
                rota_end_time: "08:00",
                // ✅ Section 5c — persist BH rules
                bh_same_as_weekend: bhSameAsWeekend,
                bh_custom_rules: bhSameAsWeekend === false ? bhCustomRules : null,
              };

              if (!configId) {
                const { data, error } = await supabase
                  .from("rota_configs")
                  .insert({ ...configFields, owned_by: user?.username ?? "developer1" } as any)
                  .select("id")
                  .single();
                if (error) throw error;
                configId = data.id;
                setCurrentRotaConfigId(configId);
              } else {
                const { error } = await supabase
                  .from("rota_configs")
                  .update({ ...configFields, updated_at: new Date().toISOString() })
                  .eq("id", configId);
                if (error) throw error;
              }

              // Delete existing bank_holidays
              await supabase.from("bank_holidays").delete().eq("rota_config_id", configId);

              // Insert bank_holidays
              if (bankHolidays.length > 0) {
                const rows = bankHolidays.map((h) => ({
                  rota_config_id: configId!,
                  date: format(h.date, "yyyy-MM-dd"),
                  name: h.name,
                  is_auto_added: h.id.startsWith("bh-"),
                }));
                const { error: insertError } = await supabase.from("bank_holidays").insert(rows);
                if (insertError) throw insertError;
              }

              toast.success("✓ Rota period saved");
              setPeriodComplete(true);
              navigate("/admin/dashboard");
              // SECTION 5 COMPLETE
            } catch (err: any) {
              console.error("Rota period save failed:", err);
              toast.error("Save failed — please try again");
            } finally {
              setSaving(false);
            }
          }} className="bg-amber-500 hover:bg-amber-600">
            {saving ? "Saving…" : "Save Rota Period"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
