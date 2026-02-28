import { useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { ArrowLeft, Stethoscope, FlaskConical, Info, CheckCircle, ShieldAlert } from "lucide-react";
import { useSurveyMode } from "@/contexts/SurveyModeContext";

const specialties = ["Cardiology", "Neurology", "Internal Medicine", "Pediatrics", "Oncology", "Dermatology"];
const interests = ["Research", "Patient Care", "Surgery Tech", "Telemedicine", "Public Health"];
const defaultSpecialties = ["Cardiology", "Internal Medicine"];
const defaultInterests = ["Patient Care", "Surgery Tech"];

export default function SurveyStep6() {
  const navigate = useNavigate();
  const { isAdminMode, doctorId } = useSurveyMode();

  const prevPath = isAdminMode ? `/admin/survey-override/${doctorId}/5` : "/doctor/survey/5";

  const handleSubmit = () => {
    if (isAdminMode) {
      navigate("/admin/roster");
    }
    // In normal mode, stays on page / shows success (future)
  };

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        {isAdminMode && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
          </div>
        )}

        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md pb-2">
          <div className="flex items-center p-4 pb-2 justify-between">
            <button onClick={() => navigate(prevPath)} className="flex size-12 items-center justify-center rounded-full text-slate-900 hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Preferences Survey</h2>
            <div className="size-12" />
          </div>
          <div className="flex flex-col gap-3 px-6">
            <div className="flex justify-between items-end">
              <p className="text-teal-600 text-sm font-medium">Final Step</p>
              <p className="text-slate-900 text-sm font-bold">Step 6 of 6</p>
            </div>
            <div className="rounded-full bg-slate-100 h-2 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.4)]" style={{ width: "100%" }} />
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col px-6 pt-6 pb-40 gap-8 overflow-y-auto">
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-900 mb-2">Final Touches</h1>
            <p className="text-slate-500 text-base font-medium leading-relaxed">Select your desired specialties and clinical interests to personalize your feed.</p>
          </div>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-teal-500" />
              <h3 className="text-lg font-bold text-slate-900">Desired Specialties</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <label key={s} className="cursor-pointer select-none">
                  <input type="checkbox" defaultChecked={defaultSpecialties.includes(s)} className="peer sr-only" />
                  <div className="px-5 py-3 rounded-full border border-slate-200 bg-white text-slate-600 font-medium text-sm transition-all peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500 peer-checked:shadow-md peer-checked:font-bold hover:border-teal-500/50 hover:text-teal-500">
                    {s}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <FlaskConical className="h-5 w-5 text-teal-500" />
              <h3 className="text-lg font-bold text-slate-900">Clinical Interests</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((s) => (
                <label key={s} className="cursor-pointer select-none">
                  <input type="checkbox" defaultChecked={defaultInterests.includes(s)} className="peer sr-only" />
                  <div className="px-5 py-3 rounded-full border border-slate-200 bg-white text-slate-600 font-medium text-sm transition-all peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500 peer-checked:shadow-md peer-checked:font-bold hover:border-teal-500/50 hover:text-teal-500">
                    {s}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <div className="bg-teal-50 rounded-2xl p-4 flex gap-4 items-start shadow-sm border border-teal-100">
            <div className="bg-white p-2 rounded-xl text-teal-500 shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-teal-900 font-bold text-sm mb-1">Almost done!</h4>
              <p className="text-teal-700 text-sm leading-normal">Your profile will be customized based on these selections. You can always change this later in settings.</p>
            </div>
          </div>
        </main>

        <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 p-6 z-20">
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubmit}
              className={`w-full h-14 text-white text-lg font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                isAdminMode
                  ? "bg-amber-500 shadow-amber-500/30 hover:bg-amber-600"
                  : "bg-teal-500 shadow-teal-500/30 hover:bg-teal-600"
              }`}
            >
              {isAdminMode ? "Save Admin Override" : "Submit Preferences"} <CheckCircle className="h-5 w-5" />
            </button>
            <button onClick={() => navigate(prevPath)} className="w-full h-12 text-slate-500 font-medium hover:text-slate-800 transition-colors">
              Back to previous step
            </button>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
