import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, CheckCircle, Loader2, BarChart2, ChevronDown, ChevronRight, Eye } from "lucide-react";
import {
  useDepartmentSetup,
  getShiftColor,
  SHIFT_COLORS,
  type ShiftType,
  type DaySlot,
} from "@/contexts/DepartmentSetupContext";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Constants (mirrors DepartmentStep3) ─────────────────────
const REF_WEEKS = 13;
const REF_HPW = 48;

// ─── Pure helpers (mirrors DepartmentStep3) ──────────────────
function getWeeklyDemand(shift: ShiftType): number {
  if (shift.daySlots.length > 0)
    return shift.daySlots.reduce((sum, ds) => sum + (ds.staffing?.target ?? 0), 0) * shift.durationHours;
  return Object.values(shift.applicableDays).filter(Boolean).length * shift.staffing.target * shift.durationHours;
}

function refHours(bucketPct: number, shiftPct: number): number {
  return Math.round((bucketPct / 100) * (shiftPct / 100) * REF_HPW * REF_WEEKS * 10) / 10;
}

function refShiftCount(bucketPct: number, shiftPct: number, dur: number): number {
  return dur > 0 ? Math.round(refHours(bucketPct, shiftPct) / dur) : 0;
}

// ─── Effective within-bucket % (mirrors Summary logic) ───────
function getEffectivePct(shift: ShiftType, peers: ShiftType[]): number {
  if (shift.targetOverridePct != null) return shift.targetOverridePct;
  const overriddenPeers = peers.filter((p) => p.targetOverridePct != null);
  const remainingPct = 100 - overriddenPeers.reduce((acc, p) => acc + (p.targetOverridePct ?? 0), 0);
  const unoverriddenCount = peers.filter((p) => p.targetOverridePct == null).length;
  return unoverriddenCount > 0 ? Math.round(remainingPct / unoverriddenCount) : 0;
}

// ─── Day labels ───────────────────────────────────────────────
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];
const DAY_SHORT: Record<DayKey, string> = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const DAY_FULL: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// ─── Badge config ─────────────────────────────────────────────
const BADGE_CONFIG = [
  { key: "night" as const, label: "🌙 Night" },
  { key: "long" as const, label: "⏱ Long (>10h)" },
  { key: "ooh" as const, label: "🌆 Out of hours" },
  { key: "oncall" as const, label: "📟 On-call" },
  { key: "nonres" as const, label: "🏠 Non-resident" },
];

const GRADE_LABELS: Record<string, string> = {
  CT1: "CT1",
  CT2: "CT2",
  CT3: "CT3",
  ST3: "ST3",
  ST4: "ST4",
  ST5: "ST5",
  ST6: "ST6",
  ST7: "ST7",
  Fellow: "Fellow",
  Consultant: "Consultant",
};

// ─── ShiftAccordionRow ────────────────────────────────────────
function ShiftAccordionRow({
  shift,
  index,
  defaultOpen,
  oncallShifts,
  nonOncallShifts,
  globalOncallPct,
}: {
  shift: ShiftType;
  index: number;
  defaultOpen: boolean;
  oncallShifts: ShiftType[];
  nonOncallShifts: ShiftType[];
  globalOncallPct: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const color = getShiftColor(index);
  const peers = shift.isOncall ? oncallShifts : nonOncallShifts;
  const withinBucketPct = getEffectivePct(shift, peers);
  const bucketPct = shift.isOncall ? globalOncallPct : 100 - globalOncallPct;
  const activeBadges = BADGE_CONFIG.filter(({ key }) => !!(shift.badges as any)?.[key]);

  return (
    <div
      className="rounded-xl border bg-card overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: color.solid }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span
          className="shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: color.solid }}
        >
          {shift.abbreviation}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{shift.name}</span>
            <span className="text-xs text-muted-foreground">
              {shift.startTime}–{shift.endTime} ·{" "}
              {typeof shift.durationHours === "number" ? shift.durationHours.toFixed(1) : "—"}h
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                shift.isOncall ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {shift.isOncall ? "On-call" : "Non-OC"}
            </span>
          </div>
          {activeBadges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {activeBadges.map(({ key, label }) => (
                <span
                  key={key}
                  className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 font-medium"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 mt-1 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border bg-muted/10">
          {/* Applicable days */}
          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Active days
            </p>
            <div className="flex gap-1.5">
              {DAY_KEYS.map((day) => {
                const active = (shift.applicableDays ?? {})[day] ?? shift.daySlots.some((ds) => ds.dayKey === day);
                const isWeekend = day === "sat" || day === "sun";
                return (
                  <div key={day} className={`flex flex-col items-center gap-0.5`}>
                    <span
                      className={`text-[9px] font-semibold ${isWeekend ? "text-purple-500" : "text-muted-foreground"}`}
                    >
                      {DAY_SHORT[day]}
                    </span>
                    <div
                      className={`h-5 w-5 rounded-full border-2 ${
                        active
                          ? isWeekend
                            ? "border-purple-500 bg-purple-500"
                            : "border-foreground bg-foreground"
                          : "border-muted-foreground/20 bg-transparent"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shift-level competency requirements */}
          {((shift.reqIac ?? 0) > 0 ||
            (shift.reqIaoc ?? 0) > 0 ||
            (shift.reqIcu ?? 0) > 0 ||
            (shift.reqTransfer ?? 0) > 0 ||
            shift.reqMinGrade) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Shift requirements
              </p>
              <div className="flex flex-wrap gap-1.5">
                {shift.reqMinGrade && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                    Min grade: {shift.reqMinGrade}
                  </span>
                )}
                {(shift.reqIac ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                    IAC ×{shift.reqIac}
                  </span>
                )}
                {(shift.reqIaoc ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                    IAOC ×{shift.reqIaoc}
                  </span>
                )}
                {(shift.reqIcu ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                    ICU ×{shift.reqIcu}
                  </span>
                )}
                {(shift.reqTransfer ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                    Transfer ×{shift.reqTransfer}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Per-day breakdown */}
          {shift.daySlots.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Per-day staffing
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Day</th>
                      <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Min</th>
                      <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Target</th>
                      <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Max</th>
                      <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Slots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shift.daySlots]
                      .sort((a, b) => DAY_KEYS.indexOf(a.dayKey as DayKey) - DAY_KEYS.indexOf(b.dayKey as DayKey))
                      .map((ds) => {
                        const hasSlots = ds.slots.length > 0;
                        return (
                          <>
                            <tr key={ds.dayKey} className="border-t border-border">
                              <td className="px-3 py-1.5 font-medium">{DAY_FULL[ds.dayKey as DayKey] ?? ds.dayKey}</td>
                              <td className="text-center px-2 py-1.5 text-muted-foreground">{ds.staffing.min}</td>
                              <td className="text-center px-2 py-1.5 font-semibold">{ds.staffing.target}</td>
                              <td className="text-center px-2 py-1.5 text-muted-foreground">
                                {ds.staffing.max ?? "—"}
                              </td>
                              <td className="text-center px-2 py-1.5">
                                {hasSlots ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold">
                                    ⚙ {ds.slots.length}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            </tr>
                            {/* Slot-level requirements sub-rows */}
                            {hasSlots &&
                              ds.slots.map((slot) => (
                                <tr key={`${ds.dayKey}-slot-${slot.slotIndex}`} className="bg-muted/20">
                                  <td colSpan={5} className="px-4 py-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                      <span className="font-semibold text-muted-foreground">
                                        Slot {slot.slotIndex + 1}
                                        {slot.label ? ` · ${slot.label}` : ""}:
                                      </span>
                                      {slot.permittedGrades.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                                          Grades: {slot.permittedGrades.join(", ")}
                                        </span>
                                      )}
                                      {slot.reqIac > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                                          IAC ×{slot.reqIac}
                                        </span>
                                      )}
                                      {slot.reqIaoc > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                                          IAOC ×{slot.reqIaoc}
                                        </span>
                                      )}
                                      {slot.reqIcu > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                                          ICU ×{slot.reqIcu}
                                        </span>
                                      )}
                                      {slot.reqTransfer > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                                          Transfer ×{slot.reqTransfer}
                                        </span>
                                      )}
                                      {slot.permittedGrades.length === 0 &&
                                        slot.reqIac === 0 &&
                                        slot.reqIaoc === 0 &&
                                        slot.reqIcu === 0 &&
                                        slot.reqTransfer === 0 && (
                                          <span className="text-muted-foreground/50">No restrictions</span>
                                        )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hour allocation reference */}
          <div className="rounded-lg px-3 py-2 bg-purple-50 border border-purple-100 text-xs text-purple-700">
            <span className="font-semibold">Hour allocation: </span>
            {withinBucketPct}% within {shift.isOncall ? "on-call" : "non-on-call"} bucket
            {" · "}~{refHours(bucketPct, withinBucketPct)}h{" · "}~
            {refShiftCount(bucketPct, withinBucketPct, shift.durationHours)} shifts per FT doctor (13-wk ref)
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function DepartmentSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPostSubmit = searchParams.get("mode") !== "pre-submit";

  const { shifts, globalOncallPct, resetDepartment } = useDepartmentSetup();
  const { setDepartmentComplete } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();
  const { user, accountSettings } = useAuth();

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // DB-read globalOncallPct fallback for post-submit refresh
  const [dbGlobalOncallPct, setDbGlobalOncallPct] = useState<number | null>(null);

  const displayOncallPct =
    isPostSubmit && globalOncallPct === 50 && dbGlobalOncallPct !== null ? dbGlobalOncallPct : globalOncallPct;

  // ── Load saved_at + fallback globalOncallPct from rota_configs ──
  useEffect(() => {
    if (!isPostSubmit || !currentRotaConfigId) return;
    supabase
      .from("rota_configs")
      .select("updated_at, global_oncall_pct")
      .eq("id", currentRotaConfigId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.updated_at) setSavedAt(format(new Date(data.updated_at), "dd MMM yyyy 'at' HH:mm"));
        if (data?.global_oncall_pct != null) setDbGlobalOncallPct(Number(data.global_oncall_pct));
      });
  }, [isPostSubmit, currentRotaConfigId]);

  const oncallShifts = shifts.filter((s) => s.isOncall);
  const nonOncallShifts = shifts.filter((s) => !s.isOncall);

  // ── Save handler (pre-submit) ─────────────────────────────
  const handleConfirmSave = async () => {
    if (!currentRotaConfigId || !user?.id) return;
    setSaving(true);
    try {
      await supabase
        .from("rota_configs")
        .update({
          global_oncall_pct: globalOncallPct,
          global_non_oncall_pct: 100 - globalOncallPct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentRotaConfigId);

      for (const shift of shifts) {
        await supabase
          .from("shift_types")
          .update({
            target_percentage: shift.targetOverridePct ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("rota_config_id", currentRotaConfigId)
          .eq("shift_key", shift.id);
      }
      setDepartmentComplete(true);
      toast.success("✓ Department setup saved");
      navigate("/admin/setup");
    } catch {
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset handler ─────────────────────────────────────────
  const handleReset = async () => {
    if (!currentRotaConfigId) return;
    setSaving(true);
    try {
      await supabase.from("shift_types").delete().eq("rota_config_id", currentRotaConfigId);
      resetDepartment();
      setDepartmentComplete(false);
      toast.success("Department setup reset");
      navigate("/admin/department/step-1");
    } catch {
      toast.error("Reset failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  // ── Cards ─────────────────────────────────────────────────
  const dataCards = (
    <>
      {/* Card 1 — Department Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-purple-600" />
            Department Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex justify-between text-sm py-2 border-b border-border">
            <span className="text-muted-foreground">Department</span>
            <span className="font-medium">{accountSettings.departmentName ?? "—"}</span>
          </div>
          <div className="flex justify-between text-sm py-2">
            <span className="text-muted-foreground">Hospital / Trust</span>
            <span className="font-medium">{accountSettings.trustName ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Weekly Schedule (enhanced grid) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-purple-600" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Weekday / Weekend column headers */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-0.5">
            {DAY_KEYS.map((day, i) => {
              const isWeekend = day === "sat" || day === "sun";
              return (
                <div
                  key={day}
                  className={`pb-0.5 ${isWeekend ? "border-t-2 border-purple-300" : "border-t-2 border-border/40"}`}
                >
                  <p
                    className={`text-[10px] font-semibold text-center ${isWeekend ? "text-purple-600" : "text-muted-foreground"}`}
                  >
                    {DAY_SHORT[day]}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {DAY_KEYS.map((day) => {
              // Use daySlots as authoritative source; fall back to applicableDays
              const daySlotsByDay = shifts
                .map((s) => {
                  const ds = s.daySlots.find((d) => d.dayKey === day);
                  const activeViaFallback = !s.daySlots.length && (s.applicableDays ?? {})[day];
                  return {
                    shift: s,
                    ds:
                      ds ??
                      (activeViaFallback
                        ? ({ staffing: s.staffing, isCustomised: false, slots: [], dayKey: day } as DaySlot)
                        : null),
                  };
                })
                .filter((x) => x.ds !== null);

              return (
                <div key={day} className="min-w-0 flex flex-col gap-0.5">
                  {daySlotsByDay.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground/30 text-center block py-1">—</span>
                  ) : (
                    daySlotsByDay.map(({ shift, ds }, i) => {
                      const idx = shifts.indexOf(shift);
                      const color = getShiftColor(idx);
                      const target = ds!.staffing?.target ?? shift.staffing.target;
                      const hasCustom = ds!.isCustomised || (ds!.slots?.length ?? 0) > 0;
                      return (
                        <div
                          key={shift.id}
                          className="rounded px-0.5 py-0.5 text-center w-full relative"
                          style={{ backgroundColor: color.solid }}
                        >
                          <span className="text-[9px] font-bold leading-tight block truncate text-white">
                            {shift.abbreviation}
                          </span>
                          <span className="text-[8px] leading-tight block opacity-90 text-white">×{target}</span>
                          {hasCustom && (
                            <span
                              className="absolute top-0 right-0 h-2 w-2 rounded-full bg-amber-400 border border-white"
                              title="Custom slot configuration"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1 align-middle" />= custom slot
            configuration
          </p>
        </CardContent>
      </Card>

      {/* Card 3 — Shift Types (accordion) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-purple-600" />
            Shift Types
          </CardTitle>
          {shifts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {shifts.length} shift{shifts.length !== 1 ? "s" : ""} · {oncallShifts.length} on-call ·{" "}
              {nonOncallShifts.length} non-on-call
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {shifts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No shift types defined.</p>
          )}
          {oncallShifts.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-1">On-call</p>
              {oncallShifts.map((s) => (
                <ShiftAccordionRow
                  key={s.id}
                  shift={s}
                  index={shifts.indexOf(s)}
                  defaultOpen={!isPostSubmit}
                  oncallShifts={oncallShifts}
                  nonOncallShifts={nonOncallShifts}
                  globalOncallPct={displayOncallPct}
                />
              ))}
            </>
          )}
          {nonOncallShifts.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-3 mb-1">Non-on-call</p>
              {nonOncallShifts.map((s) => (
                <ShiftAccordionRow
                  key={s.id}
                  shift={s}
                  index={shifts.indexOf(s)}
                  defaultOpen={!isPostSubmit}
                  oncallShifts={oncallShifts}
                  nonOncallShifts={nonOncallShifts}
                  globalOncallPct={displayOncallPct}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Card 4 — Hour Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4 text-purple-600" />
            Hour Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Global split bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>On-call</span>
              <span>Non-on-call</span>
            </div>
            <div className="flex h-3 w-full rounded-full overflow-hidden">
              <div className="bg-purple-500 transition-all" style={{ width: `${displayOncallPct}%` }} />
              <div className="bg-slate-200 flex-1" />
            </div>
            <div className="flex justify-between text-xs font-semibold mt-1">
              <span className="text-purple-700">{displayOncallPct}%</span>
              <span className="text-slate-500">{100 - displayOncallPct}%</span>
            </div>
          </div>

          {/* Per-shift rows grouped by bucket */}
          {oncallShifts.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-600 mb-1">On-call</p>
              {oncallShifts.map((s, i) => {
                const color = getShiftColor(shifts.indexOf(s));
                const withinBucketPct = getEffectivePct(s, oncallShifts);
                const globalSharePct = Math.round((displayOncallPct * withinBucketPct) / 100);
                const rh = refHours(displayOncallPct, withinBucketPct);
                const rs = refShiftCount(displayOncallPct, withinBucketPct, s.durationHours);
                return (
                  <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                    <div
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: color.solid }}
                    >
                      {s.abbreviation}
                    </div>
                    <span className="flex-1 min-w-0 text-xs text-foreground truncate">{s.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground hidden sm:block">
                      ~{rh}h · ~{rs} shifts (13-wk)
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-foreground w-10 text-right">
                      {globalSharePct}%
                    </span>
                  </div>
                );
              })}
            </>
          )}
          {nonOncallShifts.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mt-3 mb-1">Non-on-call</p>
              {nonOncallShifts.map((s) => {
                const color = getShiftColor(shifts.indexOf(s));
                const withinBucketPct = getEffectivePct(s, nonOncallShifts);
                const bucketPct = 100 - displayOncallPct;
                const globalSharePct = Math.round((bucketPct * withinBucketPct) / 100);
                const rh = refHours(bucketPct, withinBucketPct);
                const rs = refShiftCount(bucketPct, withinBucketPct, s.durationHours);
                return (
                  <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                    <div
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: color.solid }}
                    >
                      {s.abbreviation}
                    </div>
                    <span className="flex-1 min-w-0 text-xs text-foreground truncate">{s.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground hidden sm:block">
                      ~{rh}h · ~{rs} shifts (13-wk)
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-foreground w-10 text-right">
                      {globalSharePct}%
                    </span>
                  </div>
                );
              })}
            </>
          )}

          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Percentages show each shift's share of total rostered hours. Step 3 overrides applied first; remainder split
            by demand weight.
          </p>
        </CardContent>
      </Card>
    </>
  );

  // ── Nav bars ──────────────────────────────────────────────
  const navBarContent = isPostSubmit ? (
    <StepNavBar
      left={
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setShowResetConfirm(true);
            setShowEditConfirm(false);
          }}
        >
          Reset
        </Button>
      }
      right={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-1?readonly=true")}>
            <Eye className="mr-1.5 h-4 w-4" /> View
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setShowEditConfirm(true);
              setShowResetConfirm(false);
            }}
          >
            Edit
          </Button>
        </div>
      }
    />
  ) : (
    <StepNavBar
      left={
        <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-3")}>
          Back
        </Button>
      }
      right={
        <Button size="lg" disabled={saving} onClick={handleConfirmSave}>
          {saving ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Confirm & Save"
          )}
        </Button>
      }
    />
  );

  return (
    <>
      <AdminLayout
        title="Department Setup"
        subtitle={isPostSubmit ? "Summary" : "Review & save"}
        accentColor="purple"
        pageIcon={Building2}
        navBar={navBarContent}
      >
        <div className="mx-auto max-w-3xl space-y-4 animate-fadeSlideUp">
          {isPostSubmit ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Department setup complete{savedAt ? ` · ${savedAt}` : ""}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700">
              Review your department configuration before saving.
            </div>
          )}
          {dataCards}
        </div>
      </AdminLayout>

      {/* Edit confirm dialog */}
      <Dialog
        open={showEditConfirm}
        onOpenChange={(open) => {
          if (!open) setShowEditConfirm(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit department setup?</DialogTitle>
            <DialogDescription>Editing department setup may affect a rota already in progress.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => navigate("/admin/department/step-1")}>Continue to Edit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset confirm dialog */}
      <Dialog
        open={showResetConfirm}
        onOpenChange={(open) => {
          if (!open) setShowResetConfirm(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset department setup?</DialogTitle>
            <DialogDescription>
              This will permanently delete all shift types and department settings. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={handleReset}>
              {saving ? <>Resetting…</> : "Reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
