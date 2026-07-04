import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Building2, Calendar, CheckCircle2, ExternalLink, GraduationCap, Loader2, Mail, MapPin, Navigation, Phone, Search, Send, Stethoscope, User, Clock, FileText, AlertTriangle, Users } from "lucide-react";
import { z } from "zod";
import PrintableHospitalCard from "./PrintableHospitalCard";
import PrintableReferralLetter from "./PrintableReferralLetter";
import { notifyStudentOfReferral, getStudentUserId } from "@/lib/notifications/medical-leave-notifications";
import HospitalRecommendation from "./HospitalRecommendation";

// Hospital contact information type
interface HospitalInfo {
  name: string;
  location: string;
  entitlement?: string;
  phone?: string;
  emergency?: string;
  address?: string;
  directions?: string;
  mapUrl?: string;
  specialties?: string[];
}

// Student emergency contacts type
interface StudentEmergencyContacts {
  emergencyContact?: string;
  emergencyRelationship?: string;
  fatherName?: string;
  fatherContact?: string;
  motherName?: string;
  motherContact?: string;
  mentorName?: string;
  mentorContact?: string;
  personalPhone?: string;
  aadharNumber?: string;
}

const EMPANELLED_HOSPITALS: Record<string, HospitalInfo[]> = {
  superSpecialityWarangal: [
    { 
      name: "Rohini Super Specialty Hospital", 
      location: "Hanamkonda",
      phone: "0870-2461111",
      emergency: "0870-2461122",
      address: "6-3-249, Rohini Circle, Hanamkonda, Warangal - 506001",
      directions: "Near Hanamkonda Bus Stand, opposite Rohini Circle. 8 km from NIT Warangal main gate.",
      mapUrl: "https://maps.google.com/?q=Rohini+Super+Specialty+Hospital+Hanamkonda",
      specialties: ["Cardiology", "Neurology", "Nephrology", "Oncology"]
    },
    { 
      name: "Samraksha Super Specialty Hospital", 
      location: "Warangal",
      phone: "0870-2577777",
      emergency: "0870-2577700",
      address: "Warangal Main Road, Near MGM Hospital, Warangal - 506002",
      directions: "On Warangal Main Road, near MGM Government Hospital. 10 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Samraksha+Super+Specialty+Hospital+Warangal",
      specialties: ["Cardiac Surgery", "Orthopedics", "Gastroenterology", "Urology"]
    },
  ],
  generalWarangal: [
    { 
      name: "Jaya Hospital", 
      location: "Hanamkonda",
      phone: "0870-2542899",
      emergency: "0870-2542800",
      address: "JPN Road, Hanamkonda, Warangal - 506001",
      directions: "On JPN Road, near Thousand Pillar Temple. 7 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Jaya+Hospital+Hanamkonda",
      specialties: ["General Medicine", "Surgery", "Pediatrics", "Gynecology"]
    },
    { 
      name: "Guardian Multi-Speciality Hospital", 
      location: "Warangal",
      phone: "0870-2576666",
      emergency: "0870-2576600",
      address: "SVN Road, Warangal Fort, Warangal - 506002",
      directions: "Near Warangal Fort, on SVN Road. 9 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Guardian+Multi+Speciality+Hospital+Warangal",
      specialties: ["Multi-Specialty", "Critical Care", "Dialysis"]
    },
    { 
      name: "Max Care Hospitals", 
      location: "Warangal",
      phone: "0870-2555555",
      address: "Nakkalagutta, Hanamkonda, Warangal - 506001",
      directions: "At Nakkalagutta Junction, Hanamkonda. 6 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Max+Care+Hospitals+Warangal"
    },
    { 
      name: "Pramoda Hospital", 
      location: "Hanamkonda",
      phone: "0870-2500222",
      address: "Kothawada Road, Hanamkonda, Warangal - 506001",
      directions: "On Kothawada Road, near RTC Bus Stand. 8 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Pramoda+Hospital+Hanamkonda"
    },
    { 
      name: "Sharat Laser Eye Hospital", 
      location: "Hanamkonda",
      phone: "0870-2574433",
      address: "Subedari, Hanamkonda, Warangal - 506001",
      directions: "At Subedari, near Subedari Circle. 7 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Sharat+Eye+Hospital+Hanamkonda",
      specialties: ["Ophthalmology", "LASIK", "Cataract Surgery"]
    },
    { 
      name: "Sri Laxmi Narasimha Hospital", 
      location: "Hanamkonda",
      phone: "0870-2543322",
      address: "Mulugu Road, Hanamkonda, Warangal - 506001",
      directions: "On Mulugu Road, near Balasamudram. 6 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Sri+Laxmi+Narasimha+Hospital+Hanamkonda"
    },
  ],
  superSpecialityHyderabad: [
    { 
      name: "Basavatarakam Indo American Cancer Hospital", 
      location: "Hyderabad",
      phone: "040-23551235",
      emergency: "040-23551236",
      address: "Road No. 10, Banjara Hills, Hyderabad - 500034",
      directions: "In Banjara Hills, Road No. 10. Approx. 150 km from NIT Warangal (2.5 hrs by road).",
      mapUrl: "https://maps.google.com/?q=Basavatarakam+Indo+American+Cancer+Hospital+Hyderabad",
      specialties: ["Oncology", "Cancer Treatment", "Radiation Therapy", "Chemotherapy"]
    },
    { 
      name: "Krishna Institute of Medical Sciences Ltd. (KIMS)", 
      location: "Hyderabad",
      phone: "040-44885000",
      emergency: "040-44885100",
      address: "1-8-31/1, Minister Road, Secunderabad - 500003",
      directions: "At Minister Road, Secunderabad. 145 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=KIMS+Hospitals+Secunderabad",
      specialties: ["Cardiac Sciences", "Neuro Sciences", "Liver Transplant", "Orthopedics"]
    },
    { 
      name: "Sunshine Hospitals", 
      location: "Hyderabad",
      phone: "040-44556677",
      emergency: "040-44556600",
      address: "PG Road, Secunderabad - 500003",
      directions: "On PG Road, Secunderabad. 145 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Sunshine+Hospitals+Hyderabad",
      specialties: ["Orthopedics", "Joint Replacement", "Spine Surgery", "Sports Medicine"]
    },
    { 
      name: "CARE Super Speciality Hospitals", 
      location: "Hyderabad",
      phone: "040-30418888",
      emergency: "040-30418800",
      address: "Road No. 1, Banjara Hills, Hyderabad - 500034",
      directions: "In Banjara Hills, Road No. 1. Approx. 150 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=CARE+Hospitals+Banjara+Hills",
      specialties: ["Cardiac Sciences", "Neuro Sciences", "Oncology", "Gastroenterology"]
    },
  ],
  empanelledStudents: [
    { 
      name: "M/s. Medicover Hospitals", 
      location: "Hyderabad & Warangal", 
      entitlement: "Employees & Students",
      phone: "040-68334455",
      emergency: "040-68334455",
      address: "Nakkalagutta, Hanamkonda, Warangal & Hi-Tech City, Hyderabad",
      directions: "Warangal branch at Nakkalagutta. 6 km from NIT Warangal. Email: info@medicoverhospitals.in | 24/7 Helpline: 040-68334455",
      mapUrl: "https://maps.google.com/?q=Medicover+Hospitals+Warangal",
      specialties: ["Multi-Specialty", "Emergency Care", "Diagnostics"]
    },
    { 
      name: "M/s. Vijaya Diagnostic Centre Ltd.", 
      location: "Hyderabad & Warangal", 
      entitlement: "Employees & Students",
      phone: "0870-2440000",
      address: "Hanamkonda, Warangal & Multiple locations in Hyderabad",
      directions: "Multiple centers in Warangal city. Nearest at Hanamkonda center.",
      mapUrl: "https://maps.google.com/?q=Vijaya+Diagnostic+Centre+Warangal",
      specialties: ["Diagnostics", "Lab Tests", "Radiology", "Health Checkups"]
    },
    { 
      name: "M/s. Rohini Medicare Pvt. Ltd.", 
      location: "Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2461111",
      emergency: "0870-2461100",
      address: "Rohini Circle, Hanamkonda, Warangal - 506001",
      directions: "At Rohini Circle, Hanamkonda. 8 km from NIT Warangal main gate.",
      mapUrl: "https://maps.google.com/?q=Rohini+Medicare+Hanamkonda"
    },
    { 
      name: "M/s. Ajara Hospitals", 
      location: "Warangal", 
      entitlement: "Employees & Students",
      phone: "0870-2500123",
      address: "Main Road, Warangal - 506002",
      directions: "On Warangal Main Road. 10 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Ajara+Hospitals+Warangal"
    },
    { 
      name: "M/s. Laxmi Narasimha Hospital", 
      location: "Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2543322",
      address: "Mulugu Road, Hanamkonda, Warangal - 506001",
      directions: "On Mulugu Road, near Balasamudram. 6 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Laxmi+Narasimha+Hospital+Hanamkonda"
    },
    { 
      name: "M/s. Samraksha Super Specialty Hospital", 
      location: "Warangal", 
      entitlement: "Employees & Students",
      phone: "0870-2577777",
      emergency: "0870-2577700",
      address: "Warangal Main Road, Near MGM Hospital, Warangal - 506002",
      directions: "On Warangal Main Road. 10 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Samraksha+Hospital+Warangal"
    },
    { 
      name: "M/s. Dr. Sharat Maxivision Eye Hospitals", 
      location: "Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2574433",
      address: "Subedari, Hanamkonda, Warangal - 506001",
      directions: "At Subedari Circle. 7 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Sharat+Maxivision+Hanamkonda",
      specialties: ["Ophthalmology", "LASIK", "Retina Care"]
    },
    { 
      name: "M/s. Ekashilaa Hospitals", 
      location: "Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2571234",
      address: "JPN Road, Hanamkonda, Warangal - 506001",
      directions: "On JPN Road, Hanamkonda. 7 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Ekashilaa+Hospitals+Hanamkonda"
    },
    { 
      name: "M/s. Jaya Hospitals", 
      location: "Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2542899",
      emergency: "0870-2542800",
      address: "JPN Road, Hanamkonda, Warangal - 506001",
      directions: "On JPN Road, near Thousand Pillar Temple. 7 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Jaya+Hospitals+Hanamkonda"
    },
    { 
      name: "M/s. S Vision Hospital", 
      location: "Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2575000",
      address: "Hanamkonda, Warangal - 506001",
      directions: "In Hanamkonda city. 7 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=S+Vision+Hospital+Hanamkonda",
      specialties: ["Ophthalmology", "Eye Care"]
    },
    { 
      name: "M/s. Dr. Vasavi's Hospital", 
      location: "Naimnagar, Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2546789",
      address: "Naimnagar, Hanamkonda, Warangal - 506001",
      directions: "At Naimnagar, Hanamkonda. 8 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Dr+Vasavis+Hospital+Hanamkonda"
    },
    { 
      name: "M/s. Pebbles Kids Hospital", 
      location: "Main Road, Balasamudram, Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2549876",
      address: "Main Road, Balasamudram, Hanamkonda - 506001",
      directions: "At Balasamudram, Main Road. 5 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Pebbles+Kids+Hospital+Hanamkonda",
      specialties: ["Pediatrics", "Neonatal Care", "Child Healthcare"]
    },
    { 
      name: "M/s. Sri Chakra Super Speciality Hospital", 
      location: "Balasamudram, Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2548765",
      address: "Opp. Hayagreevachary Ground, Balasamudram, Hanamkonda - 506001",
      directions: "Opposite Hayagreevachary Ground, Balasamudram. 5 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Sri+Chakra+Hospital+Hanamkonda"
    },
    { 
      name: "M/s. Sri Valli Good Life Hospital", 
      location: "Balasamudram, Hanamkonda", 
      entitlement: "Employees & Students",
      phone: "0870-2547654",
      address: "Beside New Bus Stand Road, Balasamudram, Hanamkonda - 506001",
      directions: "Near New Bus Stand, Balasamudram. 5 km from NIT Warangal.",
      mapUrl: "https://maps.google.com/?q=Sri+Valli+Hospital+Hanamkonda"
    },
    { 
      name: "M/s. K&H Dental Hospitals", 
      location: "Hanamkonda & Warangal", 
      entitlement: "Employees & Students",
      phone: "0870-2574321",
      address: "Near Hanuman Temple Road, Hanamkonda & JPN Road, Warangal",
      directions: "Two branches: Hanamkonda (7 km) and Warangal (10 km) from NIT.",
      mapUrl: "https://maps.google.com/?q=KH+Dental+Hospitals+Hanamkonda",
      specialties: ["Dental Care", "Orthodontics", "Oral Surgery"]
    },
  ],
};

// Get hospital details by name
const getHospitalByName = (name: string): HospitalInfo | null => {
  for (const category of Object.values(EMPANELLED_HOSPITALS)) {
    const found = category.find(h => h.name === name);
    if (found) return found;
  }
  return null;
};

// Hospital Details Card Component
const HospitalDetailsCard = ({ hospital, studentName, studentRollNumber, studentProgram, studentBranch, emergencyContacts, showReferralLetter, referralData }: { 
  hospital: HospitalInfo; 
  studentName?: string;
  studentRollNumber?: string;
  studentProgram?: string;
  studentBranch?: string | null;
  emergencyContacts?: StudentEmergencyContacts;
  showReferralLetter?: boolean;
  referralData?: {
    program?: string;
    branch?: string | null;
    illnessDescription: string;
    leaveDays: number;
    healthPriority: string;
    doctorNotes?: string;
    aadharNumber?: string;
    fatherName?: string;
  };
}) => (
  <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">{hospital.name}</h4>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PrintableHospitalCard 
            hospital={hospital} 
            studentName={studentName}
            studentRollNumber={studentRollNumber}
            studentProgram={studentProgram}
            studentBranch={studentBranch || undefined}
            emergencyContacts={emergencyContacts}
            illnessDescription={referralData?.illnessDescription}
            doctorNotes={referralData?.doctorNotes}
          />
          {showReferralLetter && referralData && studentName && studentRollNumber && (
            <PrintableReferralLetter
              data={{
                studentName,
                rollNumber: studentRollNumber,
                program: referralData.program,
                branch: referralData.branch,
                aadharNumber: referralData.aadharNumber || emergencyContacts?.aadharNumber,
                fatherName: referralData.fatherName || emergencyContacts?.fatherName,
                hospital,
                illnessDescription: referralData.illnessDescription,
                leaveDays: referralData.leaveDays,
                healthPriority: referralData.healthPriority,
                doctorNotes: referralData.doctorNotes,
              }}
            />
          )}
        </div>
      </div>
      
      {hospital.address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">{hospital.address}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {hospital.phone && (
          <a 
            href={`tel:${hospital.phone}`} 
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {hospital.phone}
          </a>
        )}
        {hospital.emergency && (
          <a 
            href={`tel:${hospital.emergency}`} 
            className="inline-flex items-center gap-1.5 text-sm text-destructive font-medium hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            Emergency: {hospital.emergency}
          </a>
        )}
      </div>

      {hospital.directions && (
        <div className="flex items-start gap-2 text-sm bg-background/60 rounded-md p-2">
          <Navigation className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span className="text-muted-foreground">{hospital.directions}</span>
        </div>
      )}

      {hospital.specialties && hospital.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {hospital.specialties.map((specialty, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {specialty}
            </Badge>
          ))}
        </div>
      )}

      {hospital.mapUrl && (
        <a
          href={hospital.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Google Maps
        </a>
      )}
    </div>
  </div>
);


interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  program: string;
  branch: string | null;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  year_of_study?: string | null;
  batch?: string | null;
  mentor_name?: string | null;
  mentor_contact?: string | null;
  mentor_email?: string | null;
  emergencyContacts?: StudentEmergencyContacts;
}

// Custom schema for this form
const referralFormSchema = z.object({
  rollNumber: z.string().min(2, "Roll number is required"),
  email: z.string().email("Valid email required").regex(
    /@(nitw\.ac\.in|student\.nitw\.ac\.in|student\.nit\.ac\.in)$/,
    "Must be a valid NIT Warangal email"
  ),
  referralHospital: z.string().min(2, "Hospital name is required"),
  expectedDuration: z.string().min(1, "Expected duration is required"),
  illnessDescription: z.string().min(3, "Please describe the illness/condition"),
  leaveDays: z.coerce.number().min(0, "Enter 0 or more days").max(90, "Maximum 90 days"),
  healthPriority: z.enum(["low", "medium", "high"]),
  doctorNotes: z.string().optional(),
  // Academic Coordination fields
  mentorEmail: z.string().email("Valid mentor email required").regex(
    /@nitw\.ac\.in$/,
    "Must be a valid NIT Warangal faculty email"
  ).optional().or(z.literal("")),
  hodEmail: z.string().email("Valid HOD email required").regex(
    /@nitw\.ac\.in$/,
    "Must be a valid NIT Warangal faculty email"
  ).optional().or(z.literal("")),
  deanEmail: z.string().email("Valid Dean email required").regex(
    /@nitw\.ac\.in$/,
    "Must be a valid NIT Warangal faculty email"
  ).optional().or(z.literal("")),
});

type ReferralFormData = z.infer<typeof referralFormSchema>;

interface ApprovedLeaveInfo {
  id: string;
  doctorName: string;
  doctorNotes: string | null;
  restDays: number | null;
  referralHospital: string;
  healthPriority: string | null;
  expectedDuration: string;
  createdAt: string;
  status: string;
  referralType: string[];
  testDetails: string | null;
}

const DoctorReferralForm = () => {
  const navigate = useNavigate();
  const { doctorId, isDoctor } = useUserRole();
  const queryClient = useQueryClient();
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [approvedLeave, setApprovedLeave] = useState<ApprovedLeaveInfo | null>(null);
  const [leaveCheckDone, setLeaveCheckDone] = useState(false);
  const [referredForTreatment, setReferredForTreatment] = useState(false);
  const [referredForTest, setReferredForTest] = useState(false);
  const [isFetchingEmail, setIsFetchingEmail] = useState(false);
  const [emailAutoFilled, setEmailAutoFilled] = useState(false);

  // Quick Lookup state
  const [lookupRoll, setLookupRoll] = useState("");
  const [lookupStudent, setLookupStudent] = useState<Student | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const quickLookupStudent = async () => {
    if (!lookupRoll.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupStudent(null);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, roll_number, program, branch, email, phone, photo_url, year_of_study, batch, mentor_name, mentor_contact, mentor_email")
        .ilike("roll_number", lookupRoll.trim())
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setLookupError("No student found with this roll number");
        return;
      }
      // Fetch profile data
      const { data: profileData } = await supabase
        .from("student_profiles")
        .select("blood_group, known_allergies, current_medications, emergency_contact, emergency_relationship, father_name, father_contact, mother_name, mother_contact, aadhar_number")
        .eq("student_id", data.id)
        .maybeSingle();

      setLookupStudent({
        ...data,
        emergencyContacts: {
          emergencyContact: profileData?.emergency_contact || undefined,
          emergencyRelationship: profileData?.emergency_relationship || undefined,
          fatherName: profileData?.father_name || undefined,
          fatherContact: profileData?.father_contact || undefined,
          motherName: profileData?.mother_name || undefined,
          motherContact: profileData?.mother_contact || undefined,
          mentorName: data.mentor_name || undefined,
          mentorContact: data.mentor_contact || undefined,
          personalPhone: data.phone || undefined,
          aadharNumber: profileData?.aadhar_number || undefined,
        },
        // store extra profile info as ad-hoc for display
        _bloodGroup: profileData?.blood_group,
        _allergies: profileData?.known_allergies,
        _medications: profileData?.current_medications,
      } as any);
    } catch {
      setLookupError("Failed to fetch student details");
    } finally {
      setLookupLoading(false);
    }
  };

  const form = useForm<ReferralFormData>({
    resolver: zodResolver(referralFormSchema),
    defaultValues: {
      rollNumber: "",
      email: "",
      referralHospital: "",
      expectedDuration: "",
      illnessDescription: "",
      leaveDays: 3,
      healthPriority: "medium",
      doctorNotes: "",
      mentorEmail: "",
      hodEmail: "",
      deanEmail: "deansg@nitw.ac.in", // Default Dean of Student Welfare email
    },
  });

  // Get selected hospital details
  const selectedHospitalName = form.watch("referralHospital");
  const selectedHospital = selectedHospitalName && selectedHospitalName !== "other" 
    ? getHospitalByName(selectedHospitalName) 
    : null;

  // Fetch email from roll number
  const fetchEmailFromRollNumber = async (rollNumber: string) => {
    if (!rollNumber || rollNumber.trim().length < 2) return;
    setIsFetchingEmail(true);
    setEmailAutoFilled(false);
    try {
      const { data } = await supabase
        .from("students")
        .select("email")
        .ilike("roll_number", rollNumber.trim())
        .maybeSingle();
      
      if (data?.email) {
        form.setValue("email", data.email);
        setEmailAutoFilled(true);
      }
    } catch {
      // silently fail - user can still type email
    } finally {
      setIsFetchingEmail(false);
    }
  };

  const searchStudent = async () => {
    const rollNumber = form.getValues("rollNumber").trim();
    const email = form.getValues("email").trim().toLowerCase();

    if (!rollNumber || !email) {
      setSearchError("Please enter both roll number and email");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
      setFoundStudent(null);
      setApprovedLeave(null);
      setLeaveCheckDone(false);
      setReferredForTreatment(false);
      setReferredForTest(false);

    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, roll_number, program, branch, email, phone, photo_url, year_of_study, batch, mentor_name, mentor_contact, mentor_email")
        .ilike("roll_number", rollNumber)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setSearchError("No student found with this roll number");
        return;
      }

      // Verify email matches
      if (data.email && data.email.toLowerCase() !== email) {
        setSearchError("Email does not match the student's registered email");
        return;
      }

      // Fetch emergency contacts from student_profiles
      const { data: profileData } = await supabase
        .from("student_profiles")
        .select("emergency_contact, emergency_relationship, father_name, father_contact, mother_name, mother_contact, aadhar_number")
        .eq("student_id", data.id)
        .maybeSingle();

      const emergencyContacts: StudentEmergencyContacts = {
        emergencyContact: profileData?.emergency_contact || undefined,
        emergencyRelationship: profileData?.emergency_relationship || undefined,
        fatherName: profileData?.father_name || undefined,
        fatherContact: profileData?.father_contact || undefined,
        motherName: profileData?.mother_name || undefined,
        motherContact: profileData?.mother_contact || undefined,
        mentorName: data.mentor_name || undefined,
        mentorContact: data.mentor_contact || undefined,
        personalPhone: data.phone || undefined,
        aadharNumber: profileData?.aadhar_number || undefined,
      };

      const studentResult: Student = { 
        ...data, 
        email,
        emergencyContacts,
      };
      setFoundStudent(studentResult);

      // Check for today's approved medical leave
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: leaveData } = await supabase
        .from("medical_leave_requests")
        .select(`
          id, doctor_notes, rest_days, referral_hospital, health_priority, 
          expected_duration, created_at, status, referral_type,
          medical_officers:referring_doctor_id(name)
        `)
        .eq("student_id", data.id)
        .gte("created_at", `${todayStr}T00:00:00`)
        .lte("created_at", `${todayStr}T23:59:59`)
        .in("status", ["student_form_pending", "on_leave", "doctor_referred"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaveData) {
        const doctorInfo = leaveData.medical_officers as any;
        const refTypes = (leaveData.referral_type as string[]) || [];
        
        // Extract test details from doctor_notes if present
        const notes = leaveData.doctor_notes || "";
        const testMatch = notes.match(/Test\/Checkup:\s*(.+?)(?:\s*\||$)/);
        const testDetails = testMatch ? testMatch[1].trim() : null;
        
        setApprovedLeave({
          id: leaveData.id,
          doctorName: doctorInfo?.name || "A doctor",
          doctorNotes: leaveData.doctor_notes,
          restDays: leaveData.rest_days,
          referralHospital: leaveData.referral_hospital,
          healthPriority: leaveData.health_priority,
          expectedDuration: leaveData.expected_duration,
          createdAt: leaveData.created_at,
          status: leaveData.status,
          referralType: refTypes,
          testDetails,
        });
        
        // Auto-fill referral type toggles from leave approval
        setReferredForTreatment(refTypes.includes("treatment"));
        setReferredForTest(refTypes.includes("test_checkup"));
        
        // Auto-fill form fields from existing approval
        form.setValue("referralHospital", leaveData.referral_hospital || "");
        form.setValue("healthPriority", (leaveData.health_priority as any) || "medium");
        form.setValue("leaveDays", leaveData.rest_days || 0);
        form.setValue("illnessDescription", leaveData.doctor_notes || "");
        form.setValue("expectedDuration", leaveData.expected_duration || "");
      }
      setLeaveCheckDone(true);

      toast.success("Student found", {
        description: `${data.full_name} - ${data.roll_number}`,
      });
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Failed to search for student. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const referralMutation = useMutation({
    mutationFn: async (data: ReferralFormData) => {
      if (!doctorId) throw new Error("Doctor ID not found");
      if (!foundStudent) throw new Error("Please verify student first");

      const leaveStartDate = new Date();
      const expectedReturnDate = new Date(Date.now() + data.leaveDays * 24 * 60 * 60 * 1000);

      // Build referral type array
      const referralTypes: string[] = [];
      if (referredForTreatment) referralTypes.push("treatment");
      if (referredForTest) referralTypes.push("test_checkup");

      // Get doctor name for notification
      const { data: doctorData } = await supabase
        .from("medical_officers")
        .select("name")
        .eq("id", doctorId)
        .maybeSingle();

      const { data: insertedData, error } = await supabase.from("medical_leave_requests").insert({
        student_id: foundStudent.id,
        referring_doctor_id: doctorId,
        referral_hospital: data.referralHospital,
        expected_duration: data.expectedDuration,
        illness_description: data.illnessDescription,
        health_priority: data.healthPriority,
        doctor_notes: data.doctorNotes || null,
        leave_start_date: leaveStartDate.toISOString().split('T')[0],
        expected_return_date: expectedReturnDate.toISOString().split('T')[0],
        rest_days: data.leaveDays,
        status: "student_form_pending",
        referral_type: referralTypes,
      }).select("id").maybeSingle();

      if (error) throw error;

      // Send notification to student
      const studentUserId = await getStudentUserId(foundStudent.id);
      if (studentUserId) {
        await notifyStudentOfReferral(studentUserId, {
          hospital: data.referralHospital,
          doctorName: doctorData?.name || "Campus Doctor",
          expectedDuration: data.expectedDuration,
          leaveRequestId: insertedData?.id,
        });
      }

      return { studentName: foundStudent.full_name };
    },
    onSuccess: (data) => {
      toast.success("Referral submitted successfully", {
        description: `${data?.studentName || "The student"} has been notified to complete the leave form.`,
      });
      form.reset();
      setFoundStudent(null);
      setReferredForTreatment(false);
      setReferredForTest(false);
      setApprovedLeave(null);
      setLeaveCheckDone(false);
      setEmailAutoFilled(false);
      queryClient.invalidateQueries({ queryKey: ["medical-leave-requests"] });
    },
    onError: (error) => {
      console.error("Referral error:", error);
      toast.error("Failed to submit referral", {
        description: "Please try again or contact support.",
      });
    },
  });

  const onSubmit = (data: ReferralFormData) => {
    if (!foundStudent) {
      toast.error("Please verify student first");
      return;
    }
    if (!referredForTreatment && !referredForTest) {
      toast.error("Please select at least one referral purpose (Treatment or Test/Checkup)");
      return;
    }
    referralMutation.mutate(data);
  };

  if (!isDoctor) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Only doctors can access this form.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Off-Campus Treatment Referral</CardTitle>
            <CardDescription>
              Refer a student for external hospital treatment
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Quick Student Lookup Section */}
        <div className="mb-8 p-5 rounded-xl border border-border bg-muted/30">
          <Label className="text-base font-semibold flex items-center gap-2 mb-1">
            <Search className="h-4 w-4" />
            Quick Student Lookup
          </Label>
          <p className="text-sm text-muted-foreground mb-4">
            Enter a roll number to view the student's full details, profile photo, and medical info
          </p>

          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="e.g., 25edi0012"
              value={lookupRoll}
              onChange={(e) => {
                setLookupRoll(e.target.value);
                setLookupStudent(null);
                setLookupError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickLookupStudent())}
            />
            <Button
              type="button"
              variant="default"
              disabled={lookupLoading || !lookupRoll.trim()}
              onClick={quickLookupStudent}
            >
              {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5">Lookup</span>
            </Button>
          </div>

          {lookupError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{lookupError}</AlertDescription>
            </Alert>
          )}

          {lookupStudent && (
            <div className="mt-4 p-4 rounded-lg bg-background border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">Student Found</span>
              </div>
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {lookupStudent.photo_url ? (
                    <img
                      src={lookupStudent.photo_url}
                      alt={lookupStudent.full_name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-muted-foreground/20">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline text-left text-lg"
                    onClick={() => navigate(`/student-profile/${lookupStudent.roll_number}`)}
                  >
                    {lookupStudent.full_name}
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                      {lookupStudent.roll_number}
                    </span>
                    <span>{lookupStudent.program}{lookupStudent.branch ? ` — ${lookupStudent.branch}` : ''}</span>
                    {lookupStudent.year_of_study && <span>Year: {lookupStudent.year_of_study}</span>}
                    {lookupStudent.batch && <span>Batch: {lookupStudent.batch}</span>}
                    {lookupStudent.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {lookupStudent.email}
                      </span>
                    )}
                    {lookupStudent.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {lookupStudent.phone}
                      </span>
                    )}
                    {lookupStudent.mentor_name && (
                      <span className="flex items-center gap-1.5 col-span-2">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        Mentor: {lookupStudent.mentor_name}
                        {lookupStudent.mentor_contact ? ` (${lookupStudent.mentor_contact})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Medical Info */}
                  {((lookupStudent as any)._bloodGroup || (lookupStudent as any)._allergies || (lookupStudent as any)._medications) && (
                    <div className="mt-2 pt-2 border-t border-border space-y-1 text-sm">
                      <p className="font-medium text-foreground text-xs uppercase tracking-wide">Medical Info</p>
                      {(lookupStudent as any)._bloodGroup && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          Blood Group: <Badge variant="outline" className="text-xs">{(lookupStudent as any)._bloodGroup}</Badge>
                        </span>
                      )}
                      {(lookupStudent as any)._allergies && (
                        <p className="text-muted-foreground">Allergies: {(lookupStudent as any)._allergies}</p>
                      )}
                      {(lookupStudent as any)._medications && (
                        <p className="text-muted-foreground">Current Medications: {(lookupStudent as any)._medications}</p>
                      )}
                    </div>
                  )}

                  {/* Emergency Contacts */}
                  {lookupStudent.emergencyContacts && (
                    <div className="mt-2 pt-2 border-t border-border space-y-1 text-sm">
                      <p className="font-medium text-foreground text-xs uppercase tracking-wide">Emergency Contacts</p>
                      {lookupStudent.emergencyContacts.fatherName && (
                        <p className="text-muted-foreground">Father: {lookupStudent.emergencyContacts.fatherName} {lookupStudent.emergencyContacts.fatherContact ? `(${lookupStudent.emergencyContacts.fatherContact})` : ''}</p>
                      )}
                      {lookupStudent.emergencyContacts.motherName && (
                        <p className="text-muted-foreground">Mother: {lookupStudent.emergencyContacts.motherName} {lookupStudent.emergencyContacts.motherContact ? `(${lookupStudent.emergencyContacts.motherContact})` : ''}</p>
                      )}
                      {lookupStudent.emergencyContacts.emergencyContact && (
                        <p className="text-muted-foreground">Emergency: {lookupStudent.emergencyContacts.emergencyContact} ({lookupStudent.emergencyContacts.emergencyRelationship || 'N/A'})</p>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-1"
                    onClick={() => navigate(`/student-profile/${lookupStudent.roll_number}`)}
                  >
                    View Full Profile →
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Student Verification */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Student Verification
              </Label>
              <p className="text-sm text-muted-foreground">
                Enter the student's roll number to auto-fetch their official email and verify identity
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rollNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll Number</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            placeholder="e.g., 21CS1045" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setFoundStudent(null);
                              setSearchError(null);
                              setApprovedLeave(null);
                              setLeaveCheckDone(false);
                              setReferredForTreatment(false);
                              setReferredForTest(false);
                              setEmailAutoFilled(false);
                              form.setValue("email", "");
                            }}
                            onBlur={(e) => {
                              field.onBlur();
                              fetchEmailFromRollNumber(e.target.value);
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={isFetchingEmail || !field.value}
                          onClick={() => fetchEmailFromRollNumber(field.value)}
                        >
                          {isFetchingEmail ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        College Email
                        {emailAutoFilled && (
                          <Badge variant="secondary" className="ml-1 text-xs py-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Auto-fetched
                          </Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="student@student.nitw.ac.in" 
                          {...field}
                          readOnly={emailAutoFilled}
                          className={emailAutoFilled ? "bg-muted/50" : ""}
                          onChange={(e) => {
                            field.onChange(e);
                            setFoundStudent(null);
                            setSearchError(null);
                            setApprovedLeave(null);
                            setLeaveCheckDone(false);
                            setReferredForTreatment(false);
                            setReferredForTest(false);
                          }}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {emailAutoFilled ? "Email fetched from student records" : "Must be @nitw.ac.in or @student.nitw.ac.in"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={searchStudent}
                disabled={isSearching}
                className="w-full md:w-auto"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Verify Student
                  </>
                )}
              </Button>

              {searchError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{searchError}</AlertDescription>
                </Alert>
              )}

              {foundStudent && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="font-medium text-primary">Student Verified ✓</span>
                  </div>
                  <div className="flex items-start gap-4">
                    {/* Student Photo */}
                    <div className="shrink-0">
                      {foundStudent.photo_url ? (
                        <img 
                          src={foundStudent.photo_url} 
                          alt={foundStudent.full_name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-muted-foreground/20">
                          <User className="w-7 h-7 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {/* Student Details */}
                    <div className="flex-1 space-y-1.5">
                      <button
                        type="button"
                        className="font-semibold text-primary hover:underline text-left text-base"
                        onClick={() => navigate(`/student-profile/${foundStudent.roll_number}`)}
                      >
                        {foundStudent.full_name}
                      </button>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5" />
                          {foundStudent.roll_number}
                        </span>
                        <span>{foundStudent.program}{foundStudent.branch ? ` — ${foundStudent.branch}` : ''}</span>
                        {foundStudent.year_of_study && <span>Year: {foundStudent.year_of_study}</span>}
                        {foundStudent.batch && <span>Batch: {foundStudent.batch}</span>}
                        {foundStudent.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {foundStudent.email}
                          </span>
                        )}
                        {foundStudent.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {foundStudent.phone}
                          </span>
                        )}
                        {foundStudent.mentor_name && (
                          <span className="flex items-center gap-1 col-span-2">
                            <Users className="h-3.5 w-3.5" />
                            Mentor: {foundStudent.mentor_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Workflow Verification: Approval Check */}
            {foundStudent && leaveCheckDone && !approvedLeave && (
              <Alert variant="destructive" className="border-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold text-base">Medical Leave Not Approved</p>
                  <p>
                    Doctor has not approved medical leave or treatment for <strong>{foundStudent.full_name}</strong> ({foundStudent.roll_number}) today. 
                    Please complete the medical leave process first from the Doctor Dashboard before creating an off-campus referral.
                  </p>
                  <p className="text-sm opacity-80">
                    Workflow: Appointment → Doctor issues medical leave → Then referral can proceed.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {foundStudent && leaveCheckDone && approvedLeave && (
              <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200 dark:bg-green-950/20 dark:border-green-800 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-800 dark:text-green-200 text-base">Medical Leave Approved Today</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                  Dr. <strong>{approvedLeave.doctorName}</strong> has approved medical leave for this student.
                  {approvedLeave.doctorNotes && <> Reason: <em>{approvedLeave.doctorNotes}</em>.</>}
                  {" "}Rest days: <strong>{approvedLeave.restDays ?? "N/A"}</strong>.
                  {approvedLeave.referralHospital && <> Referral hospital: <strong>{approvedLeave.referralHospital}</strong>.</>}
                </p>
                {approvedLeave.referralType.length > 0 && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Referral type: <strong>
                      {approvedLeave.referralType.includes("treatment") ? "Treatment" : ""}
                      {approvedLeave.referralType.length === 2 ? " & " : ""}
                      {approvedLeave.referralType.includes("test_checkup") ? "Test/Checkup" : ""}
                    </strong>
                    {approvedLeave.testDetails && <> — Tests: <em>{approvedLeave.testDetails}</em></>}
                  </p>
                )}
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✅ Workflow verified — you may now proceed with the off-campus referral details below. Form fields have been auto-filled from the leave approval.
                </p>
              </div>
            )}

            {/* Referral Details - Only show after student verification AND approval */}
            {foundStudent && leaveCheckDone && approvedLeave && (
              <>
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Referral Details
                  </Label>

                  <HospitalRecommendation
                    priority={(form.watch("healthPriority") as "high" | "medium" | "low") || "medium"}
                    selectedHospital={selectedHospitalName || undefined}
                    onSelect={(name) => form.setValue("referralHospital", name)}
                  />

                  <FormField
                    control={form.control}
                    name="referralHospital"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referral Hospital</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select empanelled hospital..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="other">
                              <span className="text-muted-foreground">Other Hospital (specify below)</span>
                            </SelectItem>
                            
                            {/* Group: Empanelled for Students */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-primary bg-primary/5">
                              Empanelled for Students (2023-2024)
                            </div>
                            {EMPANELLED_HOSPITALS.empanelledStudents.map((h, idx) => (
                              <SelectItem key={`emp-${idx}`} value={h.name}>
                                <div className="flex flex-col">
                                  <span>{h.name}</span>
                                  <span className="text-xs text-muted-foreground">{h.location}</span>
                                </div>
                              </SelectItem>
                            ))}

                            {/* Group: Super Speciality Warangal */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-primary bg-primary/5 mt-2">
                              Super Speciality - Warangal
                            </div>
                            {EMPANELLED_HOSPITALS.superSpecialityWarangal.map((h, idx) => (
                              <SelectItem key={`ssw-${idx}`} value={h.name}>
                                <div className="flex flex-col">
                                  <span>{h.name}</span>
                                  <span className="text-xs text-muted-foreground">{h.location}</span>
                                </div>
                              </SelectItem>
                            ))}

                            {/* Group: General Warangal */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-primary bg-primary/5 mt-2">
                              General Hospitals - Warangal
                            </div>
                            {EMPANELLED_HOSPITALS.generalWarangal.map((h, idx) => (
                              <SelectItem key={`gw-${idx}`} value={h.name}>
                                <div className="flex flex-col">
                                  <span>{h.name}</span>
                                  <span className="text-xs text-muted-foreground">{h.location}</span>
                                </div>
                              </SelectItem>
                            ))}

                            {/* Group: Super Speciality Hyderabad */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-primary bg-primary/5 mt-2">
                              Super Speciality - Hyderabad
                            </div>
                            {EMPANELLED_HOSPITALS.superSpecialityHyderabad.map((h, idx) => (
                              <SelectItem key={`ssh-${idx}`} value={h.name}>
                                <div className="flex flex-col">
                                  <span>{h.name}</span>
                                  <span className="text-xs text-muted-foreground">{h.location}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select from empanelled hospitals (01.07.2023 - 30.06.2024)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedHospitalName === "other" && (
                    <FormItem>
                      <FormLabel>Other Hospital Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter hospital name..."
                          onChange={(e) => form.setValue("referralHospital", e.target.value)}
                        />
                      </FormControl>
                    </FormItem>
                  )}

                  {/* Referral Type Selection */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Referral Purpose
                    </Label>
                    <p className="text-sm text-muted-foreground -mt-1">
                      Select the purpose of this off-campus referral. Both can be selected.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReferredForTreatment(!referredForTreatment)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          referredForTreatment 
                            ? "border-primary bg-primary/10 ring-1 ring-primary" 
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            referredForTreatment ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}>
                            {referredForTreatment && <span className="text-primary-foreground text-xs">✓</span>}
                          </div>
                          <span className="font-medium text-sm">Referred for Treatment</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          Student needs medical treatment at an outside hospital
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReferredForTest(!referredForTest)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          referredForTest 
                            ? "border-primary bg-primary/10 ring-1 ring-primary" 
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            referredForTest ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}>
                            {referredForTest && <span className="text-primary-foreground text-xs">✓</span>}
                          </div>
                          <span className="font-medium text-sm">Referred for Test / Checkup</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          Student needs diagnostic tests or checkup at an outside facility
                        </p>
                      </button>
                    </div>

                    {/* Show test details fetched from leave approval when test/checkup is selected */}
                    {referredForTest && approvedLeave?.testDetails && (
                      <Alert className="bg-primary/5 border-primary/20">
                        <FileText className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Tests suggested by doctor:</strong> {approvedLeave.testDetails}
                        </AlertDescription>
                      </Alert>
                    )}

                    {!referredForTreatment && !referredForTest && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Please select at least one referral purpose
                      </p>
                    )}
                  </div>

                  {/* Medical Leave Details Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Medical Leave Details
                    </Label>

                    <FormField
                      control={form.control}
                      name="illnessDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4" />
                            Illness / Condition Description
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the medical condition requiring external treatment..."
                              className="resize-none"
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="leaveDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Medical Leave Days
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={0} 
                                max={90} 
                                placeholder={referredForTest && !referredForTreatment ? "0 for test/checkup only" : "Number of days"}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {referredForTest && !referredForTreatment 
                                ? "Enter 0 if only going for test/checkup (no rest needed)" 
                                : "Recommended rest period (1-90 days)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="healthPriority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Health Priority
                            </FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="low" id="priority-low" />
                                  <Label htmlFor="priority-low" className="text-primary font-medium cursor-pointer">Low</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="medium" id="priority-medium" />
                                  <Label htmlFor="priority-medium" className="text-accent-foreground font-medium cursor-pointer">Medium</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="high" id="priority-high" />
                                  <Label htmlFor="priority-high" className="text-destructive font-medium cursor-pointer">High</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="expectedDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Expected Treatment Duration
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 3-5 days, 1 week..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="doctorNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor's Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add any relevant medical notes, instructions, or recommendations..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                          These notes will appear on the referral letter
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>

                  {/* Academic Coordination Section - Optional for test/checkup only */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Academic Coordination
                      {!referredForTreatment && referredForTest && (
                        <Badge variant="secondary" className="text-xs">Optional for Test/Checkup</Badge>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {!referredForTreatment && referredForTest 
                        ? "Optional for test/checkup referrals. Fill if academic coordination is needed."
                        : "Official email IDs for academic notifications and leave approval coordination"}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="mentorEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Mentor Email
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="mentor@nitw.ac.in" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Faculty mentor's official email
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hodEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              HOD Email
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="hod_dept@nitw.ac.in" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Head of Department's email
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deanEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4" />
                              Dean (Student Welfare) Email
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="deansg@nitw.ac.in" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Dean of Student Welfare's email
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Alert className="bg-primary/5 border-primary/20">
                      <Mail className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        These email addresses will be used to notify academic authorities about the student's medical leave for coordination and approval purposes.
                      </AlertDescription>
                    </Alert>
                  </div>

                  {/* Show hospital details with referral letter button when form is filled */}
                  {selectedHospital && (
                    <HospitalDetailsCard 
                      hospital={selectedHospital} 
                      studentName={foundStudent?.full_name}
                      studentRollNumber={foundStudent?.roll_number}
                      studentProgram={foundStudent?.program}
                      studentBranch={foundStudent?.branch}
                      emergencyContacts={foundStudent?.emergencyContacts}
                      showReferralLetter={!!form.watch("illnessDescription") && form.watch("leaveDays") > 0}
                      referralData={{
                        program: foundStudent?.program,
                        branch: foundStudent?.branch,
                        illnessDescription: form.watch("illnessDescription"),
                        leaveDays: form.watch("leaveDays"),
                        healthPriority: form.watch("healthPriority"),
                        doctorNotes: form.watch("doctorNotes"),
                      }}
                    />
                  )}
                </div>

                {/* Declaration */}
                <div className="p-4 rounded-lg bg-accent/30 border border-accent">
                  <p className="text-sm font-medium text-accent-foreground">
                    Medical Declaration
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    By submitting this referral, I confirm that the student is medically unfit 
                    to remain on campus and requires off-campus treatment at the specified hospital.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={referralMutation.isPending || (!referredForTreatment && !referredForTest)}
                >
                  {referralMutation.isPending ? (
                    "Submitting Referral..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Referral & Notify Student
                    </>
                  )}
                </Button>
              </>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default DoctorReferralForm;
