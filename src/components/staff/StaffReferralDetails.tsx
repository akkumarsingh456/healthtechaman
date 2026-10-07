import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PrintableReferralLetter from "@/components/medical-leave/PrintableReferralLetter";
import PrintableHospitalCard from "@/components/medical-leave/PrintableHospitalCard";
import {
  Building, Calendar, CheckCircle2, User, MapPin, Phone, Navigation,
  ExternalLink, Stethoscope, FileText, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

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

// Empanelled hospital data (shared with DoctorReferralForm)
const EMPANELLED_HOSPITALS: Record<string, HospitalInfo[]> = {
  empanelledStudents: [
    { name: "M/s. Medicover Hospitals", location: "Hyderabad & Warangal", entitlement: "Employees & Students", phone: "040-68334455", emergency: "040-68334455", address: "Nakkalagutta, Hanamkonda, Warangal & Hi-Tech City, Hyderabad", directions: "Warangal branch at Nakkalagutta. 6 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Medicover+Hospitals+Warangal", specialties: ["Multi-Specialty", "Emergency Care", "Diagnostics"] },
    { name: "M/s. Vijaya Diagnostic Centre Ltd.", location: "Hyderabad & Warangal", entitlement: "Employees & Students", phone: "0870-2440000", address: "Hanamkonda, Warangal", directions: "Multiple centers in Warangal city.", mapUrl: "https://maps.google.com/?q=Vijaya+Diagnostic+Centre+Warangal", specialties: ["Diagnostics", "Lab Tests", "Radiology"] },
    { name: "M/s. Rohini Medicare Pvt. Ltd.", location: "Hanamkonda", entitlement: "Employees & Students", phone: "0870-2461111", emergency: "0870-2461100", address: "Rohini Circle, Hanamkonda, Warangal - 506001", directions: "At Rohini Circle, Hanamkonda. 8 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Rohini+Medicare+Hanamkonda" },
    { name: "M/s. Ajara Hospitals", location: "Warangal", entitlement: "Employees & Students", phone: "0870-2500123", address: "Main Road, Warangal - 506002", directions: "On Warangal Main Road. 10 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Ajara+Hospitals+Warangal" },
    { name: "M/s. Laxmi Narasimha Hospital", location: "Hanamkonda", entitlement: "Employees & Students", phone: "0870-2543322", address: "Mulugu Road, Hanamkonda, Warangal", directions: "On Mulugu Road. 6 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Laxmi+Narasimha+Hospital+Hanamkonda" },
    { name: "M/s. Samraksha Super Specialty Hospital", location: "Warangal", entitlement: "Employees & Students", phone: "0870-2577777", emergency: "0870-2577700", address: "Warangal Main Road, Near MGM Hospital", directions: "On Warangal Main Road. 10 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Samraksha+Hospital+Warangal" },
    { name: "M/s. Jaya Hospitals", location: "Hanamkonda", entitlement: "Employees & Students", phone: "0870-2542899", emergency: "0870-2542800", address: "JPN Road, Hanamkonda, Warangal", directions: "On JPN Road, near Thousand Pillar Temple. 7 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Jaya+Hospitals+Hanamkonda" },
  ],
  superSpecialityWarangal: [
    { name: "Rohini Super Specialty Hospital", location: "Hanamkonda", phone: "0870-2461111", emergency: "0870-2461122", address: "6-3-249, Rohini Circle, Hanamkonda, Warangal - 506001", directions: "Near Hanamkonda Bus Stand. 8 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Rohini+Super+Specialty+Hospital+Hanamkonda", specialties: ["Cardiology", "Neurology", "Nephrology", "Oncology"] },
    { name: "Samraksha Super Specialty Hospital", location: "Warangal", phone: "0870-2577777", emergency: "0870-2577700", address: "Warangal Main Road, Near MGM Hospital", directions: "On Warangal Main Road. 10 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=Samraksha+Super+Specialty+Hospital+Warangal", specialties: ["Cardiac Surgery", "Orthopedics", "Gastroenterology"] },
  ],
  superSpecialityHyderabad: [
    { name: "Krishna Institute of Medical Sciences Ltd. (KIMS)", location: "Hyderabad", phone: "040-44885000", emergency: "040-44885100", address: "1-8-31/1, Minister Road, Secunderabad - 500003", directions: "At Minister Road, Secunderabad. 145 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=KIMS+Hospitals+Secunderabad", specialties: ["Cardiac Sciences", "Neuro Sciences", "Liver Transplant"] },
    { name: "CARE Super Speciality Hospitals", location: "Hyderabad", phone: "040-30418888", emergency: "040-30418800", address: "Road No. 1, Banjara Hills, Hyderabad", directions: "In Banjara Hills. 150 km from NIT Warangal.", mapUrl: "https://maps.google.com/?q=CARE+Hospitals+Banjara+Hills", specialties: ["Cardiac Sciences", "Neuro Sciences", "Oncology"] },
  ],
};

const getHospitalByName = (name: string): HospitalInfo | null => {
  for (const category of Object.values(EMPANELLED_HOSPITALS)) {
    const found = category.find(h => h.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(h.name.toLowerCase()));
    if (found) return found;
  }
  return null;
};

interface LeaveRequest {
  id: string;
  status: string;
  referral_hospital: string;
  expected_duration: string;
  doctor_notes: string | null;
  referral_date: string | null;
  referring_doctor_id: string | null;
  rest_days: number | null;
  illness_description: string | null;
  referral_type: string[] | null;
  leave_start_date: string | null;
  expected_return_date: string | null;
  health_priority: string | null;
  doctor?: { name: string };
}

interface StudentInfo {
  full_name: string;
  roll_number: string;
  program: string;
  branch: string | null;
  mentor_name: string | null;
  mentor_contact: string | null;
  phone: string | null;
  email: string | null;
}

interface StaffReferralDetailsProps {
  leaveRequests: LeaveRequest[];
  student: StudentInfo;
}

const HospitalDetailsCard = ({ hospital, studentName, studentRoll }: {
  hospital: HospitalInfo;
  studentName?: string;
  studentRoll?: string;
}) => (
  <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">{hospital.name}</h4>
      </div>
      {hospital.address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">{hospital.address}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {hospital.phone && (
          <a href={`tel:${hospital.phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Phone className="h-3.5 w-3.5" /> {hospital.phone}
          </a>
        )}
        {hospital.emergency && (
          <a href={`tel:${hospital.emergency}`} className="inline-flex items-center gap-1.5 text-sm text-destructive font-medium hover:underline">
            <Phone className="h-3.5 w-3.5" /> Emergency: {hospital.emergency}
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
          {hospital.specialties.map((s, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
          ))}
        </div>
      )}
      {hospital.mapUrl && (
        <a href={hospital.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
          <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
        </a>
      )}
    </div>
  </div>
);

const getPriorityColor = (priority: string | null) => {
  switch (priority) {
    case "high": return "bg-destructive/10 text-destructive border-destructive/30";
    case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "low": return "bg-green-100 text-green-800 border-green-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const StaffReferralDetails = ({ leaveRequests, student }: StaffReferralDetailsProps) => {
  const [expandedLeaves, setExpandedLeaves] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedLeaves(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (leaveRequests.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="font-medium text-yellow-800">No Active Medical Leave Found</p>
          <p className="text-sm text-muted-foreground mt-1">
            No doctor has approved medical leave for this student. Medical leave can only be issued after a doctor's referral.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {leaveRequests.map((leave) => {
        const isExpanded = expandedLeaves.has(leave.id);
        const hospital = getHospitalByName(leave.referral_hospital);
        const refTypes = leave.referral_type || [];
        const testMatch = leave.doctor_notes?.match(/Test\/Checkup:\s*(.+?)(?:\s*\||$)/);
        const testDetails = testMatch ? testMatch[1].trim() : null;

        return (
          <Card key={leave.id} className="border-primary/20 overflow-hidden">
            {/* Header - Always visible */}
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={leave.status === "on_leave" ? "default" : "secondary"}>
                      {leave.status.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                    {leave.rest_days != null && (
                      <Badge variant="outline">{leave.rest_days} day(s) rest</Badge>
                    )}
                    {leave.health_priority && (
                      <Badge className={getPriorityColor(leave.health_priority)}>
                        {leave.health_priority.toUpperCase()} Priority
                      </Badge>
                    )}
                    {refTypes.map((type, i) => (
                      <Badge key={i} variant="outline" className="border-primary/30 text-primary">
                        {type === "test_checkup" ? "Test/Checkup" : type}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-muted-foreground" />
                      <span>Hospital: <strong>{leave.referral_hospital}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span>Doctor: {leave.doctor?.name || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>Duration: {leave.expected_duration}</span>
                    </div>
                    {leave.referral_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>Referred: {format(new Date(leave.referral_date), "dd MMM yyyy")}</span>
                      </div>
                    )}
                  </div>
                  {leave.doctor_notes && (
                    <p className="text-sm"><strong>Doctor Notes:</strong> {leave.doctor_notes}</p>
                  )}
                </div>
                <Badge className="bg-green-600 shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Doctor Approved
                </Badge>
              </div>

              {/* Toggle expand */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-primary"
                onClick={() => toggleExpand(leave.id)}
              >
                {isExpanded ? (
                  <><ChevronUp className="w-4 h-4 mr-1" /> Hide Full Details</>
                ) : (
                  <><ChevronDown className="w-4 h-4 mr-1" /> View Full Referral Details & Print Documents</>
                )}
              </Button>
            </CardContent>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t bg-muted/20 p-5 space-y-5">
                {/* Medical Leave Approved Notice */}
                <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800 text-base">Medical Leave Approved</span>
                  </div>
                  <p className="text-sm text-green-700 leading-relaxed">
                    Dr. <strong>{leave.doctor?.name || "Unknown"}</strong> has approved medical leave for this student.
                    {leave.doctor_notes && <> Reason: <em>{leave.doctor_notes}</em>.</>}
                    {" "}Rest days: <strong>{leave.rest_days ?? "N/A"}</strong>.
                    {leave.referral_hospital && <> Referral hospital: <strong>{leave.referral_hospital}</strong>.</>}
                  </p>
                  {refTypes.length > 0 && (
                    <p className="text-sm text-green-700">
                      Referral type: <strong>
                        {refTypes.includes("treatment") ? "Treatment" : ""}
                        {refTypes.length === 2 ? " & " : ""}
                        {refTypes.includes("test_checkup") ? "Test/Checkup" : ""}
                      </strong>
                      {testDetails && <> — Tests: <em>{testDetails}</em></>}
                    </p>
                  )}
                  <p className="text-xs text-green-600">
                    ✅ Workflow verified — you may proceed with issuing the referral letter and hospital card.
                  </p>
                </div>

                {/* Referral Purpose */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" /> Referral Purpose
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border-2 ${refTypes.includes("treatment") ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${refTypes.includes("treatment") ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                          {refTypes.includes("treatment") && <span className="text-primary-foreground text-xs">✓</span>}
                        </div>
                        <span className="font-medium text-sm">Referred for Treatment</span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg border-2 ${refTypes.includes("test_checkup") ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${refTypes.includes("test_checkup") ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                          {refTypes.includes("test_checkup") && <span className="text-primary-foreground text-xs">✓</span>}
                        </div>
                        <span className="font-medium text-sm">Referred for Test / Checkup</span>
                      </div>
                    </div>
                  </div>
                  {testDetails && (
                    <Alert className="bg-primary/5 border-primary/20">
                      <FileText className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Tests suggested by doctor:</strong> {testDetails}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Medical Leave Details */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Medical Leave Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background rounded-lg border">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Illness / Condition</p>
                      <p className="text-sm font-medium mt-1">{leave.illness_description || leave.doctor_notes || "As per doctor's assessment"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Health Priority</p>
                      <Badge className={`mt-1 ${getPriorityColor(leave.health_priority)}`}>
                        {(leave.health_priority || "medium").toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Medical Leave Days</p>
                      <p className="text-sm font-medium mt-1">{leave.rest_days ?? 0} day(s)</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Expected Treatment Duration</p>
                      <p className="text-sm font-medium mt-1">{leave.expected_duration}</p>
                    </div>
                    {leave.leave_start_date && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Leave Start</p>
                        <p className="text-sm font-medium mt-1">{format(new Date(leave.leave_start_date), "dd MMM yyyy")}</p>
                      </div>
                    )}
                    {leave.expected_return_date && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Expected Return</p>
                        <p className="text-sm font-medium mt-1">{format(new Date(leave.expected_return_date), "dd MMM yyyy")}</p>
                      </div>
                    )}
                  </div>
                  {leave.doctor_notes && (
                    <div className="p-3 bg-accent/30 rounded-lg border border-accent">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Doctor's Notes</p>
                      <p className="text-sm">{leave.doctor_notes}</p>
                    </div>
                  )}
                </div>

                {/* Hospital Details */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4" /> Hospital Details
                  </h4>
                  {hospital ? (
                    <HospitalDetailsCard hospital={hospital} studentName={student.full_name} studentRoll={student.roll_number} />
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="font-medium">{leave.referral_hospital}</p>
                      <p className="text-sm text-muted-foreground mt-1">Hospital not in empanelled list — manual details may apply.</p>
                    </div>
                  )}
                </div>

                {/* Print Documents Section */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Print Documents
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    <PrintableReferralLetter
                      data={{
                        studentName: student.full_name,
                        rollNumber: student.roll_number,
                        program: student.program,
                        branch: student.branch,
                        hospital: hospital || {
                          name: leave.referral_hospital,
                          location: leave.referral_hospital,
                        },
                        illnessDescription: leave.illness_description || leave.doctor_notes || "As per doctor's assessment",
                        leaveDays: (leave.rest_days ?? parseInt(leave.expected_duration)) || 1,
                        healthPriority: leave.health_priority || "medium",
                        doctorNotes: leave.doctor_notes || undefined,
                        doctorDetails: leave.doctor ? {
                          name: leave.doctor.name,
                          designation: "Medical Officer",
                        } : undefined,
                        mentorDetails: student.mentor_name ? {
                          name: student.mentor_name,
                          phone: student.mentor_contact || undefined,
                        } : undefined,
                      }}
                    />
                    <PrintableHospitalCard
                      hospital={hospital || {
                        name: leave.referral_hospital,
                        location: leave.referral_hospital,
                      }}
                      studentName={student.full_name}
                      studentRollNumber={student.roll_number}
                      studentProgram={student.program}
                      studentBranch={student.branch || undefined}
                      emergencyContacts={{
                        mentorName: student.mentor_name || undefined,
                        mentorContact: student.mentor_contact || undefined,
                        personalPhone: student.phone || undefined,
                      }}
                      illnessDescription={leave.illness_description || leave.doctor_notes || undefined}
                      doctorNotes={leave.doctor_notes || undefined}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default StaffReferralDetails;
