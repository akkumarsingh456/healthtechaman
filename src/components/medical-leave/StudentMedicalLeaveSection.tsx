import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertCircle, ArrowRight, Building2, Calendar, CheckCircle2, 
  Clock, FileText, Home, Printer, ShieldCheck, Stethoscope 
} from "lucide-react";
import { format } from "date-fns";

interface StudentMedicalLeaveSectionProps {
  userId: string;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "student_form_pending":
      return { label: "Form Required", color: "bg-amber-100 text-amber-800", icon: FileText, urgent: true };
    case "on_leave":
      return { label: "On Leave", color: "bg-blue-100 text-blue-800", icon: Building2, urgent: false };
    case "return_pending":
      return { label: "Return Pending", color: "bg-purple-100 text-purple-800", icon: Home, urgent: true };
    case "returned":
      return { label: "Returned", color: "bg-green-100 text-green-800", icon: CheckCircle2, urgent: false };
    default:
      return { label: "Active", color: "bg-gray-100 text-gray-800", icon: Clock, urgent: false };
  }
};

const StudentMedicalLeaveSection = ({ userId }: StudentMedicalLeaveSectionProps) => {
  const navigate = useNavigate();

  const { data: leaveRequests, isLoading } = useQuery({
    queryKey: ["student-leave-dashboard", userId],
    queryFn: async () => {
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!studentData) return [];

      const { data, error } = await supabase
        .from("medical_leave_requests")
        .select(`
          id, status, referral_hospital, expected_duration, referral_date,
          illness_description, leave_start_date, expected_return_date,
          health_centre_visited, doctor_clearance,
          medical_officers!referring_doctor_id(name)
        `)
        .eq("student_id", studentData.id)
        .in("status", ["student_form_pending", "on_leave", "return_pending", "returned"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  if (isLoading || !leaveRequests || leaveRequests.length === 0) return null;

  const activeRequest = leaveRequests.find(r => 
    ["student_form_pending", "on_leave", "return_pending"].includes(r.status)
  );
  const latestReturned = leaveRequests.find(r => r.status === "returned" && !r.doctor_clearance);

  const displayRequest = activeRequest || latestReturned;
  if (!displayRequest) return null;

  const statusConfig = getStatusConfig(displayRequest.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`border-l-4 ${statusConfig.urgent ? 'border-l-amber-500 shadow-amber-100' : 'border-l-primary shadow-sm'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-primary" />
            Medical Leave
          </CardTitle>
          <Badge className={statusConfig.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
        <CardDescription>
          {displayRequest.status === "student_form_pending" 
            ? "Action required: Complete your departure form"
            : displayRequest.status === "returned" && !displayRequest.doctor_clearance
            ? "Visit health centre for fitness clearance"
            : `${displayRequest.referral_hospital}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Urgent alert for form pending */}
        {displayRequest.status === "student_form_pending" && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Departure Form Required</AlertTitle>
            <AlertDescription>
              {(displayRequest as any).medical_officers?.name || "Campus Doctor"} has referred you to{" "}
              <strong>{displayRequest.referral_hospital}</strong>. Complete the form before leaving campus.
            </AlertDescription>
          </Alert>
        )}

        {/* Returned but needs health centre visit */}
        {displayRequest.status === "returned" && !displayRequest.health_centre_visited && (
          <Alert className="bg-blue-50 border-blue-200">
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Health Centre Visit Required</AlertTitle>
            <AlertDescription className="text-blue-700">
              Please visit the campus health centre for a post-treatment checkup.
            </AlertDescription>
          </Alert>
        )}

        {/* Returned and visited, awaiting clearance */}
        {displayRequest.status === "returned" && displayRequest.health_centre_visited && !displayRequest.doctor_clearance && (
          <Alert className="bg-green-50 border-green-200">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Awaiting Fitness Clearance</AlertTitle>
            <AlertDescription className="text-green-700">
              Your health centre visit has been recorded. Awaiting doctor's fitness clearance.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Hospital</p>
            <p className="font-medium">{displayRequest.referral_hospital}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">{displayRequest.expected_duration}</p>
          </div>
          {displayRequest.referral_date && (
            <div>
              <p className="text-muted-foreground">Referred On</p>
              <p className="font-medium">{format(new Date(displayRequest.referral_date), "PP")}</p>
            </div>
          )}
          {displayRequest.illness_description && (
            <div>
              <p className="text-muted-foreground">Reason</p>
              <p className="font-medium truncate">{displayRequest.illness_description}</p>
            </div>
          )}
        </div>

        <Button 
          onClick={() => navigate("/medical-leave")} 
          className="w-full"
          variant={statusConfig.urgent ? "default" : "outline"}
        >
          {displayRequest.status === "student_form_pending" ? "Complete Departure Form" : "View Details"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default StudentMedicalLeaveSection;
