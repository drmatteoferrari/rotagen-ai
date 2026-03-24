import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { StepNavBar } from "@/components/StepNavBar";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, ClipboardCheck, Minus, Plus, ClipboardList } from "lucide-react";

function MaxWarning({ value, max, label }: { value: number; max: number; label: string }) {
  if (value <= max) return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      {value === max ? `Matches the WTR maximum of ${max} — compliant.` : `More restrictive than the WTR maximum of ${max} — compliant.`}
    </div>
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      WTR WARNING: {label} exceeds the legal maximum of {max} — a Guardian of Safe Working Hours fine may apply.
    </div>
  );
}

function MinWarning({ value, min, label }: { value: number; min: number; label: string }) {
  if (value >= min) return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      {value === min ? `Matches the WTR minimum of ${min} hrs — compliant.` : `More protective than the WTR minimum of ${min} hrs — compliant.`}
    </div>
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      WTR WARNING: {label} is below the legal minimum of {min} hrs — this may breach Working Time Regulations.
    </div>
  );
}

function TimeWarning({ value, standard, label }: { value: string; standard: string; label: string }) {
  const normalise = (t: string) => t?.slice(0, 5) ?? "";
  const isDeviation = normalise(value) !== normalise(standard);
  if (isDeviation) return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      Deviates from WTR standard {label} of {standard}
    </div>
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
      <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      Matches WTR standard {label} of {standard} — compliant.
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

export default function WtrStep4() {
  const navigate = useNavigate();

  const {
    oncallMaxPer7Days, setOncallMaxPer7Days,
    oncallLocalAgreementMaxConsec, setOncallLocalAgreementMaxConsec,
    oncallDayAfterMaxHours, setOncallDayAfterMaxHours,
    oncallDayAfterLastConsecMaxH, setOncallDayAfterLastConsecMaxH,
    oncallRestPer24h, setOncallRestPer24h,
    oncallContinuousRestHours, setOncallContinuousRestHours,
    oncallContinuousRestStart, setOncallContinuousRestStart,
    oncallContinuousRestEnd, setOncallContinuousRestEnd,
    oncallIfRestNotMetMaxHours, setOncallIfRestNotMetMaxHours,
    oncallNoConsecExceptWknd, setOncallNoConsecExceptWknd,
    oncallNoSimultaneousShift, setOncallNoSimultaneousShift,
  } = useAdminSetup();

  return (
    <AdminLayout title="Working Time Regulations" subtitle="Step 4 of 5 — Non-Resident On-Call" accentColor="red">
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeSlideUp">
        {/* Amber scope banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          Rules on this page apply exclusively to non-resident on-call shifts.
        </div>

        {/* Configurable on-call card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-red-600" />
              Non-Resident On-Call Rules
            </CardTitle>
            <CardDescription>All values are configurable. WTR compliance status is shown automatically.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Field 1 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">Max on-call periods per 7 days</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 3 (TCS §28)</span>
                </div>
                <Stepper value={oncallMaxPer7Days} onDec={() => setOncallMaxPer7Days(Math.max(1, oncallMaxPer7Days - 1))} onInc={() => setOncallMaxPer7Days(oncallMaxPer7Days + 1)} />
              </div>
              <MaxWarning value={oncallMaxPer7Days} max={3} label="On-call periods per 7 days" />
            </div>

            {/* Field 2 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">Max consecutive non-res on-call (local agreement)</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 7 (TCS §27)</span>
                </div>
                <Stepper value={oncallLocalAgreementMaxConsec} onDec={() => setOncallLocalAgreementMaxConsec(Math.max(1, oncallLocalAgreementMaxConsec - 1))} onInc={() => setOncallLocalAgreementMaxConsec(oncallLocalAgreementMaxConsec + 1)} />
              </div>
              <MaxWarning value={oncallLocalAgreementMaxConsec} max={7} label="Consecutive non-res on-call periods" />
            </div>

            {/* Field 3 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">Day after non-res on-call: max hours</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 10 hrs (TCS §29)</span>
                </div>
                <Stepper value={oncallDayAfterMaxHours} onDec={() => setOncallDayAfterMaxHours(Math.max(1, oncallDayAfterMaxHours - 1))} onInc={() => setOncallDayAfterMaxHours(oncallDayAfterMaxHours + 1)} />
              </div>
              <MaxWarning value={oncallDayAfterMaxHours} max={10} label="Day-after on-call hours" />
            </div>

            {/* Field 4 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">Day after last consecutive on-call: max hours</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 10 hrs — applies after the last period in a consecutive block (TCS §29)</span>
                </div>
                <Stepper value={oncallDayAfterLastConsecMaxH} onDec={() => setOncallDayAfterLastConsecMaxH(Math.max(1, oncallDayAfterLastConsecMaxH - 1))} onInc={() => setOncallDayAfterLastConsecMaxH(oncallDayAfterLastConsecMaxH + 1)} />
              </div>
              <MaxWarning value={oncallDayAfterLastConsecMaxH} max={10} label="Day-after last consecutive on-call hours" />
            </div>

            {/* Field 5 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">Expected rest per 24h while on-call</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR minimum: 8 hrs (TCS §30)</span>
                </div>
                <Stepper value={oncallRestPer24h} onDec={() => setOncallRestPer24h(Math.max(1, oncallRestPer24h - 1))} onInc={() => setOncallRestPer24h(oncallRestPer24h + 1)} />
              </div>
              <MinWarning value={oncallRestPer24h} min={8} label="Rest per 24h on-call" />
            </div>

            {/* Field 6 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">Continuous rest window: duration</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR minimum: 5 hrs (TCS §30)</span>
                </div>
                <Stepper value={oncallContinuousRestHours} onDec={() => setOncallContinuousRestHours(Math.max(1, oncallContinuousRestHours - 1))} onInc={() => setOncallContinuousRestHours(oncallContinuousRestHours + 1)} />
              </div>
              <MinWarning value={oncallContinuousRestHours} min={5} label="Continuous rest window hours" />
            </div>

            {/* Field 7 */}
            <div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground">Continuous rest window: start time</p>
                    <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR standard: 22:00 (TCS §30)</span>
                  </div>
                </div>
                <input type="time" value={oncallContinuousRestStart} onChange={(e) => setOncallContinuousRestStart(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2" />
              </div>
              <TimeWarning value={oncallContinuousRestStart} standard="22:00" label="rest window start time" />
            </div>

            {/* Field 8 */}
            <div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground">Continuous rest window: end time</p>
                    <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR standard: 07:00 (TCS §30)</span>
                  </div>
                </div>
                <input type="time" value={oncallContinuousRestEnd} onChange={(e) => setOncallContinuousRestEnd(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2" />
              </div>
              <TimeWarning value={oncallContinuousRestEnd} standard="07:00" label="rest window end time" />
            </div>

            {/* Field 9 */}
            <div>
              <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">If rest not met: next day max hours</p>
                  <span className="text-[11px] font-semibold text-red-600 mt-0.5">WTR maximum: 5 hrs (TCS §31)</span>
                </div>
                <Stepper value={oncallIfRestNotMetMaxHours} onDec={() => setOncallIfRestNotMetMaxHours(Math.max(1, oncallIfRestNotMetMaxHours - 1))} onInc={() => setOncallIfRestNotMetMaxHours(oncallIfRestNotMetMaxHours + 1)} />
              </div>
              <MaxWarning value={oncallIfRestNotMetMaxHours} max={5} label="Next-day hours when rest not met" />
            </div>

            {/* Field 10 — Toggle full width */}
            <div className="col-span-1 sm:col-span-2">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-card-foreground">No consecutive non-res on-call except Sat/Sun</p>
                    <p className="text-xs text-muted-foreground">Standard rule: no consecutive non-resident on-call except Saturday and Sunday (TCS §27)</p>
                  </div>
                  <Switch checked={oncallNoConsecExceptWknd} onCheckedChange={setOncallNoConsecExceptWknd} />
                </div>
                {oncallNoConsecExceptWknd ? (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Compliant — consecutive non-res on-call restricted to Sat/Sun only
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    WTR WARNING: Consecutive non-resident on-call is not permitted except at weekends
                  </div>
                )}
              </div>
            </div>

            {/* Field 11 — Toggle full width */}
            <div className="col-span-1 sm:col-span-2">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-card-foreground">No simultaneous non-res on-call + rostered shift</p>
                    <p className="text-xs text-muted-foreground">A doctor must not be on non-resident on-call on the same shift a colleague covers by rostered working (TCS §46)</p>
                  </div>
                  <Switch checked={oncallNoSimultaneousShift} onCheckedChange={setOncallNoSimultaneousShift} />
                </div>
                {oncallNoSimultaneousShift ? (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 mt-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Compliant
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    WTR WARNING: Requires explicit Clinical Director and Guardian of Safe Working Hours approval
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-3")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-5")} className="bg-red-600 hover:bg-red-700">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
