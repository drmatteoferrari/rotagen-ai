import { ArrowLeft, ArrowRight } from "lucide-react";

// ✅ Section 3 complete — StepNav

interface StepNavProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  isSubmit?: boolean;
}

export function StepNav({ onBack, onNext, backLabel = "Back", nextLabel = "Next Step", nextDisabled = false, isSubmit = false }: StepNavProps) {
  return (
    <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 pb-6 z-20">
      <div className="flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isSubmit
              ? "bg-red-600 text-white shadow-red-600/30 hover:bg-red-700"
              : "bg-[#0f766e] text-white shadow-[#0f766e]/30 hover:bg-[#0d6560]"
          }`}
        >
          {nextLabel} {!isSubmit && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
