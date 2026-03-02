import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, CheckCircle, AlertTriangle } from "lucide-react";

function WtrWarning({ value, threshold, aboveMsg, belowMsg }: { value: number; threshold: number; aboveMsg: string; belowMsg: string }) {
  if (value < threshold) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-1.5">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {belowMsg}
      </div>
    );
  }
  if (value > threshold) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {aboveMsg}
      </div>
    );
  }
  return null;
}

export default function WtrStep1() {
  const navigate = useNavigate();
  const [maxAvgWeekly, setMaxAvgWeekly] = useState(48);
  const [maxIn7Days, setMaxIn7Days] = useState(72);

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 1 of 4 — Hours & Limits">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-red-500">Step 1 of 4</span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-500">Hours & Limits</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: "25%" }} />
        </div>

        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Working Time Regulations</h2>
          <p className="text-muted-foreground mt-1">Configure the base legal limits for your rota.</p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-red-500" /> Weekly Limits
          </h3>
          <div className="space-y-2">
            <Label className="font-semibold">Max Avg Weekly Hours</Label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={168}
                value={maxAvgWeekly}
                onChange={(e) => setMaxAvgWeekly(Number(e.target.value))}
                className="pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground">Calculated over a 17-week reference period.</p>
            <WtrWarning
              value={maxAvgWeekly}
              threshold={48}
              belowMsg="✅ More restrictive than WTR minimum — compliant."
              aboveMsg="⚠️ WTR WARNING: Setting above 48 hours may breach Working Time Regulations. A Guardian of Safe Working Hours fine may apply."
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Max Hours in 7 Days</Label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={168}
                value={maxIn7Days}
                onChange={(e) => setMaxIn7Days(Number(e.target.value))}
                className="pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground">Absolute maximum for any single rolling week.</p>
            <WtrWarning
              value={maxIn7Days}
              threshold={72}
              belowMsg="✅ More restrictive than WTR minimum — compliant."
              aboveMsg="⚠️ WTR WARNING: Setting above 72 hours in any 168-hour period may breach Working Time Regulations. A Guardian of Safe Working Hours fine may apply."
            />
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
