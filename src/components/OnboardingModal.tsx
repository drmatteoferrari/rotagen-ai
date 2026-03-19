import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingModalProps {
  onClose: () => void;
}

export default function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [currentScreen, setCurrentScreen] = useState<1 | 2 | 3>(1);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleClose = useCallback(async () => {
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true, onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    onClose();
  }, [user?.id, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const handleGoToSetup = async () => {
    await handleClose();
    navigate("/admin/setup");
  };

  const dots = (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((d) => (
        <div
          key={d}
          className={`h-2 w-2 rounded-full transition-colors ${
            d === currentScreen ? "bg-primary" : "bg-muted-foreground/25"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-full w-full flex-col bg-background sm:h-auto sm:mx-4 sm:max-w-[560px] sm:rounded-2xl sm:shadow-xl">
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {currentScreen === 1 && <Screen1 />}
          {currentScreen === 2 && <Screen2 />}
          {currentScreen === 3 && <Screen3 />}
        </div>

        <div className="border-t border-border px-6 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {currentScreen === 1 && (
              <>
                <Button variant="ghost" className="min-h-[44px] text-muted-foreground" onClick={handleClose}>
                  Skip tour
                </Button>
                <div className="flex items-center gap-3">
                  {dots}
                  <Button className="min-h-[44px]" onClick={() => setCurrentScreen(2)}>
                    Show me around
                  </Button>
                </div>
              </>
            )}

            {currentScreen === 2 && (
              <>
                <Button variant="ghost" className="min-h-[44px]" onClick={() => setCurrentScreen(1)}>
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  {dots}
                  <Button className="min-h-[44px]" onClick={() => setCurrentScreen(3)}>
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentScreen === 3 && (
              <>
                <Button variant="ghost" className="min-h-[44px]" onClick={() => setCurrentScreen(2)}>
                  Back
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                  {dots}
                  <Button variant="ghost" className="min-h-[44px]" onClick={handleClose}>
                    Explore Dashboard
                  </Button>
                  <Button className="min-h-[44px]" onClick={handleGoToSetup}>
                    Go to Setup
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Screen components ── */

function Screen1() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-primary text-xs font-bold text-primary">
          RE
        </div>
        <span className="text-sm font-semibold text-foreground">RotaGen</span>
      </div>

      <h2 className="text-lg font-medium text-foreground sm:text-[22px]">Welcome to RotaGen</h2>
      <p className="text-sm text-muted-foreground">
        NHS-compliant rota scheduling — built for anaesthetic departments.
      </p>
      <p className="text-sm text-muted-foreground">
        You're a few steps away from generating your first rota. Let's show you how it works.
      </p>
    </div>
  );
}

function Screen2() {
  const steps = [
    { title: "Set up your department", body: "Define your shift types, staffing minimums, and WTR settings." },
    { title: "Set up your rota period", body: "Choose your start and end dates." },
    { title: "Collect doctor preferences", body: "Add your doctors and send each one a survey link — leave, NOC dates, and preferences collected automatically." },
    { title: "Generate your rota", body: "RotaGen builds a WTR-compliant rota from your doctors' preferences automatically." },
  ];

  return (
    <div className="space-y-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <CalendarDays className="h-5 w-5 text-primary" />
      </div>

      <h2 className="text-lg font-medium text-foreground">Four steps to a finished rota</h2>

      <div className="space-y-4">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Screen3() {
  return (
    <div className="space-y-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
        <CheckCircle className="h-5 w-5 text-green-600" />
      </div>

      <h2 className="text-lg font-medium text-foreground">You're ready to go</h2>
      <p className="text-sm text-muted-foreground">
        Your first step is department setup — define your shift types and staffing minimums.
      </p>
      <p className="text-sm text-muted-foreground">
        Once setup is complete, you can add doctors, collect preferences, and generate your rota.
      </p>
    </div>
  );
}
