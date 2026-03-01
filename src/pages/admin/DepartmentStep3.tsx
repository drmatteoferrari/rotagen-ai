import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useDepartmentSetup } from "@/contexts/DepartmentSetupContext";

export default function DepartmentStep3() {
  const navigate = useNavigate();
  const { setDepartmentComplete } = useAdminSetup();
  const { shifts, updateShift } = useDepartmentSetup();

  const total = shifts.reduce((sum, s) => sum + s.distributionPercent, 0);
  const isValid = total === 100;

  const onCallShifts = shifts.filter((s) => s.isOnCall);
  const standardShifts = shifts.filter((s) => !s.isOnCall);
  const onCallTotal = onCallShifts.reduce((sum, s) => sum + s.distributionPercent, 0);

  return (
    <AdminLayout title="Department Setup" subtitle="Step 3 of 3 — Distribution Targets">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2 w-8 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground">Hour Distribution Targets</h2>
          <p className="text-muted-foreground text-sm mt-1">Adjust percentages so they total exactly 100%.</p>
        </div>

        {/* Validation banner */}
        {!isValid ? (
          <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-destructive font-semibold text-sm">Targets sum to {total}%</p>
              <p className="text-destructive/80 text-xs mt-0.5">Please adjust shifts to total exactly 100% before saving.</p>
            </div>
            <span className="bg-destructive/20 text-destructive text-xs font-bold px-2 py-1 rounded-full">{total}%</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border p-4" style={{ backgroundColor: "hsl(160 84% 39% / 0.1)", borderColor: "hsl(160 84% 39% / 0.2)" }}>
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--success))" }} />
            <p className="font-semibold text-sm" style={{ color: "hsl(var(--success))" }}>Distribution totals 100% ✓</p>
          </div>
        )}

        {/* On-Call Target */}
        <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <label className="font-semibold text-muted-foreground">Total On-Call %</label>
            <span className="text-2xl font-bold text-card-foreground">{onCallTotal}%</span>
          </div>
          <div className="relative h-4 w-full bg-muted rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(onCallTotal, 100)}%` }} />
          </div>
        </div>

        {/* On-Call Shifts */}
        {onCallShifts.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4 flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> On-Call Shifts
            </h4>
            <div className="space-y-4">
              {onCallShifts.map((s) => (
                <ShiftSlider key={s.id} shift={s} onUpdate={updateShift} accent="primary" />
              ))}
            </div>
          </div>
        )}

        {/* Standard Shifts */}
        {standardShifts.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4 flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" /> Standard Shifts
            </h4>
            <div className="space-y-4">
              {standardShifts.map((s) => (
                <ShiftSlider key={s.id} shift={s} onUpdate={updateShift} accent="muted" />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-2")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button
            size="lg"
            disabled={!isValid}
            onClick={() => {
              setDepartmentComplete(true);
              navigate("/admin/dashboard");
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save Department Configuration
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}

function ShiftSlider({
  shift,
  onUpdate,
  accent,
}: {
  shift: { id: string; name: string; distributionPercent: number };
  onUpdate: (id: string, u: { distributionPercent: number }) => void;
  accent: "primary" | "muted";
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <h5 className="font-semibold text-card-foreground">{shift.name}</h5>
        <span className={`font-bold text-lg ${accent === "primary" ? "text-primary" : "text-card-foreground"}`}>
          {shift.distributionPercent}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={shift.distributionPercent}
        onChange={(e) => onUpdate(shift.id, { distributionPercent: Number(e.target.value) })}
        className={`w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer ${accent === "primary" ? "accent-[hsl(var(--primary))]" : "accent-slate-400"}`}
      />
    </div>
  );
}
