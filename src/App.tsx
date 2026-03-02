import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminSetupProvider } from "./contexts/AdminSetupContext";
import { DepartmentSetupProvider } from "./contexts/DepartmentSetupContext";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
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
        <AuthProvider>
        <AdminSetupProvider>
        <DepartmentSetupProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute requireRole="admin"><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/rota-period/step-1" element={<ProtectedRoute requireRole="admin"><RotaPeriodStep1 /></ProtectedRoute>} />
          <Route path="/admin/rota-period/step-2" element={<ProtectedRoute requireRole="admin"><RotaPeriodStep2 /></ProtectedRoute>} />
          <Route path="/admin/department/step-1" element={<ProtectedRoute requireRole="admin"><DepartmentStep1 /></ProtectedRoute>} />
          <Route path="/admin/department/step-2" element={<ProtectedRoute requireRole="admin"><DepartmentStep2 /></ProtectedRoute>} />
          <Route path="/admin/department/step-3" element={<ProtectedRoute requireRole="admin"><DepartmentStep3 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-1" element={<ProtectedRoute requireRole="admin"><WtrStep1 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-2" element={<ProtectedRoute requireRole="admin"><WtrStep2 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-3" element={<ProtectedRoute requireRole="admin"><WtrStep3 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-4" element={<ProtectedRoute requireRole="admin"><WtrStep4 /></ProtectedRoute>} />
          <Route path="/admin/roster" element={<ProtectedRoute requireRole="admin"><Roster /></ProtectedRoute>} />
          <Route path="/admin/survey-override/:doctorId/:step" element={<ProtectedRoute requireRole="admin"><SurveyOverride /></ProtectedRoute>} />
          <Route path="/doctor/survey/1" element={<ProtectedRoute><SurveyStep1 /></ProtectedRoute>} />
          <Route path="/doctor/survey/2" element={<ProtectedRoute><SurveyStep2 /></ProtectedRoute>} />
          <Route path="/doctor/survey/3" element={<ProtectedRoute><SurveyStep3 /></ProtectedRoute>} />
          <Route path="/doctor/survey/4" element={<ProtectedRoute><SurveyStep4 /></ProtectedRoute>} />
          <Route path="/doctor/survey/5" element={<ProtectedRoute><SurveyStep5 /></ProtectedRoute>} />
          <Route path="/doctor/survey/6" element={<ProtectedRoute><SurveyStep6 /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </DepartmentSetupProvider>
        </AdminSetupProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
