import { useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { ArrowLeft, ArrowRight, Clock, CalendarDays, Info, ShieldAlert } from "lucide-react";
import { useSurveyMode } from "@/contexts/SurveyModeContext";

const wteOptions = [
  { value: "100", label: "100%", sub: "Full Time" },
  { value: "80", label: "80%", sub: "4 Days" },
  { value: "60", label: "60%", sub: "3 Days" },
  { value: "other", label: "Other", sub: "Custom" },
];

const days = ["M", "T", "W", "T", "F", "S", "S"];

export default function SurveyStep3() {
  const navigate = useNavigate();
  const { isAdminMode, doctorId } = useSurveyMode();

  const prevPath = isAdminMode ? `/admin/survey-override/${doctorId}/2` : "/doctor/survey/2";
  const nextPath = isAdminMode ? `/admin/survey-override/${doctorId}/4` : "/doctor/survey/4";

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        {isAdminMode && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
          </div>
        )}

        <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f8]/95 backdrop-blur-sm p-4 pb-2">
          <button onClick={() => navigate(prevPath)} className="flex size-10 items-center justify-center rounded-full text-slate-900 hover:bg-slate-200 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Step 3 of 6</h2>
          <div className="size-10" />
        </header>

        <div className="flex flex-col gap-3 px-6 py-2">
          <div className="flex justify-between items-end">
            <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Progress</span>
            <span className="text-teal-500 font-bold text-sm">50%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full bg-teal-500" style={{ width: "50%" }} />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto pb-32">
          <div className="px-6 pt-6 pb-4">
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight mb-3">Working Hours<br />& LTFT</h1>
            <p className="text-slate-600 text-base leading-relaxed">Please select your Whole Time Equivalent (WTE) and preferred days off if Less Than Full Time.</p>
          </div>

          <div className="px-6 py-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-500" /> Whole Time Equivalent (WTE)
            </h3>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="grid grid-cols-2 gap-3">
                {wteOptions.map((opt, i) => (
                  <label key={opt.value} className="relative cursor-pointer">
                    <input type="radio" name="wte" defaultChecked={i === 0} className="peer sr-only" />
                    <div className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-slate-100 bg-[#f6f8f8] transition-all peer-checked:border-teal-500 peer-checked:bg-teal-50 peer-checked:shadow-sm">
                      <span className="text-2xl font-bold text-slate-900 mb-1">{opt.label}</span>
                      <span className="text-xs font-medium text-slate-500">{opt.sub}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-2">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-teal-500" /> Preferred Non-Working Days
            </h3>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 mb-4">Select the days you prefer NOT to work. Tap to select multiple.</p>
              <div className="flex flex-wrap gap-2">
                {days.map((d, i) => (
                  <label key={i} className="cursor-pointer">
                    <input type="checkbox" defaultChecked={i === 2} className="peer sr-only" />
                    <div className="size-10 rounded-full flex items-center justify-center text-sm font-bold border border-slate-200 text-slate-600 peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500 transition-all">
                      {d}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-start gap-3 p-4 bg-teal-50 rounded-lg border border-teal-500/20">
              <Info className="h-5 w-5 text-teal-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">Selecting LTFT may affect your rota pattern availability. Your department lead will review this request.</p>
            </div>
          </div>
        </main>

        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 pb-8 flex justify-between items-center gap-4 z-20">
          <button onClick={() => navigate(prevPath)} className="flex-1 py-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-center">Back</button>
          <button onClick={() => navigate(nextPath)} className="flex-[2] py-4 rounded-xl font-bold text-white bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 transition-all">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </DoctorLayout>
  );
}
