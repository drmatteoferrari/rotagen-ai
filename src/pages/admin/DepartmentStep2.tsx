import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Plus, Minus, Phone, Home, X } from "lucide-react";
import { useDepartmentSetup } from "@/contexts/DepartmentSetupContext";

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function DepartmentStep2() {
  const navigate = useNavigate();
  const { shifts, currentShiftIndex, setCurrentShiftIndex, updateShift } = useDepartmentSetup();
  const shift = shifts[currentShiftIndex];

  if (!shift) {
    navigate("/admin/department/step-1");
    return null;
  }

  const isLast = currentShiftIndex === shifts.length - 1;

  const handleNext = () => {
    if (isLast) {
      navigate("/admin/department/step-3");
    } else {
      setCurrentShiftIndex(currentShiftIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentShiftIndex === 0) {
      navigate("/admin/department/step-1");
    } else {
      setCurrentShiftIndex(currentShiftIndex - 1);
    }
  };

  return (
    <AdminLayout title="Department Setup" subtitle={`Step 2 of 3 — Shift ${currentShiftIndex + 1} of ${shifts.length}`}>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Shift counter badge */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">{shift.name}</h2>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {currentShiftIndex + 1} / {shifts.length}
          </span>
        </div>

        {/* Shift Name */}
        <div className="space-y-2">
          <Label className="font-semibold">Shift Name</Label>
          <Input
            value={shift.name}
            onChange={(e) => updateShift(shift.id, { name: e.target.value })}
            placeholder="e.g. Early Morning Ward"
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Start Time</Label>
            <Input type="time" value={shift.startTime} onChange={(e) => updateShift(shift.id, { startTime: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">End Time</Label>
            <Input type="time" value={shift.endTime} onChange={(e) => updateShift(shift.id, { endTime: e.target.value })} />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label className="font-semibold">Tags & Attributes</Label>
          <div className="flex flex-wrap gap-2">
            {shift.tags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                {tag}
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={() => updateShift(shift.id, { tags: shift.tags.filter((_, ti) => ti !== i) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              onClick={() => {
                const tag = prompt("Enter tag name:");
                if (tag) updateShift(shift.id, { tags: [...shift.tags, tag] });
              }}
            >
              <Plus className="h-3 w-3" /> Add Tag
            </button>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm border border-border">
              <span className="font-medium text-card-foreground flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />On-Call</span>
              <Switch checked={shift.isOnCall} onCheckedChange={(v) => updateShift(shift.id, { isOnCall: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm border border-border">
              <span className="font-medium text-card-foreground flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />Non-Resident</span>
              <Switch checked={shift.isNonResident} onCheckedChange={(v) => updateShift(shift.id, { isNonResident: v })} />
            </div>
          </div>
        </div>

        {/* Active Days */}
        <div className="space-y-3">
          <Label className="font-semibold">Active Days</Label>
          <div className="flex justify-between items-center rounded-2xl bg-card p-3 shadow-sm border border-border">
            {dayLabels.map((day, i) => (
              <button
                key={i}
                onClick={() => {
                  const newDays = [...shift.activeDays];
                  newDays[i] = !newDays[i];
                  updateShift(shift.id, { activeDays: newDays });
                }}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${shift.activeDays[i] ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Required Staff */}
        <div className="space-y-3">
          <Label className="font-semibold">Required Staff</Label>
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm border border-border">
            <button
              onClick={() => updateShift(shift.id, { requiredStaff: Math.max(1, shift.requiredStaff - 1) })}
              className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-card-foreground">👨‍⚕️ {shift.requiredStaff}</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Doctors</span>
            </div>
            <button
              onClick={() => updateShift(shift.id, { requiredStaff: shift.requiredStaff + 1 })}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pt-4">
          <Button variant="outline" size="lg" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={handleNext} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isLast ? "Continue to Distribution" : "Next Shift"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
