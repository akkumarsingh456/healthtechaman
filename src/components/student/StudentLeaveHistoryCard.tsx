import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Stethoscope, Share2, FileText, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";
import LeaveApprovalWorkflowTimeline, { type ApprovalWorkflowRow } from "@/components/medical-leave/LeaveApprovalWorkflowTimeline";
import ShareHealthReportDialog from "./ShareHealthReportDialog";

export interface LeaveHistoryItem {
  id: string;
  referral_hospital: string;
  illness_description: string | null;
  expected_duration: string;
  leave_start_date: string | null;
  expected_return_date: string | null;
  status: string;
  referral_date: string;
  doctor_name: string;
  doctor_clearance: boolean | null;
}

interface Props {
  studentId: string;
  userId: string;
  leaves: LeaveHistoryItem[];
  workflowsByLeave: Record<string, ApprovalWorkflowRow>;
  mentorName?: string | null;
  /** Called when user wants to print the referral letter for a leave */
  onPrintReferral?: (leaveId: string) => void;
  /** Called when user wants to print the leave certificate */
  onPrintLeaveCertificate?: (leaveId: string) => void;
}

const statusColor = (s: string) => {
  if (["approved", "returned", "completed"].includes(s)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (["rejected", "denied"].includes(s)) return "bg-destructive/10 text-destructive";
  if (["on_leave"].includes(s)) return "bg-blue-100 text-blue-800";
  if (["pending", "doctor_referred", "student_form_pending", "return_pending"].includes(s)) return "bg-amber-100 text-amber-800";
  return "bg-muted text-muted-foreground";
};

const prettyStatus = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function StudentLeaveHistoryCard({
  studentId, userId, leaves, workflowsByLeave, mentorName, onPrintReferral, onPrintLeaveCertificate,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(leaves[0]?.id || null);
  const [shareLeaveId, setShareLeaveId] = useState<string | null>(null);

  const shareLeave = leaves.find(l => l.id === shareLeaveId) || null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          Medical Leave History & Sharing
        </CardTitle>
        <CardDescription>
          All your past and current leave requests with the full Doctor → Mentor → HOD → Dean approval timeline. You can share any leave packet with your saved recipients.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {leaves.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No medical leave requests yet. To start a new one, visit a doctor at the Health Centre — they will create a referral that appears here.
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map(leave => {
              const wf = workflowsByLeave[leave.id] || null;
              const open = openId === leave.id;
              return (
                <Collapsible key={leave.id} open={open} onOpenChange={v => setOpenId(v ? leave.id : null)}>
                  <div className="rounded-lg border">
                    <CollapsibleTrigger className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {leave.referral_hospital}
                          </span>
                          <Badge className={`text-[10px] ${statusColor(leave.status)}`}>{prettyStatus(leave.status)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(leave.referral_date), "MMM d, yyyy")} · {leave.expected_duration}
                          {leave.doctor_name && <span>· Dr. {leave.doctor_name}</span>}
                        </p>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0 border-t bg-muted/10">
                      {leave.illness_description && (
                        <p className="text-xs text-foreground mb-3 mt-2"><strong>Reason:</strong> {leave.illness_description}</p>
                      )}
                      <LeaveApprovalWorkflowTimeline
                        workflow={wf}
                        approverNames={{ doctor: leave.doctor_name, mentor: mentorName || undefined }}
                      />
                      <div className="flex flex-wrap gap-2 mt-3">
                        {onPrintReferral && (
                          <Button size="sm" variant="outline" onClick={() => onPrintReferral(leave.id)}>
                            <FileText className="w-3 h-3 mr-1" /> Referral Letter
                          </Button>
                        )}
                        {onPrintLeaveCertificate && leave.doctor_clearance && (
                          <Button size="sm" variant="outline" onClick={() => onPrintLeaveCertificate(leave.id)}>
                            <FileText className="w-3 h-3 mr-1" /> Leave Certificate
                          </Button>
                        )}
                        <Button size="sm" onClick={() => setShareLeaveId(leave.id)}>
                          <Share2 className="w-3 h-3 mr-1" /> Share with Mentor / HOD / Dean
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
      <ShareHealthReportDialog
        open={!!shareLeaveId}
        onOpenChange={v => !v && setShareLeaveId(null)}
        studentId={studentId}
        userId={userId}
        leaveRequestId={shareLeaveId}
        leaveLabel={shareLeave ? `${shareLeave.referral_hospital} (${format(new Date(shareLeave.referral_date), "MMM d, yyyy")})` : null}
        hasReferral={true}
        hasLeaveCertificate={!!shareLeave?.doctor_clearance}
      />
    </Card>
  );
}