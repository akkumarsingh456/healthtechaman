import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, User, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AppointmentCard from "./AppointmentCard";

interface ShiftExchangeAppointmentsProps {
  doctorId: string;
}

export default function ShiftExchangeAppointments({ doctorId }: ShiftExchangeAppointmentsProps) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // Fetch active shift exchanges where this doctor is the replacement (today and future)
  const { data: activeExchanges } = useQuery({
    queryKey: ["active-shift-exchanges-for-me", doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_exchanges")
        .select("*, original_doctor:original_doctor_id(id, name)")
        .eq("replacement_doctor_id", doctorId)
        .gte("shift_date", today)
        .eq("status", "approved");
      return (data as any[]) || [];
    },
    enabled: !!doctorId,
  });

  // Fetch untransferred appointments from original doctors within exchange time ranges
  const { data: untransferredAppointments } = useQuery({
    queryKey: ["untransferred-shift-appointments", doctorId, activeExchanges],
    queryFn: async () => {
      if (!activeExchanges?.length) return [];

      const allUntransferred: any[] = [];
      for (const exchange of activeExchanges) {
        const { data } = await supabase
          .from("appointments")
          .select("id, patient_id, appointment_date, appointment_time, reason, status, health_priority, notes")
          .eq("medical_officer_id", exchange.original_doctor_id)
          .eq("appointment_date", exchange.shift_date)
          .in("status", ["pending", "confirmed"])
          .gte("appointment_time", exchange.new_start_time)
          .lte("appointment_time", exchange.new_end_time);

        if (data?.length) {
          allUntransferred.push(...data.map(apt => ({
            ...apt,
            fromDoctor: exchange.original_doctor?.name || "Unknown",
            exchangeId: exchange.id,
          })));
        }
      }
      return allUntransferred;
    },
    enabled: !!doctorId && !!activeExchanges?.length,
  });

  // Auto-transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!untransferredAppointments?.length) return 0;

      const ids = untransferredAppointments.map(a => a.id);
      const { data, error } = await supabase
        .from("appointments")
        .update({
          medical_officer_id: doctorId,
          notes: "Transferred via shift exchange",
        })
        .in("id", ids)
        .select("id");

      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: (count) => {
      if (count > 0) {
        toast.success(`${count} appointment(s) transferred to your dashboard`);
        queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["doctor-home-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["doctor-appointment-stats"] });
        queryClient.invalidateQueries({ queryKey: ["untransferred-shift-appointments"] });
      }
    },
    onError: (err: any) => {
      toast.error("Transfer failed", { description: err.message });
    },
  });

  // Auto-transfer untransferred appointments
  useEffect(() => {
    if (untransferredAppointments?.length && !transferMutation.isPending) {
      transferMutation.mutate();
    }
  }, [untransferredAppointments]);

  // Fetch appointments already transferred to this doctor via shift exchange
  const { data: transferredAppointments } = useQuery({
    queryKey: ["transferred-shift-appointments", doctorId, activeExchanges],
    queryFn: async () => {
      if (!activeExchanges?.length) return [];

      // Get all exchange dates
      const dates = [...new Set(activeExchanges.map(e => e.shift_date))];

      const allTransferred: any[] = [];
      for (const date of dates) {
        const { data } = await supabase
          .from("appointments")
          .select("id, patient_id, appointment_date, appointment_time, reason, status, health_priority, notes, denial_reason, approved_at, denied_at")
          .eq("medical_officer_id", doctorId)
          .eq("appointment_date", date)
          .or("notes.ilike.%shift exchange%,notes.ilike.%Transferred via%")
          .order("appointment_time", { ascending: true });

        if (data?.length) allTransferred.push(...data);
      }

      // Fetch student details
      const patientIds = [...new Set(allTransferred.map(a => a.patient_id))];
      if (!patientIds.length) return [];

      const { data: students } = await supabase
        .from("students")
        .select("id, user_id, full_name, roll_number, program, branch, batch, year_of_study, photo_url")
        .in("user_id", patientIds);

      return allTransferred.map(apt => ({
        ...apt,
        student: students?.find(s => s.user_id === apt.patient_id),
      }));
    },
    enabled: !!doctorId && !!activeExchanges?.length,
  });

  const exchangeInfo = activeExchanges?.map(e => ({
    originalDoctor: e.original_doctor?.name || "Unknown",
    timeRange: `${formatTime(e.new_start_time)} - ${formatTime(e.new_end_time)}`,
    date: format(new Date(e.shift_date), "MMM d"),
  })) || [];

  if (!activeExchanges?.length) return null;
  if (!transferredAppointments?.length && !untransferredAppointments?.length) return null;

  return (
    <Card className="border-2 border-amber-300/50 bg-gradient-to-br from-amber-50/50 to-background shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg text-foreground">Shift Exchange Appointments</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Appointments transferred via shift exchange
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 bg-amber-50 self-start sm:self-auto shrink-0">
            <RefreshCw className="h-3 w-3" />
            {transferredAppointments?.length || 0} transferred
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Exchange info */}
        {exchangeInfo.map((info, i) => (
          <div key={i} className="flex items-start sm:items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs sm:text-sm">
            <User className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-amber-800">
              From <strong>{info.originalDoctor}</strong> • {info.date} • {info.timeRange}
            </span>
          </div>
        ))}

        {/* Transferred appointments list */}
        {transferredAppointments && transferredAppointments.length > 0 ? (
          <div className="space-y-3 pt-2">
            {transferredAppointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                doctorId={doctorId}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4 text-sm">
            {transferMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transferring appointments...
              </span>
            ) : (
              "No appointments in the exchange time range"
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}
