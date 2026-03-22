import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepNavProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  isSubmit?: boolean;
}

export function StepNav({ onBack, onNext, backLabel = "Back", nextLabel = "Continue", nextDisabled = false, isSubmit = false }: StepNavProps) {
  return (
    <div className="shrink-0 bg-white border-t border-border px-4 sm:px-6 py-3 sm:py-4 z-20">
      <div className="flex items-center justify-between gap-3">
        <div>
          {onBack && (
            <Button
              variant="outline"
              size="lg"
              onClick={onBack}
              className="h-11 px-5 cursor-pointer border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 active:bg-teal-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> {backLabel}
            </Button>
          )}
        </div>
        <Button
          size="lg"
          onClick={onNext}
          disabled={nextDisabled}
          className="h-11 px-6 cursor-pointer bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLabel}
          {isSubmit ? <Send className="h-4 w-4 ml-2" /> : <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}
