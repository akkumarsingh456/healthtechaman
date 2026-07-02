import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, User, FileText, AlertTriangle, CheckCircle, XCircle, Eye, Edit2, Loader2, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import MedicalLeaveDialog from "./MedicalLeaveDialog";
import PrescriptionDialog from "./PrescriptionDialog";

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  program: string;
  branch: string | null;
  batch: string;
  year_of_study: string | null;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
}

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  status: string;
  health_priority: string | null;
  denial_reason?: string | null;
  approved_at?: string | null;
  denied_at?: string | null;
  ai_priority?: string | null;
  ai_summary?: string | null;
  student?: Student;
}

interface AppointmentCardProps {
  appointment: Appointment;
  doctorId: string;
}

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
};

const getPriorityColor = (priority: string | null) => {
  switch (priority) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-amber-500 text-white";
    case "low":
      return "bg-green-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "confirmed":
      return <Badge variant="default">Confirmed</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "completed":
      return <Badge variant="outline" className="border-green-500 text-green-600">Completed</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const AppointmentCard = ({ appointment, doctorId }: AppointmentCardProps) => {
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [showViewPrescription, setShowViewPrescription] = useState(false);
  const [showUpdateReason, setShowUpdateReason] = useState(false);
  const [updatedReason, setUpdatedReason] = useState(appointment.reason || "");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch existing prescription for completed appointments
  const { data: existingPrescription } = useQuery({
    queryKey: ["appointment-prescription", appointment.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prescriptions")
        .select(`id, created_at, diagnosis, notes, medical_officers:doctor_id ( name, designation ), prescription_items ( id, medicine_name, dosage, frequency, duration, instructions, meal_timing )`)
        .eq("appointment_id", appointment.id)
        .maybeSingle();
      return data;
    },
    enabled: appointment.status === "completed",
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async (priority: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ health_priority: priority })
        .eq("id", appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Priority updated");
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
    },
    onError: () => {
      toast.error("Failed to update priority");
    },
  });

  const approveAppointmentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "confirmed",
          approved_at: new Date().toISOString()
        })
        .eq("id", appointment.id);

      if (error) throw error;

      // Simple approval notification — no leave form link
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: appointment.patient_id,
          title: "✅ Appointment Approved",
          message: `Your appointment on ${new Date(appointment.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at ${formatTime(appointment.appointment_time)} has been approved. Please arrive 10 minutes before your scheduled time.`,
          type: "approved",
          related_appointment_id: appointment.id
        });

      if (notifError) {
        console.error("Failed to create notification:", notifError);
      }

      // Send notification email (fire-and-forget, non-blocking)
      supabase.functions.invoke('send-appointment-notification', {
        body: {
          appointmentId: appointment.id,
          action: 'approved'
        }
      }).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Appointment approved", {
        description: "The student has been notified."
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      // Do NOT show medical leave prompt — doctor uses the confirmed card buttons for that
    },
    onError: () => {
      toast.error("Failed to approve appointment");
    },
  });

  const denyAppointmentMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          denied_at: new Date().toISOString(),
          denial_reason: reason
        })
        .eq("id", appointment.id);

      if (error) throw error;

      // Create in-app notification for the student
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: appointment.patient_id,
          title: "Appointment Rejected",
          message: `Your appointment on ${new Date(appointment.appointment_date).toLocaleDateString()} at ${formatTime(appointment.appointment_time)} has been rejected. Reason: ${reason}`,
          type: "rejected",
          related_appointment_id: appointment.id
        });

      if (notifError) {
        console.error("Failed to create notification:", notifError);
      }

      // Send notification email (fire-and-forget, non-blocking)
      supabase.functions.invoke('send-appointment-notification', {
        body: {
          appointmentId: appointment.id,
          action: 'rejected',
          reason: reason
        }
      }).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Appointment denied", {
        description: "The student has been notified."
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      setShowDenyDialog(false);
      setDenialReason("");
    },
    onError: () => {
      toast.error("Failed to deny appointment");
    },
  });

  const updateReasonMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ reason })
        .eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visit reason updated");
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      setShowUpdateReason(false);
    },
    onError: () => toast.error("Failed to update reason"),
  });

  const handleApprove = () => {
    approveAppointmentMutation.mutate();
  };

  const handleDeny = () => {
    if (!denialReason.trim()) {
      toast.error("Please provide a reason for denial");
      return;
    }
    denyAppointmentMutation.mutate(denialReason);
  };




  const student = appointment.student;

  return (
    <>
      <Card className="border hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Patient Info */}
            <div className="flex items-center gap-4 flex-1">
              {student?.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                  <ImageOff className="w-5 h-5 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1">
                <p 
                  className="font-semibold text-foreground cursor-pointer hover:text-primary hover:underline transition-colors"
                  onClick={() => student?.roll_number && navigate(`/student-profile/${student.roll_number}`)}
                >
                  {student?.full_name || "Unknown Student"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {student?.roll_number || "N/A"} • {student?.program || ""}
                  {student?.branch && ` • ${student.branch}`}
                </p>
                {appointment.reason && (
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span>{appointment.reason}</span>
                    {(appointment.reason === 'Other' || appointment.reason.startsWith('Other:')) && 
                     appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 ml-1" 
                        onClick={() => setShowUpdateReason(true)}
                      >
                        <Edit2 className="w-3 h-3 text-primary" />
                      </Button>
                    )}
                  </div>
                )}
                {showUpdateReason && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Enter actual visit reason..."
                      value={updatedReason}
                      onChange={(e) => setUpdatedReason(e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <Button 
                      size="sm" 
                      className="h-8"
                      disabled={updateReasonMutation.isPending || !updatedReason.trim()}
                      onClick={() => updateReasonMutation.mutate(updatedReason.trim())}
                    >
                      {updateReasonMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8"
                      onClick={() => { setShowUpdateReason(false); setUpdatedReason(appointment.reason || ""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {/* Show denial reason if denied */}
                {appointment.status === "cancelled" && appointment.denial_reason && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Denial: {appointment.denial_reason}
                  </p>
                )}
              </div>
            </div>

            {/* Time & Status */}
            <div className="text-right space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-1 justify-end">
                <Clock className="w-4 h-4" />
                {formatTime(appointment.appointment_time)}
              </p>
              {getStatusBadge(appointment.status)}
              {appointment.ai_priority && (
                <div>
                  <Badge
                    variant="outline"
                    className={
                      appointment.ai_priority === 'high'
                        ? 'border-destructive text-destructive'
                        : appointment.ai_priority === 'medium'
                        ? 'border-amber-500 text-amber-600'
                        : 'border-emerald-500 text-emerald-600'
                    }
                    title={appointment.ai_summary || undefined}
                  >
                    AI: {appointment.ai_priority.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {appointment.ai_summary && (
            <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">AI triage: </span>
              {appointment.ai_summary}
            </div>
          )}

          {/* Actions Row */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-4">
            {/* Priority Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <Select
                value={appointment.health_priority || "medium"}
                onValueChange={(value) => updatePriorityMutation.mutate(value)}
                disabled={updatePriorityMutation.isPending}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      High
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge className={getPriorityColor(appointment.health_priority)}>
                {appointment.health_priority?.toUpperCase() || "MEDIUM"}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Pending appointments: Show Approve/Deny */}
              {appointment.status === "pending" && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApprove}
                    disabled={approveAppointmentMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDenyDialog(true)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Deny
                  </Button>
                </>
              )}

               {/* Confirmed appointments: Show Issue Leave and Complete */}
              {appointment.status === "confirmed" && (
                <>
                   <Button
                     variant="outline"
                     size="sm"
                     className="border-amber-400 text-amber-700 hover:bg-amber-50"
                     onClick={() => setShowLeaveDialog(true)}
                   >
                     <AlertTriangle className="w-4 h-4 mr-1" />
                     Issue Leave
                   </Button>
                   <Button
                     variant="default"
                     size="sm"
                     onClick={() => setShowPrescriptionDialog(true)}
                   >
                     <FileText className="w-4 h-4 mr-1" />
                     Prescribe & Complete
                   </Button>
                 </>
               )}

               {/* Completed appointments: View Prescription if exists */}
               {appointment.status === "completed" && existingPrescription && (
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setShowViewPrescription(true)}
                 >
                   <Eye className="w-4 h-4 mr-1" />
                   View Prescription
                 </Button>
               )}
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Deny Dialog */}
      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Deny Appointment
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for denying this appointment. The student will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Denial</Label>
              <Textarea
                placeholder="E.g., Slot unavailable, please reschedule for tomorrow..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDenyDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeny}
                disabled={denyAppointmentMutation.isPending}
              >
                {denyAppointmentMutation.isPending ? "Denying..." : "Confirm Denial"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Medical Leave Dialog */}
      {student && (
        <MedicalLeaveDialog
          open={showLeaveDialog}
          onOpenChange={setShowLeaveDialog}
          student={student}
          doctorId={doctorId}
          appointmentId={appointment.id}
          healthPriority={appointment.health_priority || "medium"}
        />
      )}

      {/* Prescription Dialog */}
      <PrescriptionDialog
        open={showPrescriptionDialog}
        onOpenChange={setShowPrescriptionDialog}
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        doctorId={doctorId}
        studentName={student?.full_name || "Student"}
        onCompleted={() => {}}
      />

      {/* View Existing Prescription Dialog */}
      {existingPrescription && (
        <Dialog open={showViewPrescription} onOpenChange={setShowViewPrescription}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Prescription — {student?.full_name || "Student"}
              </DialogTitle>
              <DialogDescription>
                Issued on {new Date(existingPrescription.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {(existingPrescription as any).medical_officers?.name && (
                  <> · Dr. {(existingPrescription as any).medical_officers.name}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {existingPrescription.diagnosis && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Diagnosis</p>
                  <p className="text-sm">{existingPrescription.diagnosis}</p>
                </div>
              )}
              {(existingPrescription as any).prescription_items?.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium">#</th>
                        <th className="text-left p-2 font-medium">Medicine</th>
                        <th className="text-left p-2 font-medium">Dosage</th>
                        <th className="text-left p-2 font-medium">Frequency</th>
                        <th className="text-left p-2 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(existingPrescription as any).prescription_items.map((item: any, i: number) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-medium">{item.medicine_name}</td>
                          <td className="p-2">{item.dosage}</td>
                          <td className="p-2">{item.frequency}</td>
                          <td className="p-2">{item.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {existingPrescription.notes && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Doctor's Notes</p>
                  <p className="text-sm">{existingPrescription.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowViewPrescription(false)}>Close</Button>
                <Button onClick={async () => {
                  const { printDocument, getNitwHeaderHtml } = await import('@/lib/print/printDocument');
                  const items = (existingPrescription as any).prescription_items || [];
                  const doctorName = (existingPrescription as any).medical_officers?.name || 'Medical Officer';
                  const prescriptionId = `RX-${existingPrescription.id.slice(0, 8).toUpperCase()}`;
                  const mealLabel = (val: string) => ({ before_meal: 'Before Meal', after_meal: 'After Meal', with_meal: 'With Meal', empty_stomach: 'Empty Stomach', any_time: 'Any Time', bedtime: 'At Bedtime' }[val] ?? val);
                  const rows = items.map((m: any, i: number) => `<tr><td style="text-align:center">${i + 1}</td><td><strong>${m.medicine_name}</strong></td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td><td>${mealLabel(m.meal_timing || '')}</td><td>${m.instructions || '—'}</td></tr>`).join('');
                  const bodyHtml = `${getNitwHeaderHtml('PRESCRIPTION')}<div class="ref-date"><span><strong>Patient:</strong> ${student?.full_name}</span><span><strong>Date:</strong> ${new Date(existingPrescription.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>${existingPrescription.diagnosis ? `<div class="section-title">Diagnosis</div><p style="font-size:13px;margin-bottom:12px;">${existingPrescription.diagnosis}</p>` : ''}<div class="section-title">Prescribed Medicines</div><table><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Timing</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>${existingPrescription.notes ? `<div class="notes-box"><strong>Notes:</strong> ${existingPrescription.notes}</div>` : ''}<div class="signature-section"><div class="emblem-area"><img src="/nitw-emblem.png" alt="NITW" /><div class="emblem-label">NIT Warangal</div></div><div class="signature-box"><div class="online-signature">${doctorName}</div><div class="signature-line"><strong>${doctorName}</strong><div class="doctor-type">Health Centre, NIT Warangal</div></div></div></div>`;
                  await printDocument({ title: `Prescription - ${student?.full_name}`, bodyHtml, documentId: prescriptionId, documentType: 'Prescription' });
                }}>
                  <FileText className="w-4 h-4 mr-1" />
                  Print Prescription
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default AppointmentCard;
