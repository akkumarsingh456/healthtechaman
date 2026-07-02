import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Search, Filter, Clock, AlertTriangle } from "lucide-react";
import AppointmentCard from "./AppointmentCard";

interface DoctorAppointmentsListProps {
  doctorId: string;
}

const DoctorAppointmentsList = ({ doctorId }: DoctorAppointmentsListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("today");
  const queryClient = useQueryClient();

  // Real-time subscription for appointment changes (transfers, new bookings)
  useEffect(() => {
    if (!doctorId) return;
    const channel = supabase
      .channel(`doctor-appointments-${doctorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["doctor-appointments", doctorId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [doctorId, queryClient]);

  // Fetch appointments for this doctor
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["doctor-appointments", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          appointment_date,
          appointment_time,
          reason,
          status,
          health_priority,
          denial_reason,
          approved_at,
          denied_at,
          ai_priority,
          ai_summary
        `)
        .eq("medical_officer_id", doctorId)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;

      // Fetch student details for each appointment using the doctor view (avoids RLS recursion)
      const patientIds = [...new Set(data.map((apt) => apt.patient_id))];
      
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, user_id, full_name, roll_number, program, branch, batch, year_of_study, photo_url")
        .in("user_id", patientIds);

      if (studentsError) {
        console.error("Error fetching students:", studentsError);
      }

      // Map students to appointments
      const appointmentsWithStudents = data.map((apt) => ({
        ...apt,
        student: students?.find((s) => s.user_id === apt.patient_id),
      }));

      return appointmentsWithStudents;
    },
    enabled: !!doctorId,
  });

  // Filter and categorize appointments
  const filterAppointments = (dateFilter: string) => {
    if (!appointments) return [];

    return appointments.filter((apt) => {
      const aptDate = parseISO(apt.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Date filter
      let dateMatch = true;
      const isCompleted = apt.status === "completed";
      if (dateFilter === "today") {
        dateMatch = isToday(aptDate) && !isCompleted;
      } else if (dateFilter === "upcoming") {
        dateMatch = aptDate >= today && !isToday(aptDate) && !isCompleted;
      } else if (dateFilter === "past") {
        dateMatch = aptDate < today || isCompleted;
      }

      // Search filter
      const searchMatch =
        !searchQuery ||
        apt.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.student?.roll_number?.toLowerCase().includes(searchQuery.toLowerCase());

      // Priority filter
      const priorityMatch =
        priorityFilter === "all" || apt.health_priority === priorityFilter;

      return dateMatch && searchMatch && priorityMatch;
    });
  };

  const todayAppointments = filterAppointments("today");
  const upcomingAppointments = filterAppointments("upcoming");
  // Deduplicate past appointments: show only the latest visit per student
  const pastAppointmentsAll = filterAppointments("past");
  const pastAppointments = (() => {
    const latestByPatient = new Map<string, typeof pastAppointmentsAll[0]>();
    // Sort descending by date+time first
    const sorted = [...pastAppointmentsAll].sort((a, b) => {
      const dateComp = b.appointment_date.localeCompare(a.appointment_date);
      if (dateComp !== 0) return dateComp;
      return b.appointment_time.localeCompare(a.appointment_time);
    });
    for (const apt of sorted) {
      if (!latestByPatient.has(apt.patient_id)) {
        latestByPatient.set(apt.patient_id, apt);
      }
    }
    return Array.from(latestByPatient.values());
  })();

  const highPriorityCount = appointments?.filter(
    (apt) => apt.health_priority === "high" && isToday(parseISO(apt.appointment_date))
  ).length || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* High Priority Alert */}
      {highPriorityCount > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {highPriorityCount} high priority patient{highPriorityCount > 1 ? "s" : ""} today requiring immediate attention
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex gap-2 sm:gap-3 flex-col sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium Priority</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Appointments Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="today" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-4">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            Today ({todayAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs sm:text-sm px-2 sm:px-4">
            Upcoming ({upcomingAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="text-xs sm:text-sm px-2 sm:px-4">
            Past ({pastAppointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Today's Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No appointments scheduled for today
                </p>
              ) : (
                todayAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    doctorId={doctorId}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No upcoming appointments
                </p>
              ) : (
                upcomingAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    doctorId={doctorId}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                Past Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pastAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No past appointments
                </p>
              ) : (
                pastAppointments.slice(0, 10).map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    doctorId={doctorId}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DoctorAppointmentsList;
