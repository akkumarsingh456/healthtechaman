import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { triggerStudentBackup } from "@/lib/backup/triggerStudentBackup";
import { RegistrationProgress } from "@/components/registration/RegistrationProgress";
import { PersonalInfoStep } from "@/components/registration/PersonalInfoStep";
import { AcademicInfoStep } from "@/components/registration/AcademicInfoStep";
import { MedicalInfoStep } from "@/components/registration/MedicalInfoStep";
import { DeclarationsStep } from "@/components/registration/DeclarationsStep";
import {
  fullRegistrationSchema,
  FullRegistration,
  personalInfoSchema,
  academicInfoSchema,
  medicalInfoSchema,
  declarationsSchema,
} from "@/lib/validations/student-registration";

const STEPS = [
  { title: "Personal", description: "Basic info" },
  { title: "Academic", description: "Study details" },
  { title: "Medical", description: "Health info" },
  { title: "Declarations", description: "Consent" },
];

const stepSchemas = [personalInfoSchema, academicInfoSchema, medicalInfoSchema, declarationsSchema];

export default function StudentRegistration() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const navigate = useNavigate();

  const form = useForm<FullRegistration>({
    resolver: zodResolver(fullRegistrationSchema),
    defaultValues: {
      aadharNumber: "",
      fullName: "",
      rollNumber: "",
      officialEmail: "",
      personalContact: "",
      emergencyContact: "",
      emergencyRelationship: "",
      fatherName: "",
      fatherContact: "",
      motherName: "",
      motherContact: "",
      mentorName: "",
      mentorContact: "",
      mentorEmail: "",
      department: "",
      yearOfStudy: "",
      currentSemester: "",
      programme: "",
      bloodGroup: "",
      hasPreviousHealthIssues: undefined,
      previousHealthDetails: "",
      currentMedications: "",
      knownAllergies: "",
      covidVaccinationStatus: "",
      hasDisability: undefined,
      disabilityDetails: "",
      accuracyConfirmation: false,
      codeOfConduct: false,
      photoVideoConsent: false,
      medicalAuthorization: false,
    },
    mode: "onChange",
  });

  // Load existing data for edit mode
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingExisting(false); return; }

        const { data: student } = await supabase
          .from('students')
          .select('id, full_name, roll_number, email, phone, program, branch, batch, year_of_study, mentor_name, mentor_contact, mentor_email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!student) { setLoadingExisting(false); return; }

        setIsEditMode(true);

        // Fetch student_profiles
        const { data: profile } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('student_id', student.id)
          .maybeSingle();

        // Pre-fill form with existing data
        form.reset({
          aadharNumber: profile?.aadhar_number || "",
          fullName: student.full_name || "",
          rollNumber: student.roll_number || "",
          officialEmail: student.email || "",
          personalContact: student.phone || "",
          emergencyContact: profile?.emergency_contact || "",
          emergencyRelationship: profile?.emergency_relationship || "",
          fatherName: profile?.father_name || "",
          fatherContact: profile?.father_contact || "",
          motherName: profile?.mother_name || "",
          motherContact: profile?.mother_contact || "",
          mentorName: student.mentor_name || "",
          mentorContact: student.mentor_contact || "",
          mentorEmail: student.mentor_email || "",
          department: student.branch || "",
          yearOfStudy: student.year_of_study || student.batch || "",
          currentSemester: "",
          programme: student.program || "",
          bloodGroup: profile?.blood_group || "",
          hasPreviousHealthIssues: profile?.has_previous_health_issues ? "yes" : profile?.has_previous_health_issues === false ? "no" : undefined,
          previousHealthDetails: profile?.previous_health_details || "",
          currentMedications: profile?.current_medications || "",
          knownAllergies: profile?.known_allergies || "",
          covidVaccinationStatus: profile?.covid_vaccination_status || "",
          hasDisability: profile?.has_disability ? "yes" : profile?.has_disability === false ? "no" : undefined,
          disabilityDetails: profile?.disability_details || "",
          accuracyConfirmation: profile?.accuracy_confirmation || false,
          codeOfConduct: profile?.code_of_conduct || false,
          photoVideoConsent: profile?.photo_video_consent || false,
          medicalAuthorization: profile?.medical_authorization || false,
        });
      } catch (err) {
        console.error('Error loading existing profile:', err);
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExistingData();
  }, [form]);

  const validateCurrentStep = async () => {
    const currentSchema = stepSchemas[currentStep];
    const values = form.getValues();
    
    try {
      await currentSchema.parseAsync(values);
      return true;
    } catch {
      // Trigger validation to show errors
      const fields = Object.keys(currentSchema.shape) as (keyof FullRegistration)[];
      fields.forEach((field) => form.trigger(field));
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (data: FullRegistration) => {
    setIsSubmitting(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in first to complete registration.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        navigate("/auth");
        return;
      }

      // Check if student profile already exists
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let studentId: string;

      if (existingStudent) {
        studentId = existingStudent.id;
        // Update existing profile
        const { error: updateError } = await supabase
          .from('students')
          .update({
            full_name: data.fullName,
            roll_number: data.rollNumber,
            email: data.officialEmail,
            phone: data.personalContact,
            program: data.programme,
            branch: data.department,
            batch: data.yearOfStudy,
            year_of_study: data.yearOfStudy,
            mentor_name: data.mentorName,
            mentor_contact: data.mentorContact,
            mentor_email: data.mentorEmail,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        // Insert new profile
        const { data: newStudent, error: insertError } = await supabase
          .from('students')
          .insert({
            user_id: user.id,
            full_name: data.fullName,
            roll_number: data.rollNumber,
            email: data.officialEmail,
            phone: data.personalContact,
            program: data.programme,
            branch: data.department,
            batch: data.yearOfStudy,
            year_of_study: data.yearOfStudy,
            mentor_name: data.mentorName,
            mentor_contact: data.mentorContact,
            mentor_email: data.mentorEmail,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        studentId = newStudent.id;

        // Add student role if not exists
        try {
          await supabase.from('user_roles').insert({
            user_id: user.id,
            role: 'student'
          });
        } catch {
          // Role may already exist, ignore
        }
      }

      // Now save medical info to student_profiles.
      // 1) Fetch existing row so we can MERGE — never wipe previously-saved
      //    fields just because the user re-submitted without re-entering them.
      const { data: existingProfile } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      // 2) Build a partial payload that only includes fields the user
      //    actually provided. Empty strings and `undefined` are treated as
      //    "no change" so the saved value survives.
      const setIfPresent = <T,>(value: T | undefined | null): T | undefined => {
        if (value === undefined || value === null) return undefined;
        if (typeof value === 'string' && value.trim() === '') return undefined;
        return value;
      };
      const partial: Record<string, unknown> = {
        blood_group: setIfPresent(data.bloodGroup),
        previous_health_details: setIfPresent(data.previousHealthDetails),
        current_medications: setIfPresent(data.currentMedications),
        known_allergies: setIfPresent(data.knownAllergies),
        covid_vaccination_status: setIfPresent(data.covidVaccinationStatus),
        disability_details: setIfPresent(data.disabilityDetails),
        emergency_contact: setIfPresent(data.emergencyContact),
        emergency_relationship: setIfPresent(data.emergencyRelationship),
        aadhar_number: setIfPresent(data.aadharNumber),
        father_name: setIfPresent(data.fatherName),
        father_contact: setIfPresent(data.fatherContact),
        mother_name: setIfPresent(data.motherName),
        mother_contact: setIfPresent(data.motherContact),
      };
      if (data.hasPreviousHealthIssues === 'yes' || data.hasPreviousHealthIssues === 'no') {
        partial.has_previous_health_issues = data.hasPreviousHealthIssues === 'yes';
      }
      if (data.hasDisability === 'yes' || data.hasDisability === 'no') {
        partial.has_disability = data.hasDisability === 'yes';
      }
      // Booleans: never flip an already-true consent back to false on resubmit.
      const keepTrue = (next?: boolean, prev?: boolean | null) =>
        next === true ? true : prev ?? false;
      partial.accuracy_confirmation = keepTrue(data.accuracyConfirmation, existingProfile?.accuracy_confirmation);
      partial.code_of_conduct = keepTrue(data.codeOfConduct, existingProfile?.code_of_conduct);
      partial.photo_video_consent = keepTrue(data.photoVideoConsent, existingProfile?.photo_video_consent);
      partial.medical_authorization = keepTrue(data.medicalAuthorization, existingProfile?.medical_authorization);

      // Drop undefined keys so they don't reach Postgres as nulls
      Object.keys(partial).forEach((k) => partial[k] === undefined && delete partial[k]);

      const upsertPayload = {
        student_id: studentId,
        ...(existingProfile ?? {}),
        ...partial,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      const { error: upsertError } = await supabase
        .from('student_profiles')
        .upsert(upsertPayload, { onConflict: 'student_id' });

      if (upsertError) throw upsertError;

      // Fire-and-forget Google Drive backup of the full student record
      triggerStudentBackup(studentId);
      
      toast({
        title: "Registration Successful!",
        description: "Your health portal profile has been saved.",
      });
      
      navigate("/health-dashboard");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PersonalInfoStep form={form} />;
      case 1:
        return <AcademicInfoStep form={form} />;
      case 2:
        return <MedicalInfoStep form={form} />;
      case 3:
        return <DeclarationsStep form={form} />;
      default:
        return null;
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            {/* Progress Indicator */}
            <RegistrationProgress currentStep={currentStep} steps={STEPS} />

            {/* Form Content */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8">
              {renderStep()}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNext} className="gap-2">
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2 bg-secondary hover:bg-secondary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {isEditMode ? "Save Changes" : "Complete Registration"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help? Contact the Health Centre at{" "}
          <a href="tel:+918702462087" className="text-primary hover:underline">
            +91 870 246 2087
          </a>
        </p>
      </main>
    </div>
  );
}
