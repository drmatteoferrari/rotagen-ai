import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminSetupProvider } from "./contexts/AdminSetupContext";
import { DepartmentSetupProvider } from "./contexts/DepartmentSetupContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { RotaProvider } from "./contexts/RotaContext";
import { ReactNode } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
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
import Survey from "./pages/doctor/Survey";
import SurveyOverride from "./pages/admin/SurveyOverride";
import Audit from "./pages/Audit";
import PreRotaCalendarPage from "./pages/admin/PreRotaCalendarPage";
import PreRotaTargetsPage from "./pages/admin/PreRotaTargetsPage";
import PreRotaPage from "./pages/admin/PreRotaPage";

const queryClient = new QueryClient();
// ✅ Section 2 complete

// SECTION 7 COMPLETE
function ProtectedRoute({ children, requiredRole }: { children: ReactNode; requiredRole?: "coordinator" | "doctor" }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RotaProvider>
        <AuthProvider>
        <AdminSetupProvider>
        <DepartmentSetupProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="coordinator"><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/rota-period/step-1" element={<ProtectedRoute requiredRole="coordinator"><RotaPeriodStep1 /></ProtectedRoute>} />
          <Route path="/admin/rota-period/step-2" element={<ProtectedRoute requiredRole="coordinator"><RotaPeriodStep2 /></ProtectedRoute>} />
          <Route path="/admin/department/step-1" element={<ProtectedRoute requiredRole="coordinator"><DepartmentStep1 /></ProtectedRoute>} />
          <Route path="/admin/department/step-2" element={<ProtectedRoute requiredRole="coordinator"><DepartmentStep2 /></ProtectedRoute>} />
          <Route path="/admin/department/step-3" element={<ProtectedRoute requiredRole="coordinator"><DepartmentStep3 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-1" element={<ProtectedRoute requiredRole="coordinator"><WtrStep1 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-2" element={<ProtectedRoute requiredRole="coordinator"><WtrStep2 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-3" element={<ProtectedRoute requiredRole="coordinator"><WtrStep3 /></ProtectedRoute>} />
          <Route path="/admin/wtr/step-4" element={<ProtectedRoute requiredRole="coordinator"><WtrStep4 /></ProtectedRoute>} />
          <Route path="/admin/roster" element={<ProtectedRoute requiredRole="coordinator"><Roster /></ProtectedRoute>} />
          <Route path="/admin/pre-rota" element={<ProtectedRoute requiredRole="coordinator"><PreRotaPage /></ProtectedRoute>} />
          <Route path="/admin/pre-rota-calendar" element={<ProtectedRoute requiredRole="coordinator"><PreRotaCalendarPage /></ProtectedRoute>} />
          <Route path="/admin/pre-rota-targets" element={<ProtectedRoute requiredRole="coordinator"><PreRotaTargetsPage /></ProtectedRoute>} />
          <Route path="/admin/survey-override/:doctorId/:step" element={<ProtectedRoute requiredRole="coordinator"><SurveyOverride /></ProtectedRoute>} />
          {/* Doctor survey — token-based, no auth required */}
          <Route path="/doctor/survey" element={<Survey />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </DepartmentSetupProvider>
        </AdminSetupProvider>
        </AuthProvider>
        </RotaProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
