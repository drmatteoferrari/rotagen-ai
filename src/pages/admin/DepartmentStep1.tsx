import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Sunset, Plus, Pencil, Clock, Trash2 } from "lucide-react";
import { useDepartmentSetup, type ShiftType } from "@/contexts/DepartmentSetupContext";
import { crossesMidnight } from "@/lib/shiftUtils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function getTimeIcon(shift: ShiftType) {
  if (crossesMidnight(shift.startTime, shift.endTime)) return Moon;
  const startHour = parseInt(shift.startTime.split(":")[0]);
  if (startHour < 14) return Sun;
  return Sunset;
}

function getTimeBadge(shift: ShiftType) {
  if (crossesMidnight(shift.startTime, shift.endTime))
    return { label: "Night", classes: "bg-slate-100 text-slate-600" };
  const startHour = parseInt(shift.startTime.split(":")[0]);
  if (startHour < 14) return { label: "Day", classes: "bg-amber-50 text-amber-600" };
  return { label: "Evening", classes: "bg-indigo-50 text-indigo-600" };
}

const BADGE_LABELS = [
  { key: "night", label: "NIGHT" },
  { key: "long", label: "LONG" },
  { key: "ooh", label: "OOH" },
  { key: "weekend", label: "WEEKEND" },
] as const;

export default function DepartmentStep1() {
  const navigate = useNavigate();
  const { shifts, addShift, removeShift, setCurrentShiftIndex } = useDepartmentSetup();

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
            const badge = getTimeBadge(shift);
            const Icon = getTimeIcon(shift);
            return (
              <div key={shift.id} className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${badge.classes}`}>
                      <Icon className="h-3.5 w-3.5" /> {badge.label}
                    </span>
                    <h3 className="text-xl font-bold text-card-foreground mt-2">{shift.name}</h3>
                    <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {shift.startTime} — {shift.endTime}
                      <span className="ml-2 text-xs font-medium text-muted-foreground/70">({shift.durationHours}h)</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {shift.isOncall && (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase">On-Call</span>
                      )}
                      {shift.isNonRes && (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase">Non-Res</span>
                      )}
                      <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold uppercase capitalize">{shift.daysPreset}</span>
                    </div>
                    {/* Badges — disabled WIP */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {BADGE_LABELS.map(({ key, label }) => (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground/40 cursor-not-allowed select-none line-through">
                              {label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Coming soon</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {shifts.length > 1 && (
                      <button
                        onClick={() => removeShift(shift.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditShift(i)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
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
