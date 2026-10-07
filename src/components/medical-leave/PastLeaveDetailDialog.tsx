import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Calendar, CheckCircle2, Clock, FileText, ShieldCheck, Stethoscope, User } from "lucide-react";
import { format } from "date-fns";

interface PastLeaveDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequest: any;
}

const getStatusLabel = (status: string, cleared: boolean) => {
  if (cleared) return { label: "Cleared", className: "bg-green-100 text-green-800" };
  switch (status) {
    case "student_form_pending": return { label: "Form Pending", className: "bg-amber-100 text-amber-800" };
    case "on_leave": return { label: "On Leave", className: "bg-blue-100 text-blue-800" };
    case "return_pending": return { label: "Return Pending", className: "bg-purple-100 text-purple-800" };
    case "returned": return { label: "Returned", className: "bg-green-100 text-green-800" };
    case "cancelled": return { label: "Cancelled", className: "bg-gray-100 text-gray-800" };
    default: return { label: status, className: "bg-gray-100 text-gray-800" };
  }
};

const DetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
};

const PastLeaveDetailDialog = ({ open, onOpenChange, leaveRequest }: PastLeaveDetailDialogProps) => {
  if (!leaveRequest) return null;

  const status = getStatusLabel(leaveRequest.status, !!leaveRequest.doctor_clearance);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Medical Leave Details
            </DialogTitle>
            <Badge variant="outline" className={status.className}>
              {leaveRequest.doctor_clearance && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hospital & Treatment */}
          <div className="rounded-lg border p-4 space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Treatment Info</h4>
            <Separator className="my-2" />
            <DetailRow icon={Building2} label="Hospital" value={leaveRequest.referral_hospital} />
            <DetailRow icon={FileText} label="Reason / Illness" value={leaveRequest.illness_description || "Medical treatment"} />
            <DetailRow icon={Clock} label="Expected Duration" value={leaveRequest.expected_duration} />
            {leaveRequest.rest_days && (
              <DetailRow icon={Clock} label="Rest Days Approved" value={`${leaveRequest.rest_days} days`} />
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border p-4 space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Timeline</h4>
            <Separator className="my-2" />
            <DetailRow
              icon={Calendar}
              label="Referral Date"
              value={leaveRequest.referral_date ? format(new Date(leaveRequest.referral_date), "PPp") : null}
            />
            <DetailRow
              icon={Calendar}
              label="Leave Started"
              value={leaveRequest.leave_start_date ? format(new Date(leaveRequest.leave_start_date), "PP") : null}
            />
            <DetailRow
              icon={Calendar}
              label="Expected Return"
              value={leaveRequest.expected_return_date ? format(new Date(leaveRequest.expected_return_date), "PP") : null}
            />
            <DetailRow
              icon={Calendar}
              label="Actual Return"
              value={leaveRequest.actual_return_date ? format(new Date(leaveRequest.actual_return_date), "PPp") : null}
            />
            {leaveRequest.hospital_discharge_date && (
              <DetailRow
                icon={Calendar}
                label="Hospital Discharge"
                value={format(new Date(leaveRequest.hospital_discharge_date), "PP")}
              />
            )}
            {leaveRequest.student_form_submitted_at && (
              <DetailRow
                icon={Calendar}
                label="Departure Form Submitted"
                value={format(new Date(leaveRequest.student_form_submitted_at), "PPp")}
              />
            )}
            {leaveRequest.return_submitted_at && (
              <DetailRow
                icon={Calendar}
                label="Return Submitted"
                value={format(new Date(leaveRequest.return_submitted_at), "PPp")}
              />
            )}
          </div>

          {/* Doctor & Clearance */}
          <div className="rounded-lg border p-4 space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Doctor & Clearance</h4>
            <Separator className="my-2" />
            <DetailRow
              icon={User}
              label="Referring Doctor"
              value={
                leaveRequest.medical_officers
                  ? `${leaveRequest.medical_officers.name}${leaveRequest.medical_officers.designation ? ` — ${leaveRequest.medical_officers.designation}` : ""}`
                  : null
              }
            />
            <DetailRow icon={Stethoscope} label="Doctor Notes" value={leaveRequest.doctor_notes} />
            <DetailRow
              icon={ShieldCheck}
              label="Health Centre Visited"
              value={leaveRequest.health_centre_visited ? "Yes" : "No"}
            />
            <DetailRow
              icon={ShieldCheck}
              label="Fitness Clearance"
              value={
                leaveRequest.doctor_clearance
                  ? `Cleared${leaveRequest.doctor_clearance_date ? ` on ${format(new Date(leaveRequest.doctor_clearance_date), "PP")}` : ""}`
                  : "Pending"
              }
            />
          </div>

          {/* Accompanist */}
          {leaveRequest.accompanist_name && (
            <div className="rounded-lg border p-4 space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Accompanist</h4>
              <Separator className="my-2" />
              <DetailRow icon={User} label="Name" value={leaveRequest.accompanist_name} />
              <DetailRow icon={User} label="Relationship" value={leaveRequest.accompanist_relationship} />
              <DetailRow icon={User} label="Contact" value={leaveRequest.accompanist_contact} />
              <DetailRow icon={User} label="Type" value={leaveRequest.accompanist_type} />
            </div>
          )}

          {/* Follow-up */}
          {leaveRequest.follow_up_notes && (
            <div className="rounded-lg border p-4 space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Follow-up Notes</h4>
              <Separator className="my-2" />
              <p className="text-sm">{leaveRequest.follow_up_notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PastLeaveDetailDialog;
