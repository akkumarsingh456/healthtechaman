import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
// BackNavigation is now integrated into the Header component
import ProtectedRoute from "./components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import AutoScanIndicator from "./components/AutoScanIndicator";

// Auto-retry dynamic imports on chunk load failure (stale deploy)
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch(() => {
      // Force reload once to get fresh chunks
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
        return new Promise(() => {}); // never resolves, page reloads
      }
      sessionStorage.removeItem("chunk_reload");
      return importFn(); // retry once more
    })
  );
}

// Lazy load all dashboard pages for faster initial load
const StudentRegistration = lazyRetry(() => import("./pages/StudentRegistration"));
const DoctorRegistration = lazyRetry(() => import("./pages/DoctorRegistration"));
const MentorRegistration = lazyRetry(() => import("./pages/MentorRegistration"));
const DoctorDashboard = lazyRetry(() => import("./pages/DoctorDashboard"));
const DoctorProfile = lazyRetry(() => import("./pages/DoctorProfile"));
const StudentProfilePage = lazyRetry(() => import("./pages/StudentProfilePage"));
const MedicalTeam = lazyRetry(() => import("./pages/MedicalTeam"));
const Appointments = lazyRetry(() => import("./pages/Appointments"));
const MyAppointments = lazyRetry(() => import("./pages/MyAppointments"));
const EmailConfirmation = lazyRetry(() => import("./pages/EmailConfirmation"));
const HealthDashboard = lazyRetry(() => import("./pages/HealthDashboard"));
const StudentProfile = lazyRetry(() => import("./pages/StudentProfile"));
const NewVisit = lazyRetry(() => import("./pages/NewVisit"));
const AdminPanel = lazyRetry(() => import("./pages/AdminPanel"));
const AdminHome = lazyRetry(() => import("./pages/AdminHome"));
const MentorDashboard = lazyRetry(() => import("./pages/MentorDashboard"));
const MentorHome = lazyRetry(() => import("./pages/MentorHome"));
const MentorProfile = lazyRetry(() => import("./pages/MentorProfile"));
const MedicalLeave = lazyRetry(() => import("./pages/MedicalLeave"));
const PharmacyDashboard = lazyRetry(() => import("./pages/PharmacyDashboard"));
const LabOfficerDashboard = lazyRetry(() => import("./pages/LabOfficerDashboard"));
const MedicalStaffDashboard = lazyRetry(() => import("./pages/MedicalStaffDashboard"));
const MedicalStaffHome = lazyRetry(() => import("./pages/MedicalStaffHome"));
const EmergencyPage = lazyRetry(() => import("./pages/EmergencyPage"));
const ProposalViewer = lazyRetry(() => import("./pages/ProposalViewer"));

const PageLoader = () => (
  <div className="min-h-screen bg-background">
    <div className="h-[72px] border-b border-border bg-card/95 flex items-center px-4 gap-4">
      <Skeleton className="w-14 h-14 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds stale time
      gcTime: 5 * 60 * 1000, // 5 min garbage collection
      retry: 1,
      refetchOnWindowFocus: true,
      refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
      refetchIntervalInBackground: false, // Pause when tab is not active
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* BackNavigation integrated into Header */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/email-confirmation" element={<EmailConfirmation />} />
            <Route path="/medical-team" element={<MedicalTeam />} />
            <Route path="/proposal" element={<ProposalViewer />} />
            
            {/* Protected Routes */}
            <Route path="/student/register" element={<ProtectedRoute><StudentRegistration /></ProtectedRoute>} />
            <Route path="/student/profile" element={<ProtectedRoute><StudentProfilePage /></ProtectedRoute>} />
            <Route path="/doctor/register" element={<ProtectedRoute><DoctorRegistration /></ProtectedRoute>} />
            <Route path="/doctor/dashboard" element={<ProtectedRoute><DoctorDashboard /></ProtectedRoute>} />
            <Route path="/doctor/profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/my-appointments" element={<ProtectedRoute><MyAppointments /></ProtectedRoute>} />
            <Route path="/health-dashboard" element={<ProtectedRoute><HealthDashboard /></ProtectedRoute>} />
            <Route path="/student-profile/:rollNumber" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
            <Route path="/new-visit" element={<ProtectedRoute><NewVisit /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminHome /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            <Route path="/mentor/home" element={<ProtectedRoute><MentorHome /></ProtectedRoute>} />
            <Route path="/mentor/register" element={<ProtectedRoute><MentorRegistration /></ProtectedRoute>} />
            <Route path="/mentor/dashboard" element={<ProtectedRoute><MentorDashboard /></ProtectedRoute>} />
            <Route path="/mentor/profile" element={<ProtectedRoute><MentorProfile /></ProtectedRoute>} />
            <Route path="/medical-leave" element={<ProtectedRoute><MedicalLeave /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute><EmergencyPage /></ProtectedRoute>} />
            
            {/* Staff Dashboards */}
            <Route path="/pharmacy/dashboard" element={<ProtectedRoute><PharmacyDashboard /></ProtectedRoute>} />
            <Route path="/lab/dashboard" element={<ProtectedRoute><LabOfficerDashboard /></ProtectedRoute>} />
            <Route path="/staff/home" element={<ProtectedRoute><MedicalStaffHome /></ProtectedRoute>} />
            <Route path="/staff/dashboard" element={<ProtectedRoute><MedicalStaffDashboard /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <AutoScanIndicator />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
