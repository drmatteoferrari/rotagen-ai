import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Lock, CheckCircle } from "lucide-react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";

export default function WtrStep4() {
  const navigate = useNavigate();
  const { setWtrComplete } = useAdminSetup();

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 4 of 4 — On-Call Rules">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex justify-between items-end">
          <span className="text-sm font-semibold text-red-500">Step 4 of 4</span>
          <span className="text-xs font-medium text-muted-foreground">Final Configuration</span>
        </div>
        <div className="h-2 w-full bg-red-500/10 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 w-full rounded-full" />
        </div>

        {/* Main Card */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Non-Resident On-Call</h2>
            <p className="text-muted-foreground text-sm mt-1">Configure limits for NROC shifts to ensure compliance with safety standards.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Max On-Call Period</Label>
              <div className="relative">
                <Input type="number" defaultValue={24} className="pr-12" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Max On-Calls / 7 Days</Label>
              <div className="relative">
                <Input type="number" defaultValue={3} className="pr-12" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">shifts</span>
              </div>
            </div>
          </div>

          {/* Locked field */}
          <div className="opacity-70">
            <div className="flex justify-between items-center">
              <Label className="font-semibold">Max Hours Day After</Label>
              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                <Lock className="h-3 w-3" /> Locked
              </span>
            </div>
            <div className="relative mt-2">
              <Input type="number" defaultValue={10} disabled className="cursor-not-allowed pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">This setting is locked by your organization's global safety policy.</p>
          </div>

          <hr className="border-border" />

          {/* Toggle Card */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex-1">
              <div className="font-bold text-card-foreground mb-1">Enforce Expected Rest</div>
              <p className="text-sm text-muted-foreground">Automatically flag shifts that violate the 11-hour rest period immediately following an on-call duty.</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-3")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => { setWtrComplete(true); navigate("/admin/dashboard"); }} className="bg-red-500 hover:bg-red-600">
            <CheckCircle className="mr-2 h-4 w-4" />Save WTR Configuration
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
