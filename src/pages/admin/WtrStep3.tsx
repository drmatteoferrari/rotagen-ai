import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight } from "lucide-react";

const restFields = [
  { label: "Min Rest Between Shifts", value: 11 },
  { label: "Rest Post-Nights", value: 46 },
  { label: "Rest Post-Block", value: 48 },
];

export default function WtrStep3() {
  const navigate = useNavigate();

  return (
    <AdminLayout title="WTR Setup" subtitle="Step 3 of 4 — Rest & Weekends">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress */}
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
                <Input type="number" defaultValue={field.value} className="pr-12" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">hrs</span>
              </div>
            </div>
          ))}
        </div>

        {/* Weekend Frequency */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">Max Weekend Frequency</h3>
          <div className="bg-card border border-border p-1.5 rounded-xl shadow-sm flex gap-1">
            {["1 in 2", "1 in 3", "1 in 4"].map((opt, i) => (
              <label key={opt} className="flex-1 relative cursor-pointer">
                <input type="radio" name="weekend_freq" defaultChecked={i === 1} className="peer sr-only" />
                <div className="absolute inset-0 bg-red-500 rounded-lg opacity-0 peer-checked:opacity-100 transition-opacity shadow-sm" />
                <div className="relative z-10 py-3 text-center text-sm font-bold text-muted-foreground peer-checked:text-white transition-colors">
                  {opt}
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Select the maximum frequency you are contractually obligated to work weekends.</p>
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
