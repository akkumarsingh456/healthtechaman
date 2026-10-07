import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { format, startOfDay, isAfter } from "date-fns";
import { useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  ClipboardCheck,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building,
  Activity,
  Stethoscope,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function MedicalStaffHomeDashboard() {
  const navigate = useNavigate();
  const { user } = useUserRole();
  const queryClient = useQueryClient();

  const todayStart = startOfDay(new Date());

  // Fetch active medical leave requests
  const { data: leaveRequests, isLoading: loadingLeaves } = useQuery({
    queryKey: ["staff-home-leaves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_leave_requests")
        .select("id, status, referral_hospital, health_priority, created_at, expected_duration, student_id")
        .in("status", ["doctor_referred", "student_form_pending", "on_leave", "return_pending"])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch total students count
  const { data: studentsCount, isLoading: loadingStudents } = useQuery({
    queryKey: ["staff-home-students-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Fetch today's appointments count
  const { data: todayAppointments, isLoading: loadingAppts } = useQuery({
    queryKey: ["staff-home-today-appointments"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("appointment_date", today);
      return data || [];
    },
  });

  // Fetch medical officers
  const { data: doctors, isLoading: loadingDoctors } = useQuery({
    queryKey: ["staff-home-doctors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_officers")
        .select("id, name, designation, is_senior");
      return data || [];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const leaveChannel = supabase
      .channel("staff-home-leaves-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medical_leave_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["staff-home-leaves"] });
        }
      )
      .subscribe();

    const apptChannel = supabase
      .channel("staff-home-appts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["staff-home-today-appointments"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(apptChannel);
    };
  }, [queryClient]);

  const isLoading = loadingLeaves || loadingStudents || loadingAppts || loadingDoctors;

  const allLeaves = leaveRequests || [];
  const onLeaveCount = allLeaves.filter(l => l.status === "on_leave").length;
  const pendingFormsCount = allLeaves.filter(l => l.status === "student_form_pending").length;
  const returnPendingCount = allLeaves.filter(l => l.status === "return_pending").length;
  const doctorReferredCount = allLeaves.filter(l => l.status === "doctor_referred").length;
  const todayLeaves = allLeaves.filter(l => isAfter(new Date(l.created_at), todayStart));

  const allAppointments = todayAppointments || [];
  const pendingAppts = allAppointments.filter(a => a.status === "pending").length;
  const confirmedAppts = allAppointments.filter(a => a.status === "confirmed").length;

  const allDoctors = doctors || [];

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Staff";

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "critical": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-orange-600" />
            Welcome, {userName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Medical Staff Portal • {format(new Date(), "EEEE, dd MMMM yyyy")}
          </p>
        </div>
        <Button onClick={() => navigate("/staff/dashboard")}>
          Open Full Dashboard <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Stats Overview */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/staff/dashboard")}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <FileText className="w-5 h-5 text-primary" />
                <Badge variant="outline" className="text-xs">{todayLeaves.length} today</Badge>
              </div>
              <p className="text-2xl font-bold">{allLeaves.length}</p>
              <p className="text-sm text-muted-foreground">Active Leaves</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/staff/dashboard")}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Calendar className="w-5 h-5 text-secondary" />
                <Badge variant="outline" className="text-xs">{pendingAppts} pending</Badge>
              </div>
              <p className="text-2xl font-bold">{allAppointments.length}</p>
              <p className="text-sm text-muted-foreground">Today's Appointments</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold">{studentsCount}</p>
              <p className="text-sm text-muted-foreground">Registered Students</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Stethoscope className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{allDoctors.length}</p>
              <p className="text-sm text-muted-foreground">Medical Officers</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate("/staff/dashboard")}
            >
              <FileText className="w-4 h-4 mr-3 text-primary" />
              Issue Medical Leave
              {doctorReferredCount > 0 && (
                <Badge className="ml-auto mr-2 bg-primary/10 text-primary hover:bg-primary/20">{doctorReferredCount} pending</Badge>
              )}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate("/staff/dashboard?tab=certificate")}
            >
              <ClipboardCheck className="w-4 h-4 mr-3 text-green-600" />
              Issue Medical Certificate
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate("/medical-leave")}
            >
              <Clock className="w-4 h-4 mr-3 text-orange-600" />
              View Medical Leave Records
              {allLeaves.length > 0 && (
                <Badge className="ml-auto mr-2 bg-orange-100 text-orange-800 hover:bg-orange-200">{allLeaves.length} active</Badge>
              )}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate("/medical-team")}
            >
              <Stethoscope className="w-4 h-4 mr-3 text-blue-600" />
              View Medical Team
              {allDoctors.length > 0 && (
                <Badge className="ml-auto mr-2 bg-blue-100 text-blue-800 hover:bg-blue-200">{allDoctors.length}</Badge>
              )}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>

        {/* Leave Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Leave Status Summary
            </CardTitle>
            <CardDescription>Current medical leave breakdown (live)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm">Doctor Referred</span>
              </div>
              <Badge variant="secondary">{doctorReferredCount}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-sm">Student Form Pending</span>
              </div>
              <Badge variant="secondary">{pendingFormsCount}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">Currently On Leave</span>
              </div>
              <Badge variant="secondary">{onLeaveCount}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-sm">Return Pending</span>
              </div>
              <Badge variant="secondary">{returnPendingCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leave Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Medical Leave Requests
              <Badge variant="outline" className="ml-2 text-xs font-normal">Live</Badge>
            </CardTitle>
            <CardDescription>Latest referrals requiring attention</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/staff/dashboard")}>
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : allLeaves.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>No active medical leave requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allLeaves.slice(0, 5).map((leave) => (
                <div key={leave.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {leave.status.replace(/_/g, " ")}
                        </Badge>
                        {leave.health_priority && (
                          <Badge className={`text-xs ${getPriorityColor(leave.health_priority)}`}>
                            {leave.health_priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Building className="w-3 h-3 inline mr-1" />
                        {leave.referral_hospital} • {leave.expected_duration}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(leave.created_at), "dd MMM")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* On-Duty Doctors */}
      {allDoctors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-green-600" />
              Medical Officers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allDoctors.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.designation}</p>
                    {doc.is_senior && (
                      <Badge variant="outline" className="text-xs mt-0.5">Senior</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
