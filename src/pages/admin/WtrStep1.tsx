import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, Info, Minus, Plus, ClipboardList } from "lucide-react";

function MaxWarning({ value, max, label }: { value: number; max: number; label: string }) {
  if (value <= max) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {value === max
          ? `Matches the WTR maximum of ${max} hrs — compliant.`
          : `More restrictive than the WTR maximum of ${max} hrs — compliant.`}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      WTR WARNING: {label} exceeds the legal maximum of {max} hrs. A Guardian of Safe Working Hours fine may apply.
    </div>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-muted p-1.5 rounded-lg border border-border shrink-0">
      <button className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all" onClick={onDec}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-lg font-bold text-card-foreground">{value}</span>
      <button className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-600 transition-all" onClick={onInc}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function WtrStep1() {
  const navigate = useNavigate();
  const { maxAvgWeekly, setMaxAvgWeekly, maxIn7Days, setMaxIn7Days, maxShiftLengthH, setMaxShiftLengthH } = useAdminSetup();

  const limits = [
    {
      label: "Max Avg Weekly Hours",
      sub: "Calculated over the rota period",
      hint: "WTR maximum: 48 hrs",
      value: maxAvgWeekly,
      set: setMaxAvgWeekly,
      max: 48,
      warnLabel: "Average weekly hours",
      minVal: 40,
    },
    {
      label: "Max Hours in 7 Days",
      sub: "Absolute maximum for any single rolling 168-hour period",
      hint: "WTR maximum: 72 hrs",
      value: maxIn7Days,
      set: setMaxIn7Days,
      max: 72,
      warnLabel: "Hours in any 7-day period",
      minVal: 1,
    },
    {
      label: "Max Single Shift Length",
      sub: "Applies to all rostered shifts. On-call periods are governed separately in Step 4.",
      hint: "WTR maximum: 13 hrs (TCS §9)",
      value: maxShiftLengthH,
      set: setMaxShiftLengthH,
      max: 13,
      warnLabel: "Single shift length",
      minVal: 1,
    },
  ];

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 1 of 5 — Hours" accentColor="red" pageIcon={ClipboardList}
      navBar={
        <StepNavBar
          right={
            <Button size="lg" onClick={() => navigate("/admin/wtr/step-2")} className="bg-red-600 hover:bg-red-700">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          <Info className="h-4 w-4 shrink-0 text-red-600" />
          Set base working hours limits.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-600" />
              Hours & Shift Limits
            </CardTitle>
            <CardDescription>Set the base legal limits for your rota. All values are configurable — WTR compliance status is shown automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {limits.map((item) => (
              <div key={item.label}>
                <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-card-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.sub}</span>
                    <span className="text-[11px] font-semibold text-red-600 mt-0.5">{item.hint}</span>
                  </div>
                  <Stepper
                    value={item.value}
                    onDec={() => item.set(Math.max(item.minVal, item.value - 1))}
                    onInc={() => item.set(item.value + 1)}
                  />
                </div>
                <MaxWarning value={item.value} max={item.max} label={item.warnLabel} />
              </div>
            ))}
          </CardContent>
        </Card>

        <StepNavBar
          right={
            <Button size="lg" onClick={() => navigate("/admin/wtr/step-2")} className="bg-red-600 hover:bg-red-700">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
      </div>
    </AdminLayout>
  );
}
