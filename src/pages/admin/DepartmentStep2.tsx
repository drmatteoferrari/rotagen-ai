import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Plus, Minus, Phone, Home, Clock } from "lucide-react";
import { useDepartmentSetup } from "@/contexts/DepartmentSetupContext";
import type { DaysPreset } from "@/lib/shiftUtils";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const PRESET_OPTIONS: { value: DaysPreset; label: string }[] = [
  { value: "weekday", label: "Weekday (Mon–Fri)" },
  { value: "weekend", label: "Weekend (Sat–Sun)" },
  { value: "ext_weekend", label: "Extended Weekend (Fri–Sun)" },
  { value: "any", label: "Any Day" },
  { value: "custom", label: "Custom" },
];

export default function DepartmentStep2() {
  const navigate = useNavigate();
  const { shifts, currentShiftIndex, setCurrentShiftIndex, updateShift, updateShiftTimes, updateShiftPreset } = useDepartmentSetup();
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

        {/* Times + Duration */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Start Time</Label>
            <Input
              type="time"
              value={shift.startTime}
              onChange={(e) => updateShiftTimes(shift.id, e.target.value, shift.endTime)}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">End Time</Label>
            <Input
              type="time"
              value={shift.endTime}
              onChange={(e) => updateShiftTimes(shift.id, shift.startTime, e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Duration</Label>
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted text-muted-foreground text-sm font-medium">
              <Clock className="h-3.5 w-3.5" />
              {shift.durationHours}h
            </div>
          </div>
        </div>

        {/* Days Preset */}
        <div className="space-y-3">
          <Label className="font-semibold">Applicable Days</Label>
          <Select value={shift.daysPreset} onValueChange={(v) => updateShiftPreset(shift.id, v as DaysPreset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Day toggles (always visible, editable only for custom) */}
          <div className="flex justify-between items-center rounded-2xl bg-card p-3 shadow-sm border border-border">
            {DAY_KEYS.map((key, i) => (
              <button
                key={key}
                disabled={shift.daysPreset !== "custom"}
                onClick={() => {
                  if (shift.daysPreset !== "custom") return;
                  updateShift(shift.id, {
                    applicableDays: { ...shift.applicableDays, [key]: !shift.applicableDays[key] },
                  });
                }}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  shift.applicableDays[key]
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-muted text-muted-foreground"
                } ${shift.daysPreset !== "custom" ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/80"}`}
              >
                {DAY_LABELS[i]}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <Label className="font-semibold">Shift Attributes</Label>
          <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm border border-border">
            <span className="font-medium text-card-foreground flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />On-Call (Resident)</span>
            <Switch checked={shift.isOncall} onCheckedChange={(v) => updateShift(shift.id, { isOncall: v })} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm border border-border">
            <span className="font-medium text-card-foreground flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />Non-Resident On-Call</span>
            <Switch checked={shift.isNonRes} onCheckedChange={(v) => updateShift(shift.id, { isNonRes: v })} />
          </div>
        </div>

        {/* Staffing */}
        <div className="space-y-3">
          <Label className="font-semibold">Minimum Staffing</Label>
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm border border-border">
            <button
              onClick={() => updateShift(shift.id, { staffing: { ...shift.staffing, min: Math.max(1, shift.staffing.min - 1) } })}
              className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-card-foreground">👨‍⚕️ {shift.staffing.min}</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Doctors (min)</span>
            </div>
            <button
              onClick={() => updateShift(shift.id, { staffing: { ...shift.staffing, min: shift.staffing.min + 1 } })}
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
