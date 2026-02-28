import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Sunset, Plus, Pencil } from "lucide-react";

const shifts = [
  { name: "Early Shift", time: "07:00 — 15:00", period: "Morning", icon: Sun, badgeClasses: "bg-amber-50 text-amber-600" },
  { name: "Late Shift", time: "14:00 — 22:00", period: "Evening", icon: Sunset, badgeClasses: "bg-indigo-50 text-indigo-600" },
  { name: "Night Shift", time: "21:00 — 07:00", period: "Night", icon: Moon, badgeClasses: "bg-slate-100 text-slate-600" },
];

export default function DepartmentStep1() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="Department Setup" subtitle="Step 1 of 3 — Shift Overview">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="mb-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Shift Overview</h2>
          <p className="text-muted-foreground mt-1">Review your core shift types. These will be used to build your clinical schedule.</p>
        </div>

        <div className="flex flex-col gap-4">
          {shifts.map((shift) => (
            <div key={shift.name} className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${shift.badgeClasses}`}>
                    <shift.icon className="h-3.5 w-3.5" /> {shift.period}
                  </span>
                  <h3 className="text-xl font-bold text-card-foreground mt-2">{shift.name}</h3>
                  <p className="text-sm font-semibold text-muted-foreground">{shift.time}</p>
                </div>
                <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pt-4">
          <Button variant="outline" size="lg">
            <Plus className="mr-2 h-4 w-4" />Add New Shift Type
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/department/step-2")} className="bg-blue-600 hover:bg-blue-700">
            Next: Staffing
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
