import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Sunset, Plus, Pencil } from "lucide-react";
import { useDepartmentSetup, type ShiftType } from "@/contexts/DepartmentSetupContext";

const periodConfig: Record<string, { icon: typeof Sun; badgeClasses: string }> = {
  Morning: { icon: Sun, badgeClasses: "bg-amber-50 text-amber-600" },
  Evening: { icon: Sunset, badgeClasses: "bg-indigo-50 text-indigo-600" },
  Night: { icon: Moon, badgeClasses: "bg-slate-100 text-slate-600" },
};

export default function DepartmentStep1() {
  const navigate = useNavigate();
  const { shifts, addShift, setCurrentShiftIndex } = useDepartmentSetup();

  const handleAddShift = () => {
    addShift();
    navigate("/admin/department/step-2");
  };

  const handleEditShift = (index: number) => {
    setCurrentShiftIndex(index);
    navigate("/admin/department/step-2");
  };

  return (
    <AdminLayout title="Department Setup" subtitle="Step 1 of 3 — Shift Overview">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="mb-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Shift Overview</h2>
          <p className="text-muted-foreground mt-1">Review your core shift types. These will be used to build your clinical schedule.</p>
        </div>

        <div className="flex flex-col gap-4">
          {shifts.map((shift, i) => {
            const cfg = periodConfig[shift.period] ?? periodConfig.Morning;
            const Icon = cfg.icon;
            return (
              <div key={shift.id} className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${cfg.badgeClasses}`}>
                      <Icon className="h-3.5 w-3.5" /> {shift.period}
                    </span>
                    <h3 className="text-xl font-bold text-card-foreground mt-2">{shift.name}</h3>
                    <p className="text-sm font-semibold text-muted-foreground">{shift.startTime} — {shift.endTime}</p>
                  </div>
                  <button
                    onClick={() => handleEditShift(i)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pt-4">
          <Button variant="outline" size="lg" onClick={handleAddShift}>
            <Plus className="mr-2 h-4 w-4" />Add New Shift Type
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setCurrentShiftIndex(0);
              navigate("/admin/department/step-2");
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Next: Staffing
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
