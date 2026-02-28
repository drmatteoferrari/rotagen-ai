import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";

const onCallShifts = [
  { name: "Night Shift (A)", baseline: "15%", value: 18 },
  { name: "Weekend Call", baseline: "10%", value: 12 },
];

const standardShifts = [
  { name: "Day Clinic", baseline: "40%", value: 42 },
  { name: "Admin / Research", baseline: "30%", value: 30 },
];

export default function DepartmentStep3() {
  const navigate = useNavigate();
  const { setDepartmentComplete } = useAdminSetup();

  return (
    <AdminLayout title="Department Setup" subtitle="Step 3 of 3 — Distribution Targets">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2 w-8 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground">Hour Distribution Targets</h2>
          <p className="text-muted-foreground text-sm mt-1">Fine-tune the workload balance between On-Call and standard shifts.</p>
        </div>

        {/* Warning */}
        <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-destructive font-semibold text-sm">Targets sum to 102%</p>
            <p className="text-destructive/80 text-xs mt-0.5">Please adjust shifts to total exactly 100% before saving.</p>
          </div>
          <span className="bg-destructive/20 text-destructive text-xs font-bold px-2 py-1 rounded-full">102%</span>
        </div>

        {/* On-Call Target */}
        <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <label className="font-semibold text-muted-foreground">Target On-Call %</label>
            <span className="text-2xl font-bold text-card-foreground">45%</span>
          </div>
          <div className="relative h-4 w-full bg-muted rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full bg-blue-600 rounded-full" style={{ width: "45%" }} />
          </div>
          <div className="flex justify-between mt-3 text-xs text-muted-foreground font-medium">
            <span>0%</span><span>Target: 40-50%</span><span>100%</span>
          </div>
        </div>

        {/* On-Call Shifts */}
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4 flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> On-Call Shifts
          </h4>
          <div className="space-y-4">
            {onCallShifts.map((s) => (
              <div key={s.name} className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-semibold text-card-foreground">{s.name}</h5>
                    <p className="text-xs text-muted-foreground">Baseline: {s.baseline}</p>
                  </div>
                  <span className="text-blue-600 font-bold text-lg">{s.value}%</span>
                </div>
                <input type="range" min={0} max={100} defaultValue={s.value} className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>
            ))}
          </div>
        </div>

        {/* Standard Shifts */}
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4 flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" /> Standard Shifts
          </h4>
          <div className="space-y-4">
            {standardShifts.map((s) => (
              <div key={s.name} className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-semibold text-card-foreground">{s.name}</h5>
                    <p className="text-xs text-muted-foreground">Baseline: {s.baseline}</p>
                  </div>
                  <span className="text-card-foreground font-bold text-lg">{s.value}%</span>
                </div>
                <input type="range" min={0} max={100} defaultValue={s.value} className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-slate-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-2")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => { setDepartmentComplete(true); navigate("/admin/dashboard"); }} className="bg-blue-600 hover:bg-blue-700">
            Save Department Configuration
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
