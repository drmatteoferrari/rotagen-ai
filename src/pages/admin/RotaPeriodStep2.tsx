import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarCheck, CalendarIcon, Plus, Trash2, ArrowLeft, ArrowRight, Save, Info, RotateCcw } from "lucide-react";
import { format, isWithinInterval, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup, type BankHolidayEntry, type BhShiftRule } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getRotaConfig } from "@/lib/rotaConfig";
import { useInvalidateQuery } from "@/hooks/useAdminQueries";

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
  const {
    setPeriodComplete, rotaStartDate, rotaEndDate,
    rotaBankHolidays, setRotaBankHolidays,
    bhSameAsWeekend, setBhSameAsWeekend,
    bhShiftRules, setBhShiftRules,
    periodWorkingStateLoaded, setPeriodWorkingStateLoaded,
  } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId, setRestoredConfig } = useRotaContext();
  const { user } = useAuth();
  const { invalidateRotaConfigDetails } = useInvalidateQuery();

  const [shiftTypes, setShiftTypes] = useState<any[]>([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date>();
  const [saving, setSaving] = useState(false);

  // Bank holiday initialisation — from context or static list
  useEffect(() => {
    if (periodWorkingStateLoaded) return;
    if (!rotaStartDate || !rotaEndDate) return;

    const filtered = UK_BANK_HOLIDAYS
      .map((h) => ({ ...h, dateObj: new Date(h.date[0], h.date[1], h.date[2]) }))
      .filter((h) => isWithinInterval(h.dateObj, { start: rotaStartDate, end: rotaEndDate }))
      .map((h, i): BankHolidayEntry => ({
        id: `bh-${i}`,
        date: new Date(h.date[0], h.date[1], h.date[2]),
        name: h.name,
        isAutoAdded: true,
        isActive: true,
      }));
    setRotaBankHolidays(filtered);
    setPeriodWorkingStateLoaded(true);
  }, [periodWorkingStateLoaded, rotaStartDate, rotaEndDate]);

  // Fetch shift types
  useEffect(() => {
    if (!currentRotaConfigId) return;
    const fetchShifts = async () => {
      const { data } = await supabase
        .from("shift_types")
        .select("id, shift_key, name, start_time, end_time, target_doctors, applicable_sun, sort_order")
        .eq("rota_config_id", currentRotaConfigId)
        .order("sort_order", { ascending: true });
      setShiftTypes(data ?? []);
    };
    fetchShifts();
  }, [currentRotaConfigId]);

  // BH shift rules initialisation — merge with shift types using ref to avoid stale closure
  const bhShiftRulesRef = useRef(bhShiftRules);
  useEffect(() => {
    bhShiftRulesRef.current = bhShiftRules;
  }, [bhShiftRules]);

  useEffect(() => {
    if (shiftTypes.length === 0) return;
    const currentRules = bhShiftRulesRef.current;
    const merged: BhShiftRule[] = shiftTypes.map((t: any) => {
      const saved = currentRules.find(r => r.shift_key === t.shift_key);
      return {
        shift_key: t.shift_key,
        name: t.name,
        start_time: String(t.start_time).slice(0, 5),
        end_time: String(t.end_time).slice(0, 5),
        target_doctors: saved ? saved.target_doctors : (t.target_doctors ?? 1),
        included: saved ? saved.included : true,
      };
    });
    const existingKeys = currentRules.map(r => r.shift_key).sort().join(",");
    const mergedKeys = merged.map(r => r.shift_key).sort().join(",");
    if (existingKeys !== mergedKeys) {
      setBhShiftRules(merged);
    }
  }, [shiftTypes]);

  const addBankHoliday = () => {
    if (newHolidayDate && newHolidayName) {
      setRotaBankHolidays([
        ...rotaBankHolidays,
        {
          id: Date.now().toString(),
          date: newHolidayDate,
          name: newHolidayName,
          isAutoAdded: false,
          isActive: true,
        },
      ]);
      setNewHolidayName("");
      setNewHolidayDate(undefined);
    }
  };

  const handleToggleBankHoliday = (id: string) => {
    setRotaBankHolidays(prev => prev.map(h => {
      if (h.id !== id) return h;
      if (h.isAutoAdded) return { ...h, isActive: !h.isActive };
      return h;
    }));
  };

  const handleRemoveManualHoliday = (id: string) => {
    setRotaBankHolidays(prev => prev.filter(h => h.id !== id || h.isAutoAdded));
  };

  const updateBhRule = (shiftKey: string, field: Partial<BhShiftRule>) => {
    setBhShiftRules(prev =>
      prev.map(r => r.shift_key === shiftKey ? { ...r, ...field } : r)
    );
  };

  const handleSave = async () => {
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
        bh_same_as_weekend: bhSameAsWeekend,
        bh_shift_rules: bhSameAsWeekend === false
          ? bhShiftRules.map(r => ({
              shift_key: r.shift_key,
              name: r.name,
              start_time: r.start_time,
              end_time: r.end_time,
              target_doctors: r.target_doctors,
              included: r.included,
            }))
          : null,
      };

      if (!configId) {
        const { data, error } = await supabase
          .from("rota_configs")
          .insert({ ...configFields, owned_by: user?.id ?? "developer1" } as any)
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

      // Delete all existing bank holidays and re-insert (including inactive)
      await supabase.from("bank_holidays").delete().eq("rota_config_id", configId);

      if (rotaBankHolidays.length > 0) {
        const rows = rotaBankHolidays.map((h) => ({
          rota_config_id: configId!,
          date: format(h.date, "yyyy-MM-dd"),
          name: h.name,
          is_auto_added: h.isAutoAdded,
          is_active: h.isActive,
        }));
        const { error: insertError } = await supabase.from("bank_holidays").insert(rows);
        if (insertError) throw insertError;
      }

      // Refresh cache
      const refreshedConfig = await getRotaConfig(configId!);
      setRestoredConfig(refreshedConfig);
      invalidateRotaConfigDetails();

      toast.success("✓ Rota period saved");
      setPeriodComplete(true);
      navigate("/admin/dashboard");
    } catch (err: any) {
      console.error("Rota period save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const sundayShifts = shiftTypes.filter(s => s.applicable_sun === true);
  const activeHolidayCount = rotaBankHolidays.filter(h => h.isActive).length;

  return (
    <AdminLayout title="Rota Period" subtitle="Step 2 of 2 — Bank Holidays" accentColor="yellow">
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          Bank holidays within the rota period are auto-populated. You can modify or add custom dates.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-amber-600" />
              Bank Holidays
            </CardTitle>
            <CardDescription>Auto-populated from your rota dates. Toggle or add custom dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add holiday */}
            <div className="rounded-lg border border-dashed border-amber-300 p-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Input placeholder="e.g. Easter Monday" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} />
              </div>
              <div className="space-y-2">
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
              <Button onClick={addBankHoliday} disabled={!newHolidayName || !newHolidayDate} className="bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="mr-1.5 h-4 w-4" />Add
              </Button>
            </div>

            {/* Holiday count banner */}
            {rotaBankHolidays.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                <Info className="h-4 w-4 shrink-0 text-amber-600" />
                {activeHolidayCount} active bank holiday{activeHolidayCount !== 1 ? "s" : ""} included in this rota period.
                {rotaBankHolidays.length !== activeHolidayCount && (
                  <span className="text-muted-foreground ml-1">
                    ({rotaBankHolidays.length - activeHolidayCount} deactivated)
                  </span>
                )}
              </div>
            )}

            {/* Holiday list */}
            {rotaBankHolidays.length > 0 ? (
              <div className="space-y-2">
                {rotaBankHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className={cn(
                      "rounded-lg border border-border p-2.5 flex items-center justify-between transition-opacity",
                      !holiday.isActive && "opacity-50"
                    )}
                  >
                    <div>
                      <p className={cn(
                        "text-sm font-medium text-card-foreground",
                        !holiday.isActive && "line-through text-muted-foreground"
                      )}>
                        {holiday.name}
                      </p>
                      <p className={cn(
                        "text-xs text-muted-foreground",
                        !holiday.isActive && "opacity-50"
                      )}>
                        {format(holiday.date, "EEEE, d MMMM yyyy")}
                      </p>
                    </div>
                    {holiday.isAutoAdded ? (
                      holiday.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleBankHoliday(holiday.id)}
                          className="text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
                          title="Deactivate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleBankHoliday(holiday.id)}
                          className="text-amber-700 hover:bg-amber-50 min-h-[44px]"
                          title="Reactivate"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reactivate
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveManualHoliday(holiday.id)}
                        className="text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-6">No bank holidays in this rota period.</p>
            )}
          </CardContent>
        </Card>

        {/* Bank Holiday Rules Card */}
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
                className={`px-6 py-2 rounded-lg text-sm font-semibold border-2 transition-colors min-h-[44px] ${
                  bhSameAsWeekend === true ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-border bg-background text-muted-foreground'
                }`}
              >Yes</button>
              <button
                type="button"
                onClick={() => setBhSameAsWeekend(false)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold border-2 transition-colors min-h-[44px] ${
                  bhSameAsWeekend === false ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-border bg-background text-muted-foreground'
                }`}
              >No — different rules apply</button>
            </div>

            {/* YES — read-only Sunday summary */}
            {bhSameAsWeekend === true && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800">Bank holidays will follow Sunday staffing rules:</p>
                {sundayShifts.length > 0 ? (
                  <div className="space-y-2">
                    {sundayShifts.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-card-foreground">{s.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-amber-700">
                          Target: {s.target_doctors ?? 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No shifts are assigned to Sundays. Configure day assignments in Department Setup.</p>
                )}
              </div>
            )}

            {/* NO — per-shift toggle list */}
            {bhSameAsWeekend === false && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Toggle shifts on/off and set target doctors for bank holidays:</p>
                {bhShiftRules.length > 0 ? (
                  bhShiftRules.map((rule) => (
                    <div
                      key={rule.shift_key}
                      className={cn(
                        "rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-opacity",
                        rule.included ? "border-border bg-background" : "border-border bg-muted/30 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Switch
                          checked={rule.included}
                          onCheckedChange={(checked) => updateBhRule(rule.shift_key, { included: checked })}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-card-foreground truncate">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">{rule.start_time} – {rule.end_time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Target doctors</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={rule.target_doctors}
                          onChange={(e) => updateBhRule(rule.shift_key, { target_doctors: Math.max(0, parseInt(e.target.value) || 0) })}
                          disabled={!rule.included}
                          className="w-20"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No shift types defined. Configure them in Department Setup.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/rota-period/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" disabled={saving} onClick={handleSave} className="bg-amber-600 hover:bg-amber-700">
            {saving ? "Saving…" : "Save Rota Period"}
            {!saving && <Save className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
