import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, Info } from "lucide-react";

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
  const { maxAvgWeekly, setMaxAvgWeekly, maxIn7Days, setMaxIn7Days } = useAdminSetup();

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 1 of 4 — Rest Period Rules">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <Info className="h-4 w-4 shrink-0 text-red-600" />
          Configure the base legal limits for your rota. Values exceeding WTR thresholds are flagged automatically.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-600" />
              Rest Period Rules
            </CardTitle>
            <CardDescription>Legally fixed minimum rest intervals between and after shifts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Max Avg Weekly Hours</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={maxAvgWeekly}
                  onChange={(e) => setMaxAvgWeekly(Number(e.target.value))}
                  className="pr-12 focus-visible:ring-red-500 focus-visible:border-red-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">hrs</span>
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
              <Label>Max Hours in 7 Days</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={maxIn7Days}
                  onChange={(e) => setMaxIn7Days(Number(e.target.value))}
                  className="pr-12 focus-visible:ring-red-500 focus-visible:border-red-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">hrs</span>
              </div>
              <p className="text-xs text-muted-foreground">Absolute maximum for any single rolling week.</p>
              <WtrWarning
                value={maxIn7Days}
                threshold={72}
                belowMsg="✅ More restrictive than WTR minimum — compliant."
                aboveMsg="⚠️ WTR WARNING: Setting above 72 hours in any 168-hour period may breach Working Time Regulations. A Guardian of Safe Working Hours fine may apply."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-2")} className="bg-red-600 hover:bg-red-700">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
