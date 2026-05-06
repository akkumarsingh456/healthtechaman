import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, User, Calendar, Phone, Mail, GraduationCap, Activity, TrendingUp, Pill, FileText, Droplets, AlertCircle, Heart, Building2, Printer, TestTube, Download, Clock, FileCheck, HeartPulse, ShieldCheck, BadgeCheck, AlertTriangle, CalendarClock, CheckCircle2, Stethoscope, Eye } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import VisitPatternAnalysis from '@/components/health/VisitPatternAnalysis';
import { notifyStudentOfStatusUpdate, getStudentUserId } from '@/lib/notifications/medical-leave-notifications';
import LabReportViewer, { printLabReport } from '@/components/lab/LabReportViewer';
import LeaveApprovalWorkflowTimeline, { type ApprovalWorkflowRow } from '@/components/medical-leave/LeaveApprovalWorkflowTimeline';
import DoctorWorkflowActions from '@/components/medical-leave/DoctorWorkflowActions';

interface Student {
  id: string;
  roll_number: string;
  full_name: string;
  program: string;
  branch: string | null;
  batch: string;
  email: string | null;
  phone: string | null;
  year_of_study: string | null;
  mentor_name: string | null;
  mentor_email: string | null;
  photo_url: string | null;
  mentors: {
    name: string;
    department: string;
  } | null;
}

interface StudentProfileData {
  blood_group: string | null;
  known_allergies: string | null;
  current_medications: string | null;
  has_previous_health_issues: boolean | null;
  previous_health_details: string | null;
  emergency_contact: string | null;
  emergency_relationship: string | null;
  father_name: string | null;
  father_contact: string | null;
  mother_name: string | null;
  mother_contact: string | null;
  covid_vaccination_status: string | null;
}

interface HealthVisit {
  id: string;
  visit_date: string;
  reason_category: string;
  reason_subcategory: string | null;
  reason_notes: string | null;
  diagnosis: string | null;
  prescription: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  medical_officers: {
    name: string;
    designation: string;
  } | null;
}

interface PrescriptionItem {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  meal_timing: string | null;
}

interface Prescription {
  id: string;
  created_at: string;
  diagnosis: string | null;
  notes: string | null;
  doctor_id: string | null;
  appointment_id: string;
  medical_officers: { name: string; designation: string } | null;
  prescription_items: PrescriptionItem[];
}

interface LabReport {
  id: string;
  test_name: string;
  status: string;
  notes: string | null;
  report_file_url: string | null;
  report_file_name: string | null;
  created_at: string;
  updated_at: string;
  medical_officers: { name: string; designation: string } | null;
}

interface MedicalLeaveRecord {
  id: string;
  status: string;
  referral_hospital: string;
  illness_description: string | null;
  health_priority: string | null;
  expected_duration: string;
  leave_start_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  doctor_clearance: boolean | null;
  doctor_clearance_date: string | null;
  doctor_notes: string | null;
  created_at: string;
  health_centre_visited: boolean | null;
  accompanist_name: string | null;
  accompanist_type: string | null;
  referral_type: string[] | null;
  rest_days: number | null;
  student_id: string;
  medical_officers: { name: string } | null;
}

const MEAL_LABELS: Record<string, string> = {
  before_meal: 'Before Meal',
  after_meal: 'After Meal',
  with_meal: 'With Meal',
  empty_stomach: 'Empty Stomach',
  any_time: 'Any Time',
  bedtime: 'At Bedtime',
};

const StudentProfile = () => {
  const { rollNumber } = useParams<{ rollNumber: string }>();
  const navigate = useNavigate();
  const { user, isDoctor, isMentor, doctorId, loading: roleLoading } = useUserRole();
  const [student, setStudent] = useState<Student | null>(null);
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [visits, setVisits] = useState<HealthVisit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [medicalLeaves, setMedicalLeaves] = useState<MedicalLeaveRecord[]>([]);
  const [workflowsByLeave, setWorkflowsByLeave] = useState<Record<string, ApprovalWorkflowRow>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [clearanceDialogOpen, setClearanceDialogOpen] = useState<string | null>(null);
  const [fitConfirmed, setFitConfirmed] = useState(false);
  const [clearanceNotes, setClearanceNotes] = useState('');
  const [clearanceLoading, setClearanceLoading] = useState(false);
  const [viewingLabReport, setViewingLabReport] = useState<LabReport | null>(null);

  const handleGrantClearance = async (leave: MedicalLeaveRecord) => {
    if (!doctorId) return;
    setClearanceLoading(true);
    try {
      const { error } = await supabase
        .from('medical_leave_requests')
        .update({
          doctor_clearance: true,
          doctor_clearance_date: new Date().toISOString(),
          cleared_by_doctor_id: doctorId,
          follow_up_notes: clearanceNotes || null,
        })
        .eq('id', leave.id);

      if (error) throw error;

      // Notify student
      const studentUserId = await getStudentUserId(leave.student_id);
      if (studentUserId) {
        await notifyStudentOfStatusUpdate(
          studentUserId,
          'returned',
          'Your doctor has confirmed you are fit to resume classes. Your medical leave cycle is now complete.'
        );
      }

      toast.success('Fitness clearance granted', {
        description: `${student?.full_name} has been cleared for classes.`,
      });

      // Update local state
      setMedicalLeaves(prev =>
        prev.map(l =>
          l.id === leave.id
            ? { ...l, doctor_clearance: true, doctor_clearance_date: new Date().toISOString() }
            : l
        )
      );
      setClearanceDialogOpen(null);
      setFitConfirmed(false);
      setClearanceNotes('');
    } catch (err) {
      toast.error('Failed to grant clearance');
    } finally {
      setClearanceLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate('/auth');
    }
  }, [user, roleLoading, navigate]);

  useEffect(() => {
    if (rollNumber && !roleLoading && user) {
      fetchStudentData();
    }
  }, [rollNumber, roleLoading, user]);

  const fetchStudentData = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          id, roll_number, full_name, program, branch, batch, email, phone, year_of_study,
          mentor_name, mentor_email, photo_url,
          mentors ( name, department )
        `)
        .eq('roll_number', rollNumber)
        .single();

      if (studentError || !studentData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setStudent(studentData as Student);

      // Fetch all data in parallel
      const [visitsRes, profileRes, prescriptionsRes, completedApptsRes, labReportsRes, medicalLeavesRes] = await Promise.all([
        supabase
          .from('health_visits')
          .select(`
            id, visit_date, reason_category, reason_subcategory, reason_notes,
            diagnosis, prescription, follow_up_required, follow_up_date,
            medical_officers ( name, designation )
          `)
          .eq('student_id', studentData.id)
          .order('visit_date', { ascending: false }),
        supabase
          .from('student_profiles')
          .select('*')
          .eq('student_id', studentData.id)
          .maybeSingle(),
        supabase
          .from('prescriptions')
          .select(`
            id, created_at, diagnosis, notes, doctor_id, appointment_id,
            medical_officers:doctor_id ( name, designation ),
            prescription_items ( id, medicine_name, dosage, frequency, duration, instructions, meal_timing )
          `)
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select(`
            id, appointment_date, appointment_time, reason, status,
            medical_officers:medical_officer_id ( name, designation )
          `)
          .eq('status', 'completed')
          .order('appointment_date', { ascending: false }),
        supabase
          .from('lab_reports')
          .select(`
            id, test_name, status, notes, report_file_url, report_file_name, created_at, updated_at,
            medical_officers:doctor_id ( name, designation )
          `)
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('medical_leave_requests')
          .select(`
            id, status, referral_hospital, illness_description, health_priority,
            expected_duration, leave_start_date, expected_return_date, actual_return_date,
            doctor_clearance, doctor_clearance_date, doctor_notes, created_at,
            health_centre_visited, accompanist_name, accompanist_type, referral_type,
            rest_days, student_id,
            medical_officers:referring_doctor_id ( name )
          `)
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false }),
      ]);

      // Build combined visits: health_visits + completed appointments
      const healthVisits = (visitsRes.data as HealthVisit[]) || [];
      const completedAppts = completedApptsRes.data || [];
      
      // Get student's user_id to filter appointments by patient_id
      const { data: studentUser } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', studentData.id)
        .maybeSingle();

      // Add completed appointments as visit entries (those not already covered by health_visits)
      const healthVisitIds = new Set(healthVisits.map(v => v.id));
      const apptVisits: HealthVisit[] = [];
      
      if (studentUser?.user_id) {
        // Re-fetch completed appointments filtered by this student's user_id
        const { data: studentAppts } = await supabase
          .from('appointments')
          .select(`
            id, appointment_date, appointment_time, reason, status,
            medical_officers:medical_officer_id ( name, designation )
          `)
          .eq('patient_id', studentUser.user_id)
          .eq('status', 'completed')
          .order('appointment_date', { ascending: false });

        (studentAppts || []).forEach((a: any) => {
          apptVisits.push({
            id: a.id,
            visit_date: a.appointment_date,
            reason_category: 'routine_checkup',
            reason_subcategory: null,
            reason_notes: a.reason || null,
            diagnosis: null,
            prescription: null,
            follow_up_required: false,
            follow_up_date: null,
            medical_officers: a.medical_officers ? { name: a.medical_officers.name, designation: a.medical_officers.designation } : null,
          });
        });
      }

      const allVisits = [...healthVisits, ...apptVisits].sort(
        (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
      );

      setVisits(allVisits);
      setProfile(profileRes.data as StudentProfileData | null);
      setPrescriptions((prescriptionsRes.data as unknown as Prescription[]) || []);
      setLabReports((labReportsRes.data as unknown as LabReport[]) || []);
      setMedicalLeaves((medicalLeavesRes.data as unknown as MedicalLeaveRecord[]) || []);

      // Fetch approval workflows for these medical leave requests
      const leaveIds = ((medicalLeavesRes.data as any[]) || []).map((l) => l.id);
      if (leaveIds.length > 0) {
        const { data: wfRows } = await supabase
          .from('leave_approval_workflow')
          .select('*')
          .in('medical_leave_request_id', leaveIds);
        const map: Record<string, ApprovalWorkflowRow> = {};
        (wfRows || []).forEach((w: any) => { map[w.medical_leave_request_id] = w as ApprovalWorkflowRow; });
        setWorkflowsByLeave(map);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const refetchWorkflows = async () => {
    const leaveIds = medicalLeaves.map((l) => l.id);
    if (leaveIds.length === 0) return;
    const { data: wfRows } = await supabase
      .from('leave_approval_workflow')
      .select('*')
      .in('medical_leave_request_id', leaveIds);
    const map: Record<string, ApprovalWorkflowRow> = {};
    (wfRows || []).forEach((w: any) => { map[w.medical_leave_request_id] = w as ApprovalWorkflowRow; });
    setWorkflowsByLeave(map);
  };

  const formatReasonCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getReasonBadgeVariant = (category: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (category) {
      case 'medical_illness': return 'default';
      case 'injury': return 'destructive';
      case 'mental_wellness': return 'secondary';
      case 'vaccination': return 'outline';
      default: return 'secondary';
    }
  };

  const handlePrintPrescription = async (prescription: Prescription) => {
    const { printDocument, getNitwHeaderHtml } = await import('@/lib/print/printDocument');
    const items = prescription.prescription_items || [];
    const doctorName = (prescription.medical_officers as any)?.name || 'Health Centre Doctor';
    const doctorDesignation = (prescription.medical_officers as any)?.designation || 'Medical Officer';
    const prescriptionId = `RX-${prescription.id.slice(0, 8).toUpperCase()}`;

    const bodyHtml = `
      ${getNitwHeaderHtml('PRESCRIPTION')}
      <div class="ref-date">
        <span><strong>Patient:</strong> ${student?.full_name}</span>
        <span><strong>Date:</strong> ${format(new Date(prescription.created_at), 'PPP')}</span>
      </div>
      <div class="ref-date">
        <span><strong>Roll No:</strong> ${student?.roll_number}</span>
        <span><strong>Program:</strong> ${student?.program}${student?.branch ? ' - ' + student.branch : ''}</span>
      </div>
      ${prescription.diagnosis ? `<div class="section-title">Diagnosis</div><p style="font-size:13px;margin-bottom:12px;">${prescription.diagnosis}</p>` : ''}
      <div class="section-title">Prescribed Medicines</div>
      <table>
        <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Timing</th><th>Instructions</th></tr></thead>
        <tbody>${items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.medicine_name}</td><td>${item.dosage}</td><td>${item.frequency}</td><td>${item.duration}</td><td>${MEAL_LABELS[item.meal_timing || ''] || item.meal_timing || '-'}</td><td>${item.instructions || '-'}</td></tr>`).join('')}</tbody>
      </table>
      ${prescription.notes ? `<div class="notes-box"><strong>Doctor Notes:</strong> ${prescription.notes}</div>` : ''}
      <div class="signature-section">
        <div class="signature-box">
          <div class="emblem-area">
            <img src="/nitw-emblem.png" alt="NIT Warangal Official Emblem" />
            <p class="emblem-label">Official Emblem</p>
          </div>
        </div>
        <div class="signature-box" style="text-align:right;">
          <div class="online-signature">${doctorName}</div>
          <div class="signature-line">
            <strong>${doctorName}</strong><br/>
            ${doctorDesignation}<br/>
            <span class="doctor-type">Health Centre, NIT Warangal</span>
          </div>
        </div>
      </div>
    `;

    await printDocument({
      title: `Prescription - ${student?.full_name}`,
      bodyHtml,
      documentId: prescriptionId,
      documentType: 'Prescription',
    });
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Student Not Found</CardTitle>
            <CardDescription>No student found with roll number: {rollNumber}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isDoctor && !isMentor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>You don't have permission to view student health records.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Student Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt={student.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">{student?.full_name}</CardTitle>
                  <CardDescription className="text-lg">{student?.roll_number}</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-sm">
                {visits.length} Total Visits
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Program</p>
                  <p className="font-medium">{student?.program}{student?.branch ? ` - ${student.branch}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Batch</p>
                  <p className="font-medium">{student?.batch}{student?.year_of_study ? ` (Year ${student.year_of_study})` : ''}</p>
                </div>
              </div>
              {student?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-sm truncate max-w-[200px]">{student.email}</p>
                  </div>
                </div>
              )}
              {student?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{student.phone}</p>
                  </div>
                </div>
              )}
            </div>
            {student?.mentors && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Assigned Mentor</p>
                <p className="font-medium">{student.mentors.name} ({student.mentors.department})</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medical Profile Card - only for doctors */}
        {isDoctor && profile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-destructive" />
                Medical Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {profile.blood_group && (
                  <div className="p-3 rounded-lg bg-destructive/5 border text-center">
                    <Droplets className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Blood Group</p>
                    <p className="font-bold text-lg">{profile.blood_group}</p>
                  </div>
                )}
                {profile.covid_vaccination_status && (
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border text-center">
                    <p className="text-xs text-muted-foreground">COVID Vaccination</p>
                    <p className="font-medium">{profile.covid_vaccination_status}</p>
                  </div>
                )}
                {profile.emergency_contact && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border text-center">
                    <AlertCircle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium text-sm">{profile.emergency_contact}</p>
                    {profile.emergency_relationship && (
                      <p className="text-xs text-muted-foreground">({profile.emergency_relationship})</p>
                    )}
                  </div>
                )}
                <div className="p-3 rounded-lg bg-muted/50 border text-center">
                  <p className="text-xs text-muted-foreground">Health Issues</p>
                  <p className="font-medium">{profile.has_previous_health_issues ? 'Yes' : 'None Reported'}</p>
                </div>
              </div>
              {(profile.known_allergies || profile.current_medications || profile.previous_health_details) && (
                <div className="mt-4 space-y-3">
                  <Separator />
                  {profile.known_allergies && (
                    <div>
                      <p className="text-sm font-medium text-destructive">Known Allergies</p>
                      <p className="text-sm">{profile.known_allergies}</p>
                    </div>
                  )}
                  {profile.current_medications && (
                    <div>
                      <p className="text-sm font-medium text-primary">Current Medications</p>
                      <p className="text-sm">{profile.current_medications}</p>
                    </div>
                  )}
                  {profile.previous_health_details && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Previous Health Details</p>
                      <p className="text-sm">{profile.previous_health_details}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs for Visit History, Prescriptions, and Analysis */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Visits
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Prescriptions
            </TabsTrigger>
            <TabsTrigger value="labtests" className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Lab ({labReports.length})
            </TabsTrigger>
            <TabsTrigger value="medicalleave" className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              Leave ({medicalLeaves.length})
            </TabsTrigger>
            <TabsTrigger value="followups" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Follow-ups
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Health Visit History</CardTitle>
                <CardDescription>
                  {isDoctor ? 'Complete visit records' : 'Limited view - detailed clinical notes hidden'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {visits.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No visit records found</p>
                ) : (
                  <div className="space-y-4">
                    {visits.map((visit) => (
                      <div key={visit.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getReasonBadgeVariant(visit.reason_category)}>
                                {formatReasonCategory(visit.reason_category)}
                              </Badge>
                              {visit.reason_subcategory && (
                                <span className="text-sm text-muted-foreground">
                                  - {visit.reason_subcategory}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(visit.visit_date), 'MMMM d, yyyy - h:mm a')}
                            </p>
                          </div>
                          <div className="text-right">
                            {visit.medical_officers && (
                              <p className="text-sm font-medium">{visit.medical_officers.name}</p>
                            )}
                            {visit.follow_up_required && (
                              <Badge variant="outline" className="mt-1">
                                Follow-up: {visit.follow_up_date ? format(new Date(visit.follow_up_date), 'MMM d') : 'Required'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isDoctor && (
                          <>
                            {visit.reason_notes && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                                <p className="text-sm">{visit.reason_notes}</p>
                              </div>
                            )}
                            {visit.diagnosis && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Diagnosis</p>
                                <p className="text-sm">{visit.diagnosis}</p>
                              </div>
                            )}
                            {visit.prescription && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Prescription</p>
                                <p className="text-sm">{visit.prescription}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prescriptions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  Past Prescriptions
                </CardTitle>
                <CardDescription>
                  {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on record
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prescriptions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No prescriptions found</p>
                ) : (
                  <div className="space-y-5">
                    {prescriptions.map((rx) => (
                      <div key={rx.id} className="border rounded-lg overflow-hidden">
                        <div className="p-4 bg-muted/30 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              {format(new Date(rx.created_at), 'MMMM d, yyyy')}
                            </p>
                            {(rx.medical_officers as any)?.name && (
                              <p className="text-sm text-muted-foreground">
                                Dr. {(rx.medical_officers as any).name} — {(rx.medical_officers as any).designation}
                              </p>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handlePrintPrescription(rx)}>
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                        </div>
                        {rx.diagnosis && (
                          <div className="px-4 py-2 border-b bg-primary/5">
                            <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
                            <p className="text-sm font-medium">{rx.diagnosis}</p>
                          </div>
                        )}
                        {rx.prescription_items && rx.prescription_items.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/20">
                                  <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                                  <th className="text-left p-3 font-medium text-muted-foreground">Medicine</th>
                                  <th className="text-left p-3 font-medium text-muted-foreground">Dosage</th>
                                  <th className="text-left p-3 font-medium text-muted-foreground">Frequency</th>
                                  <th className="text-left p-3 font-medium text-muted-foreground">Duration</th>
                                  <th className="text-left p-3 font-medium text-muted-foreground">Timing</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rx.prescription_items.map((item, idx) => (
                                  <tr key={item.id} className="border-b last:border-0">
                                    <td className="p-3 text-muted-foreground">{idx + 1}</td>
                                    <td className="p-3 font-medium">{item.medicine_name}</td>
                                    <td className="p-3">{item.dosage}</td>
                                    <td className="p-3">{item.frequency}</td>
                                    <td className="p-3">{item.duration}</td>
                                    <td className="p-3">
                                      <Badge variant="outline" className="text-xs">
                                        {MEAL_LABELS[item.meal_timing || ''] || item.meal_timing || '-'}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {rx.notes && (
                          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-t">
                            <p className="text-xs font-medium text-muted-foreground">Doctor Notes</p>
                            <p className="text-sm">{rx.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labtests" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-primary" />
                  Lab Test Reports
                </CardTitle>
                <CardDescription>
                  {labReports.length} lab test{labReports.length !== 1 ? 's' : ''} on record
                </CardDescription>
              </CardHeader>
              <CardContent>
                {labReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No lab test reports found</p>
                ) : (
                  <div className="space-y-3">
                    {labReports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            report.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-amber-100 dark:bg-amber-900/20'
                          }`}>
                            {report.status === 'completed' ? (
                              <FileCheck className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{report.test_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {report.medical_officers ? `Dr. ${report.medical_officers.name}` : 'Doctor'} · {format(new Date(report.created_at), 'MMM d, yyyy')}
                            </p>
                            {report.notes && <p className="text-xs text-muted-foreground mt-0.5">{report.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                            {report.status === 'completed' ? 'Completed' : 'Pending'}
                          </Badge>
                          {report.status === 'completed' && report.report_file_url && (
                            <Button variant="outline" size="sm" onClick={() => setViewingLabReport(report)}>
                              <Eye className="w-4 h-4 mr-1" />
                              View Report
                            </Button>
                          )}
                          {report.status === 'completed' && !report.report_file_url && report.notes && (
                            <Button variant="outline" size="sm" onClick={() => {
                              toast.info(report.test_name, { description: 'Results available in text format (no PDF generated).' });
                            }}>
                              <FileText className="w-4 h-4 mr-1" />
                              View Results
                            </Button>
                          )}
                          {report.status === 'completed' && (
                            <Button variant="ghost" size="sm" onClick={async () => {
                              if (report.report_file_url) {
                                const ok = await printLabReport(report.report_file_url);
                                if (!ok) toast.error('Could not print report');
                              }
                            }}>
                              <Printer className="w-4 h-4 mr-1" />
                              Print
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lab Report Viewer Dialog */}
          {viewingLabReport && (
            <LabReportViewer
              open={!!viewingLabReport}
              onOpenChange={(open) => { if (!open) setViewingLabReport(null); }}
              title={`${viewingLabReport.test_name} — ${student?.full_name} (${student?.roll_number})`}
              reportFileUrl={viewingLabReport.report_file_url}
              fallbackNotes={viewingLabReport.notes}
              studentName={student?.full_name || ''}
              rollNumber={student?.roll_number || ''}
              doctorName={viewingLabReport.medical_officers?.name || ''}
              testDate={viewingLabReport.created_at}
            />
          )}

          <TabsContent value="medicalleave" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-destructive" />
                  Medical Leave History
                </CardTitle>
                <CardDescription>
                  {medicalLeaves.length} leave record{medicalLeaves.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {medicalLeaves.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No medical leave records found</p>
                ) : (
                  <div className="space-y-4">
                    {medicalLeaves.map((leave) => {
                      const isCleared = leave.doctor_clearance === true;
                      const isOverdue = leave.expected_return_date && parseISO(leave.expected_return_date) < new Date() && !isCleared && leave.status !== 'returned';
                      const overdueDays = isOverdue ? differenceInDays(new Date(), parseISO(leave.expected_return_date!)) : 0;
                      const leaveDays = leave.leave_start_date && leave.expected_return_date
                        ? differenceInDays(parseISO(leave.expected_return_date), parseISO(leave.leave_start_date))
                        : null;

                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case 'on_leave': return 'destructive' as const;
                          case 'return_pending': return 'secondary' as const;
                          case 'returned': return 'default' as const;
                          default: return 'outline' as const;
                        }
                      };

                      const getStatusLabel = (status: string) => {
                        switch (status) {
                          case 'doctor_referred': return 'Referred';
                          case 'student_form_pending': return 'Form Pending';
                          case 'on_leave': return 'On Leave';
                          case 'return_pending': return 'Return Pending';
                          case 'returned': return 'Returned';
                          case 'cancelled': return 'Cancelled';
                          default: return status;
                        }
                      };

                      return (
                        <div key={leave.id} className={`rounded-xl border p-4 space-y-3 transition-all ${isOverdue ? 'border-destructive/50 bg-destructive/5' : isCleared ? 'border-primary/30 bg-primary/5' : ''}`}>
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={getStatusColor(leave.status)}>
                                  {getStatusLabel(leave.status)}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {leave.health_priority || 'medium'}
                                </Badge>
                                {isOverdue && overdueDays > 0 && (
                                  <Badge 
                                    variant="destructive" 
                                    className={`flex items-center gap-1 ${isDoctor && doctorId ? 'cursor-pointer hover:bg-destructive/80 transition-colors' : ''}`}
                                    onClick={(e) => {
                                      if (isDoctor && doctorId) {
                                        e.stopPropagation();
                                        setClearanceDialogOpen(leave.id);
                                      }
                                    }}
                                    title={isDoctor ? 'Click to grant clearance' : undefined}
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    {overdueDays}d overdue
                                  </Badge>
                                )}
                                {isCleared && (
                                  <Badge className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1">
                                    <BadgeCheck className="h-3 w-3" />
                                    Cleared
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Referred on {format(new Date(leave.created_at), 'MMMM d, yyyy')}
                              </p>
                            </div>
                          </div>

                          {/* Details grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{leave.referral_hospital}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>{leave.leave_start_date ? format(parseISO(leave.leave_start_date), 'MMM d, yyyy') : '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>{leaveDays != null ? `${leaveDays} days` : leave.expected_duration}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>Return: {leave.expected_return_date ? format(parseISO(leave.expected_return_date), 'MMM d') : '—'}</span>
                            </div>
                          </div>

                          {/* Referring doctor */}
                          {leave.medical_officers && (
                            <p className="text-sm text-muted-foreground">
                              Referred by: <span className="font-medium text-foreground">{leave.medical_officers.name}</span>
                            </p>
                          )}

                          {/* Illness description */}
                          {leave.illness_description && (
                            <div className="p-2.5 rounded-lg bg-muted/50 text-sm">
                              <span className="font-medium">Reason:</span> {leave.illness_description}
                            </div>
                          )}

                          {/* Doctor notes */}
                          {leave.doctor_notes && (
                            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-sm">
                              <span className="font-medium flex items-center gap-1 mb-0.5">
                                <FileText className="h-3.5 w-3.5 text-primary" /> Doctor Note:
                              </span>
                              {leave.doctor_notes}
                            </div>
                          )}

                          {/* Clearance info */}
                          {isCleared && leave.doctor_clearance_date && (
                            <div className="flex items-center gap-2 text-sm text-primary pt-1 border-t">
                              <ShieldCheck className="h-4 w-4" />
                              <span className="font-medium">Cleared on {format(parseISO(leave.doctor_clearance_date), 'MMM d, yyyy')}</span>
                            </div>
                          )}

                          {/* Grant Clearance action for doctors */}
                          {isDoctor && doctorId && !isCleared && (leave.status === 'returned' || leave.status === 'on_leave' || leave.status === 'return_pending' || leave.status === 'student_form_pending' || leave.status === 'doctor_referred') && (
                            <Dialog open={clearanceDialogOpen === leave.id} onOpenChange={(open) => {
                              setClearanceDialogOpen(open ? leave.id : null);
                              if (!open) { setFitConfirmed(false); setClearanceNotes(''); }
                            }}>
                              <DialogTrigger asChild>
                                <Button size="sm" className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white">
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  Grant Fitness Clearance
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-green-600" />
                                    Grant Fitness Clearance
                                  </DialogTitle>
                                  <DialogDescription>
                                    Confirm that {student?.full_name} is fit to resume classes
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="text-sm space-y-2 p-3 rounded-lg bg-muted/50 border">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-muted-foreground" />
                                      <span>Hospital: <strong>{leave.referral_hospital}</strong></span>
                                    </div>
                                    {leave.illness_description && (
                                      <p className="text-muted-foreground">Reason: {leave.illness_description}</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                                      <span>Health Centre Visit: </span>
                                      {leave.health_centre_visited ? (
                                        <Badge className="bg-green-100 text-green-800 text-xs">✓ Visited</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-amber-700 text-xs">Not yet visited</Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium mb-1.5 block">Recovery Notes (optional)</label>
                                    <Textarea
                                      value={clearanceNotes}
                                      onChange={(e) => setClearanceNotes(e.target.value)}
                                      placeholder="Any notes about recovery, conditions, or follow-up needed..."
                                      className="h-20"
                                    />
                                  </div>

                                  <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30">
                                    <Checkbox
                                      id={`fit-confirm-${leave.id}`}
                                      checked={fitConfirmed}
                                      onCheckedChange={(v) => setFitConfirmed(v as boolean)}
                                    />
                                    <label htmlFor={`fit-confirm-${leave.id}`} className="text-sm leading-relaxed cursor-pointer">
                                      I confirm that <strong>{student?.full_name}</strong> has been examined and is{' '}
                                      <strong>fit to resume regular classes and academic activities</strong>.
                                    </label>
                                  </div>

                                  <Button
                                    onClick={() => handleGrantClearance(leave)}
                                    disabled={!fitConfirmed || clearanceLoading}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                  >
                                    {clearanceLoading ? 'Processing...' : (
                                      <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Issue Fitness Clearance
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="followups" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-primary" />
                  Follow-up Tracker
                </CardTitle>
                <CardDescription>
                  Visits requiring follow-up and their current status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Follow-ups from health visits
                  const visitFollowups = visits.filter(v => v.follow_up_required);
                  // Follow-ups from medical leaves (on_leave or returned)
                  const leaveFollowups = medicalLeaves.filter(l => l.status === 'on_leave' || l.status === 'returned');
                  
                  if (visitFollowups.length === 0 && leaveFollowups.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <CalendarClock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No follow-ups</h3>
                        <p className="text-sm text-muted-foreground mt-1">No pending or past follow-ups for this student</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {visitFollowups.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Visit Follow-ups ({visitFollowups.length})
                          </h4>
                          <div className="space-y-3">
                            {visitFollowups.map(v => (
                              <div key={v.id} className="p-3 rounded-lg border border-border bg-muted/30 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {v.reason_category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format(parseISO(v.visit_date), 'MMM d, yyyy')}
                                    </span>
                                  </div>
                                  {v.diagnosis && <p className="text-sm text-foreground">{v.diagnosis}</p>}
                                  {v.reason_notes && <p className="text-sm text-muted-foreground">{v.reason_notes}</p>}
                                  <p className="text-xs text-muted-foreground">
                                    By: {v.medical_officers?.name || 'Doctor'}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  {v.follow_up_date ? (
                                    <div className="space-y-1">
                                      <Badge variant={differenceInDays(parseISO(v.follow_up_date), new Date()) < 0 ? "destructive" : "outline"} className="text-xs">
                                        {differenceInDays(parseISO(v.follow_up_date), new Date()) < 0 ? 'Overdue' : 'Scheduled'}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground">{format(parseISO(v.follow_up_date), 'MMM d, yyyy')}</p>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">Pending</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {leaveFollowups.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <HeartPulse className="h-4 w-4" />
                            Medical Leave Follow-ups ({leaveFollowups.length})
                          </h4>
                          <div className="space-y-3">
                            {leaveFollowups.map(leave => (
                              <div key={leave.id} className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium text-foreground">{leave.referral_hospital}</span>
                                    </div>
                                    {leave.illness_description && (
                                      <p className="text-sm text-muted-foreground">{leave.illness_description}</p>
                                    )}
                                    {leave.doctor_notes && (
                                      <p className="text-xs text-muted-foreground">Notes: {leave.doctor_notes}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      By: {leave.medical_officers?.name || 'Doctor'} • {format(parseISO(leave.created_at), 'MMM d, yyyy')}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0 space-y-1">
                                    <Badge variant={leave.status === 'on_leave' ? 'default' : 'secondary'} className="text-xs">
                                      {leave.status === 'on_leave' ? 'On Leave' : 'Returned'}
                                    </Badge>
                                    {leave.expected_return_date && (
                                      <p className="text-xs text-muted-foreground">
                                        Expected: {format(parseISO(leave.expected_return_date), 'MMM d')}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Grant Clearance for doctors */}
                                {isDoctor && doctorId && !leave.doctor_clearance && (
                                  <Dialog open={clearanceDialogOpen === `followup-${leave.id}`} onOpenChange={(open) => {
                                    setClearanceDialogOpen(open ? `followup-${leave.id}` : null);
                                    if (!open) { setFitConfirmed(false); setClearanceNotes(''); }
                                  }}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        Grant Fitness Clearance
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <ShieldCheck className="h-5 w-5 text-green-600" />
                                          Grant Fitness Clearance
                                        </DialogTitle>
                                        <DialogDescription>
                                          Confirm that {student?.full_name} is fit to resume classes
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="text-sm space-y-2 p-3 rounded-lg bg-muted/50 border">
                                          <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            <span>Hospital: <strong>{leave.referral_hospital}</strong></span>
                                          </div>
                                          {leave.illness_description && (
                                            <p className="text-muted-foreground">Reason: {leave.illness_description}</p>
                                          )}
                                        </div>

                                        <div>
                                          <label className="text-sm font-medium mb-1.5 block">Recovery Notes (optional)</label>
                                          <Textarea
                                            value={clearanceNotes}
                                            onChange={(e) => setClearanceNotes(e.target.value)}
                                            placeholder="Any notes about recovery..."
                                            className="h-20"
                                          />
                                        </div>

                                        <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30">
                                          <Checkbox
                                            id={`fit-followup-${leave.id}`}
                                            checked={fitConfirmed}
                                            onCheckedChange={(v) => setFitConfirmed(v as boolean)}
                                          />
                                          <label htmlFor={`fit-followup-${leave.id}`} className="text-sm leading-relaxed cursor-pointer">
                                            I confirm that <strong>{student?.full_name}</strong> is{' '}
                                            <strong>fit to resume regular classes</strong>.
                                          </label>
                                        </div>

                                        <Button
                                          onClick={() => handleGrantClearance(leave)}
                                          disabled={!fitConfirmed || clearanceLoading}
                                          className="w-full bg-green-600 hover:bg-green-700"
                                        >
                                          {clearanceLoading ? 'Processing...' : (
                                            <>
                                              <CheckCircle2 className="h-4 w-4 mr-2" />
                                              Issue Fitness Clearance
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}

                                {leave.doctor_clearance && leave.doctor_clearance_date && (
                                  <div className="flex items-center gap-2 text-sm text-primary pt-1 border-t">
                                    <ShieldCheck className="h-4 w-4" />
                                    <span className="font-medium">Cleared on {format(parseISO(leave.doctor_clearance_date), 'MMM d, yyyy')}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="mt-6">
            <VisitPatternAnalysis visits={visits} studentName={student?.full_name || ''} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentProfile;
