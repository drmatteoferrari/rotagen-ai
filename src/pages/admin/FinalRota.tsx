import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { useRotaContext } from '@/contexts/RotaContext';
import { useAdminSetup } from '@/contexts/AdminSetupContext';
import { useDoctorsQuery } from '@/hooks/useAdminQueries';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Wand2, Info } from 'lucide-react';

// Generation constants — will be exported from finalRotaRunner.ts in Prompt 2.
// Defined inline here to avoid importing a file that does not yet exist.
const DEFAULT_ITERATIONS = 1000;
const MIN_ITERATIONS = 100;
const MAX_ITERATIONS = 50000;
const WARN_ABOVE_ITERATIONS = 10000;

export default function FinalRota() {
  const navigate = useNavigate();
  const { restoredConfig } = useRotaContext();
  const { rotaStartDate, rotaEndDate } = useAdminSetup();
  const { data: doctorsData } = useDoctorsQuery();

  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);

  const doctorCount = doctorsData?.length ?? 0;

  const departmentName =
    (restoredConfig as any)?.department_name ??
    (restoredConfig as any)?.departmentName ??
    (restoredConfig as any)?.name ??
    'Your Department';

  const formatDate = (d: Date | undefined) =>
    d
      ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

  return (
    <AdminLayout
      title="Final Rota Generation"
      subtitle="Run the algorithm to allocate doctors to shifts"
      accentColor="blue"
      pageIcon={Wand2}
    >
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 animate-fadeSlideUp">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/admin/setup')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Setup
        </button>

        {/* Config summary card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Configuration Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Department
              </p>
              <p className="text-sm font-semibold text-foreground truncate">{departmentName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Period
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatDate(rotaStartDate)} – {formatDate(rotaEndDate)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Doctors
              </p>
              <p className="text-sm font-semibold text-foreground">{doctorCount}</p>
            </div>
          </div>
        </div>

        {/* Iteration count input */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="iterations" className="text-sm font-bold text-foreground">
              Number of iterations
            </label>
            <p className="text-xs text-muted-foreground">
              More iterations improve rota quality but take longer. 1,000 is a good starting point.
            </p>
            <input
              id="iterations"
              type="number"
              min={MIN_ITERATIONS}
              max={MAX_ITERATIONS}
              value={iterations}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setIterations(Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, v)));
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Warning banner — only shown above threshold */}
          {iterations > WARN_ABOVE_ITERATIONS && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                Large iteration counts may take several minutes. Keep this browser tab open during generation.
              </p>
            </div>
          )}
        </div>

        {/* Coming soon notice — removed in Prompt 2 when button is wired */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 font-medium">
            Generation engine is being configured. The Generate button will be active shortly.
          </p>
        </div>

        {/* Generate button — disabled in Prompt 1, wired in Prompt 2 */}
        <Button size="lg" disabled className="w-full h-12 font-bold tracking-wide">
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Final Rota
        </Button>
      </div>
    </AdminLayout>
  );
}
// SECTION 4 COMPLETE
