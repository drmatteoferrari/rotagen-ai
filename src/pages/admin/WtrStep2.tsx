import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Minus, Plus, Layers, CheckCircle, AlertTriangle, Info } from "lucide-react";

function ConsecWarning({ value, threshold, label }: { value: number; threshold: number; label: string }) {
  if (value < threshold) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        ✅ More restrictive than WTR default.
      </div>
    );
  }
  if (value > threshold) {
    const extra = label === "night" ? " Rest of at least 46 hours must follow." : "";
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        ⚠️ WTR WARNING: Exceeding {threshold} consecutive {label} shifts may breach Working Time Regulations.{extra}
      </div>
    );
  }
  return null;
}

export default function WtrStep2() {
  const navigate = useNavigate();
  const { maxConsecDays, setMaxConsecDays, maxConsecLong, setMaxConsecLong, maxConsecNights, setMaxConsecNights } = useAdminSetup();

  const limits = [
    { label: "Max Consecutive Days", sub: "Standard shifts", value: maxConsecDays, set: setMaxConsecDays, threshold: 7, type: "standard" },
    { label: "Max Consecutive Long Shifts", sub: "Consecutive long shifts", value: maxConsecLong, set: setMaxConsecLong, threshold: 7, type: "long" },
    { label: "Max Consecutive Nights", sub: "Consecutive nights", value: maxConsecNights, set: setMaxConsecNights, threshold: 4, type: "night" },
  ];

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 2 of 4 — Consecutive Limits">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <Info className="h-4 w-4 shrink-0 text-red-600" />
          Configure limits for consecutive work days to ensure staff safety and WTR compliance.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-red-600" />
              Consecutive Limits
            </CardTitle>
            <CardDescription>Maximum consecutive shift counts — adjustable within legal bounds.</CardDescription>
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
                <ConsecWarning value={item.value} threshold={item.threshold} label={item.type} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-3")} className="bg-red-600 hover:bg-red-700">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
