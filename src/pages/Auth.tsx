import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, LogIn, UserPlus, Stethoscope, GraduationCap, ArrowLeft, KeyRound, Users, BookOpen, Phone, FlaskConical, Pill, ShieldCheck, Building, Shield, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { PasswordStrength } from "@/components/ui/password-strength";
import { 
  emailSchema, 
  passwordSchema as strongPasswordSchema,
  loginPasswordSchema,
  nameSchema 
} from "@/lib/security/validation";
import { DEPARTMENTS, YEARS_OF_STUDY, PROGRAMMES } from "@/lib/validations/student-registration";

type UserType = "student" | "doctor" | "mentor" | "lab_officer" | "pharmacy" | "medical_staff" | "admin";
type AuthView = "select" | "signin" | "signup" | "forgot" | "staff_select" | "update_password";

interface StudentFormData {
  rollNumber: string;
  branch: string;
  yearOfStudy: string;
  programme: string;
  mentorName: string;
  mentorContact: string;
  mentorEmail: string;
  phone: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  fullName?: string;
  rollNumber?: string;
  branch?: string;
  yearOfStudy?: string;
  programme?: string;
  mentorName?: string;
  mentorContact?: string;
  phone?: string;
}

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [userType, setUserType] = useState<UserType | null>(null);
  const [authView, setAuthView] = useState<AuthView>("select");
  
  // Student-specific registration fields
  const [studentData, setStudentData] = useState<StudentFormData>({
    rollNumber: "",
    branch: "",
    yearOfStudy: "",
    programme: "",
    mentorName: "",
    mentorContact: "",
    mentorEmail: "",
    phone: "",
  });

  useEffect(() => {
    // 1. Manually intercept hash on load for password recovery
    if (window.location.hash.includes('type=recovery')) {
      setAuthView('update_password');
    }

    const checkSessionAndRedirect = async () => {
      // 2. Prevent dashboard redirect if user is recovering password
      if (window.location.hash.includes('type=recovery')) return;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // Clear stale session locally without hitting server
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          return;
        }
        if (session) {
          await redirectBasedOnRole(session.user);
        }
      } catch {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('update_password');
      } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // 3. Prevent redirect if user is recovering password
        if (window.location.hash.includes('type=recovery')) return;
        await redirectBasedOnRole(session.user);
      }
    });

    checkSessionAndRedirect();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const redirectBasedOnRole = async (authUser: any) => {
    const userType = authUser?.user_metadata?.user_type;
    
    // Try cached roles first for instant redirect
    const { getCachedRoles } = await import('@/hooks/useUserRole');
    let roleList = getCachedRoles(authUser.id);
    
    if (!roleList) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id);
      roleList = (roles || []).map(r => r.role as any);
    }

    const isAdmin = roleList.includes('admin');
    const isPharmacy = roleList.includes('pharmacy');
    const isLabOfficer = roleList.includes('lab_officer');
    const isMedicalStaff = roleList.includes('medical_staff');
    const isDoctor = roleList.includes('doctor');
    const isMentor = roleList.includes('mentor');

    if (isAdmin) navigate('/admin');
    else if (isPharmacy || userType === 'pharmacy') navigate('/');
    else if (isLabOfficer || userType === 'lab_officer') navigate('/');
    else if (isMedicalStaff || userType === 'medical_staff') navigate('/staff/home');
    else if (isDoctor || userType === 'doctor') {
      // Check if doctor has completed registration
      const { data: doctorProfile } = await supabase
        .from('medical_officers')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();
      
      if (doctorProfile) {
        navigate('/');
      } else {
        navigate('/doctor/register');
      }
    }
    else if (isMentor || userType === 'mentor') navigate('/mentor/home');
    else navigate('/');
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setErrors({});
    setStudentData({
      rollNumber: "",
      branch: "",
      yearOfStudy: "",
      programme: "",
      mentorName: "",
      mentorContact: "",
      mentorEmail: "",
      phone: "",
    });
  };

  const handleBack = () => {
    if (authView === "forgot") {
      setAuthView("signin");
    } else if (authView === "staff_select") {
      setAuthView("select");
    } else if (authView === "signin" || authView === "signup") {
      if (userType === "lab_officer" || userType === "pharmacy" || userType === "medical_staff") {
        setAuthView("staff_select");
      } else {
        setAuthView("select");
      }
      setUserType(null);
    } else {
      setAuthView("select");
      setUserType(null);
    }
    resetForm();
  };

  const validateForm = (isSignUp: boolean) => {
    const newErrors: FormErrors = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    if (authView !== "forgot") {
      try {
        if (isSignUp) {
          strongPasswordSchema.parse(password);
        } else {
          loginPasswordSchema.parse(password);
        }
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.password = e.errors[0].message;
        }
      }
    }

    if (isSignUp) {
      try {
        nameSchema.parse(fullName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.fullName = e.errors[0].message;
        }
      }
      
      if (userType === "student") {
        if (!studentData.rollNumber.trim() || studentData.rollNumber.length < 5) {
          newErrors.rollNumber = "Roll number is required (min 5 characters)";
        }
        if (!studentData.branch) {
          newErrors.branch = "Please select your branch/department";
        }
        if (!studentData.yearOfStudy) {
          newErrors.yearOfStudy = "Please select your year of study";
        }
        if (!studentData.programme) {
          newErrors.programme = "Please select your programme";
        }
        if (!studentData.mentorName.trim()) {
          newErrors.mentorName = "Mentor name is required";
        }
        if (!studentData.mentorContact.trim() || !/^[6-9]\d{9}$/.test(studentData.mentorContact)) {
          newErrors.mentorContact = "Enter valid 10-digit mentor contact";
        }
        if (studentData.phone && !/^[6-9]\d{9}$/.test(studentData.phone)) {
          newErrors.phone = "Enter valid 10-digit phone number";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const ADMIN_EMAIL = "akkumarsingh456@gmail.com";
  const ALLOWED_DOCTOR_EMAILS = ["doctor@nitw.ac.in", "sr25edi0050@student.nitw.ac.in"];
  const ALLOWED_STAFF_EMAILS: Record<string, string[]> = {
    pharmacy: ["pharmacy@nitw.ac.in"],
    lab_officer: ["labofficer@nitw.ac.in"],
    medical_staff: ["medicalstaff@nitw.ac.in"],
  };

  // Roles that do NOT allow signup â€” signin only
  const signinOnlyRoles: UserType[] = ["doctor", "admin", "pharmacy", "lab_officer", "medical_staff"];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    const trimmedEmail = email.trim().toLowerCase();

    // Admin restriction
    if (userType === "admin" && trimmedEmail !== ADMIN_EMAIL) {
      toast({ title: "Access Denied", description: "Admin access is restricted. Only the authorized admin email can log in.", variant: "destructive" });
      return;
    }

    // Doctor restriction - block real doctor names
    if (userType === "doctor" && !ALLOWED_DOCTOR_EMAILS.includes(trimmedEmail)) {
      toast({ title: "Access Denied", description: "Doctor login is restricted to authorized accounts only.", variant: "destructive" });
      return;
    }

    // Staff restriction
    if (userType && ALLOWED_STAFF_EMAILS[userType] && !ALLOWED_STAFF_EMAILS[userType].includes(trimmedEmail)) {
      toast({ title: "Access Denied", description: "Staff login is restricted to authorized accounts only.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const safetyTimeout = setTimeout(() => setIsLoading(false), 8000);
    
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        clearTimeout(safetyTimeout);
        setIsLoading(false);
        const msg = error.message.includes("fetch")
          ? "Unable to reach the server. Please check your internet connection."
          : error.message === "Invalid login credentials"
            ? "Invalid email or password. Please try again."
            : error.message;
        toast({ title: "Sign In Failed", description: msg, variant: "destructive" });
        return;
      }

      if (data.user && userType) {
        // SECURITY: Never auto-assign admin role through login flow
        if (userType !== 'admin') {
          try {
            const { data: existingRoles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', data.user.id);

            if (!existingRoles?.some(r => r.role === userType)) {
              await supabase.from('user_roles').insert({ user_id: data.user.id, role: userType });
            }
          } catch {}
        }

        supabase.auth.updateUser({ data: { user_type: userType } }).then(() => {});
      }

      if (data.user) {
        await redirectBasedOnRole(data.user);
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsLoading(true);
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/email-confirmation`,
        data: {
          full_name: fullName,
          user_type: userType,
        }
      }
    });

    if (error) {
      setIsLoading(false);
      if (error.message.includes("already registered")) {
        toast({
          title: "Account Exists",
          description: "This email is already registered. Please sign in instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      return;
    }
    
    if (data.user) {
      // Auto-assign role based on user type selection
      const roleToAssign = userType as string;
      
      try {
        await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: roleToAssign as any
        });
        toast({
          title: "Account Created",
          description: `You have been registered as a ${roleToAssign.charAt(0).toUpperCase() + roleToAssign.slice(1)}.`,
        });
      } catch (roleError) {
        console.log('Role assignment error (may already exist):', roleError);
      }

      // For students, create the student profile with all details
      if (userType === "student") {
        const { error: studentError } = await supabase
          .from('students')
          .insert({
            user_id: data.user.id,
            full_name: fullName,
            email: email,
            phone: studentData.phone || null,
            roll_number: studentData.rollNumber,
            program: studentData.programme,
            batch: studentData.yearOfStudy,
            branch: studentData.branch,
            year_of_study: studentData.yearOfStudy,
            mentor_name: studentData.mentorName,
            mentor_contact: studentData.mentorContact,
            mentor_email: studentData.mentorEmail || null,
          });

        if (studentError) {
          console.error('Error creating student profile:', studentError);
          // Don't fail registration, but log the error
        }
      }

      // Send registration confirmation email (fire-and-forget, non-blocking)
      supabase.functions.invoke('send-registration-email', {
        body: {
          email,
          name: fullName,
          userType: userType,
          rollNumber: userType === "student" ? studentData.rollNumber : undefined,
        }
      }).then(({ error }) => {
        if (error) console.log('Registration email could not be sent:', error.message);
      }).catch(() => {
        // Silently ignore â€” email is non-critical
      });

      setIsLoading(false);

      if (!data.session) {
        navigate(`/email-confirmation?email=${encodeURIComponent(email)}`);
      } else {
        // For doctors, redirect to 3-step registration to complete profile
        if (userType === "doctor") {
          toast({
            title: "Account Created!",
            description: "Please complete your medical staff registration to activate your profile.",
          });
          navigate("/doctor/register");
        } else {
          toast({
            title: "Account Created!",
            description: "Welcome to the Health Portal. Your profile has been set up.",
          });
          if (userType === "pharmacy") navigate("/");
          else if (userType === "lab_officer") navigate("/");
          else if (userType === "medical_staff") navigate("/staff/home");
          else if (userType === "mentor") navigate("/mentor/home");
          else navigate("/");
        }
      }
    } else {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { email?: string } = {};
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reset Link Sent!",
        description: "Check your email for the password reset link.",
      });
      setAuthView("signin");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate new password
    const newErrors: FormErrors = {};
    try {
      strongPasswordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password Updated", description: "Your password has been changed successfully!" });
      window.history.replaceState(null, '', window.location.pathname); // clear the recovery hash from URL
      setPassword("");
      setErrors({});
      setAuthView("signin");
    }
  };

  const selectUserType = (type: UserType) => {
    setUserType(type);
    setAuthView("signin");
  };

  // User type selection view
  if (authView === "select") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to Health Portal</CardTitle>
              <CardDescription>
                Choose your account type to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => selectUserType("student")}
              >
                <GraduationCap className="w-8 h-8 text-primary" />
                <div className="text-center">
                  <p className="font-semibold">New User / Student</p>
                  <p className="text-xs text-muted-foreground">Students, Faculty & Staff</p>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-secondary hover:bg-secondary/5 transition-all"
                onClick={() => selectUserType("doctor")}
              >
                <Stethoscope className="w-8 h-8 text-secondary" />
                <div className="text-center">
                  <p className="font-semibold">Doctor</p>
                  <p className="text-xs text-muted-foreground">Medical Officers & Visiting Doctors</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-red-600 hover:bg-red-50 transition-all"
                onClick={() => selectUserType("admin")}
              >
                <Shield className="w-8 h-8 text-red-600" />
                <div className="text-center">
                  <p className="font-semibold">Admin</p>
                  <p className="text-xs text-muted-foreground">System Administrator (Restricted)</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-orange-600 hover:bg-orange-50 transition-all"
                onClick={() => setAuthView("staff_select")}
              >
                <Building className="w-8 h-8 text-orange-600" />
                <div className="text-center">
                  <p className="font-semibold">Medical Staff</p>
                  <p className="text-xs text-muted-foreground">Lab Officer, Pharmacy & Support Staff</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </main>
        
        <Footer />
      </div>
    );
  }

  // Staff sub-role selection
  if (authView === "staff_select") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-lg relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="absolute left-4 top-4 z-10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <CardHeader className="text-center pt-12">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Building className="w-8 h-8 text-orange-600" />
              </div>
              <CardTitle className="text-2xl">Medical Staff Login</CardTitle>
              <CardDescription>
                Select your department to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-blue-600 hover:bg-blue-50 transition-all"
                onClick={() => selectUserType("lab_officer")}
              >
                <FlaskConical className="w-7 h-7 text-blue-600" />
                <div className="text-center">
                  <p className="font-semibold">Lab Medical Officer</p>
                  <p className="text-xs text-muted-foreground">Diagnostic Lab & Reports</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-purple-600 hover:bg-purple-50 transition-all"
                onClick={() => selectUserType("pharmacy")}
              >
                <Pill className="w-7 h-7 text-purple-600" />
                <div className="text-center">
                  <p className="font-semibold">Pharmacy</p>
                  <p className="text-xs text-muted-foreground">Medicine Dispensing</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-orange-600 hover:bg-orange-50 transition-all"
                onClick={() => selectUserType("medical_staff")}
              >
                <ShieldCheck className="w-7 h-7 text-orange-600" />
                <div className="text-center">
                  <p className="font-semibold">Medical Staff</p>
                  <p className="text-xs text-muted-foreground">Leave & Certificate Issuance</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </main>
        
        <Footer />
      </div>
    );
  }

  // Forgot password view
  if (authView === "forgot") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="absolute left-4 top-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your.email@nitw.ac.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
        
      </div>
    );
  }

  // Update password view (Triggered after clicking reset link from email)
  if (authView === "update_password") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Set New Password</CardTitle>
              <CardDescription>
                Enter your new strong password below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="update-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="update-password"
                      type="password"
                      placeholder="Min 8 chars, uppercase, number, symbol"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <PasswordStrength password={password} />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
        
        <Footer />
      </div>
    );
  }

  // Sign in / Sign up view
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="absolute left-4 top-4 z-10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <CardHeader className="text-center pt-12">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              userType === "admin" ? "bg-red-100"
              : userType === "doctor" ? "bg-secondary/10" 
              : userType === "mentor" ? "bg-green-100" 
              : userType === "pharmacy" ? "bg-purple-100"
              : userType === "lab_officer" ? "bg-blue-100"
              : userType === "medical_staff" ? "bg-orange-100"
              : "bg-primary/10"
            }`}>
              {userType === "admin" ? (
                <Shield className="w-8 h-8 text-red-600" />
              ) : userType === "doctor" ? (
                <Stethoscope className="w-8 h-8 text-secondary" />
              ) : userType === "mentor" ? (
                <Users className="w-8 h-8 text-green-600" />
              ) : userType === "pharmacy" ? (
                <Pill className="w-8 h-8 text-purple-600" />
              ) : userType === "lab_officer" ? (
                <FlaskConical className="w-8 h-8 text-blue-600" />
              ) : userType === "medical_staff" ? (
                <ShieldCheck className="w-8 h-8 text-orange-600" />
              ) : (
                <GraduationCap className="w-8 h-8 text-primary" />
              )}
            </div>
             <CardTitle className="text-2xl">
              {userType === "admin" ? "Admin Portal"
              : userType === "doctor" ? "Doctor Portal" 
              : userType === "mentor" ? "Mentor Portal" 
              : userType === "pharmacy" ? "Pharmacy Portal"
              : userType === "lab_officer" ? "Lab Officer Portal"
              : userType === "medical_staff" ? "Medical Staff Portal"
              : "Student Portal"}
            </CardTitle>
            <CardDescription>
              {userType === "admin"
                ? "Restricted access â€” Only authorized administrator"
                : userType === "doctor" 
                ? "Sign in to access medical dashboard and patient records"
                : userType === "mentor"
                ? "Sign in to view mentee health information and reports"
                : userType === "pharmacy"
                ? "Sign in to manage medicine dispensing"
                : userType === "lab_officer"
                ? "Sign in to manage lab tests and reports"
                : userType === "medical_staff"
                ? "Sign in to issue medical leave and certificates"
                : "Sign in to book appointments and access health services"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Disclaimer for restricted roles */}
            {userType && signinOnlyRoles.includes(userType) && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Signup is not available</strong> for this role. Only pre-authorized accounts can sign in.
                  {userType === "admin" && " Admin access is restricted to a single authorized email."}
                </p>
              </div>
            )}

            {userType && signinOnlyRoles.includes(userType) ? (
              /* Sign-in only â€” no tabs */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={userType === "admin" ? "admin@email.com" : userType === "doctor" ? "doctor@nitw.ac.in" : "staff@nitw.ac.in"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <Button type="button" variant="link" className="px-0 h-auto text-xs text-muted-foreground hover:text-primary" onClick={() => setAuthView("forgot")}>
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signin-password" type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className={`w-full ${userType === "admin" ? "bg-red-600 hover:bg-red-700" : userType === "doctor" ? "bg-secondary hover:bg-secondary/90" : ""}`} disabled={isLoading}>
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            ) : (
            <Tabs defaultValue="signin" className="w-full" onValueChange={(v) => setAuthView(v as AuthView)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin" className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder={userType === "doctor" ? "doctor@nitw.ac.in" : userType === "mentor" ? "mentor@nitw.ac.in" : "student@student.nitw.ac.in"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                        onClick={() => setAuthView("forgot")}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className={`w-full ${userType === "doctor" ? "bg-secondary hover:bg-secondary/90" : userType === "mentor" ? "bg-green-600 hover:bg-green-700" : ""}`}
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder={userType === "doctor" ? "Dr. Aman Kumar" : userType === "mentor" ? "Prof. Aman Kumar" : "Aman Kumar"}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder={userType === "doctor" ? "doctor@nitw.ac.in" : userType === "mentor" ? "mentor@nitw.ac.in" : "student@student.nitw.ac.in"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Min 8 chars, uppercase, number, symbol"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        autoComplete="new-password"
                      />
                    </div>
                    <PasswordStrength password={password} />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  {/* Student-specific registration fields */}
                  {userType === "student" && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Academic Details
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="rollNumber">Roll Number *</Label>
                            <Input
                              id="rollNumber"
                              placeholder="e.g., 21CS1234"
                              value={studentData.rollNumber}
                              onChange={(e) => setStudentData(prev => ({ ...prev, rollNumber: e.target.value }))}
                            />
                            {errors.rollNumber && (
                              <p className="text-xs text-destructive">{errors.rollNumber}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone (Optional)</Label>
                            <Input
                              id="phone"
                              placeholder="10-digit mobile"
                              value={studentData.phone}
                              onChange={(e) => setStudentData(prev => ({ ...prev, phone: e.target.value }))}
                            />
                            {errors.phone && (
                              <p className="text-xs text-destructive">{errors.phone}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="space-y-2">
                            <Label>Programme *</Label>
                            <Select 
                              value={studentData.programme} 
                              onValueChange={(value) => setStudentData(prev => ({ ...prev, programme: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select programme" />
                              </SelectTrigger>
                              <SelectContent>
                                {PROGRAMMES.map((prog) => (
                                  <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.programme && (
                              <p className="text-xs text-destructive">{errors.programme}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Year of Study *</Label>
                            <Select 
                              value={studentData.yearOfStudy} 
                              onValueChange={(value) => setStudentData(prev => ({ ...prev, yearOfStudy: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              <SelectContent>
                                {YEARS_OF_STUDY.map((year) => (
                                  <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.yearOfStudy && (
                              <p className="text-xs text-destructive">{errors.yearOfStudy}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mt-3">
                          <Label>Branch/Department *</Label>
                          <Select 
                            value={studentData.branch} 
                            onValueChange={(value) => setStudentData(prev => ({ ...prev, branch: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.branch && (
                            <p className="text-xs text-destructive">{errors.branch}</p>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Mentor Details
                        </h4>
                        
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="mentorName">Mentor Name *</Label>
                            <Input
                              id="mentorName"
                              placeholder="e.g., Prof. Rajesh Kumar"
                              value={studentData.mentorName}
                              onChange={(e) => setStudentData(prev => ({ ...prev, mentorName: e.target.value }))}
                            />
                            {errors.mentorName && (
                              <p className="text-xs text-destructive">{errors.mentorName}</p>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="mentorContact">Mentor Contact *</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="mentorContact"
                                  placeholder="10-digit mobile"
                                  value={studentData.mentorContact}
                                  onChange={(e) => setStudentData(prev => ({ ...prev, mentorContact: e.target.value }))}
                                  className="pl-10"
                                />
                              </div>
                              {errors.mentorContact && (
                                <p className="text-xs text-destructive">{errors.mentorContact}</p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="mentorEmail">Mentor Email</Label>
                              <Input
                                id="mentorEmail"
                                type="email"
                                placeholder="mentor@nitw.ac.in"
                                value={studentData.mentorEmail}
                                onChange={(e) => setStudentData(prev => ({ ...prev, mentorEmail: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <Button 
                    type="submit" 
                    className={`w-full ${userType === "doctor" ? "bg-secondary hover:bg-secondary/90" : userType === "mentor" ? "bg-green-600 hover:bg-green-700" : ""}`}
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>

                  {/* Info note for doctor signup */}
                  {userType === "doctor" && (
                    <div className="text-center pt-2 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        After creating your account, you'll complete a 3-step registration process covering{" "}
                        <span className="font-medium text-foreground">Personal Info</span>,{" "}
                        <span className="font-medium text-foreground">Professional Details</span>, and{" "}
                        <span className="font-medium text-foreground">Access Configuration</span>.
                      </p>
                    </div>
                  )}
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}
