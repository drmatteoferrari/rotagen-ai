import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle, CheckCircle2, RotateCcw, Info } from "lucide-react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useDepartmentSetup } from "@/contexts/DepartmentSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Draggable bar component ─── */
function DragBar({
  value,
  onChange,
  label,
  autoValue,
  onReset,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  autoValue?: number;
  onReset?: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromPointer(e);
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  const updateFromPointer = (e: React.PointerEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = Math.round((x / rect.width) * 1000) / 10;
    onChange(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-sm text-card-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
            {value.toFixed(1)}%
          </span>
          {onReset && (() => {
            const isOverridden = autoValue !== undefined && Math.abs(value - autoValue) > 0.5;
            return (
              <button
                onClick={onReset}
                className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                  isOverridden
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "bg-muted text-muted-foreground/40"
                }`}
                title={isOverridden ? `Reset to auto (${autoValue!.toFixed(1)}%)` : "Percentage is at auto value"}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            );
          })()}
        </div>
      </div>
      <div
        ref={barRef}
        className="relative h-11 w-full bg-muted rounded-full overflow-hidden cursor-pointer select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-[width] duration-75"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-3 bg-primary-foreground border-2 border-primary rounded-full -translate-x-1/2 shadow-md"
          style={{ left: `${Math.min(value, 100)}%` }}
        />
      </div>
      {autoValue !== undefined && (
        <p className="text-[10px] text-muted-foreground mt-1">Auto: {autoValue.toFixed(1)}%</p>
      )}
    </div>
  );
}

/* ─── Global split bar ─── */
function GlobalSplitBar({
  oncallPct,
  onChange,
}: {
  oncallPct: number;
  onChange: (v: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromPointer(e);
  };

  const handlePointerUp = () => { dragging.current = false; };

  const updateFromPointer = (e: React.PointerEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = Math.round(x / rect.width * 100);
    onChange(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <Label className="font-semibold text-muted-foreground">Global On-Call / Non-On-Call Split</Label>
      <div className="flex justify-between text-sm font-bold">
        <span className="text-primary">On-call: {oncallPct}%</span>
        <span className="text-muted-foreground">Non-on-call: {100 - oncallPct}%</span>
      </div>
      <div
        ref={barRef}
        className="relative h-11 w-full rounded-full overflow-hidden cursor-pointer select-none bg-muted"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute top-0 left-0 h-full bg-primary rounded-l-full transition-[width] duration-75" style={{ width: `${oncallPct}%` }} />
        <div
          className="absolute top-0 h-full w-4 bg-card border-2 border-primary rounded-full -translate-x-1/2 shadow-lg"
          style={{ left: `${oncallPct}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0">On-call %:</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={oncallPct}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          className="w-20 h-8 text-sm"
        />
      </div>
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>📊 Target: {oncallPct}% on-call / {100 - oncallPct}% non-on-call. The breakdowns below split these hours across shift types.</p>
      </div>
    </div>
  );
}

/* ─── Distribution section for a group of shifts ─── */
function ShiftDistribution({
  title,
  shifts,
  overrides,
  setOverrides,
}: {
  title: string;
  shifts: { id: string; name: string }[];
  overrides: Record<string, number | undefined>;
  setOverrides: (fn: (prev: Record<string, number | undefined>) => Record<string, number | undefined>) => void;
}) {
  if (shifts.length === 0) return null;

  // Calculate auto values: equal share for non-overridden shifts from remaining budget
  const overriddenTotal = shifts.reduce((sum, s) => sum + (overrides[s.id] ?? 0), 0);
  const nonOverriddenCount = shifts.filter((s) => overrides[s.id] === undefined).length;
  const overriddenOnlyTotal = shifts.filter((s) => overrides[s.id] !== undefined).reduce((sum, s) => sum + (overrides[s.id] ?? 0), 0);
  const remaining = Math.max(0, 100 - overriddenOnlyTotal);
  const autoShare = nonOverriddenCount > 0 ? remaining / nonOverriddenCount : 0;

  const getValue = (id: string) => overrides[id] ?? autoShare;
  const total = shifts.reduce((sum, s) => sum + getValue(s.id), 0);
  const isValid = Math.abs(total - 100) < 0.5;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {title}
        </h4>
        {(() => {
          const hasOverrides = shifts.some((s) => {
            if (overrides[s.id] === undefined) return false;
            const overriddenOnlyTotal = shifts.filter((sh) => overrides[sh.id] !== undefined).reduce((sum, sh) => sum + (overrides[sh.id] ?? 0), 0);
            const nonOverriddenCount = shifts.filter((sh) => overrides[sh.id] === undefined).length;
            const remaining = Math.max(0, 100 - overriddenOnlyTotal);
            const auto = nonOverriddenCount > 0 ? remaining / nonOverriddenCount : 0;
            return Math.abs((overrides[s.id] ?? auto) - auto) > 0.5;
          });
          return (
            <button
              onClick={() => setOverrides((prev) => {
                const next = { ...prev };
                shifts.forEach((s) => delete next[s.id]);
                return next;
              })}
              className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                hasOverrides
                  ? "bg-destructive text-destructive-foreground animate-pulse-once"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Reset all to auto
            </button>
          );
        })()}
      </div>

      <div className="space-y-3">
        {shifts.map((s) => (
          <DragBar
            key={s.id}
            label={s.name}
            value={getValue(s.id)}
            autoValue={autoShare}
            onChange={(v) => setOverrides((prev) => ({ ...prev, [s.id]: v }))}
            onReset={() => setOverrides((prev) => { const next = { ...prev }; delete next[s.id]; return next; })}
          />
        ))}
      </div>

      <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${
        isValid ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-destructive/10 border-destructive/20 text-destructive"
      }`}>
        {isValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        Total: {total.toFixed(1)}%
      </div>
    </div>
  );
}

export default function DepartmentStep3() {
  const navigate = useNavigate();
  const { setDepartmentComplete } = useAdminSetup();
  const { shifts, globalOncallPct, setGlobalOncallPct, shiftTargetOverrides, setShiftTargetOverrides } = useDepartmentSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const oncallShifts = useMemo(() => shifts.filter((s) => s.isOncall).map((s) => ({ id: s.id, name: s.name })), [shifts]);
  const nonOncallShifts = useMemo(() => shifts.filter((s) => !s.isOncall).map((s) => ({ id: s.id, name: s.name })), [shifts]);

  // Separate overrides for oncall vs non-oncall
  const [oncallOverrides, setOncallOverrides] = useState<Record<string, number | undefined>>({});
  const [nonOncallOverrides, setNonOncallOverrides] = useState<Record<string, number | undefined>>({});

  // Validation
  const getGroupTotal = (groupShifts: { id: string }[], overrides: Record<string, number | undefined>) => {
    const overriddenOnlyTotal = groupShifts.filter((s) => overrides[s.id] !== undefined).reduce((sum, s) => sum + (overrides[s.id] ?? 0), 0);
    const nonOverriddenCount = groupShifts.filter((s) => overrides[s.id] === undefined).length;
    const remaining = Math.max(0, 100 - overriddenOnlyTotal);
    const autoShare = nonOverriddenCount > 0 ? remaining / nonOverriddenCount : 0;
    return groupShifts.reduce((sum, s) => sum + (overrides[s.id] ?? autoShare), 0);
  };

  const oncallTotal = getGroupTotal(oncallShifts, oncallOverrides);
  const nonOncallTotal = getGroupTotal(nonOncallShifts, nonOncallOverrides);
  const oncallValid = oncallShifts.length === 0 || Math.abs(oncallTotal - 100) < 0.5;
  const nonOncallValid = nonOncallShifts.length === 0 || Math.abs(nonOncallTotal - 100) < 0.5;

  const errors: string[] = [];
  if (shifts.length === 0) errors.push("At least 1 shift must exist.");
  shifts.forEach((s) => {
    if (!s.name.trim()) errors.push(`Shift "${s.id}" needs a name.`);
    if (s.startTime === s.endTime) errors.push(`"${s.name}": start and end time cannot be equal.`);
    if (!Object.values(s.applicableDays).some(Boolean)) errors.push(`"${s.name}": at least 1 day must be selected.`);
  });
  if (!oncallValid) errors.push(`On-call breakdown totals ${oncallTotal.toFixed(1)}% — must be 100%.`);
  if (!nonOncallValid) errors.push(`Non-on-call breakdown totals ${nonOncallTotal.toFixed(1)}% — must be 100%.`);

  const canSave = errors.length === 0;

  return (
    <AdminLayout title="Department Setup" subtitle="Step 2 of 2 — Distribution Targets">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground">Hour Distribution Targets</h2>
          <p className="text-muted-foreground text-sm mt-1">Set the on-call split and individual shift targets. Each group must total 100%.</p>
        </div>

        {/* Global split */}
        <GlobalSplitBar oncallPct={globalOncallPct} onChange={setGlobalOncallPct} />

        {/* On-call shifts */}
        {oncallShifts.length > 0 ? (
          <ShiftDistribution
            title="On-Call Shifts"
            shifts={oncallShifts}
            overrides={oncallOverrides}
            setOverrides={setOncallOverrides}
          />
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            ⚠️ No resident on-call shifts defined. Mark at least one shift as on-call in step-1.
          </div>
        )}

        {/* Non-on-call shifts */}
        {nonOncallShifts.length > 0 && (
          <ShiftDistribution
            title="Non-On-Call Shifts"
            shifts={nonOncallShifts}
            overrides={nonOncallOverrides}
            setOverrides={setNonOncallOverrides}
          />
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {err}
              </p>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button
            size="lg"
            disabled={!canSave || saving}
            onClick={async () => {
              setSaving(true);
              try {
                // SECTION 4 — Save on /admin/department/step-2
                const nonOncallPct = 100 - globalOncallPct;
                let configId = currentRotaConfigId;

                if (!configId) {
                  const { data, error } = await supabase
                    .from("rota_configs")
                    .insert({ global_oncall_pct: globalOncallPct, global_non_oncall_pct: nonOncallPct, owned_by: user?.username ?? "developer1" } as any)
                    .select("id")
                    .single();
                  if (error) throw error;
                  configId = data.id;
                  setCurrentRotaConfigId(configId);
                } else {
                  const { error } = await supabase
                    .from("rota_configs")
                    .update({ global_oncall_pct: globalOncallPct, global_non_oncall_pct: nonOncallPct, updated_at: new Date().toISOString() })
                    .eq("id", configId);
                  if (error) throw error;
                }

                // Delete existing shift_types
                await supabase.from("shift_types").delete().eq("rota_config_id", configId);

                // Compute target percentages for each shift
                const oncallShiftIds = shifts.filter(s => s.isOncall).map(s => s.id);
                const nonOncallShiftIds = shifts.filter(s => !s.isOncall).map(s => s.id);

                const getTargetPct = (shiftId: string, groupIds: string[], overrides: Record<string, number | undefined>) => {
                  const overriddenTotal = groupIds.filter(id => overrides[id] !== undefined).reduce((sum, id) => sum + (overrides[id] ?? 0), 0);
                  const nonOverriddenCount = groupIds.filter(id => overrides[id] === undefined).length;
                  const remaining = Math.max(0, 100 - overriddenTotal);
                  const autoShare = nonOverriddenCount > 0 ? remaining / nonOverriddenCount : 0;
                  return overrides[shiftId] ?? autoShare;
                };

                // Insert shift_types
                const shiftRows = shifts.map((s, idx) => {
                  const isOncall = s.isOncall;
                  const groupIds = isOncall ? oncallShiftIds : nonOncallShiftIds;
                  const overrides = isOncall ? oncallOverrides : nonOncallOverrides;
                  const merged = { ...s.badges };
                  // Apply overrides to get effective badges
                  for (const key of Object.keys(s.badgeOverrides) as Array<keyof typeof s.badgeOverrides>) {
                    if (s.badgeOverrides[key] !== undefined) merged[key] = s.badgeOverrides[key]!;
                  }

                  return {
                    rota_config_id: configId!,
                    shift_key: s.id,
                    name: s.name,
                    start_time: s.startTime,
                    end_time: s.endTime,
                    duration_hours: s.durationHours,
                    is_oncall: s.isOncall,
                    is_non_res_oncall: s.isNonRes,
                    applicable_mon: s.applicableDays.mon,
                    applicable_tue: s.applicableDays.tue,
                    applicable_wed: s.applicableDays.wed,
                    applicable_thu: s.applicableDays.thu,
                    applicable_fri: s.applicableDays.fri,
                    applicable_sat: s.applicableDays.sat,
                    applicable_sun: s.applicableDays.sun,
                    badge_night: merged.night,
                    badge_long: merged.long,
                    badge_ooh: merged.ooh,
                    badge_weekend: merged.weekend,
                    badge_oncall: merged.oncall,
                    badge_nonres: merged.nonres,
                    badge_night_manual_override: s.badgeOverrides.night ?? null,
                    badge_long_manual_override: s.badgeOverrides.long ?? null,
                    badge_ooh_manual_override: s.badgeOverrides.ooh ?? null,
                    badge_weekend_manual_override: s.badgeOverrides.weekend ?? null,
                    badge_oncall_manual_override: s.badgeOverrides.oncall ?? null,
                    badge_nonres_manual_override: s.badgeOverrides.nonres ?? null,
                    oncall_manually_set: s.oncallManuallySet,
                    min_doctors: s.staffing.min,
                    max_doctors: s.staffing.max,
                    target_percentage: getTargetPct(s.id, groupIds, overrides),
                    sort_order: idx,
                    // ✅ Section 3 — competency & grade fields
                    req_iac: s.reqIac,
                    req_iaoc: s.reqIaoc,
                    req_icu: s.reqIcu,
                    req_min_grade: s.reqMinGrade,
                  };
                });

                const { error: insertError } = await supabase.from("shift_types").insert(shiftRows);
                if (insertError) throw insertError;

                toast.success("✓ Shift configuration saved");
                setDepartmentComplete(true);
                navigate("/admin/dashboard");
                // SECTION 4 COMPLETE
              } catch (err: any) {
                console.error("Department save failed:", err);
                toast.error("Save failed — please try again");
              } finally {
                setSaving(false);
              }
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? "Saving…" : "Save Department Configuration"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
