import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Building2, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Eye, FileText, Home, Printer, ShieldCheck, Stethoscope, User } from "lucide-react";
import DoctorReferralForm from "@/components/medical-leave/DoctorReferralForm";
import StudentLeaveForm from "@/components/medical-leave/StudentLeaveForm";
import ReturnNotificationForm from "@/components/medical-leave/ReturnNotificationForm";
import LeaveStatusCard from "@/components/medical-leave/LeaveStatusCard";
import PrintableLeaveLetter from "@/components/medical-leave/PrintableLeaveLetter";
import LeaveStatusTimeline from "@/components/medical-leave/LeaveStatusTimeline";
import ReferralDetailsCard from "@/components/medical-leave/ReferralDetailsCard";
import DoctorClearanceCard from "@/components/medical-leave/DoctorClearanceCard";
import PastLeaveDetailDialog from "@/components/medical-leave/PastLeaveDetailDialog";
import MedicalLeaveStudentsOverview from "@/components/medical-leave/MedicalLeaveStudentsOverview";
import { format } from "date-fns";

type MedicalLeaveStatus = "doctor_referred" | "student_form_pending" | "on_leave" | "return_pending" | "returned" | "cancelled";

interface LeaveRequest {
  id: string;
  student_id: string;
  referring_doctor_id: string | null;
  referral_date: string;
  referral_hospital: string;
  expected_duration: string;
  rest_days: number | null;
  doctor_notes: string | null;
  illness_description: string | null;
  leave_start_date: string | null;
  expected_return_date: string | null;
  accompanist_type: string | null;
  accompanist_name: string | null;
  accompanist_contact: string | null;
  accompanist_relationship: string | null;
  student_form_submitted_at: string | null;
  actual_return_date: string | null;
  hospital_discharge_date: string | null;
  follow_up_notes: string | null;
  return_submitted_at: string | null;
  academic_leave_approved: boolean | null;
  approved_by_doctor_id: string | null;
  approval_date: string | null;
  health_priority: string | null;
  status: MedicalLeaveStatus;
  health_centre_visited: boolean | null;
  doctor_clearance: boolean | null;
  doctor_clearance_date: string | null;
  cleared_by_doctor_id: string | null;
  created_at: string;
  updated_at: string;
  students?: {
    full_name: string;
    roll_number: string;
    program: string;
    mentor_name?: string | null;
    mentor_email?: string | null;
    mentor_contact?: string | null;
    year_of_study?: string | null;
    branch?: string | null;
  } | null;
  medical_officers?: {
    name: string;
    designation?: string;
    qualification?: string;
    is_senior?: boolean;
  } | null;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "student_form_pending":
      return <Badge variant="outline" className="bg-amber-100 text-amber-800">Form Pending</Badge>;
    case "on_leave":
      return <Badge variant="outline" className="bg-blue-100 text-blue-800">On Leave</Badge>;
    case "return_pending":
      return <Badge variant="outline" className="bg-purple-100 text-purple-800">Return Pending</Badge>;
    case "returned":
      return <Badge variant="outline" className="bg-green-100 text-green-800">Returned</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const MedicalLeave = () => {
  const { user, isDoctor, isStudent, isMentor, isAdmin, isMedicalStaff, loading: roleLoading, doctorId } = useUserRole();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("requests");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showLeaveLetter, setShowLeaveLetter] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedPastLeave, setSelectedPastLeave] = useState<any>(null);

  // Fetch student profile for leave letter
  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile-for-leave", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, roll_number, program, branch, batch, year_of_study, mentor_name, mentor_email, mentor_contact")
        .eq("user_id", user!.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isStudent && !!user,
  });

  // Fetch student's current leave request
  const { data: studentLeaveRequest, isLoading: studentLeaveLoading } = useQuery({
    queryKey: ["student-leave-status", user?.id],
    queryFn: async () => {
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!studentData) return null;

      const { data, error } = await supabase
        .from("medical_leave_requests")
        .select(`
          *,
          medical_officers!referring_doctor_id(name, designation, qualification, is_senior)
        `)
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LeaveRequest | null;
    },
    enabled: isStudent && !!user,
  });

  // Fetch past leave history for student
  const { data: pastLeaveRequests, isLoading: pastLeaveLoading } = useQuery({
    queryKey: ["student-past-leaves", user?.id],
    queryFn: async () => {
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!studentData) return [];

      const { data, error } = await supabase
        .from("medical_leave_requests")
        .select(`
          *,
          medical_officers!referring_doctor_id(name, designation, qualification)
        `)
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isStudent && !!user,
  });

  // Fetch all leave requests for doctors/mentors/admins
  const { data: allLeaveRequests, isLoading: allLeaveLoading } = useQuery({
    queryKey: ["medical-leave-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_leave_requests")
        .select(`
          *,
          students(full_name, roll_number, program, mentor_name, mentor_email, mentor_contact, year_of_study, branch),
          medical_officers!referring_doctor_id(name, designation, qualification, is_senior)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as LeaveRequest[];
    },
    enabled: (isDoctor || isMentor || isAdmin || isMedicalStaff) && !!user,
  });

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate("/auth");
    }
  }, [user, roleLoading, navigate]);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const pendingFormRequest = studentLeaveRequest?.status === "student_form_pending" ? studentLeaveRequest : null;
  const activeLeaveRequest = studentLeaveRequest && ["on_leave", "return_pending"].includes(studentLeaveRequest.status) 
    ? studentLeaveRequest : null;
  const returnedLeaveRequest = studentLeaveRequest?.status === "returned" ? studentLeaveRequest : null;

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Medical Leave Management</h1>
            <p className="text-muted-foreground mt-1">
              {isDoctor && "Refer students for external treatment and track leave requests"}
              {!isDoctor && isStudent && "Track and manage your off-campus medical leave"}
              {!isDoctor && !isStudent && isMentor && "Monitor your mentees' medical leave status"}
              {isMedicalStaff && !isDoctor && "View and manage all medical leave records"}
              {isAdmin && !isDoctor && !isMedicalStaff && "Oversee all medical leave requests"}
            </p>
          </div>
        </div>

        {/* Student View - only show for pure students, not doctors */}
        {isStudent && !isDoctor && (
          <div className="space-y-6">
            {/* Show Leave Letter */}
            {showLeaveLetter && studentLeaveRequest && studentProfile && (
              <PrintableLeaveLetter
                leaveData={{
                  id: studentLeaveRequest.id,
                  studentName: studentProfile.full_name,
                  rollNumber: studentProfile.roll_number,
                  program: studentProfile.program,
                  branch: studentProfile.branch,
                  batch: studentProfile.batch,
                  referralHospital: studentLeaveRequest.referral_hospital,
                  illnessDescription: studentLeaveRequest.illness_description,
                  doctorName: studentLeaveRequest.medical_officers?.name,
                  doctorDetails: studentLeaveRequest.medical_officers ? {
                    name: studentLeaveRequest.medical_officers.name,
                    designation: studentLeaveRequest.medical_officers.designation,
                    qualification: studentLeaveRequest.medical_officers.qualification,
                    isSenior: studentLeaveRequest.medical_officers.is_senior,
                  } : null,
                  mentorDetails: studentProfile.mentor_name ? {
                    name: studentProfile.mentor_name,
                    email: studentProfile.mentor_email,
                    phone: studentProfile.mentor_contact,
                    department: studentProfile.branch || undefined,
                  } : null,
                  academicDetails: {
                    yearOfStudy: studentProfile.year_of_study || undefined,
                    hodDepartment: studentProfile.branch || undefined,
                  },
                  referralDate: studentLeaveRequest.referral_date,
                  leaveStartDate: studentLeaveRequest.leave_start_date,
                  expectedReturnDate: studentLeaveRequest.expected_return_date,
                  restDays: studentLeaveRequest.rest_days,
                  doctorNotes: studentLeaveRequest.doctor_notes,
                  approvalDate: studentLeaveRequest.approval_date,
                  status: studentLeaveRequest.status,
                }}
                onClose={() => setShowLeaveLetter(false)}
              />
            )}

            {/* Main Content */}
            {!showLeaveLetter && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Card & Timeline */}
                <div className="lg:col-span-1 space-y-4">
                  <LeaveStatusCard
                    leaveRequest={studentLeaveRequest}
                    onFillForm={() => setShowLeaveForm(true)}
                    onSubmitReturn={() => setShowReturnForm(true)}
                  />
                  
                  {/* Timeline for active leave requests */}
                  {studentLeaveRequest && (
                    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                      <CardContent className="pt-6">
                        <LeaveStatusTimeline leaveRequest={studentLeaveRequest} />
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* View Leave Letter Button */}
                  {studentLeaveRequest && ["on_leave", "return_pending", "returned"].includes(studentLeaveRequest.status) && (
                    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                      <CardContent className="pt-4 pb-4">
                        <Button 
                          onClick={() => setShowLeaveLetter(true)}
                          variant="outline"
                          className="w-full flex items-center gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          View & Print Leave Letter
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Download official leave certificate for academic departments
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Forms Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Referral Details Card - Show when form pending */}
                  {pendingFormRequest && !showReturnForm && (
                    <>
                      <ReferralDetailsCard 
                        leaveRequest={pendingFormRequest} 
                        studentProfile={studentProfile}
                      />
                      <StudentLeaveForm
                        leaveRequest={pendingFormRequest}
                        onSuccess={() => setShowLeaveForm(false)}
                      />
                    </>
                  )}

                  {/* Return Notification Form */}
                  {activeLeaveRequest && showReturnForm && (
                    <ReturnNotificationForm
                      leaveRequest={activeLeaveRequest}
                      onSuccess={() => setShowReturnForm(false)}
                    />
                  )}

                   {/* No Active Leave */}
                  {!pendingFormRequest && !activeLeaveRequest && !returnedLeaveRequest && (
                    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                      <CardContent className="pt-12 pb-12 text-center">
                        <Home className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-xl font-semibold mb-2">No Active Leave Request</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          You don't have any pending medical leave requests. If you need off-campus 
                          treatment, please visit the campus medical center for evaluation.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Returned - Health Centre Visit & Doctor Clearance */}
                  {returnedLeaveRequest && !returnedLeaveRequest.doctor_clearance && (
                    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                      <CardHeader className="border-b bg-gradient-to-r from-green-500/5 to-green-500/10">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-500/10">
                            <ShieldCheck className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">Post-Treatment Follow-up</CardTitle>
                            <CardDescription>
                              Complete your return process
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        {!returnedLeaveRequest.health_centre_visited ? (
                          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                            <Stethoscope className="h-4 w-4" />
                            <AlertTitle>Health Centre Visit Required</AlertTitle>
                            <AlertDescription>
                              You must visit the campus health centre for a post-treatment checkup. 
                              The doctor will examine you and issue fitness clearance for resuming classes.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert className="bg-green-50 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Health Centre Visit Completed</AlertTitle>
                            <AlertDescription className="text-green-700">
                              Awaiting doctor's fitness clearance to resume classes.
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <p><strong>Hospital:</strong> {returnedLeaveRequest.referral_hospital}</p>
                          <p><strong>Treatment:</strong> {returnedLeaveRequest.illness_description || "Medical treatment"}</p>
                          {returnedLeaveRequest.actual_return_date && (
                            <p><strong>Returned:</strong> {format(new Date(returnedLeaveRequest.actual_return_date), "PPp")}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* On Leave Status */}
                  {activeLeaveRequest && !showReturnForm && (
                    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">Currently On Leave</CardTitle>
                            <CardDescription>
                              You are on off-campus medical leave
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <Alert className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Return Notification Required</AlertTitle>
                          <AlertDescription>
                            When you return to the hostel, please submit the return notification 
                            within 2 hours of arrival.
                          </AlertDescription>
                        </Alert>
                        <div className="flex gap-3">
                          <Button 
                            onClick={() => setShowReturnForm(true)} 
                            className="flex-1"
                            variant="default"
                          >
                            <Home className="h-4 w-4 mr-2" />
                            Submit Return Notification
                          </Button>
                          <Button 
                            onClick={() => setShowLeaveLetter(true)}
                            variant="outline"
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Print Letter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Past Medical Leave History */}
            {!showLeaveLetter && (
              <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Past Medical Leave History
                  </CardTitle>
                  <CardDescription>Your previous medical leave records</CardDescription>
                </CardHeader>
                <CardContent>
                  {pastLeaveLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : !pastLeaveRequests || pastLeaveRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No medical leave records found</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Hospital</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Leave Period</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pastLeaveRequests.map((item) => (
                            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedPastLeave(item)}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.referral_hospital}</p>
                                  {(item as any).medical_officers?.name && (
                                    <p className="text-xs text-muted-foreground">
                                      {(item as any).medical_officers.name}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{item.illness_description || "Medical treatment"}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {item.leave_start_date ? (
                                    <>
                                      <p>{format(new Date(item.leave_start_date), "PP")}</p>
                                      <p className="text-muted-foreground">
                                        to {item.actual_return_date 
                                          ? format(new Date(item.actual_return_date), "PP")
                                          : item.expected_return_date
                                          ? format(new Date(item.expected_return_date), "PP")
                                          : "TBD"}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-muted-foreground">
                                      Referred {item.referral_date ? format(new Date(item.referral_date), "PP") : "—"}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{item.expected_duration}</TableCell>
                              <TableCell>
                                {item.doctor_clearance ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Cleared
                                  </Badge>
                                ) : (
                                  getStatusBadge(item.status)
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Past Leave Detail Dialog */}
            <PastLeaveDetailDialog
              open={!!selectedPastLeave}
              onOpenChange={(open) => !open && setSelectedPastLeave(null)}
              leaveRequest={selectedPastLeave}
            />
          </div>
        )}

        {/* Doctor View */}
        {isDoctor && (
          <>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="referral" className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                New Referral
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                My Referrals
              </TabsTrigger>
            </TabsList>

            <TabsContent value="referral">
              <div className="max-w-2xl">
                <DoctorReferralForm />
              </div>
            </TabsContent>

            <TabsContent value="requests">
              <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
                <CardHeader>
                  <CardTitle>My Referrals</CardTitle>
                  <CardDescription>
                    Students you have referred for off-campus treatment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {allLeaveLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : allLeaveRequests?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No referrals yet</p>
                    </div>
                  ) : (() => {
                    // Group referrals by student (roll_number)
                    const grouped = new Map<string, { student: LeaveRequest['students']; requests: LeaveRequest[] }>();
                    (allLeaveRequests || []).forEach((req) => {
                      const key = req.students?.roll_number || req.student_id;
                      if (!grouped.has(key)) {
                        grouped.set(key, { student: req.students, requests: [] });
                      }
                      grouped.get(key)!.requests.push(req);
                    });
                    const sortedGroups = Array.from(grouped.entries()).sort((a, b) =>
                      (a[1].student?.full_name || '').localeCompare(b[1].student?.full_name || '')
                    );

                    return (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8"></TableHead>
                              <TableHead>Student</TableHead>
                              <TableHead>Total Referrals</TableHead>
                              <TableHead>Latest Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedGroups.map(([key, group]) => {
                              const latestRequest = group.requests[0];
                              const isExpanded = expandedRows.has(key);
                              return (
                                <>
                                  <TableRow
                                    key={key}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => {
                                      setExpandedRows(prev => {
                                        const next = new Set(prev);
                                        if (next.has(key)) next.delete(key);
                                        else next.add(key);
                                        return next;
                                      });
                                    }}
                                  >
                                    <TableCell className="p-2">
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div>
                                        <button
                                          className="font-medium text-primary hover:underline text-left"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (group.student?.roll_number) {
                                              navigate(`/student-profile/${group.student.roll_number}`);
                                            }
                                          }}
                                        >
                                          {group.student?.full_name}
                                        </button>
                                        <p className="text-sm text-muted-foreground">
                                          {group.student?.roll_number}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{group.requests.length} referral{group.requests.length > 1 ? 's' : ''}</Badge>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(latestRequest.status)}</TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow key={`${key}-details`}>
                                      <TableCell colSpan={4} className="bg-muted/30 p-0">
                                        <div className="p-4 space-y-3">
                                          {group.requests.map((request) => (
                                            <div key={request.id} className="border rounded-lg p-3 bg-background space-y-2">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                                  <span className="font-medium text-sm">{request.referral_hospital}</span>
                                                  <span className="text-sm text-muted-foreground">
                                                    {format(new Date(request.referral_date), "PP")}
                                                  </span>
                                                </div>
                                                {getStatusBadge(request.status)}
                                              </div>
                                              <LeaveStatusTimeline leaveRequest={request} />
                                              {request.status === "returned" && !request.doctor_clearance && (
                                                <DoctorClearanceCard
                                                  leaveRequest={{
                                                    ...request,
                                                    health_centre_visited: (request as any).health_centre_visited ?? false,
                                                    doctor_clearance: (request as any).doctor_clearance ?? false,
                                                  }}
                                                  doctorId={request.referring_doctor_id || ""}
                                                />
                                              )}
                                              {(request as any).doctor_clearance && (
                                                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                                                  <ShieldCheck className="h-4 w-4" />
                                                  <span className="text-sm font-medium">Student cleared for classes</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Medical Leave Students Overview with real data */}
          <MedicalLeaveStudentsOverview doctorId={doctorId} />
          </>
        )}

        {/* Mentor/Admin/Medical Staff View */}
        {(isMentor || isAdmin || isMedicalStaff) && !isDoctor && (
          <>
          {/* Medical Leave Students Overview */}
          <MedicalLeaveStudentsOverview doctorId={null} />
          <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {isMentor ? "Mentee Leave Requests" : "All Leave Requests"}
              </CardTitle>
              <CardDescription>
                {isMentor 
                  ? "Medical leave status of your assigned students"
                  : "Overview of all medical leave requests in the system"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allLeaveLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : allLeaveRequests?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No leave requests found</p>
                  <p className="text-sm">All students are currently on campus</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Hospital</TableHead>
                        <TableHead>Referred By</TableHead>
                        <TableHead>Leave Period</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allLeaveRequests?.map((request) => (
                        <>
                          <TableRow 
                            key={request.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleRowExpanded(request.id)}
                          >
                            <TableCell className="p-2">
                              {expandedRows.has(request.id) ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{request.students?.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {request.students?.roll_number} • {request.students?.program}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{request.referral_hospital}</p>
                                {request.illness_description && (
                                  <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                                    {request.illness_description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{request.medical_officers?.name || "—"}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(request.referral_date), "PP")}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {request.leave_start_date ? (
                                <div className="text-sm">
                                  <p>{format(new Date(request.leave_start_date), "PP")}</p>
                                  <p className="text-muted-foreground">
                                    to {request.expected_return_date 
                                      ? format(new Date(request.expected_return_date), "PP")
                                      : "TBD"}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                          </TableRow>
                          {expandedRows.has(request.id) && (
                            <TableRow key={`${request.id}-timeline`}>
                              <TableCell colSpan={6} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <LeaveStatusTimeline leaveRequest={request} />
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                      Additional Details
                                    </h4>
                                    {request.accompanist_name && (
                                      <div className="text-sm">
                                        <p className="font-medium">Accompanist</p>
                                        <p className="text-muted-foreground">
                                          {request.accompanist_name} ({request.accompanist_relationship})
                                        </p>
                                        {request.accompanist_contact && (
                                          <p className="text-muted-foreground">
                                            Contact: {request.accompanist_contact}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {request.doctor_notes && (
                                      <div className="text-sm">
                                        <p className="font-medium">Doctor's Notes</p>
                                        <p className="text-muted-foreground">{request.doctor_notes}</p>
                                      </div>
                                    )}
                                    {request.rest_days && (
                                      <div className="text-sm">
                                        <p className="font-medium">Approved Rest Days</p>
                                        <p className="text-muted-foreground">{request.rest_days} days</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default MedicalLeave;
