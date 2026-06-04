import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import QuickBookCard from "@/components/appointments/QuickBookCard";
import StudentDataSyncBanner from "@/components/student/StudentDataSyncBanner";
import {
  Calendar,
  ClipboardList,
  FileText,
  Heart,
  Stethoscope,
  Activity,
  ArrowRight,
  Clock,
  AlertTriangle,
  Pill,
  User,
  Phone,
  Shield,
  Ambulance,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";

const StudentHomeDashboard = () => {
  const { user } = useUserRole();
  const navigate = useNavigate();

  // Fetch student basic info
  const { data: student } = useQuery({
    queryKey: ["student-home-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("students")
        .select("id, full_name, roll_number, program, branch, batch, year_of_study, mentor_name, mentor_contact")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch upcoming appointments
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["student-home-appointments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, reason, status, doctor_type, medical_officers(name, designation), visiting_doctors(name, specialization)")
        .eq("patient_id", user.id)
        .gte("appointment_date", today)
        .in("status", ["pending", "confirmed"])
        .order("appointment_date", { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["student-home-stats", student?.id],
    queryFn: async () => {
      if (!student) return null;

      const [healthVisitsRes, completedAppointmentsRes, upcomingAppointmentsRes, leavesRes, prescriptionsRes] = await Promise.all([
        supabase.from("health_visits").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", user!.id).eq("status", "completed"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", user!.id).in("status", ["pending", "confirmed"]).gte("appointment_date", new Date().toISOString().split("T")[0]),
        supabase.from("medical_leave_requests").select("id", { count: "exact", head: true }).eq("student_id", student.id).in("status", ["doctor_referred", "student_form_pending", "on_leave", "return_pending"]),
        supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("student_id", student.id),
      ]);

      // Total visits = health_visits + completed appointments (to match HealthDashboard logic)
      const totalVisits = (healthVisitsRes.count || 0) + (completedAppointmentsRes.count || 0);

      return {
        totalVisits,
        upcomingAppointments: upcomingAppointmentsRes.count || 0,
        activeLeaves: leavesRes.count || 0,
        totalPrescriptions: prescriptionsRes.count || 0,
      };
    },
    enabled: !!student && !!user,
  });

  // Fetch active medical leave alerts
  const { data: activeLeave } = useQuery({
    queryKey: ["student-home-leave", student?.id],
    queryFn: async () => {
      if (!student) return null;
      const { data } = await supabase
        .from("medical_leave_requests")
        .select("id, status, referral_hospital, expected_return_date, leave_start_date")
        .eq("student_id", student.id)
        .in("status", ["doctor_referred", "student_form_pending", "on_leave", "return_pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!student,
  });

  // Fetch recent visit
  const { data: recentVisit } = useQuery({
    queryKey: ["student-home-recent-visit", student?.id],
    queryFn: async () => {
      if (!student) return null;
      const { data } = await supabase
        .from("health_visits")
        .select("id, visit_date, reason_category, diagnosis, follow_up_required, follow_up_date")
        .eq("student_id", student.id)
        .order("visit_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!student,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const formatAppointmentDate = (date: string) => {
    if (isToday(new Date(date))) return "Today";
    if (isTomorrow(new Date(date))) return "Tomorrow";
    return format(new Date(date), "dd MMM");
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${minutes} ${ampm}`;
  };

  const getLeaveStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      doctor_referred: "Referred by Doctor",
      student_form_pending: "Form Pending",
      on_leave: "On Leave",
      return_pending: "Return Pending",
    };
    return map[status] || status;
  };

  const firstName = student?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Student";

  return (
    <div className="py-8">
      <div className="container mx-auto px-4 max-w-6xl space-y-8">
        {/* Greeting Section */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {getGreeting()}, {firstName} 👋
          </h1>
          {student && (
            <p className="text-muted-foreground text-lg">
              {student.roll_number} • {student.program} {student.branch ? `(${student.branch})` : ""} • Batch {student.batch}
            </p>
          )}
        </div>

        {/* Alert Banners */}
        {student && (
          <StudentDataSyncBanner rollNumberHint={student.roll_number} compact />
        )}
        {activeLeave && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="p-2 rounded-full bg-warning/10">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Active Medical Leave — {getLeaveStatusLabel(activeLeave.status)}</p>
                <p className="text-sm text-muted-foreground">
                  {activeLeave.referral_hospital}
                  {activeLeave.expected_return_date && ` • Expected return: ${format(new Date(activeLeave.expected_return_date), "dd MMM yyyy")}`}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/medical-leave">
                  View Details
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {recentVisit?.follow_up_required && recentVisit.follow_up_date && !isPast(new Date(recentVisit.follow_up_date)) && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Follow-up Appointment Needed</p>
                <p className="text-sm text-muted-foreground">
                  Scheduled for {format(new Date(recentVisit.follow_up_date), "dd MMM yyyy")} — {recentVisit.diagnosis || recentVisit.reason_category}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/appointments">
                  Book Now
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/my-appointments')}>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.upcomingAppointments ?? 0}</p>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/student/profile?tab=records')}>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-secondary/10 flex items-center justify-center mb-3">
                <Activity className="w-6 h-6 text-secondary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.totalVisits ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Visits</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/student/profile?tab=records&subtab=prescriptions')}>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent/50 flex items-center justify-center mb-3">
                <Pill className="w-6 h-6 text-accent-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.totalPrescriptions ?? 0}</p>
              <p className="text-sm text-muted-foreground">Prescriptions</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/medical-leave')}>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-warning" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.activeLeaves ?? 0}</p>
              <p className="text-sm text-muted-foreground">Active Leaves</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-auto py-6 flex-col gap-3 hover:bg-primary/5 hover:border-primary/30">
              <Link to="/appointments">
                <Calendar className="w-7 h-7 text-primary" />
                <span className="text-sm font-medium">Book Appointment</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-6 flex-col gap-3 hover:bg-primary/5 hover:border-primary/30">
              <Link to="/health-dashboard">
                <ClipboardList className="w-7 h-7 text-primary" />
                <span className="text-sm font-medium">My Dashboard</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-6 flex-col gap-3 hover:bg-primary/5 hover:border-primary/30">
              <Link to="/student/profile?tab=records">
                <Heart className="w-7 h-7 text-primary" />
                <span className="text-sm font-medium">Health Records</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-6 flex-col gap-3 hover:bg-primary/5 hover:border-primary/30">
              <Link to="/medical-team">
                <Stethoscope className="w-7 h-7 text-primary" />
                <span className="text-sm font-medium">Medical Team</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Book Appointment */}
        <QuickBookCard />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/my-appointments" className="text-primary">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No upcoming appointments</p>
                  <Button asChild variant="link" size="sm" className="mt-2">
                    <Link to="/appointments">Book one now</Link>
                  </Button>
                </div>
              ) : (
                upcomingAppointments.map((apt) => {
                  const doctorName = apt.doctor_type === "visiting" 
                    ? (apt.visiting_doctors as any)?.name 
                    : (apt.medical_officers as any)?.name;
                  const doctorLabel = apt.doctor_type === "visiting"
                    ? (apt.visiting_doctors as any)?.specialization
                    : (apt.medical_officers as any)?.designation;
                  return (
                    <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="text-center min-w-[50px]">
                        <p className="text-xs text-muted-foreground">{formatAppointmentDate(apt.appointment_date)}</p>
                        <p className="text-sm font-semibold text-primary">{formatTime(apt.appointment_time)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{apt.reason || "General Consultation"}</p>
                        <p className="text-xs text-muted-foreground">{doctorName || doctorLabel || apt.doctor_type?.replace("_", " ")}</p>
                      </div>
                      <Badge variant={apt.status === "confirmed" ? "default" : "secondary"} className="shrink-0">
                        {apt.status}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Health Info & Emergency */}
          <div className="space-y-6">
            {/* Mentor Info */}
            {student?.mentor_name && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Your Mentor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{student.mentor_name}</p>
                      {student.mentor_contact && (
                        <a href={`tel:${student.mentor_contact}`} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary">
                          <Phone className="w-3 h-3" />
                          {student.mentor_contact}
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Emergency Card */}
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <Ambulance className="w-5 h-5" />
                  Emergency Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  24/7 ambulance service available on campus
                </p>
                <div className="flex gap-3">
                  <Button asChild variant="destructive" size="sm" className="gap-2">
                    <a href="tel:+918702462087">
                      <Phone className="w-4 h-4" />
                      Call Emergency
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to="/medical-team">
                      <Stethoscope className="w-4 h-4" />
                      Contact Doctor
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Health Centre Info Bar */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-center gap-8 text-center text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <span className="font-medium">Working Days:</span>{" "}
                  <span className="text-muted-foreground">8:00 AM - 1:00 PM & 3:00 PM - 8:00 PM</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <span className="font-medium">Weekends:</span>{" "}
                  <span className="text-muted-foreground">9:00 AM - 1:00 PM</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">ABHA Integrated</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentHomeDashboard;
