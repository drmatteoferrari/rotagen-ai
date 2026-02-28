import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Plus, Minus, Phone, Home, X } from "lucide-react";

const days = ["M", "T", "W", "T", "F", "S", "S"];
const activeDays = [true, true, true, true, true, false, false];

export default function DepartmentStep2() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="Department Setup" subtitle="Step 2 of 3 — Shifts & Staffing">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </div>

        <h2 className="text-2xl font-bold text-foreground">Standard Day Shift</h2>

        {/* Shift Name */}
        <div className="space-y-2">
          <Label className="font-semibold">Shift Name</Label>
          <Input defaultValue="Standard Day Shift" placeholder="e.g. Early Morning Ward" />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Start Time</Label>
            <Input type="time" defaultValue="08:00" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">End Time</Label>
            <Input type="time" defaultValue="17:00" />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label className="font-semibold">Tags & Attributes</Label>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-700">
              Long Day <button className="ml-1 hover:text-orange-900"><X className="h-3 w-3" /></button>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-700">
              12 Hours <button className="ml-1 hover:text-blue-900"><X className="h-3 w-3" /></button>
            </span>
            <button className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Plus className="h-3 w-3" /> Add Tag
            </button>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm border border-border">
              <span className="font-medium text-card-foreground flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />On-Call</span>
              <Switch />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm border border-border">
              <span className="font-medium text-card-foreground flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />Non-Resident</span>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Active Days */}
        <div className="space-y-3">
          <Label className="font-semibold">Active Days</Label>
          <div className="flex justify-between items-center rounded-2xl bg-card p-3 shadow-sm border border-border">
            {days.map((day, i) => (
              <button key={i} className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${activeDays[i] ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Required Staff */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <Label className="font-semibold">Required Staff</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Set Maximum</span>
              <Switch />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm border border-border">
            <button className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors">
              <Minus className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-card-foreground">👨‍⚕️ 4</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Doctors</span>
            </div>
            <button className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/department/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" size="lg">
              <Plus className="mr-2 h-4 w-4" />Add new shift type
            </Button>
            <Button size="lg" onClick={() => navigate("/admin/department/step-3")} className="bg-blue-600 hover:bg-blue-700">
              Next Shift <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
