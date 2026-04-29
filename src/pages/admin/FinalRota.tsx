import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { useRotaContext } from '@/contexts/RotaContext';
import { useAdminSetup } from '@/contexts/AdminSetupContext';
import { useDoctorsQuery } from '@/hooks/useAdminQueries';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  ArrowLeft,
  Wand2,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildFinalRotaInput, validateFinalRotaInput } from '@/lib/rotaGenInput';
import {
  FinalRotaRunner,
  DEFAULT_ITERATIONS,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
  WARN_ABOVE_ITERATIONS,
} from '@/lib/finalRotaRunner';
import type { FinalRotaResult, GenerationProgress } from '@/types/finalRota';

// ─── Types ────────────────────────────────────────────────────

type Phase = 'idle' | 'running' | 'result' | 'error';

// ─── Helpers ──────────────────────────────────────────────────

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatDate(d: Date | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadge(status: FinalRotaResult['status']) {
  const map: Record<FinalRotaResult['status'], { label: string; className: string }> = {
    complete: { label: 'Complete', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    complete_with_gaps: { label: 'Complete with gaps', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${className}`}>
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function FinalRota() {
  const navigate = useNavigate();
  const { currentRotaConfigId, restoredConfig } = useRotaContext();
  const { rotaStartDate, rotaEndDate } = useAdminSetup();
  const { data: doctorsData } = useDoctorsQuery();

  // ── State machine ──────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('idle');
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<FinalRotaResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const runnerRef = useRef<FinalRotaRunner | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Elapsed timer — ticks while running ───────────────────
  useEffect(() => {
    if (phase !== 'running') return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Worker cleanup on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      runnerRef.current?.terminate();
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const doctorCount = doctorsData?.length ?? 0;
  const departmentName =
    (restoredConfig as any)?.department_name ??
    (restoredConfig as any)?.departmentName ??
    (restoredConfig as any)?.name ??
    'Your Department';

  // ── Handlers ──────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!currentRotaConfigId) return;

    // Reset state
    setErrorMessage(null);
    setProgress(null);
    setResult(null);
    setElapsedMs(0);

    // Validate before starting worker
    let input;
    try {
      const validation = await validateFinalRotaInput(currentRotaConfigId);
      if (validation.blockers.length > 0) {
        setErrorMessage(validation.blockers.join('\n'));
        setPhase('error');
        return;
      }
      input = await buildFinalRotaInput(currentRotaConfigId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to build rota input. Check pre-rota is complete.');
      setPhase('error');
      return;
    }

    // Create runner
    const runner = new FinalRotaRunner();
    runnerRef.current = runner;

    runner.onProgress((p) => setProgress(p));

    runner.onComplete(async (r) => {
      setResult(r);
      setIsSaving(true);
      try {
        // Explicit snake_case ↔ camelCase mapping — must match final_rota_results schema
        await supabase.from('final_rota_results').insert({
          rota_config_id: r.configId,
          generated_at: r.generatedAt,
          status: r.status,
          iterations_completed: r.iterationsCompleted,
          iterations_target: r.iterationsTarget,
          runtime_ms: r.runtimeMs,
          assignments: r.assignments as any,
          score: r.score as any,
          per_doctor: r.perDoctor as any,
          swap_log: r.swapLog as any,
          violations: r.violations as any,
        });
      } catch (err) {
        console.error('Failed to save final rota result:', err);
      }
      setIsSaving(false);
      setPhase('result');
    });

    runner.onError((msg) => {
      setErrorMessage(msg);
      setPhase('error');
    });

    setPhase('running');
    runner.start(input, iterations);
  }, [currentRotaConfigId, iterations]);

  const handleStop = () => setShowStopConfirm(true);

  const handleStopConfirm = () => {
    setShowStopConfirm(false);
    runnerRef.current?.cancel();
  };

  const handleRegenerate = () => {
    runnerRef.current?.terminate();
    runnerRef.current = null;
    setPhase('idle');
    setProgress(null);
    setResult(null);
    setErrorMessage(null);
    setElapsedMs(0);
  };

  const handleDismissError = () => {
    setPhase('idle');
    setErrorMessage(null);
  };

  const handleExportFixture = useCallback(async () => {
    if (!currentRotaConfigId) return;
    try {
      const input = await buildFinalRotaInput(currentRotaConfigId);
      const fixture = {
        exportedAt: new Date().toISOString(),
        configId: currentRotaConfigId,
        label: `${departmentName} — ${input.preRotaInput.period.startDate} to ${input.preRotaInput.period.endDate}`,
        doctorCount: input.doctors.length,
        resolvedAvailabilityCount: input.resolvedAvailability.length,
        input,
      };
      const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rotagen-fixture-${currentRotaConfigId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Fixture export failed:', err);
    }
  }, [currentRotaConfigId, departmentName]);

  // ── Render ────────────────────────────────────────────────

  const progressPct = progress
    ? Math.round((progress.iterationsCompleted / progress.iterationsTarget) * 100)
    : 0;

  return (
    <AdminLayout
      title="Final Rota Generation"
      subtitle="Run the algorithm to allocate doctors to shifts"
      accentColor="blue"
      pageIcon={Wand2}
    >
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-5 animate-fadeSlideUp">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/admin/setup')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Setup
        </button>

        {/* ── STATE D: Error banner ── */}
        {phase === 'error' && errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-red-900 mb-1">Rota generation failed</h4>
                <p className="text-xs text-red-800 whitespace-pre-line">{errorMessage}</p>
              </div>
            </div>
            <div className="flex gap-2 self-end">
              <Button variant="outline" size="sm" onClick={handleDismissError}>
                Dismiss
              </Button>
              <Button size="sm" onClick={handleGenerate}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* ── STATE A: Idle ── */}
        {(phase === 'idle' || phase === 'error') && (
          <>
            {import.meta.env.DEV && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-sm font-medium text-amber-800">⚙️ DEV TOOLS — not visible in production</span>
                <button
                  type="button"
                  onClick={handleExportFixture}
                  disabled={!currentRotaConfigId}
                  className="text-sm font-semibold px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  ⬇️ Export Test Fixture
                </button>
              </div>
            )}
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

              {iterations > WARN_ABOVE_ITERATIONS && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 font-medium">
                    Large iteration counts may take several minutes. Keep this browser tab open during generation.
                  </p>
                </div>
              )}
            </div>

            {/* Generate button */}
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!currentRotaConfigId}
              className="w-full h-12 font-bold tracking-wide"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Final Rota
            </Button>
          </>
        )}

        {/* ── STATE B: Running ── */}
        {phase === 'running' && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary animate-spin" />
              <h3 className="text-sm font-bold text-foreground">Generating rota…</h3>
            </div>

            {/* Progress bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  {progress
                    ? `${progress.iterationsCompleted} / ${progress.iterationsTarget} iterations`
                    : 'Starting…'}
                </span>
                <span className="font-bold text-foreground">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>

            {/* Live scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Critical unfilled',
                  value: progress?.bestScore?.tier1CriticalUnfilled ?? '—',
                  accent: 'text-red-600',
                },
                {
                  label: 'Warning unfilled',
                  value: progress?.bestScore?.tier2WarningUnfilled ?? '—',
                  accent: 'text-amber-600',
                },
                {
                  label: 'Fairness deviation',
                  value: progress?.bestScore
                    ? progress.bestScore.tier3FairnessDeviation.toFixed(1)
                    : '—',
                  accent: 'text-blue-600',
                },
                {
                  label: 'Elapsed',
                  value: formatMs(elapsedMs),
                  accent: 'text-muted-foreground',
                },
              ].map(({ label, value, accent }) => (
                <div
                  key={label}
                  className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1"
                >
                  <p className={`text-lg font-bold ${accent}`}>{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Current phase label */}
            {progress?.currentPhase && (
              <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {progress.currentPhase}
              </p>
            )}

            {/* Stop button */}
            <Button variant="outline" onClick={handleStop} className="w-full">
              <Square className="mr-2 h-4 w-4" />
              Stop Generation
            </Button>
          </div>
        )}

        {/* ── STATE C: Result ── */}
        {phase === 'result' && result && (
          <div className="flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                {statusBadge(result.status)}
              </div>
              {isSaving && (
                <span className="text-xs text-muted-foreground italic">Saving…</span>
              )}
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4">Generation Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Iterations
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {result.iterationsCompleted} / {result.iterationsTarget}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Runtime
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatMs(result.runtimeMs)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Critical unfilled
                  </p>
                  <p className={`text-sm font-bold ${result.score.tier1CriticalUnfilled > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {result.score.tier1CriticalUnfilled}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Warning unfilled
                  </p>
                  <p className={`text-sm font-bold ${result.score.tier2WarningUnfilled > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {result.score.tier2WarningUnfilled}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Fairness deviation
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {result.score.tier3FairnessDeviation.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Doctors assigned
                  </p>
                  <p className="text-sm font-semibold text-foreground">{result.perDoctor.length}</p>
                </div>
              </div>
            </div>

            {/* Per-doctor table */}
            {result.perDoctor.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-3">Per-Doctor Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Doctor</th>
                        <th className="py-2 px-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">WTE%</th>
                        <th className="py-2 px-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">Hours</th>
                        <th className="py-2 px-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">Target</th>
                        <th className="py-2 px-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">Dev%</th>
                        <th className="py-2 px-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">Wknds</th>
                        <th className="py-2 pl-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">Nights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.perDoctor.map((d) => (
                        <tr key={d.doctorId} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 font-medium text-foreground">{d.name}</td>
                          <td className="py-2 px-2 text-right text-foreground">{d.wtePct}%</td>
                          <td className="py-2 px-2 text-right text-foreground">{d.totalHoursAssigned}h</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{d.targetTotalHours}h</td>
                          <td className={`py-2 px-2 text-right font-bold ${Math.abs(d.deviationPct) > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {d.deviationPct > 0 ? '+' : ''}{d.deviationPct}%
                          </td>
                          <td className="py-2 px-2 text-right text-foreground">{d.weekendDays}</td>
                          <td className="py-2 pl-2 text-right text-foreground">{d.nightBlocks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Regenerate button */}
            <Button size="lg" onClick={handleRegenerate} className="w-full h-12 font-bold tracking-wide">
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          </div>
        )}

        {/* ── Stop confirmation modal ── */}
        {showStopConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Stop generation?</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                The best result found so far will be saved. You can regenerate at any time.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowStopConfirm(false)}>
                  Continue
                </Button>
                <Button size="sm" onClick={handleStopConfirm}>
                  Stop & Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
// SECTION 4 COMPLETE
