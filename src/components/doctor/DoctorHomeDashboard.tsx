import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { format, isToday } from "date-fns";
import {
  Stethoscope,
  Calendar,
  ClipboardList,
  Users,
  AlertTriangle,
  Activity,
  ArrowRight,
  HeartPulse,
  FileText,
  Clock,
  CheckCircle2,
  Siren,
} from "lucide-react";
import ShiftExchangeSection from "./ShiftExchangeSection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function DoctorHomeDashboard() {
  const navigate = useNavigate();
  const { user, doctorId } = useUserRole();
  const queryClient = useQueryClient();

  // Real-time: auto-refresh when appointments change (e.g. shift transfers)
  useEffect(() => {
    if (!doctorId) return;
    const channel = supabase
      .channel(`doctor-home-realtime-${doctorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["doctor-home-appointments", doctorId] });
          queryClient.invalidateQueries({ queryKey: ["doctor-home-pending", doctorId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [doctorId, queryClient]);

  // Fetch doctor info
  const { data: doctorInfo, isLoading: doctorLoading } = useQuery({
    queryKey: ["doctor-home-info", doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_officers")
        .select("name, designation, qualification, is_senior")
        .eq("id", doctorId)
        .maybeSingle();
      return data;
    },
    enabled: !!doctorId,
  });

  // Fetch today's appointments
  const { data: todayAppointments, isLoading: apptLoading } = useQuery({
    queryKey: ["doctor-home-appointments", doctorId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_time, status, reason, patient_id")
        .eq("appointment_date", today)
        .eq("medical_officer_id", doctorId!)
        .order("appointment_time", { ascending: true });
      return data || [];
    },
    enabled: !!doctorId,
  });

  // Fetch active medical leave referrals
  const { data: activeLeaves, isLoading: leaveLoading } = useQuery({
    queryKey: ["doctor-home-leaves", doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_leave_requests")
        .select(`
          id, status, health_priority, referral_hospital,
          student:student_id ( full_name, roll_number )
        `)
        
        .in("status", ["on_leave", "return_pending", "doctor_referred", "student_form_pending"])
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as any[]) || [];
    },
    enabled: !!doctorId,
  });

  // Fetch pending approvals count
  const { data: pendingCount } = useQuery({
    queryKey: ["doctor-home-pending", doctorId],
    queryFn: async () => {
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("medical_officer_id", doctorId!)
        .eq("status", "pending");
      return count || 0;
    },
    enabled: !!doctorId,
  });

  const confirmedToday = todayAppointments?.filter((a) => a.status === "confirmed").length || 0;
  const pendingToday = todayAppointments?.filter((a) => a.status === "pending").length || 0;

  // Deduplicate active leaves by student roll number
  const uniqueActiveLeaves = (() => {
    if (!activeLeaves?.length) return [];
    const seen = new Map<string, any>();
    for (const leave of activeLeaves) {
      const key = leave.student?.roll_number || leave.id;
      if (!seen.has(key)) seen.set(key, leave);
    }
    return Array.from(seen.values());
  })();

  const highPriorityLeaves = uniqueActiveLeaves.filter((l: any) => l.health_priority === "high").length;

  const isLoading = doctorLoading || apptLoading || leaveLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10 border-primary/20">
        <CardContent className="py-6 px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                <Stethoscope className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                {(() => {
                  const name = doctorInfo?.name || user?.user_metadata?.full_name || "Doctor";
                  const displayName = name.replace(/^Dr\.?\s*/i, "").trim();
                  return (
                    <h1 className="text-2xl font-bold text-foreground">
                      Welcome, {displayName}
                    </h1>
                  );
                })()}
                <p className="text-muted-foreground">
                  {doctorInfo?.designation || "Medical Officer"} • {doctorInfo?.qualification || ""}
                  {doctorInfo?.is_senior && (
                    <Badge variant="secondary" className="ml-2 text-xs">Senior</Badge>
                  )}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/doctor/dashboard")} className="gap-2">
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
          onClick={() => navigate("/doctor/dashboard")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{confirmedToday}</p>
                <p className="text-sm text-muted-foreground">Today's Patients</p>
              </div>
              <Calendar className="h-8 w-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-amber-500"
          onClick={() => navigate("/doctor/dashboard")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingCount || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-secondary"
          onClick={() => navigate("/medical-leave")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{uniqueActiveLeaves.length}</p>
                <p className="text-sm text-muted-foreground">Active Leave Cases</p>
              </div>
              <ClipboardList className="h-8 w-8 text-secondary/60" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
            highPriorityLeaves > 0 ? "border-l-destructive" : "border-l-primary"
          }`}
          onClick={() => navigate("/doctor/dashboard")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{highPriorityLeaves}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${highPriorityLeaves > 0 ? "text-destructive/60" : "text-primary/60"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Exchange - Highlighted Section */}
      <ShiftExchangeSection doctorId={doctorId} />

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common clinical workflows</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/doctor/dashboard")}
            >
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">View Appointments</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/medical-leave")}
            >
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">New Referral</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/medical-team")}
            >
              <Users className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">Medical Team</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/doctor/dashboard")}
            >
              <Siren className="h-6 w-6 text-destructive" />
              <span className="text-xs font-medium">Emergency</span>
            </Button>
          </CardContent>
        </Card>

        {/* Active Leave Cases */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-primary" />
                  Active Leave Cases
                </CardTitle>
                <CardDescription>Students currently on medical leave</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/medical-leave")}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {uniqueActiveLeaves.length > 0 ? (
              <div className="space-y-3">
                {uniqueActiveLeaves.slice(0, 4).map((leave: any) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => {
                      const rollNumber = leave.student?.roll_number;
                      if (rollNumber) navigate(`/student-profile/${rollNumber}`);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {leave.student?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leave.student?.roll_number} • {leave.referral_hospital}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {leave.health_priority === "high" && (
                        <Badge variant="destructive" className="text-xs">High</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {leave.status === "on_leave" ? "On Leave" :
                         leave.status === "return_pending" ? "Returning" :
                         leave.status === "doctor_referred" ? "Referred" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active leave cases</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health Centre Info - useful for doctors too */}
      <Separator />
      <div className="text-center">
        <Button variant="outline" onClick={() => navigate("/doctor/dashboard")} className="gap-2">
          <Stethoscope className="h-4 w-4" />
          Open Full Doctor Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
