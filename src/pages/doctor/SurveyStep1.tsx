import { useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/components/DoctorLayout";
import { Input } from "@/components/ui/input";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { useSurveyMode } from "@/contexts/SurveyModeContext";

export default function SurveyStep1() {
  const navigate = useNavigate();
  const { isAdminMode, doctorId, doctorName, doctorEmail } = useSurveyMode();

  const nextPath = isAdminMode ? `/admin/survey-override/${doctorId}/2` : "/doctor/survey/2";

  return (
    <DoctorLayout>
      <div className="flex flex-col min-h-full">
        {/* Admin Override Banner */}
        {isAdminMode && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">Admin Override Mode</span>
          </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f8]/95 backdrop-blur-sm p-4 pb-2">
          <div className="size-10" />
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Preference Survey</h2>
          <div className="size-10" />
        </header>

        {/* Progress */}
        <div className="flex flex-col gap-3 px-6 py-2">
          <div className="flex justify-between items-end">
            <p className="text-sm font-semibold text-teal-500">Step 1 of 6</p>
            <p className="text-xs font-medium text-slate-500">17%</p>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full bg-teal-500" style={{ width: "17%" }} />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 px-6 pt-4 pb-32">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Personal Details</h1>
          <p className="text-slate-500 mb-8">Please confirm your basic information to get started.</p>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Full Name</label>
              <Input
                placeholder="Dr. Jane Smith"
                defaultValue={isAdminMode ? doctorName : ""}
                readOnly={isAdminMode}
                className={`bg-white border-0 shadow-sm rounded-xl py-3 px-4 ${isAdminMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <Input
                type="email"
                placeholder="j.smith@nhs.net"
                defaultValue={isAdminMode ? doctorEmail : ""}
                readOnly={isAdminMode}
                className={`bg-white border-0 shadow-sm rounded-xl py-3 px-4 ${isAdminMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">GMC Number</label>
              <Input placeholder="1234567" className="bg-white border-0 shadow-sm rounded-xl py-3 px-4" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Grade / Level</label>
              <Input placeholder="e.g. ST5" className="bg-white border-0 shadow-sm rounded-xl py-3 px-4" />
            </div>
          </div>
        </main>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 pb-6 z-20">
          <button
            onClick={() => navigate(nextPath)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3.5 text-white font-bold shadow-lg shadow-teal-500/25 hover:bg-teal-600 active:scale-[0.98] transition-all"
          >
            Next Step <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </DoctorLayout>
  );
}
