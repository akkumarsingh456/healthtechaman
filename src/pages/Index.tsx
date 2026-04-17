import { Link } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import InspirationalSection from "@/components/InspirationalSection";
import FeaturesSection from "@/components/FeaturesSection";
import HealthCentreInfo from "@/components/HealthCentreInfo";
import SecurityBanner from "@/components/SecurityBanner";
import Footer from "@/components/Footer";
import BackgroundWrapper from "@/components/layout/BackgroundWrapper";
import HealthServicesSection from "@/components/HealthServicesSection";
import HospitalIntegration from "@/components/HospitalIntegration";
import WelcomeBanner from "@/components/WelcomeBanner";
import DisclaimerSection from "@/components/DisclaimerSection";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import DoctorHomeDashboard from "@/components/doctor/DoctorHomeDashboard";
import LabOfficerHomeDashboard from "@/components/lab/LabOfficerHomeDashboard";
import PharmacyHomeDashboard from "@/components/pharmacy/PharmacyHomeDashboard";
import StudentHomeDashboard from "@/components/student/StudentHomeDashboard";

const Index = () => {
  const { user, isDoctor, isStudent, isLabOfficer, isPharmacy, isMedicalStaff, isAdmin, isMentor, loading } = useUserRole();
  const navigate = useNavigate();

  // Redirect admin, mentor, and medical staff roles to their dedicated pages
  useEffect(() => {
    if (loading || !user) return;
    if (isAdmin) navigate('/admin', { replace: true });
    else if (isMentor) navigate('/mentor/home', { replace: true });
    else if (isMedicalStaff) navigate('/staff/home', { replace: true });
  }, [user, loading, isAdmin, isMentor, isMedicalStaff, navigate]);

  // Don't render landing page for redirecting roles
  if (user && (isAdmin || isMentor || isMedicalStaff)) {
    return null;
  }

  return (
    <BackgroundWrapper>
      <Header />
      <main>
        {isDoctor && user ? (
          <DoctorHomeDashboard />
        ) : isLabOfficer && user ? (
          <LabOfficerHomeDashboard />
        ) : isPharmacy && user ? (
          <PharmacyHomeDashboard />
        ) : isStudent && user ? (
          <StudentHomeDashboard />
        ) : user ? (
          // Logged in but no specific role yet — show student home as default
          <StudentHomeDashboard />
        ) : (
          <>
            {/* Highly Visible Blinking Proposal PDF Bar (Completely Outside Disclaimer Box) */}
            <div className="bg-primary/10 border-b border-primary/30 py-5 shadow-sm">
              <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                
                <div className="flex items-center gap-2">
                  {/* Left Blinking Arrow */}
                  <span className="text-red-500 text-4xl md:text-5xl animate-pulse font-extrabold" style={{ animationDuration: '0.8s' }}>👉</span>
                  <span className="text-base md:text-lg text-foreground font-bold ml-2">
                    Project Proposal & Guide:
                  </span>
                </div>
                
                <Link 
                  to="/proposal" 
                  className="text-base md:text-lg font-bold text-white bg-primary px-6 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-md animate-pulse flex items-center gap-2"
                  style={{ animationDuration: '1.5s' }}
                >
                  View Guide PDF 📄
                </Link>
                
                {/* Right Blinking Arrow */}
                <span className="text-red-500 text-4xl md:text-5xl animate-pulse font-extrabold hidden sm:block" style={{ animationDuration: '0.8s' }}>👈</span>
                
              </div>
            </div>

            {/* Do NOT touch the Disclaimer Section or Contact Form Code below this line! */}
            <DisclaimerSection />
            <WelcomeBanner />
            <HeroSection />
            <InspirationalSection />
            <HealthServicesSection />
            <FeaturesSection />
            <HospitalIntegration />
            <SecurityBanner />
            <HealthCentreInfo />
          </>
        )}
      </main>
      <Footer />
    </BackgroundWrapper>
  );
};

export default Index;
