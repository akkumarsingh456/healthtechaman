import { Stethoscope, Users, Building2, GraduationCap, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface ApprovalWorkflowRow {
  id: string;
  medical_leave_request_id: string;
  current_approval_level: number;
  required_approval_level: number;
  level1_approved_by: string | null;
  level1_approved_at: string | null;
  level1_notes: string | null;
  level2_required: boolean | null;
  level2_approved_by: string | null;
  level2_approved_at: string | null;
  level2_notes: string | null;
  level3_required: boolean | null;
  level3_approved_by: string | null;
  level3_approved_at: string | null;
  level3_notes: string | null;
  status: string;
  rejection_reason: string | null;
  is_emergency_bypass: boolean | null;
  bypass_reason: string | null;
}

interface Props {
  workflow: ApprovalWorkflowRow | null;
  /** Optional names to display under each forwarder (mentor, hod, dean) */
  approverNames?: {
    doctor?: string;
    mentor?: string;
    hod?: string;
    dean?: string;
  };
  className?: string;
}

type StageState = "completed" | "current" | "pending" | "skipped" | "rejected";

interface Stage {
  key: "doctor" | "mentor" | "hod" | "dean";
  level: number;
  label: string;
  role: string;
  icon: React.ElementType;
  state: StageState;
  date: string | null;
  notes: string | null;
  approver?: string;
}

const stateStyles = (s: StageState) => {
  switch (s) {
    case "completed":
      return { bg: "bg-emerald-500 text-white", line: "bg-emerald-500", label: "Approved", labelColor: "text-emerald-700 dark:text-emerald-400" };
    case "current":
      return { bg: "bg-amber-500 text-white ring-4 ring-amber-200", line: "bg-muted", label: "Pending", labelColor: "text-amber-700 dark:text-amber-400" };
    case "rejected":
      return { bg: "bg-destructive text-destructive-foreground", line: "bg-destructive/30", label: "Rejected", labelColor: "text-destructive" };
    case "skipped":
      return { bg: "bg-muted text-muted-foreground", line: "bg-muted", label: "Not required", labelColor: "text-muted-foreground" };
    default:
      return { bg: "bg-muted text-muted-foreground", line: "bg-muted", label: "Awaiting", labelColor: "text-muted-foreground" };
  }
};

export default function LeaveApprovalWorkflowTimeline({ workflow, approverNames, className }: Props) {
  if (!workflow) {
    return (
      <div className={cn("rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-2", className)}>
        <Clock className="h-4 w-4" />
        Approval workflow has not been started yet for this referral.
      </div>
    );
  }

  const isRejected = workflow.status === "rejected";
  const isApproved = workflow.status === "approved";
  const isBypass = !!workflow.is_emergency_bypass;

  const currentLevel = workflow.current_approval_level;

  const stageState = (level: number, approvedAt: string | null, required: boolean): StageState => {
    if (!required && level > 1) return "skipped";
    if (approvedAt) return "completed";
    if (isRejected && level === currentLevel) return "rejected";
    if (level === currentLevel) return "current";
    if (level < currentLevel) return "completed";
    return "pending";
  };

  const stages: Stage[] = [
    {
      key: "doctor",
      level: 1,
      label: "Doctor Verification",
      role: "Campus Health Centre",
      icon: Stethoscope,
      state: stageState(1, workflow.level1_approved_at, true),
      date: workflow.level1_approved_at,
      notes: workflow.level1_notes,
      approver: approverNames?.doctor,
    },
    {
      key: "mentor",
      level: 2,
      label: "Faculty Mentor",
      role: "Mentor Acknowledgement",
      icon: Users,
      state: stageState(2, workflow.level2_approved_at, !!workflow.level2_required),
      date: workflow.level2_approved_at,
      notes: workflow.level2_notes,
      approver: approverNames?.mentor,
    },
    {
      key: "hod",
      level: 3,
      label: "Head of Department",
      role: "Department Approval",
      icon: Building2,
      state: stageState(3, workflow.level3_approved_at, !!workflow.level3_required),
      date: workflow.level3_approved_at,
      notes: workflow.level3_notes,
      approver: approverNames?.hod,
    },
    {
      key: "dean",
      level: 4,
      label: "Academic Dean",
      role: "Final Sign-off",
      icon: GraduationCap,
      // Dean is implicit "completed" only when overall workflow is approved AND required level >= 4
      state:
        workflow.required_approval_level >= 4
          ? isApproved
            ? "completed"
            : currentLevel >= 4
            ? "current"
            : "pending"
          : "skipped",
      date: isApproved && workflow.required_approval_level >= 4 ? workflow.level3_approved_at : null,
      notes: null,
      approver: approverNames?.dean,
    },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Approval Workflow
        </h4>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            isApproved && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
            isRejected && "bg-destructive/10 text-destructive",
            isBypass && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
            !isApproved && !isRejected && !isBypass && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          )}
        >
          {isBypass ? "🚨 Emergency Bypass" : isApproved ? "Approved" : isRejected ? "Rejected" : "In Progress"}
        </span>
      </div>

      {isBypass && workflow.bypass_reason && (
        <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-2 text-xs text-orange-800 dark:text-orange-200 flex gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span><strong>Emergency bypass:</strong> {workflow.bypass_reason}</span>
        </div>
      )}

      <ol className="relative">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const styles = stateStyles(stage.state);
          const isLast = idx === stages.length - 1;
          return (
            <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <div className={cn("absolute left-[15px] top-8 w-0.5 h-[calc(100%-24px)]", styles.line)} />
              )}
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors",
                  styles.bg
                )}
              >
                {stage.state === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : stage.state === "rejected" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">
                    {stage.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{stage.role}</span>
                  </p>
                  <span className={cn("text-xs font-medium", styles.labelColor)}>{styles.label}</span>
                </div>
                {stage.approver && stage.state !== "skipped" && (
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.approver}</p>
                )}
                {stage.date && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(stage.date), "MMM d, yyyy · h:mm a")}
                  </p>
                )}
                {stage.notes && (
                  <p className="text-xs text-foreground/80 mt-1 italic">"{stage.notes}"</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isRejected && workflow.rejection_reason && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <strong>Rejected:</strong> {workflow.rejection_reason}
        </div>
      )}
    </div>
  );
}