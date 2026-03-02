import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

function RestWarning({ value, min, fieldName }: { value: number; min: number; fieldName: string }) {
  if (value > min) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-1.5">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        ✅ More protective than WTR minimum.
      </div>
    );
  }
  if (value < min) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        ⚠️ WTR WARNING: {fieldName} must be at least {min} hours. Setting below this may breach Working Time Regulations.
      </div>
    );
  }
  return null;
}

export default function WtrStep3() {
  const navigate = useNavigate();
  const [restPostNights, setRestPostNights] = useState(46);
  const [restPostBlock, setRestPostBlock] = useState(48);
  const [restAfter7, setRestAfter7] = useState(48);
  const [weekendFreq, setWeekendFreq] = useState(3);

  const restFields = [
    { label: "Rest After Consecutive Nights", value: restPostNights, set: setRestPostNights, min: 46, fieldName: "Rest after consecutive nights" },
    { label: "Rest After 4 Long Shifts", value: restPostBlock, set: setRestPostBlock, min: 48, fieldName: "Rest after 4 consecutive long shifts" },
    { label: "Rest After 7 Standard Shifts", value: restAfter7, set: setRestAfter7, min: 48, fieldName: "Rest after 7 consecutive standard shifts" },
  ];

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 3 of 4 — Rest & Weekends">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-2 flex-1 rounded-full ${s <= 3 ? "bg-red-500" : "bg-red-500/20"}`} />
          ))}
        </div>

        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Rest & Weekends</h2>
          <p className="text-muted-foreground mt-1">Configure your mandatory rest periods and weekend working frequency according to regulations.</p>
        </div>

        {/* Rest Requirements */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">Rest Requirements</h3>
          {restFields.map((field) => (
            <div key={field.label} className="space-y-1.5">
              <Label className="text-sm font-medium">{field.label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.set(Number(e.target.value))}
                  className="pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">hrs</span>
              </div>
              <RestWarning value={field.value} min={field.min} fieldName={field.fieldName} />
            </div>
          ))}
        </div>

        {/* Weekend Frequency */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">Max Weekend Frequency</h3>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Maximum weekend frequency: 1 in</Label>
            <div className="relative w-32">
              <Input
                type="number"
                min={1}
                max={52}
                value={weekendFreq}
                onChange={(e) => setWeekendFreq(Number(e.target.value))}
              />
            </div>
            {weekendFreq === 1 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive mt-1.5">
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                ❌ A frequency of 1 in 1 would mean working every weekend — this is not permitted.
              </div>
            )}
            {weekendFreq === 2 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                ⚠️ AUTHORISATION REQUIRED: A rota pattern of 1 in 2 weekends requires authorisation. A clearly identified clinical reason must be agreed by the Clinical Director and deemed appropriate by the Guardian of Safe Working Hours.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-2")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-4")} className="bg-red-500 hover:bg-red-600">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
