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
    <div className="sticky bottom-0 bg-card/95 backdrop-blur-md border-t border-border p-4 pb-6 z-20">
      <div className="flex items-center justify-between gap-3 sm:flex-row flex-col-reverse">
        {onBack && (
          <Button variant="outline" size="lg" onClick={onBack} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" /> {backLabel}
          </Button>
        )}
        <Button
          size="lg"
          onClick={onNext}
          disabled={nextDisabled}
          className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto"
        >
          {nextLabel}
          {isSubmit ? <Send className="h-4 w-4 ml-2" /> : <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}
