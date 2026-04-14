import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Info,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Building2,
} from "lucide-react";
import { useDepartmentSetup, getShiftColor, type ShiftType } from "@/contexts/DepartmentSetupContext";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────

const REF_WEEKS = 13;
const REF_HPW = 48;

// ─── Pure utility functions ───────────────────────────────────

function getWeeklyDemand(shift: ShiftType): number {
  if (shift.daySlots.length > 0) {
    const totalTargetPerWeek = shift.daySlots.reduce((sum, ds) => sum + (ds.staffing?.target ?? 0), 0);
    return totalTargetPerWeek * shift.durationHours;
  }
  const activeDayCount = Object.values(shift.applicableDays).filter(Boolean).length;
  return activeDayCount * shift.staffing.target * shift.durationHours;
}

function getDayCount(shift: ShiftType): number {
  if (shift.daySlots.length > 0) return shift.daySlots.length;
  return Object.values(shift.applicableDays).filter(Boolean).length;
}

function shiftFingerprint(shifts: ShiftType[]): string {
  return shifts
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => `${s.id}:${s.isOncall ? 1 : 0}:${s.daySlots.length}:${getWeeklyDemand(s)}`)
    .join("|");
}

function getDemandWeightedPcts(shifts: ShiftType[]): Record<string, number> {
  if (shifts.length === 0) return {};
  const demands = shifts.map((s) => ({ id: s.id, d: getWeeklyDemand(s) }));
  const total = demands.reduce((s, d) => s + d.d, 0);
  if (total === 0) {
    const eq = Math.round((100 / shifts.length) * 10) / 10;
    return Object.fromEntries(shifts.map((s) => [s.id, eq]));
  }
  let cum = 0;
  return Object.fromEntries(
    demands.map((d, i) => {
      if (i === demands.length - 1) return [d.id, Math.round((100 - cum) * 10) / 10];
      const v = Math.round((d.d / total) * 1000) / 10;
      cum += v;
      return [d.id, v];
    }),
  );
}

function getSuggestedGlobalSplit(oncall: ShiftType[], nonOncall: ShiftType[]): number {
  const od = oncall.reduce((s, sh) => s + getWeeklyDemand(sh), 0);
  const nd = nonOncall.reduce((s, sh) => s + getWeeklyDemand(sh), 0);
  const total = od + nd;
  if (total === 0) return 50;
  return Math.round((od / total) * 100);
}

function computeActivePcts(shifts: ShiftType[], overrides: Record<string, number>): Record<string, number> {
  if (shifts.length === 0) return {};
  const pinned = shifts.filter((s) => overrides[s.id] !== undefined);
  const unpinned = shifts.filter((s) => overrides[s.id] === undefined);
  const pinnedTotal = pinned.reduce((sum, s) => sum + overrides[s.id], 0);
  const remaining = Math.max(0, 100 - pinnedTotal);
  const unpinnedDemand = unpinned.reduce((sum, s) => sum + getWeeklyDemand(s), 0);
  return Object.fromEntries(
    shifts.map((s) => {
      if (overrides[s.id] !== undefined) return [s.id, overrides[s.id]];
      if (unpinned.length === 0) return [s.id, 0];
      if (unpinnedDemand === 0) return [s.id, Math.round((remaining / unpinned.length) * 10) / 10];
      return [s.id, Math.round((getWeeklyDemand(s) / unpinnedDemand) * remaining * 10) / 10];
    }),
  );
}

function getAutoShare(shifts: ShiftType[], overrides: Record<string, number>, shiftId: string): number {
  const withoutThis = { ...overrides };
  delete withoutThis[shiftId];
  return computeActivePcts(shifts, withoutThis)[shiftId] ?? 0;
}

function refHours(bucketPct: number, shiftPct: number): number {
  return Math.round((bucketPct / 100) * (shiftPct / 100) * REF_HPW * REF_WEEKS * 10) / 10;
}

function refShiftCount(bucketPct: number, shiftPct: number, dur: number): number {
  return dur > 0 ? Math.round(refHours(bucketPct, shiftPct) / dur) : 0;
}

// ─── GlobalSplitBar ───────────────────────────────────────────

function GlobalSplitBar({ oncallPct, onChange }: { oncallPct: number; onChange: (pct: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

  const pctFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return oncallPct;
    return clamp(((clientX - rect.left) / rect.width) * 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    onChange(pctFromPointer(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    onChange(pctFromPointer(e.clientX));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") onChange(clamp(oncallPct + (e.shiftKey ? 5 : 1)));
    if (e.key === "ArrowLeft") onChange(clamp(oncallPct - (e.shiftKey ? 5 : 1)));
  };

  return (
    <div
      ref={trackRef}
      className="relative h-8 w-full cursor-pointer select-none overflow-hidden rounded-full"
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-75"
        style={{ width: `${oncallPct}%`, background: "linear-gradient(to right, rgba(147,51,234,0.15), #9333ea)" }}
      />
      <div
        className="absolute inset-y-0 right-0 rounded-r-full transition-[width] duration-75"
        style={{
          width: `${100 - oncallPct}%`,
          background: "linear-gradient(to right, rgba(147,51,234,0.06), rgba(196,181,253,0.4))",
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3 text-[11px] font-semibold">
        <span className="text-white drop-shadow-sm">{oncallPct}% on-call</span>
        <span className="text-purple-700">{100 - oncallPct}% non-on-call</span>
      </div>
      <div
        className="absolute top-0 flex h-full items-center"
        style={{ left: `${oncallPct}%`, transform: "translateX(-50%)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuenow={oncallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="On-call percentage"
      >
        <div className="flex h-[44px] w-[44px] items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-purple-600 bg-white shadow-md" />
        </div>
      </div>
    </div>
  );
}

// ─── ShiftPctBar ──────────────────────────────────────────────

function ShiftPctBar({
  value,
  autoValue,
  isOverridden,
  onChange,
  onReset,
}: {
  value: number;
  autoValue: number;
  isOverridden: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [tooltip, setTooltip] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  const snap = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 2) / 2;

  const pctFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return value;
    return snap(((clientX - rect.left) / rect.width) * 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    setTooltip(true);
    onChange(pctFromPointer(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    onChange(pctFromPointer(e.clientX));
  };
  const onPointerUp = () => {
    dragging.current = false;
    setTooltip(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") onChange(snap(value + (e.shiftKey ? 5 : 0.5)));
    if (e.key === "ArrowLeft") onChange(snap(value - (e.shiftKey ? 5 : 0.5)));
  };

  const commitEdit = () => {
    const v = snap(parseFloat(editVal) || 0);
    onChange(v);
    setEditing(false);
  };

  const isActive = isOverridden && Math.abs(value - autoValue) > 0.5;
  const handleBorderClass = isActive ? "border-purple-600" : "border-muted-foreground/40";

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        className="relative h-[22px] flex-1 cursor-pointer select-none overflow-hidden rounded-full bg-muted/40"
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-75"
          style={{ width: `${value}%`, background: "linear-gradient(to right, rgba(147,51,234,0.1), #9333ea)" }}
        />
        <div
          className="absolute top-0 flex h-full items-center"
          style={{ left: `${value}%`, transform: "translateX(-50%)" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="slider"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Shift percentage"
        >
          {tooltip && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-foreground px-2 py-0.5 text-[10px] font-bold text-background shadow">
              {value}%
            </div>
          )}
          <div className="h-[44px] w-[44px] flex items-center justify-center p-[10px]">
            <div className={`h-4 w-4 rounded-full border-2 ${handleBorderClass} bg-white shadow-sm`} />
          </div>
        </div>
      </div>

      {editing ? (
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-14 rounded-md border border-purple-400 bg-background px-1.5 py-0.5 text-center text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      ) : (
        <button
          onClick={() => {
            setEditing(true);
            setEditVal(String(value));
          }}
          className={`min-h-[44px] w-12 text-center text-xs font-bold transition-colors hover:text-purple-700 ${
            isActive ? "text-purple-700" : "text-muted-foreground"
          }`}
        >
          {value}%
        </button>
      )}

      {isActive ? (
        <button
          onClick={onReset}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-purple-600 hover:text-purple-800 transition-colors"
          title="Reset to auto"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      ) : (
        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground/30">
          <RotateCcw className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export default function DepartmentStep3() {
  const navigate = useNavigate();
  const { shifts, isLoadingShifts } = useDepartmentSetup();
  const { setDepartmentComplete } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();
  const { user } = useAuth();

  const oncallShifts = shifts.filter((s) => s.isOncall);
  const nonOncallShifts = shifts.filter((s) => !s.isOncall);

  const [globalOncallPct, setGlobalOncallPctState] = useState(50);
  const [oncallOverrides, setOncallOverrides] = useState<Record<string, number>>({});
  const [nonOncallOverrides, setNonOncallOverrides] = useState<Record<string, number>>({});
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Whether Step 3's own DB load has run at least once after shifts were ready.
  const hasInitialisedRef = useRef(false);

  // Fingerprint recorded after each successful DB load or save.
  // Used to detect Step 2 changes and reset stale shift-type overrides.
  const loadedFingerprintRef = useRef<string | null>(null);

  const activeOncallPcts = computeActivePcts(oncallShifts, oncallOverrides);
  const activeNonOncallPcts = computeActivePcts(nonOncallShifts, nonOncallOverrides);

  const oncallSum = Object.values(activeOncallPcts).reduce((s, v) => s + v, 0);
  const nonOncallSum = Object.values(activeNonOncallPcts).reduce((s, v) => s + v, 0);

  const oncallSumErr = oncallShifts.length > 0 && Math.abs(oncallSum - 100) > 0.5;
  const nonOncallSumErr = nonOncallShifts.length > 0 && Math.abs(nonOncallSum - 100) > 0.5;
  const canSave = !oncallSumErr && !nonOncallSumErr && !saving;

  const anyOncallOverride = Object.keys(oncallOverrides).length > 0;
  const anyNonOncallOverride = Object.keys(nonOncallOverrides).length > 0;

  // ── Data loading ────────────────────────────────────────────
  // Waits for the context to finish its own DB load (isLoadingShifts === false)
  // before running. This ensures `shifts` is fully hydrated from the DB before
  // demand calculations and fingerprinting run.
  // Runs when: currentRotaConfigId changes, or isLoadingShifts transitions to false.
  useEffect(() => {
    // Block until context has finished loading shifts from DB.
    if (isLoadingShifts) return;
    // Only initialise once per config. Subsequent shift changes are handled
    // by the reset effect below.
    if (hasInitialisedRef.current) return;

    const load = async () => {
      setLoading(true);
      try {
        if (!currentRotaConfigId) {
          // No config yet — seed from demand suggestion.
          if (shifts.length > 0) {
            setGlobalOncallPctState(
              getSuggestedGlobalSplit(
                shifts.filter((s) => s.isOncall),
                shifts.filter((s) => !s.isOncall),
              ),
            );
          }
          return;
        }

        const { data: cfg, error: cfgErr } = await supabase
          .from("rota_configs")
          .select("global_oncall_pct")
          .eq("id", currentRotaConfigId)
          .single();

        if (cfgErr || cfg?.global_oncall_pct == null) {
          // No previously saved split — seed from demand.
          if (shifts.length > 0) {
            setGlobalOncallPctState(
              getSuggestedGlobalSplit(
                shifts.filter((s) => s.isOncall),
                shifts.filter((s) => !s.isOncall),
              ),
            );
          }
        } else {
          setGlobalOncallPctState(Number(cfg.global_oncall_pct));
        }

        const { data: rows } = await supabase
          .from("shift_types")
          .select("shift_key, target_percentage, is_oncall")
          .eq("rota_config_id", currentRotaConfigId);

        const oo: Record<string, number> = {};
        const no: Record<string, number> = {};
        (rows ?? []).forEach((r: any) => {
          if (r.target_percentage == null) return;
          if (r.is_oncall) oo[r.shift_key] = Number(r.target_percentage);
          else no[r.shift_key] = Number(r.target_percentage);
        });
        if (Object.keys(oo).length > 0) setOncallOverrides(oo);
        if (Object.keys(no).length > 0) setNonOncallOverrides(no);

        // Record fingerprint now that shifts are hydrated and overrides loaded.
        loadedFingerprintRef.current = shiftFingerprint(shifts);
      } catch (e) {
        console.error("Step 3 load failed:", e);
        toast.error("Could not load saved settings — defaults applied");
        if (shifts.length > 0) {
          setGlobalOncallPctState(
            getSuggestedGlobalSplit(
              shifts.filter((s) => s.isOncall),
              shifts.filter((s) => !s.isOncall),
            ),
          );
        }
      } finally {
        hasInitialisedRef.current = true;
        setLoading(false);
      }
    };

    load();
  }, [currentRotaConfigId, isLoadingShifts]);

  // ── Reset shift-type overrides when Step 2 changes ──────────
  // After initialisation, watches the live shift fingerprint.
  // When it diverges from the fingerprint at last load/save, clears overrides
  // so the auto-calculated distribution is shown fresh.
  // Does NOT reset globalOncallPct.
  useEffect(() => {
    if (loading) return;
    if (!hasInitialisedRef.current) return;
    if (loadedFingerprintRef.current === null) return;

    const current = shiftFingerprint(shifts);
    if (current !== loadedFingerprintRef.current) {
      setOncallOverrides({});
      setNonOncallOverrides({});
      loadedFingerprintRef.current = current;
    }
  }, [shifts, loading]);

  // Reset hasInitialisedRef when config changes so a full re-initialise runs.
  useEffect(() => {
    hasInitialisedRef.current = false;
    loadedFingerprintRef.current = null;
  }, [currentRotaConfigId]);

  // ── Save handler ────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (!currentRotaConfigId) throw new Error("No config");
      if (!user?.id) throw new Error("Not signed in");

      const { error: cfgErr } = await supabase
        .from("rota_configs")
        .update({
          global_oncall_pct: globalOncallPct,
          global_non_oncall_pct: 100 - globalOncallPct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentRotaConfigId);
      if (cfgErr) throw cfgErr;

      const allUpdates = [
        ...oncallShifts.map((s) => ({ key: s.id, pct: activeOncallPcts[s.id] ?? 0 })),
        ...nonOncallShifts.map((s) => ({ key: s.id, pct: activeNonOncallPcts[s.id] ?? 0 })),
      ];
      for (const u of allUpdates) {
        const { error } = await supabase
          .from("shift_types")
          .update({ target_percentage: u.pct, updated_at: new Date().toISOString() })
          .eq("rota_config_id", currentRotaConfigId)
          .eq("shift_key", u.key);
        if (error) throw error;
      }

      loadedFingerprintRef.current = shiftFingerprint(shifts);

      toast.success("✓ Distribution saved");
      setDepartmentComplete(true);
      navigate("/admin/department/summary?mode=post-submit");
    } catch (e: any) {
      console.error("Step 3 save failed:", e);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  // ── Bucket renderer ─────────────────────────────────────────
  const renderBucket = (
    bucketShifts: ShiftType[],
    activePcts: Record<string, number>,
    overrides: Record<string, number>,
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    globalBucketPct: number,
    bucketLabel: string,
    anyOverride: boolean,
    sumVal: number,
    sumErr: boolean,
    onResetAll: () => void,
  ) => {
    if (bucketShifts.length === 0) {
      return (
        <p className="py-4 text-center text-sm text-muted-foreground italic">
          No {bucketLabel.toLowerCase()} defined. Add them in Step 2.
        </p>
      );
    }

    const sumOk = !sumErr;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${sumOk ? "text-emerald-600" : "text-destructive"}`} />
            <p className="text-sm font-semibold">{bucketLabel}</p>
            <span className="text-xs text-muted-foreground">({globalBucketPct}% of hours)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sumOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              {Math.round(sumVal * 10) / 10}% {sumOk ? "✓" : "⚠"}
            </span>
            <button
              onClick={onResetAll}
              disabled={!anyOverride}
              className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors ${
                anyOverride
                  ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                  : "text-muted-foreground/40 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset all
            </button>
          </div>
        </div>

        {bucketShifts.map((shift, idx) => {
          const color = getShiftColor(idx);
          const pct = Math.round((activePcts[shift.id] ?? 0) * 10) / 10;
          const auto = Math.round(getAutoShare(bucketShifts, overrides, shift.id) * 10) / 10;
          const isOverridden = overrides[shift.id] !== undefined;
          const demand = getWeeklyDemand(shift);
          const dayCount = getDayCount(shift);
          const targetDoctors = shift.staffing.target;
          const isRefActive = isOverridden && Math.abs(pct - auto) > 0.5;

          return (
            <div
              key={shift.id}
              className="rounded-xl border bg-card p-4 space-y-2"
              style={{ borderLeftWidth: 4, borderLeftColor: color.solid }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-bold border ${color.bg} ${color.text} ${color.border}`}
                >
                  {shift.abbreviation}
                </span>
                <span className="text-sm font-medium">{shift.name}</span>
                <span className="text-xs text-muted-foreground">
                  {shift.startTime}–{shift.endTime} · {shift.durationHours}h
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                {dayCount}d/wk × {targetDoctors} doctor{targetDoctors !== 1 ? "s" : ""} × {shift.durationHours}h ={" "}
                {Math.round(demand * 10) / 10}h/wk demand · Auto: {auto}%
              </p>

              <ShiftPctBar
                value={pct}
                autoValue={auto}
                isOverridden={isOverridden}
                onChange={(v) => setOverrides((prev) => ({ ...prev, [shift.id]: v }))}
                onReset={() =>
                  setOverrides((prev) => {
                    const next = { ...prev };
                    delete next[shift.id];
                    return next;
                  })
                }
              />

              <p
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  isRefActive ? "bg-purple-50 text-purple-700" : "bg-muted/50 text-muted-foreground"
                }`}
              >
                ~{refHours(globalBucketPct, pct)}h · ~{refShiftCount(globalBucketPct, pct, shift.durationHours)} shifts
                per FT doctor (13-wk ref)
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  // ── JSX ─────────────────────────────────────────────────────
  return (
    <AdminLayout
      title="Department Setup"
      subtitle="Step 3 of 3 — Hours"
      accentColor="purple"
      pageIcon={Building2}
      navBar={
        <StepNavBar
          left={
            <Button
              variant="outline"
              size="lg"
              className="min-h-[44px]"
              onClick={() => navigate("/admin/department/step-2")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          }
          right={
            <Button size="lg" className="min-h-[44px]" disabled={!canSave || saving} onClick={handleSave}>
              {saving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <ArrowRight className="mr-1 h-4 w-4" />
                  Review &amp; Save
                </>
              )}
            </Button>
          }
        />
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        {loading || isLoadingShifts ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* ── ZONE 1: GLOBAL SPLIT ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-5 w-5 text-purple-600" />
                  On-call vs non-on-call split
                </CardTitle>
                <CardDescription>
                  Set the on-call fraction of contracted time. Higher = more coverage, heavier rota. Lower = lighter
                  rota, harder to fill all shifts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <GlobalSplitBar oncallPct={globalOncallPct} onChange={setGlobalOncallPctState} />

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-purple-600" />
                    On-call: {globalOncallPct}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    Non-on-call: {100 - globalOncallPct}%
                    <span className="h-3 w-3 rounded-full bg-purple-200" />
                  </span>
                </div>

                {globalOncallPct > 60 && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      Over 60% on-call — the rota may be demanding for doctors. Check this reflects your department's
                      actual needs.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── ZONE 2: ADVANCED (COLLAPSED) ── */}
            <Card>
              <button
                onClick={() => setExpandedAdvanced((v) => !v)}
                className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-xl"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold">Shift type distribution</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Advanced
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated from shift demands. Increase a shift's % to prioritise filling it — useful if a
                    specific shift is harder to cover.
                  </p>

                  {!expandedAdvanced && (
                    <div className="pt-2 space-y-2">
                      {oncallShifts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            On-call
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {oncallShifts.map((shift, idx) => {
                              const color = getShiftColor(idx);
                              const pct = Math.round(activeOncallPcts[shift.id] ?? 0);
                              return (
                                <span
                                  key={shift.id}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium border ${color.bg} ${color.text} ${color.border}`}
                                >
                                  {shift.abbreviation}
                                  <span className="font-bold">{pct}%</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {nonOncallShifts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Non-on-call
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {nonOncallShifts.map((shift, idx) => {
                              const color = getShiftColor(idx);
                              const pct = Math.round(activeNonOncallPcts[shift.id] ?? 0);
                              return (
                                <span
                                  key={shift.id}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium border ${color.bg} ${color.text} ${color.border}`}
                                >
                                  {shift.abbreviation}
                                  <span className="font-bold">{pct}%</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {expandedAdvanced ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground mt-1" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground mt-1" />
                )}
              </button>

              {expandedAdvanced && (
                <CardContent className="space-y-6 pt-0">
                  <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Each bucket totals 100% independently. Changing one shift redistributes the remainder
                      proportionally across the others.
                    </p>
                  </div>

                  {renderBucket(
                    oncallShifts,
                    activeOncallPcts,
                    oncallOverrides,
                    setOncallOverrides,
                    globalOncallPct,
                    "On-call shifts",
                    anyOncallOverride,
                    oncallSum,
                    oncallSumErr,
                    () => setOncallOverrides({}),
                  )}

                  {oncallShifts.length > 0 && nonOncallShifts.length > 0 && (
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 border-t border-border" />
                      <span className="text-xs font-semibold text-muted-foreground">Non-on-call shifts</span>
                      <div className="flex-1 border-t border-border" />
                    </div>
                  )}

                  {renderBucket(
                    nonOncallShifts,
                    activeNonOncallPcts,
                    nonOncallOverrides,
                    setNonOncallOverrides,
                    100 - globalOncallPct,
                    "Non-on-call shifts",
                    anyNonOncallOverride,
                    nonOncallSum,
                    nonOncallSumErr,
                    () => setNonOncallOverrides({}),
                  )}

                  {oncallShifts.length === 0 && nonOncallShifts.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground italic">
                      No shift types found. Define shift types in Step 2 first.
                    </p>
                  )}

                  {(oncallSumErr || nonOncallSumErr) && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-red-700">Cannot save — fix the percentages above.</p>
                        {oncallSumErr && (
                          <p className="text-xs text-red-600">
                            On-call total: {Math.round(oncallSum * 10) / 10}% (must be 100%)
                          </p>
                        )}
                        {nonOncallSumErr && (
                          <p className="text-xs text-red-600">
                            Non-on-call total: {Math.round(nonOncallSum * 10) / 10}% (must be 100%)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* REFERENCE NOTE */}
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Shift estimates assume a full-time doctor, 13-week rota, 48h/week.</p>
                <p>
                  Actual allocations are recalculated per doctor at generation time using their WTE, leave, and rota
                  length.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
