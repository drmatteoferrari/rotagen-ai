import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, Lock } from "lucide-react";

export default function WtrStep1() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 1 of 4 — Hours & Limits">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-red-500">Step 1 of 4</span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-500">Hours & Limits</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: "25%" }} />
        </div>

        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Working Time Regulations</h2>
          <p className="text-muted-foreground mt-1">Configure the base legal limits for your rota. Some fields are locked for compliance.</p>
        </div>

        {/* Weekly Limits */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-red-500" /> Weekly Limits
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <Label className="font-semibold">Max Avg Weekly Hours</Label>
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500 border border-red-500/20">
                <Lock className="h-3 w-3" /> Locked Legal Limit
              </span>
            </div>
            <div className="relative">
              <Input type="number" defaultValue={48} disabled className="opacity-75 cursor-not-allowed pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground">Calculated over a 17-week reference period.</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <Label className="font-semibold">Max Hours in 7 Days</Label>
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500 border border-red-500/20">
                <Lock className="h-3 w-3" /> Locked Legal Limit
              </span>
            </div>
            <div className="relative">
              <Input type="number" defaultValue={72} disabled className="opacity-75 cursor-not-allowed pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground">Absolute maximum for any single rolling week.</p>
          </div>
        </div>

        {/* Shift Configuration */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-500" /> Shift Configuration
          </h3>
          <div className="space-y-2">
            <Label className="font-semibold">Max Shift Length</Label>
            <div className="relative">
              <Input type="number" defaultValue={13} className="pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground">Includes handover time. Standard recommendation is 12-13 hours.</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-2")} className="bg-red-500 hover:bg-red-600">
            Continue to Step 2
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
