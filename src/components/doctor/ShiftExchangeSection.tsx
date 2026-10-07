import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight, Clock, User, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Calendar as CalendarIcon, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShiftExchangeProps {
  doctorId: string | null;
}

const SHIFT_TIMES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00",
];

const formatTime = (time: string) => {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
};

const buildGoogleCalendarUrl = (date: string, startTime: string, endTime: string, replacementName: string, reason: string) => {
  const dtStart = `${date.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
  const dtEnd = `${date.replace(/-/g, "")}T${endTime.replace(":", "")}00`;
  const title = encodeURIComponent(`Shift Exchange with Dr. ${replacementName}`);
  const details = encodeURIComponent(
    `Shift exchange scheduled.\nReplacement: Dr. ${replacementName}\nTime: ${formatTime(startTime)} - ${formatTime(endTime)}${reason ? `\nReason: ${reason}` : ""}`
  );
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}`;
};

export default function ShiftExchangeSection({ doctorId }: ShiftExchangeProps) {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [exchangeDate, setExchangeDate] = useState<Date>(new Date());
  const [replacementDoctorId, setReplacementDoctorId] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [reason, setReason] = useState("");

  // Fetch current doctor's shift for selected date
  const { data: todayShift } = useQuery({
    queryKey: ["doctor-shift", doctorId, formattedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctor_shifts")
        .select("*")
        .eq("doctor_id", doctorId!)
        .eq("shift_date", formattedDate)
        .maybeSingle();
      return data;
    },
    enabled: !!doctorId,
  });

  // Fetch all medical officers for replacement selection
  const { data: allDoctors } = useQuery({
    queryKey: ["all-doctors-for-exchange"],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_officers")
        .select("id, name, designation")
        .order("name");
      return data || [];
    },
  });

  // Fetch recent exchanges
  const { data: recentExchanges } = useQuery({
    queryKey: ["recent-shift-exchanges", doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_exchanges")
        .select("*, original_doctor:original_doctor_id(name), replacement_doctor:replacement_doctor_id(name)")
        .or(`original_doctor_id.eq.${doctorId},replacement_doctor_id.eq.${doctorId}`)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as any[]) || [];
    },
    enabled: !!doctorId,
  });

  const exchangeDateStr = format(exchangeDate, "yyyy-MM-dd");

  // Count appointments that would be affected
  const { data: affectedAppointments } = useQuery({
    queryKey: ["affected-appointments", doctorId, exchangeDateStr, newStartTime, newEndTime],
    queryFn: async () => {
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("medical_officer_id", doctorId!)
        .eq("appointment_date", exchangeDateStr)
        .in("status", ["pending", "confirmed"])
        .gte("appointment_time", newStartTime)
        .lte("appointment_time", newEndTime);
      return count || 0;
    },
    enabled: !!doctorId && dialogOpen,
  });

  const otherDoctors = allDoctors?.filter((d) => d.id !== doctorId) || [];
  const selectedReplacementDoctor = allDoctors?.find(d => d.id === replacementDoctorId);

  // Mutation: create/update shift + create exchange + transfer appointments
  const exchangeMutation = useMutation({
    mutationFn: async () => {
      if (!doctorId || !replacementDoctorId) throw new Error("Missing data");

      // Get current shift for the exchange date
      const { data: existingShift } = await supabase
        .from("doctor_shifts")
        .select("start_time, end_time")
        .eq("doctor_id", doctorId)
        .eq("shift_date", exchangeDateStr)
        .maybeSingle();

      const currentStart = existingShift?.start_time || "09:00";
      const currentEnd = existingShift?.end_time || "17:00";

      // 1. Upsert the doctor's shift
      const { error: shiftError } = await supabase
        .from("doctor_shifts")
        .upsert(
          {
            doctor_id: doctorId,
            shift_date: exchangeDateStr,
            start_time: newStartTime,
            end_time: newEndTime,
            is_modified: true,
            modified_by: doctorId,
            notes: reason || null,
          },
          { onConflict: "doctor_id,shift_date" }
        );
      if (shiftError) throw shiftError;

      // 2. Transfer affected appointments to replacement doctor
      const { data: transferred, error: transferError } = await supabase
        .from("appointments")
        .update({
          medical_officer_id: replacementDoctorId,
          notes: `Transferred via shift exchange from ${exchangeDateStr}`,
        })
        .eq("medical_officer_id", doctorId)
        .eq("appointment_date", exchangeDateStr)
        .in("status", ["pending", "confirmed"])
        .gte("appointment_time", newStartTime)
        .lte("appointment_time", newEndTime)
        .select("id");

      if (transferError) throw transferError;
      const transferredCount = transferred?.length || 0;

      // 3. Record the exchange
      const { error: exchangeError } = await supabase
        .from("shift_exchanges")
        .insert({
          original_doctor_id: doctorId,
          replacement_doctor_id: replacementDoctorId,
          shift_date: exchangeDateStr,
          original_start_time: currentStart,
          original_end_time: currentEnd,
          new_start_time: newStartTime,
          new_end_time: newEndTime,
          exchange_reason: reason || null,
          status: "approved",
          transferred_appointments_count: transferredCount,
          approved_at: new Date().toISOString(),
        });
      if (exchangeError) throw exchangeError;

      return transferredCount;
    },
    onSuccess: (transferredCount) => {
      toast.success("Shift exchange completed!", {
        description: `${transferredCount} appointment(s) transferred to the replacement doctor.`,
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-shift"] });
      queryClient.invalidateQueries({ queryKey: ["recent-shift-exchanges"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-home-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-appointment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["active-shift-exchanges-for-me"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error("Exchange failed", { description: err.message });
    },
  });

  const resetForm = () => {
    setReplacementDoctorId("");
    setNewStartTime("09:00");
    setNewEndTime("17:00");
    setReason("");
    setExchangeDate(new Date());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const currentStart = todayShift?.start_time || "09:00:00";
  const currentEnd = todayShift?.end_time || "17:00:00";

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-secondary/5 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Shift Exchange</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Manage your shift & transfer appointments</CardDescription>
            </div>
          </div>

          {/* Date Picker for viewing shifts */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(selectedDate, "EEE, MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(date) => date < startOfDay(new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Shift Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/60 text-center">
            <p className="text-xs text-muted-foreground mb-1">Shift Start</p>
            <p className={cn("text-xl font-bold", todayShift?.is_modified ? "text-amber-600" : "text-foreground")}>
              {formatTime(currentStart.slice(0, 5))}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/60 text-center">
            <p className="text-xs text-muted-foreground mb-1">Shift End</p>
            <p className={cn("text-xl font-bold", todayShift?.is_modified ? "text-amber-600" : "text-foreground")}>
              {formatTime(currentEnd.slice(0, 5))}
            </p>
          </div>
        </div>

        {todayShift?.is_modified && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <RefreshCw className="h-3 w-3" />
            <span>Shift was modified from the regular schedule</span>
          </div>
        )}

        {/* Recent Exchanges */}
        {recentExchanges && recentExchanges.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recent Exchanges
            </p>
            {recentExchanges.slice(0, 3).map((ex: any) => (
              <div key={ex.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-md bg-muted/40 text-sm gap-1 sm:gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs sm:text-sm">
                    {ex.original_doctor?.name} → {ex.replacement_doctor?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-5 sm:pl-0">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ex.shift_date), "MMM d")} • {ex.transferred_appointments_count} apt
                  </span>
                  {getStatusBadge(ex.status)}
                </div>
              </div>
            ))}

            {/* Google Calendar links for recent exchanges */}
            {recentExchanges
              .filter((ex: any) => ex.status === "approved" && new Date(ex.shift_date) >= startOfDay(new Date()))
              .slice(0, 2)
              .map((ex: any) => (
                <a
                  key={`gcal-${ex.id}`}
                  href={buildGoogleCalendarUrl(
                    ex.shift_date,
                    ex.new_start_time,
                    ex.new_end_time,
                    ex.replacement_doctor?.name || "Unknown",
                    ex.exchange_reason || ""
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline pl-5"
                >
                  <ExternalLink className="h-3 w-3" />
                  Add to Google Calendar ({format(new Date(ex.shift_date), "MMM d")})
                </a>
              ))}
          </div>
        )}

        {/* Exchange Button & Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2" variant="default">
              <ArrowLeftRight className="h-4 w-4" />
              Request Shift Exchange
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                Shift Exchange Request
              </DialogTitle>
              <DialogDescription>
                Select a date, modify your shift, and transfer appointments to a replacement doctor.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label>Exchange Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !exchangeDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(exchangeDate, "EEEE, MMMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={exchangeDate}
                      onSelect={(d) => d && setExchangeDate(d)}
                      disabled={(date) => date < startOfDay(new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Current shift info */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs font-medium text-muted-foreground mb-2">CURRENT SHIFT ({format(exchangeDate, "MMM d")})</p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">{formatTime(currentStart.slice(0, 5))}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">{formatTime(currentEnd.slice(0, 5))}</span>
                  </div>
                </div>
              </div>

              {/* Replacement Doctor */}
              <div className="space-y-2">
                <Label>Select Replacement Doctor *</Label>
                <Select value={replacementDoctorId} onValueChange={setReplacementDoctorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a doctor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {otherDoctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name} — {doc.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* New Shift Times */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Start Time *</Label>
                  <Select value={newStartTime} onValueChange={setNewStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_TIMES.map((t) => (
                        <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>New End Time *</Label>
                  <Select value={newEndTime} onValueChange={setNewEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_TIMES.map((t) => (
                        <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason for Exchange (Optional)</Label>
                <Textarea
                  placeholder="Please provide reason for shift exchange..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-[70px]"
                />
              </div>

              {/* Warning */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>
                        <strong>{affectedAppointments ?? "..."}</strong> appointment(s) on {format(exchangeDate, "MMM d")} will be transferred
                      </li>
                      <li>The replacement doctor will receive these appointments</li>
                      <li>Patients will see the updated doctor in their dashboard</li>
                      <li>This action is recorded in the exchange history</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!replacementDoctorId || newStartTime >= newEndTime || exchangeMutation.isPending}
                  onClick={() => exchangeMutation.mutate()}
                >
                  {exchangeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm Exchange
                </Button>
              </div>

              {/* Google Calendar after confirmation hint */}
              {selectedReplacementDoctor && (
                <p className="text-xs text-muted-foreground text-center">
                  After confirming, you can add this shift exchange to your Google Calendar from the main view.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
