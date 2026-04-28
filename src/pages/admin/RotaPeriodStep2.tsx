import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarCheck, CalendarIcon, Plus, Trash2, ArrowLeft, ArrowRight, Save, Info, RotateCcw, CalendarDays } from "lucide-react";
import { format, isWithinInterval, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup, type BankHolidayEntry, type BhShiftRule } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getRotaConfig } from "@/lib/rotaConfig";
import { useInvalidateQuery, useRotaConfigDetailsQuery } from "@/hooks/useAdminQueries";

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
    surveyDeadline, setSurveyDeadline,
  } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId, setRestoredConfig } = useRotaContext();
  const { user } = useAuth();
  const { invalidateRotaConfigDetails } = useInvalidateQuery();

  const [shiftTypes, setShiftTypes] = useState<any[]>([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date>();
  const [saving, setSaving] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [savingDeadline, setSavingDeadline] = useState(false);

  // Single source of truth: sync deadline from DB cache (latest change wins,
  // whether edited here or in Roster).
  const { data: configDetails } = useRotaConfigDetailsQuery();
  useEffect(() => {
    if (!configDetails?.survey_deadline) return;
    const dbStr = configDetails.survey_deadline;
    const currentStr = surveyDeadline ? format(surveyDeadline, "yyyy-MM-dd") : null;
    if (currentStr === dbStr) return;
    const [y, m, d] = dbStr.split("-").map(Number);
    setSurveyDeadline(new Date(y, m - 1, d));
  }, [configDetails?.survey_deadline]);

  // Save deadline immediately on change (mirrors Roster behaviour).
  const handleDeadlineSelect = async (date: Date | undefined) => {
    setSurveyDeadline(date);
    setDeadlineOpen(false);
    if (!date || !currentRotaConfigId) return;
    setSavingDeadline(true);
    const { error } = await supabase
      .from("rota_configs")
      .update({ survey_deadline: format(date, "yyyy-MM-dd"), updated_at: new Date().toISOString() })
      .eq("id", currentRotaConfigId);
    setSavingDeadline(false);
    if (error) {
      toast.error("Failed to save deadline");
      console.error(error);
      return;
    }
    invalidateRotaConfigDetails();
    toast.success("Deadline saved");
  };

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

  // Fetch shift types + Sunday-specific targets from shift_day_slots.
  // The global shift_types.target_doctors is the default; Department Setup
  // step 2 saves the Sunday override in shift_day_slots where day_key='sun'.
  useEffect(() => {
    if (!currentRotaConfigId) return;
    const fetchShifts = async () => {
      const [shiftRes, slotRes] = await Promise.all([
        supabase
          .from("shift_types")
          .select("id, shift_key, name, start_time, end_time, target_doctors, applicable_sun, sort_order")
          .eq("rota_config_id", currentRotaConfigId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("shift_day_slots")
          .select("shift_type_id, target_doctors")
          .eq("rota_config_id", currentRotaConfigId)
          .eq("day_key", "sun"),
      ]);
      const sundayTargets = new Map(
        (slotRes.data ?? []).map((s: any) => [s.shift_type_id, s.target_doctors as number])
      );
      const merged = (shiftRes.data ?? []).map((t: any) => ({
        ...t,
        sunday_target_doctors: sundayTargets.get(t.id) ?? t.target_doctors ?? 1,
      }));
      setShiftTypes(merged);
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
        target_doctors: saved ? saved.target_doctors : (t.sunday_target_doctors ?? t.target_doctors ?? 1),
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
    <AdminLayout title="Rota Period" subtitle="Step 2 of 2 — Bank holidays" accentColor="yellow" pageIcon={CalendarDays}
      navBar={
        <StepNavBar
          left={
            <Button variant="outline" size="lg" onClick={() => navigate("/admin/rota-period/step-1")}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          }
          right={
            <Button
              size="lg"
              disabled={saving || !surveyDeadline}
              onClick={() => navigate('/admin/rota-period/summary?mode=pre-submit')}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Review &amp; Save
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
      }
    >
      <div className="mx-auto w-full max-w-7xl flex flex-col h-full min-h-0 gap-2 sm:gap-3 animate-fadeSlideUp">
        {/* Compact info banner — wraps on mobile, single line from sm. */}
        <div className="shrink-0 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 sm:px-4 py-2 text-sm font-medium text-amber-700">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 leading-snug sm:truncate">
            UK bank holidays are auto-populated. Edit or add custom dates below.
          </p>
        </div>

        {/* L4 — Survey deadline (required). Doctors must submit their survey by this date. */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 sm:px-4 py-2.5">
          <CalendarIcon className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-sm font-medium text-card-foreground">Survey deadline</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Date by which doctors must submit their survey
          </span>
          <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={savingDeadline}
                className={cn(
                  "ml-auto h-8 text-xs font-normal px-3 gap-1.5 min-w-[140px] justify-start",
                  !surveyDeadline && "text-muted-foreground border-amber-300",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {surveyDeadline ? format(surveyDeadline, "EEE, d MMM yyyy") : "Required — set deadline"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
              <Calendar
                mode="single"
                selected={surveyDeadline}
                onSelect={handleDeadlineSelect}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (date < today) return true;
                  if (rotaStartDate && date >= rotaStartDate) return true;
                  return false;
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 2-col from md (768+); single col on mobile (allows page scroll). */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 flex-1 md:min-h-0">
          {/* Card 1: Bank Holidays */}
          <Card className="flex flex-col md:min-h-0 overflow-hidden">
            <CardHeader className="shrink-0 px-3 py-2 sm:px-4 sm:py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-amber-600" />
                  Bank Holidays
                </span>
                {rotaBankHolidays.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {activeHolidayCount}/{rotaBankHolidays.length} active
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 md:min-h-0 flex flex-col gap-2 px-3 pb-3 sm:px-4 sm:pb-4 pt-0 overflow-hidden">
              {/* Add holiday — stacks on mobile/tablet (cards are narrow at md), inline on lg+. */}
              <div className="shrink-0 rounded-md border border-dashed border-amber-300 p-2 flex flex-col lg:flex-row gap-2">
                <Input
                  placeholder="Custom holiday name"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  className="lg:flex-1 h-9"
                />
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 lg:flex-none lg:w-[150px] h-9 justify-start text-left font-normal",
                          !newHolidayDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{newHolidayDate ? format(newHolidayDate, "d MMM yyyy") : "Pick a date"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Button
                    onClick={addBankHoliday}
                    disabled={!newHolidayName || !newHolidayDate}
                    className="h-9 px-3 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Plus className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </div>

              {/* Holiday list — 2-col grid on lg+ to fit more in less vertical space. */}
              <div className="flex-1 md:min-h-0 overflow-y-auto -mx-1 px-1">
                {rotaBankHolidays.length > 0 ? (
                  <ul className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                    {rotaBankHolidays.map((holiday) => (
                      <li
                        key={holiday.id}
                        className={cn(
                          "rounded-md border border-border pl-3 pr-1 py-1 flex items-center justify-between gap-2 transition-opacity",
                          !holiday.isActive && "opacity-50"
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn(
                            "text-sm font-medium text-card-foreground truncate",
                            !holiday.isActive && "line-through text-muted-foreground"
                          )}>
                            {holiday.name}
                          </p>
                          <p className={cn(
                            "text-xs text-muted-foreground truncate",
                            !holiday.isActive && "opacity-50"
                          )}>
                            {format(holiday.date, "EEE, d MMM yyyy")}
                          </p>
                        </div>
                        {holiday.isAutoAdded ? (
                          holiday.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleBankHoliday(holiday.id)}
                              className="shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive"
                              title="Deactivate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleBankHoliday(holiday.id)}
                              className="shrink-0 h-10 text-amber-700 hover:bg-amber-50"
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
                            className="shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-4">No bank holidays in this rota period.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Bank Holiday Shift Rules */}
          <Card className="flex flex-col md:min-h-0 overflow-hidden">
            <CardHeader className="shrink-0 px-3 py-2 sm:px-4 sm:py-3">
              <CardTitle className="text-base">Bank Holiday Shift Rules</CardTitle>
              <CardDescription className="text-xs">
                Should bank holidays use the same staffing as Sundays?
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 md:min-h-0 flex flex-col gap-2 px-3 pb-3 sm:px-4 sm:pb-4 pt-0 overflow-hidden">
              {/* Yes/No segmented toggle — short labels keep them on one line at any width. */}
              <div className="shrink-0 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBhSameAsWeekend(true)}
                  className={cn(
                    "h-10 rounded-md text-sm font-semibold border-2 transition-colors",
                    bhSameAsWeekend === true
                      ? "border-amber-600 bg-amber-50 text-amber-700"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >Yes</button>
                <button
                  type="button"
                  onClick={() => setBhSameAsWeekend(false)}
                  className={cn(
                    "h-10 rounded-md text-sm font-semibold border-2 transition-colors",
                    bhSameAsWeekend === false
                      ? "border-amber-600 bg-amber-50 text-amber-700"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >No</button>
              </div>

              {/* Conditional panel — internal scroll if needed. */}
              <div className="flex-1 md:min-h-0 overflow-y-auto -mx-1 px-1">
                {bhSameAsWeekend === true && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Sunday staffing applies to bank holidays:</p>
                    {sundayShifts.length > 0 ? (
                      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                        {sundayShifts.map((s: any) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-card-foreground truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-amber-700">
                              Target: {s.sunday_target_doctors ?? s.target_doctors ?? 1}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">
                        No shifts assigned to Sundays. Configure them in Department Setup.
                      </p>
                    )}
                  </div>
                )}

                {bhSameAsWeekend === false && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Toggle each shift and set the target doctor count for bank holidays:</p>
                    {bhShiftRules.length > 0 ? (
                      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                        {bhShiftRules.map((rule) => (
                          <li
                            key={rule.shift_key}
                            className={cn(
                              "rounded-md border px-3 py-2 flex items-center justify-between gap-3 transition-opacity",
                              rule.included ? "border-border bg-background" : "border-border bg-muted/30 opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <Switch
                                checked={rule.included}
                                onCheckedChange={(checked) => updateBhRule(rule.shift_key, { included: checked })}
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-card-foreground truncate">{rule.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {rule.start_time} – {rule.end_time}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Target</Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={rule.target_doctors}
                                onChange={(e) => updateBhRule(rule.shift_key, { target_doctors: Math.max(0, parseInt(e.target.value) || 0) })}
                                disabled={!rule.included}
                                className="w-16 h-9 text-center"
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No shift types defined. Configure them in Department Setup.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
