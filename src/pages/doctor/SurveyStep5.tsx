import { useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { ArrowLeft, ArrowRight, Info, ShieldAlert } from "lucide-react";
import { useSurveyMode } from "@/contexts/SurveyModeContext";

export default function SurveyStep5() {
  const navigate = useNavigate();
  const { isAdminMode, doctorId } = useSurveyMode();

  const prevPath = isAdminMode ? `/admin/survey-override/${doctorId}/4` : "/doctor/survey/4";
  const nextPath = isAdminMode ? `/admin/survey-override/${doctorId}/6` : "/doctor/survey/6";

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        {isAdminMode && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
          </div>
        )}

        <header className="sticky top-0 z-10 bg-[#f6f8f8]/95 backdrop-blur-sm border-b border-slate-200">
          <div className="flex items-center p-4 justify-between h-16">
            <button onClick={() => navigate(prevPath)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 transition-colors text-slate-900">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold tracking-tight flex-1 text-center pr-10">Medical Details</h2>
          </div>
        </header>

        <div className="px-5 pt-6 pb-2">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-teal-500 uppercase tracking-wider">Step 5 of 6</p>
            <span className="text-xs font-medium text-slate-500">83% Completed</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full bg-teal-500" style={{ width: "83%" }} />
          </div>
        </div>

        <main className="flex-1 flex flex-col gap-6 p-5 pb-32">
          <div>
            <h1 className="text-xl font-bold tracking-tight mb-4 text-slate-900">Do you have any medical or OH restrictions?</h1>
            <div className="bg-white rounded-xl p-1.5 shadow-sm border border-slate-200 flex overflow-hidden">
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="medical_restrictions" defaultChecked className="peer sr-only" />
                <div className="h-12 flex items-center justify-center rounded-lg text-slate-600 font-medium transition-all peer-checked:bg-teal-500 peer-checked:text-white">No</div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="medical_restrictions" className="peer sr-only" />
                <div className="h-12 flex items-center justify-center rounded-lg text-slate-600 font-medium transition-all peer-checked:bg-teal-500 peer-checked:text-white">Yes</div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h1 className="text-xl font-bold tracking-tight mb-4 text-slate-900">Are you currently pregnant?</h1>
            <div className="bg-white rounded-xl p-1.5 shadow-sm border border-slate-200 flex overflow-hidden">
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="pregnancy" defaultChecked className="peer sr-only" />
                <div className="h-12 flex items-center justify-center rounded-lg text-slate-600 font-medium transition-all peer-checked:bg-teal-500 peer-checked:text-white">No</div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="pregnancy" className="peer sr-only" />
                <div className="h-12 flex items-center justify-center rounded-lg text-slate-600 font-medium transition-all peer-checked:bg-teal-500 peer-checked:text-white">Yes</div>
              </label>
            </div>
          </div>

          <div className="mt-4 p-4 bg-teal-500/10 rounded-xl border border-teal-500/20 flex gap-3 items-start">
            <Info className="h-5 w-5 text-teal-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">Your medical information is kept strictly confidential and only used to ensure your safety in the workplace.</p>
          </div>
        </main>

        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-8 z-20">
          <div className="flex gap-4">
            <button onClick={() => navigate(prevPath)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={() => navigate(nextPath)} className="flex-1 py-3.5 rounded-xl bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/30 hover:bg-teal-600 transition-colors flex items-center justify-center gap-2">
              Next Step <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
