import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, Info, Minus, Plus } from "lucide-react";

function WtrWarning({ value, threshold, aboveMsg, belowMsg }: { value: number; threshold: number; aboveMsg: string; belowMsg: string }) {
  if (value < threshold) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {belowMsg}
      </div>
    );
  }
  if (value > threshold) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
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

  const limits = [
    {
      label: "Max Avg Weekly Hours",
      sub: "Calculated over a 17-week reference period",
      value: maxAvgWeekly,
      set: setMaxAvgWeekly,
      threshold: 48,
      belowMsg: "✅ More restrictive than WTR minimum — compliant.",
      aboveMsg: "⚠️ WTR WARNING: Setting above 48 hours may breach Working Time Regulations. A Guardian of Safe Working Hours fine may apply.",
    },
    {
      label: "Max Hours in 7 Days",
      sub: "Absolute maximum for any single rolling week",
      value: maxIn7Days,
      set: setMaxIn7Days,
      threshold: 72,
      belowMsg: "✅ More restrictive than WTR minimum — compliant.",
      aboveMsg: "⚠️ WTR WARNING: Setting above 72 hours in any 168-hour period may breach Working Time Regulations. A Guardian of Safe Working Hours fine may apply.",
    },
  ];

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
          <CardContent className="space-y-4">
            {limits.map((item) => (
              <div key={item.label}>
                <div className="rounded-lg border border-border p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.sub}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-muted p-1.5 rounded-lg border border-border">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all"
                      onClick={() => item.set(Math.max(1, item.value - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-card-foreground">{item.value}</span>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all"
                      onClick={() => item.set(item.value + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <WtrWarning value={item.value} threshold={item.threshold} belowMsg={item.belowMsg} aboveMsg={item.aboveMsg} />
              </div>
            ))}
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
