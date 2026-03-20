import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Minus, Plus, Clock, CheckCircle, AlertTriangle, Info } from "lucide-react";

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
  const {
    restPostNights, setRestPostNights, restPostBlock, setRestPostBlock,
    restAfter7, setRestAfter7, weekendFreq, setWeekendFreq,
    restAfterLongEveningH, setRestAfterLongEveningH, minInterShiftRestH, setMinInterShiftRestH,
  } = useAdminSetup();

  const restFields = [
    {
      label: "Rest After Any Night Shift(s)",
      sub: "Minimum mandatory rest after any night shift or block of night shifts",
      hint: "WTR minimum: 46 hrs — applies even after a single night shift (TCS §13)",
      value: restPostNights, set: setRestPostNights, min: 46,
      warnLabel: "Rest after any night shift(s)",
    },
    {
      label: "Rest After Long Shift Block",
      sub: "Applies after any block of consecutive long shifts or long evening shifts (>10h)",
      hint: "WTR minimum: 48 hrs",
      value: restPostBlock, set: setRestPostBlock, min: 48,
      warnLabel: "Rest after long shift block",
    },
    {
      label: "Rest After Long Evening Block",
      sub: "Mandatory rest following any consecutive long evening shift(s)",
      hint: "WTR minimum: 48 hrs",
      value: restAfterLongEveningH, set: setRestAfterLongEveningH, min: 48,
      warnLabel: "Rest after long evening block",
    },
    {
      label: "Rest After 7 Standard Shifts",
      sub: "Weekly recovery requirement after any block of 7 consecutive standard shifts",
      hint: "WTR minimum: 48 hrs",
      value: restAfter7, set: setRestAfter7, min: 48,
      warnLabel: "Rest after 7 standard shifts",
    },
    {
      label: "Min Rest Between Rostered Shifts",
      sub: "Minimum continuous rest between any two consecutive non-on-call rostered shifts",
      hint: "WTR minimum: 11 hrs (TCS §19)",
      value: minInterShiftRestH, set: setMinInterShiftRestH, min: 11,
      warnLabel: "Minimum inter-shift rest",
    },
  ];

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 3 of 4 — Rest Periods & Weekend" accentColor="red">
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <Info className="h-4 w-4 shrink-0 text-red-600" />
          Configure mandatory rest periods and weekend working frequency according to regulations.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              Rest Periods & Weekend
            </CardTitle>
            <CardDescription>Mandatory rest periods and maximum weekend working frequency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    onClick={() => setWeekendFreq(Math.max(2, weekendFreq - 1))}
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