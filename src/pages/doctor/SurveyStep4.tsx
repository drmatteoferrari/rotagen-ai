import { useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { ArrowLeft, ArrowRight, CalendarDays, GraduationCap, CalendarX, Plus, Trash2, ShieldAlert } from "lucide-react";
import { useSurveyMode } from "@/contexts/SurveyModeContext";

export default function SurveyStep4() {
  const navigate = useNavigate();
  const { isAdminMode, doctorId } = useSurveyMode();

  const prevPath = isAdminMode ? `/admin/survey-override/${doctorId}/3` : "/doctor/survey/3";
  const nextPath = isAdminMode ? `/admin/survey-override/${doctorId}/5` : "/doctor/survey/5";

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        {isAdminMode && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
          </div>
        )}

        <header className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur-sm p-4 pb-2 border-b border-slate-100">
          <button onClick={() => navigate(prevPath)} className="flex size-12 items-center justify-center rounded-full text-slate-900 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 flex-1 text-center pr-12">Leave & Availability</h2>
        </header>

        <main className="flex-1 overflow-y-auto pb-24">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex justify-between items-baseline">
              <p className="text-base font-medium text-slate-900">Step 4 of 6</p>
              <p className="text-sm text-slate-500">66%</p>
            </div>
            <div className="rounded-full bg-slate-200 h-2 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500" style={{ width: "66%" }} />
            </div>
          </div>

          <section>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-xl font-bold text-slate-900">Annual Leave</h3>
              <span className="text-slate-400 text-sm">Optional</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 hover:border-teal-500/50 hover:bg-teal-500/5 transition-colors">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="size-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500 mb-2">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <p className="text-base font-bold text-slate-900">No annual leave added</p>
                  <p className="text-sm text-slate-500 max-w-[240px]">Add your planned leave dates here to block your calendar.</p>
                </div>
                <button className="flex items-center justify-center gap-2 rounded-xl h-10 px-4 bg-teal-500 text-white hover:bg-teal-600 text-sm font-bold shadow-md shadow-teal-500/20 transition-all">
                  <Plus className="h-4 w-4" /> Add Annual Leave
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-xl font-bold text-slate-900">Study Leave</h3>
              <span className="text-slate-400 text-sm">Optional</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 hover:border-teal-500/50 hover:bg-teal-500/5 transition-colors">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="size-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500 mb-2">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <p className="text-base font-bold text-slate-900">No study leave added</p>
                  <p className="text-sm text-slate-500 max-w-[240px]">Planning exams or courses? Add dates here.</p>
                </div>
                <button className="flex items-center justify-center gap-2 rounded-xl h-10 px-4 bg-teal-500 text-white hover:bg-teal-600 text-sm font-bold shadow-md shadow-teal-500/20 transition-all">
                  <Plus className="h-4 w-4" /> Add Study Leave
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-xl font-bold text-slate-900">Not-On-Call (NOC) Dates</h3>
              <span className="text-slate-400 text-sm">Required</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500">
                      <CalendarX className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Not On Call</p>
                      <p className="text-xs text-slate-500">Aug 12 - Aug 14, 2024</p>
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl h-12 px-4 border border-dashed border-teal-500/40 text-teal-500 hover:bg-teal-500/5 text-sm font-bold transition-all">
                  <Plus className="h-5 w-5" /> Add NOC Date
                </button>
              </div>
            </div>
          </section>
        </main>

        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 z-20">
          <div className="flex gap-4">
            <button onClick={() => navigate(prevPath)} className="flex-1 h-12 rounded-xl bg-slate-100 text-slate-900 font-bold hover:bg-slate-200 transition-colors">Back</button>
            <button onClick={() => navigate(nextPath)} className="flex-1 h-12 rounded-xl bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all flex items-center justify-center gap-2">
              Next Step <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
