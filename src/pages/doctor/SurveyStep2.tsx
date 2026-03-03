import { DoctorLayout } from "@/components/DoctorLayout";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, FileText, Heart, Activity, Ambulance, CheckCircle, ShieldAlert } from "lucide-react";
import { useSurveyMode } from "@/contexts/SurveyModeContext";
import { useSurveyContext } from "@/contexts/SurveyContext";

const competencies = [
  { code: "IAC", name: "Initial Assessment", icon: FileText, achieved: true, toggleLabel: "Independent Practice?", toggleSub: "Can you practice solo?", defaultChecked: true },
  { code: "IAOC", name: "Obstetric Competence", icon: Heart, achieved: false, toggleLabel: "Working towards?", toggleSub: "Is this a current goal?", defaultChecked: false, yesNoDefault: "no" },
  { code: "ICU", name: "Intensive Care Unit", icon: Activity, achieved: true, toggleLabel: "Independent Practice?", toggleSub: "Cleared for solo shifts?", defaultChecked: true, yesNoDefault: "yes" },
  { code: "Transfers", name: "Patient Transport", icon: Ambulance, achieved: false, toggleLabel: "Working towards?", toggleSub: "Actively training?", defaultChecked: true, yesNoDefault: "no" },
];

export default function SurveyStep2() {
  const surveyCtx = useSurveyContext();
  const surveyMode = useSurveyMode();
  const isAdminMode = surveyMode.isAdminMode;

  const handleBack = () => surveyCtx?.prevStep();
  const handleNext = () => surveyCtx?.nextStep();

  const isWrapped = !!surveyCtx;

  const content = (
    <div className="flex flex-col min-h-full">
      {isAdminMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#f6f8f8]/95 backdrop-blur-sm p-4 pb-2">
        <button onClick={handleBack} className="flex size-10 items-center justify-center rounded-full text-slate-900 hover:bg-slate-200 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Competencies</h2>
        <div className="size-10" />
      </header>

      <div className="flex flex-col gap-3 px-6 py-2">
        <div className="flex justify-between items-end">
          <p className="text-sm font-semibold text-teal-500">Step 2 of 6</p>
          <p className="text-xs font-medium text-slate-500">33% Completed</p>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full bg-teal-500" style={{ width: "33%" }} />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 pb-32">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Core Competencies</h1>
        <p className="text-slate-600 mb-6">Please indicate your current level for the following clinical areas.</p>

        <div className="flex flex-col gap-6">
          {competencies.map((c) => (
            <div key={c.code} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.achieved ? "bg-teal-500/10 text-teal-500" : "bg-slate-100 text-slate-600"}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{c.code}</h3>
                    <p className="text-xs text-slate-500">{c.name}</p>
                  </div>
                </div>
                {c.achieved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-500">
                    <CheckCircle className="h-3.5 w-3.5" /> Achieved
                  </span>
                ) : (
                  <div className="flex rounded-lg bg-slate-100 p-1">
                    <button className={`rounded-md px-3 py-1 text-xs font-medium ${c.yesNoDefault === "yes" ? "bg-white shadow-sm font-bold text-teal-500" : "text-slate-500"}`}>Yes</button>
                    <button className={`rounded-md px-3 py-1 text-xs font-medium ${c.yesNoDefault === "no" ? "bg-white shadow-sm font-bold text-slate-900" : "text-slate-500"}`}>No</button>
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{c.toggleLabel}</span>
                    <span className="text-xs text-slate-500">{c.toggleSub}</span>
                  </label>
                  <Switch defaultChecked={c.defaultChecked} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 pb-6 z-30">
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleBack} className="flex-1 rounded-xl bg-slate-100 py-3.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors">Back</button>
          <button onClick={handleNext} className="flex-1 rounded-xl bg-teal-500 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-600 active:scale-[0.98] transition-all">Next Step</button>
        </div>
      </div>
    </div>
  );

  if (isWrapped) return content;
  return <DoctorLayout>{content}</DoctorLayout>;
}
