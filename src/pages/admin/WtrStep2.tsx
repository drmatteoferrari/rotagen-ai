import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Minus, Plus, AlertTriangle } from "lucide-react";

const limits = [
  { label: "Max Consecutive Days", sub: "Standard limit", value: 7 },
  { label: "Max Consecutive Long Shifts", sub: "Requires approval if > 4", value: 4, warning: true },
  { label: "Max Consecutive Nights", sub: "Consecutive nights", value: 4 },
];

export default function WtrStep2() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 2 of 4 — Consecutive Shifts">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
        <div className="flex justify-between items-end">
          <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Consecutive Shifts</h2>
          <span className="text-sm font-semibold text-muted-foreground">Step 2 of 4</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-red-500 flex-1" />
          <div className="h-full bg-red-500 flex-1" />
          <div className="h-full bg-muted flex-1" />
          <div className="h-full bg-muted flex-1" />
        </div>
        <p className="text-muted-foreground text-sm">Configure limits for consecutive work days to ensure staff safety and compliance with WTR regulations.</p>

        {/* Limit Cards */}
        <div className="flex flex-col gap-4">
          {limits.map((item) => (
            <div key={item.label} className="rounded-xl bg-card border border-border p-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-card-foreground font-semibold">{item.label}</span>
                <span className={`text-xs ${item.warning ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>{item.sub}</span>
              </div>
              <div className="flex items-center gap-3 bg-muted p-1.5 rounded-lg border border-border">
                <button className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-500 transition-all">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-lg font-bold text-card-foreground">{item.value}</span>
                <button className="w-8 h-8 flex items-center justify-center rounded-md bg-card shadow-sm text-muted-foreground hover:text-red-500 transition-all">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Local Agreement */}
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h4 className="text-card-foreground font-bold">Allow Local Agreement Extensions</h4>
              </div>
              <p className="text-muted-foreground text-sm">Enable local agreement overrides for standard shift limits.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-orange-200 mt-1">
            <span className="text-orange-700 text-xs font-semibold">Requires Guardian of Safe Working approval.</span>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/wtr/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/wtr/step-3")} className="bg-red-500 hover:bg-red-600">
            Continue to Step 3 <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
