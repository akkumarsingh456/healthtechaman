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
            {/* Highly Visible Custom 3D Emoji Pointer Bar */}
            <div className="bg-primary/10 border-b border-primary/30 py-5 shadow-sm">
              <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                
                <div className="flex items-center gap-2">
                  {/* Left Beautiful 3D Emoji Hand (Pointing Right) */}
                  <div className="animate-pulse" style={{ animationDuration: '0.8s' }}>
                    <img 
                      src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f449/512.webp" 
                      alt="Point Right" 
                      className="w-10 h-10 md:w-12 md:h-12 object-contain" 
                      style={{ filter: 'drop-shadow(0px 3px 5px rgba(0,0,0,0.25))' }}
                    />
                  </div>
                  <span className="text-base md:text-lg text-foreground font-bold ml-2">
                    Project Proposal & Guide:
                  </span>
                </div>
                
                <Link 
                  to="/proposal" 
                  className="text-base md:text-lg font-bold text-white bg-primary px-6 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-md hover:shadow-lg animate-pulse flex items-center gap-2"
                  style={{ animationDuration: '1.5s' }}
                >
                  View Guide PDF 📄
                </Link>
                
                {/* Right Beautiful 3D Emoji Hand (Pointing Left) */}
                <div className="hidden sm:flex animate-pulse" style={{ animationDuration: '0.8s' }}>
                  <img 
                    src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f448/512.webp" 
                    alt="Point Left" 
                    className="w-10 h-10 md:w-12 md:h-12 object-contain" 
                    style={{ filter: 'drop-shadow(0px 3px 5px rgba(0,0,0,0.25))' }}
                  />
                </div>
                
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
