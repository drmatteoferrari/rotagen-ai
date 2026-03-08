import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Minus, Plus, Clock, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

function MinWarning({ value, min, label }: { value: number; min: number; label: string }) {
  if (value >= min) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {value === min
          ? `Matches the WTR minimum of ${min} hrs — compliant.`
          : `More protective than the WTR minimum of ${min} hrs — compliant.`}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ⚠️ WTR WARNING: {label} must be at least {min} hrs. Setting below this may breach Working Time Regulations.
    </div>
  );
}

export default function WtrStep3() {
  const navigate = useNavigate();
  const { restPostNights, setRestPostNights, restPostBlock, setRestPostBlock, restAfter7, setRestAfter7, weekendFreq, setWeekendFreq } = useAdminSetup();

  const restFields = [
    { label: "Rest After Consecutive Nights", sub: "Minimum mandatory rest period", hint: "WTR minimum: 46 hrs", value: restPostNights, set: setRestPostNights, min: 46, warnLabel: "Rest after consecutive nights" },
    { label: "Rest After 4 Long Shifts", sub: "Post-block recovery period", hint: "WTR minimum: 48 hrs", value: restPostBlock, set: setRestPostBlock, min: 48, warnLabel: "Rest after 4 consecutive long shifts" },
    { label: "Rest After 7 Standard Shifts", sub: "Weekly recovery requirement", hint: "WTR minimum: 48 hrs", value: restAfter7, set: setRestAfter7, min: 48, warnLabel: "Rest after 7 consecutive standard shifts" },
  ];

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 3 of 4 — Hours & Targets">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <Info className="h-4 w-4 shrink-0 text-red-600" />
          Configure mandatory rest periods and weekend working frequency according to regulations.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              Hours & Targets
            </CardTitle>
            <CardDescription>Weekly hour caps, on-call percentage, and weekend frequency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rest Requirements */}
            <h3 className="text-sm font-semibold text-card-foreground">Rest Requirements</h3>
            {restFields.map((field) => (
              <div key={field.label}>
                <div className="rounded-lg border border-border p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-card-foreground">{field.label}</span>
                    <span className="text-xs text-muted-foreground">{field.sub}</span>
                    <span className="text-[11px] font-semibold text-red-600 mt-0.5">{field.hint}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-muted p-1.5 rounded-lg border border-border">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all"
                      onClick={() => field.set(Math.max(1, field.value - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-card-foreground">{field.value}</span>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all"
                      onClick={() => field.set(field.value + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <MinWarning value={field.value} min={field.min} label={field.warnLabel} />
              </div>
            ))}

            {/* Weekend Frequency */}
            <h3 className="text-sm font-semibold text-card-foreground pt-2">Max Weekend Frequency</h3>
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-card-foreground">Weekend frequency: 1 in</span>
                  <span className="text-xs text-muted-foreground">Maximum weekend working ratio</span>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR advised: 1 in 3 or less frequent</span>
                </div>
                <div className="flex items-center gap-3 bg-muted p-1.5 rounded-lg border border-border">
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all"
                    onClick={() => setWeekendFreq(Math.max(1, weekendFreq - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-bold text-card-foreground">{weekendFreq}</span>
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all"
                    onClick={() => setWeekendFreq(weekendFreq + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {weekendFreq === 1 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive mt-2">
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  ❌ A frequency of 1 in 1 would mean working every weekend — this is not permitted.
                </div>
              )}
              {weekendFreq === 2 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  ⚠️ AUTHORISATION REQUIRED: 1 in 2 weekends requires authorisation from the Clinical Director and Guardian of Safe Working Hours.
                </div>
              )}
              {weekendFreq >= 3 && (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  1 in {weekendFreq} weekends — compliant with WTR guidance.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-2")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-4")} className="bg-red-600 hover:bg-red-700">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
