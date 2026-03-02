import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminSetupProvider } from "./contexts/AdminSetupContext";
import { DepartmentSetupProvider } from "./contexts/DepartmentSetupContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Roster from "./pages/admin/Roster";
import Dashboard from "./pages/admin/Dashboard";
import RotaPeriodStep1 from "./pages/admin/RotaPeriodStep1";
import RotaPeriodStep2 from "./pages/admin/RotaPeriodStep2";
import DepartmentStep1 from "./pages/admin/DepartmentStep1";
import DepartmentStep2 from "./pages/admin/DepartmentStep2";
import DepartmentStep3 from "./pages/admin/DepartmentStep3";
import WtrStep1 from "./pages/admin/WtrStep1";
import WtrStep2 from "./pages/admin/WtrStep2";
import WtrStep3 from "./pages/admin/WtrStep3";
import WtrStep4 from "./pages/admin/WtrStep4";
import SurveyStep1 from "./pages/doctor/SurveyStep1";
import SurveyStep2 from "./pages/doctor/SurveyStep2";
import SurveyStep3 from "./pages/doctor/SurveyStep3";
import SurveyStep4 from "./pages/doctor/SurveyStep4";
import SurveyStep5 from "./pages/doctor/SurveyStep5";
import SurveyStep6 from "./pages/doctor/SurveyStep6";
import SurveyOverride from "./pages/admin/SurveyOverride";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AdminSetupProvider>
        <DepartmentSetupProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/rota-period/step-1" element={<RotaPeriodStep1 />} />
          <Route path="/admin/rota-period/step-2" element={<RotaPeriodStep2 />} />
          <Route path="/admin/department/step-1" element={<DepartmentStep1 />} />
          <Route path="/admin/department/step-2" element={<DepartmentStep2 />} />
          <Route path="/admin/department/step-3" element={<DepartmentStep3 />} />
          <Route path="/admin/wtr/step-1" element={<WtrStep1 />} />
          <Route path="/admin/wtr/step-2" element={<WtrStep2 />} />
          <Route path="/admin/wtr/step-3" element={<WtrStep3 />} />
          <Route path="/admin/wtr/step-4" element={<WtrStep4 />} />
          <Route path="/admin/roster" element={<Roster />} />
          <Route path="/admin/survey-override/:doctorId/:step" element={<SurveyOverride />} />
          <Route path="/doctor/survey/1" element={<SurveyStep1 />} />
          <Route path="/doctor/survey/2" element={<SurveyStep2 />} />
          <Route path="/doctor/survey/3" element={<SurveyStep3 />} />
          <Route path="/doctor/survey/4" element={<SurveyStep4 />} />
          <Route path="/doctor/survey/5" element={<SurveyStep5 />} />
          <Route path="/doctor/survey/6" element={<SurveyStep6 />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </DepartmentSetupProvider>
        </AdminSetupProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
