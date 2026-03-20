import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useDepartmentSetup } from "@/contexts/DepartmentSetupContext";
import { useInvalidateQuery } from "@/hooks/useAdminQueries";

interface ResetModalProps {
  open: boolean;
  onClose: () => void;
}

export function ResetModal({ open, onClose }: ResetModalProps) {
  const navigate = useNavigate();
  const { currentRotaConfigId } = useRotaContext();
  const { resetDepartment: resetDepartmentContext } = useDepartmentSetup();
  const {
    resetWtr: resetWtrContext,
    setDepartmentComplete, setPeriodComplete,
    setRotaStartDate, setRotaEndDate,
    setRotaBankHolidays, setBhSameAsWeekend,
    setBhShiftRules, setPeriodWorkingStateLoaded,
  } = useAdminSetup();
  const { invalidateDoctors, invalidateInactiveDoctors } = useInvalidateQuery();

  const [step, setStep] = useState<1 | 2>(1);
  const [resetDepartment, setResetDepartment] = useState(false);
  const [resetWtr, setResetWtr] = useState(false);
  const [resetPeriod, setResetPeriod] = useState(false);
  const [resetRoster, setResetRoster] = useState(false);
  const [carryForwardDoctors, setCarryForwardDoctors] = useState<string[]>([]);
  const [allActiveDoctors, setAllActiveDoctors] = useState<{id: string; first_name: string; last_name: string; grade: string}[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch active doctors when roster reset is ticked
  useEffect(() => {
    if (!resetRoster || !currentRotaConfigId) return;
    supabase
      .from('doctors')
      .select('id, first_name, last_name, grade')
      .eq('rota_config_id', currentRotaConfigId)
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .then(({ data }) => {
        const docs = data ?? [];
        setAllActiveDoctors(docs);
        setCarryForwardDoctors(docs.map(d => d.id));
      });
  }, [resetRoster, currentRotaConfigId]);

  const resetState = () => {
    setStep(1);
    setResetDepartment(false);
    setResetWtr(false);
    setResetPeriod(false);
    setResetRoster(false);
    setCarryForwardDoctors([]);
    setAllActiveDoctors([]);
    setConfirmText("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleReset = async () => {
    if (!currentRotaConfigId) return;
    setLoading(true);
    try {
      if (resetDepartment) {
        await supabase.from('shift_types').delete().eq('rota_config_id', currentRotaConfigId);
        setDepartmentComplete(false);
        resetDepartmentContext();
      }
      if (resetWtr) {
        await supabase.from('wtr_settings').delete().eq('rota_config_id', currentRotaConfigId);
        resetWtrContext();
      }
      if (resetPeriod) {
        await supabase.from('rota_configs').update({
          rota_start_date: null,
          rota_end_date: null,
          rota_duration_days: null,
          rota_duration_weeks: null,
          survey_deadline: null,
          bh_same_as_weekend: null,
          bh_shift_rules: null,
        }).eq('id', currentRotaConfigId);
        await supabase.from('bank_holidays').delete().eq('rota_config_id', currentRotaConfigId);
        setPeriodComplete(false);
        setRotaStartDate(undefined);
        setRotaEndDate(undefined);
      }
      if (resetRoster) {
        await supabase.from('doctors')
          .update({ is_active: false, survey_status: 'not_started', survey_submitted_at: null })
          .eq('rota_config_id', currentRotaConfigId);
        if (carryForwardDoctors.length > 0) {
          await supabase.from('doctors')
            .update({ is_active: true })
            .in('id', carryForwardDoctors);
        }
        invalidateDoctors();
        invalidateInactiveDoctors();
      }
      const resetItems = [
        resetDepartment && 'Department',
        resetWtr && 'Contract Rules (WTR)',
        resetPeriod && 'Rota Period',
        resetRoster && 'Doctor Roster',
      ].filter(Boolean).join(', ');
      toast.success(`Reset complete: ${resetItems}`);
      handleClose();
      navigate('/admin/setup');
    } catch (err: any) {
      toast.error('Reset failed: ' + (err?.message ?? 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const anySelected = resetDepartment || resetWtr || resetPeriod || resetRoster;

  const toggleCarryForward = (id: string) => {
    setCarryForwardDoctors(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset Rota Data
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Select which sections to reset. All changes are permanent and cannot be undone.
              </p>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Group 1 */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Department & Rules</p>
                <div className="space-y-2">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={resetDepartment} onCheckedChange={(v) => setResetDepartment(!!v)} />
                      <span className="text-sm">Department (shift types)</span>
                    </label>
                    {resetDepartment && (
                      <p className="text-xs text-amber-600 ml-6 mt-1">
                        ⚠️ You can edit this section directly without resetting. Use the Edit button on the Setup page.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={resetWtr} onCheckedChange={(v) => setResetWtr(!!v)} />
                      <span className="text-sm">Contract Rules (WTR)</span>
                    </label>
                    {resetWtr && (
                      <p className="text-xs text-amber-600 ml-6 mt-1">
                        ⚠️ You can edit this section directly without resetting. Use the Edit button on the Setup page.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 2 */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Dates & Preferences</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={resetPeriod} onCheckedChange={(v) => setResetPeriod(!!v)} />
                    <span className="text-sm">Rota Period (dates, bank holidays, survey deadline)</span>
                  </label>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={resetRoster} onCheckedChange={(v) => setResetRoster(!!v)} />
                      <span className="text-sm">Doctor Roster (moves all doctors to inactive)</span>
                    </label>
                    {resetRoster && allActiveDoctors.length > 0 && (
                      <div className="ml-6 mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground">Which doctors would you like to carry forward to the new period?</p>
                        <div className="flex gap-2 text-xs">
                          <button className="text-primary underline" onClick={() => setCarryForwardDoctors(allActiveDoctors.map(d => d.id))}>Select all</button>
                          <button className="text-primary underline" onClick={() => setCarryForwardDoctors([])}>Deselect all</button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                          {allActiveDoctors.map(doc => (
                            <label key={doc.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={carryForwardDoctors.includes(doc.id)}
                                onCheckedChange={() => toggleCarryForward(doc.id)}
                              />
                              {doc.last_name}, {doc.first_name} — {doc.grade}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" disabled={!anySelected} onClick={() => setStep(2)}>Next</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Reset</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <ul className="list-disc list-inside text-sm space-y-1">
                {resetDepartment && <li>Department shift types will be permanently deleted</li>}
                {resetWtr && <li>Contract Rules (WTR) will be reset to factory defaults</li>}
                {resetPeriod && <li>Rota period dates and bank holidays will be cleared</li>}
                {resetRoster && (
                  <li>
                    All doctors will be set to inactive
                    {carryForwardDoctors.length > 0 && ` (${carryForwardDoctors.length} doctors will be carried forward)`}
                  </li>
                )}
              </ul>

              <div className="space-y-1">
                <label className="text-sm font-medium">Type RESET to confirm</label>
                <Input placeholder="RESET" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setStep(1); setConfirmText(""); }}>
                ← Go back
              </button>
              <div className="flex-1" />
              <Button
                variant="destructive"
                disabled={confirmText !== "RESET" || loading}
                onClick={handleReset}
              >
                {loading ? "Resetting…" : "Reset Now"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
