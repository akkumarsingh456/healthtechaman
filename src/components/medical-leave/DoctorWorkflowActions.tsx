import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Send, XCircle, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import type { ApprovalWorkflowRow } from "./LeaveApprovalWorkflowTimeline";

interface Props {
  leaveRequestId: string;
  doctorId: string | null;
  workflow: ApprovalWorkflowRow | null;
  onUpdated: () => void;
}

/**
 * Doctor-side action panel for the leave approval workflow.
 * - If no workflow row: lets the doctor "verify" the referral, which creates the row at level 1.
 * - At level 1 (doctor): doctor can verify & forward to Mentor / HOD / Dean (selecting the destination level).
 * - Doctor can also reject with reason.
 */
export default function DoctorWorkflowActions({ leaveRequestId, doctorId, workflow, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [forwardToMentor, setForwardToMentor] = useState(true);
  const [forwardToHod, setForwardToHod] = useState(false);
  const [forwardToDean, setForwardToDean] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setNotes("");
      setForwardToMentor(true);
      setForwardToHod(false);
      setForwardToDean(false);
    }
  }, [open]);

  // If approved or rejected — no further actions
  if (workflow && (workflow.status === "approved" || workflow.status === "rejected")) {
    return null;
  }

  // Only level-1 (doctor stage) actions are exposed for now
  const isDoctorStage = !workflow || workflow.current_approval_level === 1;
  if (!isDoctorStage) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Awaiting action from the next approver — doctor verification already complete.
      </p>
    );
  }

  const handleVerifyAndForward = async () => {
    if (!doctorId) {
      toast.error("Doctor profile not found");
      return;
    }
    setBusy(true);
    try {
      // Determine highest forward target (mentor=2, hod=3, dean=4)
      const requiredLevel = forwardToDean ? 4 : forwardToHod ? 3 : forwardToMentor ? 2 : 1;
      const nextLevel = requiredLevel === 1 ? 1 : 2; // if forwarded, mentor (level 2) is next
      const nextStatus =
        requiredLevel === 1
          ? "approved"
          : requiredLevel === 2
          ? "awaiting_level2"
          : requiredLevel === 3
          ? "awaiting_level2" // still goes through level 2 first
          : "awaiting_level2";

      const payload = {
        medical_leave_request_id: leaveRequestId,
        current_approval_level: nextLevel,
        required_approval_level: requiredLevel,
        level1_approved_by: doctorId,
        level1_approved_at: new Date().toISOString(),
        level1_notes: notes || null,
        level2_required: requiredLevel >= 2,
        level3_required: requiredLevel >= 3,
        status: nextStatus,
      };

      let error;
      if (workflow) {
        ({ error } = await supabase
          .from("leave_approval_workflow")
          .update(payload)
          .eq("id", workflow.id));
      } else {
        ({ error } = await supabase.from("leave_approval_workflow").insert(payload));
      }
      if (error) throw error;

      toast.success(
        requiredLevel === 1
          ? "Referral verified & approved"
          : `Forwarded to ${forwardToDean ? "Academic Dean" : forwardToHod ? "HOD" : "Mentor"}`
      );
      setOpen(false);
      onUpdated();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update workflow");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!doctorId) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        medical_leave_request_id: leaveRequestId,
        current_approval_level: 1,
        required_approval_level: workflow?.required_approval_level ?? 1,
        level1_approved_by: doctorId,
        level1_approved_at: new Date().toISOString(),
        level1_notes: notes || null,
        status: "rejected",
        rejection_reason: rejectionReason,
      };
      let error;
      if (workflow) {
        ({ error } = await supabase.from("leave_approval_workflow").update(payload).eq("id", workflow.id));
      } else {
        ({ error } = await supabase.from("leave_approval_workflow").insert(payload));
      }
      if (error) throw error;
      toast.success("Referral rejected");
      setRejectOpen(false);
      setRejectionReason("");
      onUpdated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="default">
            <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
            Verify & Forward
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Referral</DialogTitle>
            <DialogDescription>
              Confirm clinical verification and select who this referral should be forwarded to for academic acknowledgement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wf-notes" className="text-sm">Doctor's verification notes (optional)</Label>
              <Textarea
                id="wf-notes"
                placeholder="e.g. Verified clinical findings, leave is medically justified..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
              <Label className="text-sm font-medium">Forward to:</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={forwardToMentor} onCheckedChange={(v) => setForwardToMentor(!!v)} />
                Faculty Mentor (acknowledgement)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={forwardToHod}
                  onCheckedChange={(v) => {
                    setForwardToHod(!!v);
                    if (v) setForwardToMentor(true);
                  }}
                />
                Head of Department (HOD)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={forwardToDean}
                  onCheckedChange={(v) => {
                    setForwardToDean(!!v);
                    if (v) {
                      setForwardToHod(true);
                      setForwardToMentor(true);
                    }
                  }}
                />
                Academic Dean (final sign-off)
              </label>
              <p className="text-xs text-muted-foreground">
                Approval flows in order: Mentor → HOD → Dean. Selecting a higher level automatically requires the prior ones.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleVerifyAndForward} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {forwardToMentor || forwardToHod || forwardToDean ? "Verify & Forward" : "Verify (No Forward)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Referral</DialogTitle>
            <DialogDescription>Provide a reason that will be visible to the student.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}