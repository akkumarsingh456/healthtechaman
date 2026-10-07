import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Stethoscope, Calendar, Upload, Clock, AlertTriangle, Plus, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LabResultEntryDialog from "./LabResultEntryDialog";
import RegisterSampleDialog from "./RegisterSampleDialog";

interface LabReport {
  id: string;
  test_name: string;
  notes: string | null;
  status: string;
  report_file_url: string | null;
  report_file_name: string | null;
  created_at: string;
  updated_at: string;
  student_id: string;
  doctor_id: string | null;
  prescription_id: string | null;
  student?: { full_name: string; roll_number: string; branch: string | null; program: string };
  doctor?: { name: string; designation: string };
}

interface Props {
  reports: LabReport[];
  onUpload: (report: LabReport, file: File) => void;
  uploadingId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  testFilter: string;
  onTestFilterChange: (f: string) => void;
  onRefresh: () => void;
}

// Tests that are physical/printed — lab officer can only "Mark Complete"
const PHYSICAL_TESTS = ["ecg", "x ray", "x-ray", "xray", "chest x ray", "chest x-ray", "electrocardiogram"];

const isPhysicalTest = (testName: string) =>
  PHYSICAL_TESTS.some(pt => testName.toLowerCase().includes(pt));

const priorityFromAge = (createdAt: string) => {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (hours > 24) return "high";
  if (hours > 6) return "medium";
  return "normal";
};

export default function LabProcessingQueue({
  reports, onUpload, uploadingId, searchQuery, onSearchChange, testFilter, onTestFilterChange, onRefresh
}: Props) {
  const { toast } = useToast();
  const [resultDialogReport, setResultDialogReport] = useState<LabReport | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleApprovePhysicalTest = async (report: LabReport) => {
    setApprovingId(report.id);
    try {
      const { error } = await supabase.from("lab_reports").update({
        status: "completed",
        notes: `Physical test completed (printed report). Approved on ${format(new Date(), "dd MMM yyyy, hh:mm a")}`,
        updated_at: new Date().toISOString(),
      }).eq("id", report.id);
      if (error) throw error;

      const { data: student } = await supabase.from("students").select("user_id").eq("id", report.student_id).single();
      if (student?.user_id) {
        await supabase.from("notifications").insert({
          user_id: student.user_id,
          title: "🔬 Test Completed",
          message: `Your ${report.test_name} has been completed. Please collect the printed report from the Health Centre.`,
          type: "lab_report",
        });
      }

      toast({ title: "✅ Test Approved", description: `${report.test_name} marked as completed for ${report.student?.full_name}` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const testTypes = [...new Set(reports.map(r => r.test_name))];

  const filtered = reports.filter(r => {
    if (testFilter && testFilter !== "all" && r.test_name !== testFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.student?.full_name?.toLowerCase().includes(q) || 
             r.student?.roll_number?.toLowerCase().includes(q) || 
             r.test_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">🔬 Pending Lab Tests — Processing Queue</h2>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />Register New Sample
          </Button>
          <Badge variant="outline" className="text-amber-600 border-amber-300 whitespace-nowrap">{filtered.length} pending</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by Patient Name/ID/Test Type..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} className="pl-10" />
        </div>
        <Select value={testFilter} onValueChange={onTestFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Tests" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tests</SelectItem>
            {testTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Queue */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No pending lab tests in queue</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const priority = priorityFromAge(r.created_at);
            return (
              <Card key={r.id} className={`border-l-4 ${
                priority === "high" ? "border-l-red-500" : priority === "medium" ? "border-l-amber-500" : "border-l-blue-500"
              } hover:shadow-md transition-shadow`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Patient info */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold">{r.student?.full_name || "Unknown"}</span>
                        <Badge variant="outline" className="text-xs">{r.student?.roll_number}</Badge>
                        {r.student?.program && <Badge variant="secondary" className="text-[10px]">{r.student.program}</Badge>}
                        {r.student?.branch && <Badge variant="secondary" className="text-[10px]">{r.student.branch}</Badge>}
                      </div>

                      {/* Test & Doctor */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />
                          Ordered by {r.doctor?.name || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
                        </span>
                      </div>

                      {/* Test badge & priority */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          Test: {r.test_name}
                        </Badge>
                        <Badge className={
                          priority === "high" ? "bg-red-100 text-red-700" : 
                          priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        }>
                          {priority === "high" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {priority === "high" ? "🔴 HIGH" : priority === "medium" ? "🟡 MEDIUM" : "🟢 NORMAL"}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.round((Date.now() - new Date(r.created_at).getTime()) / 3600000)}h ago
                        </span>
                      </div>

                      {r.notes && (
                        <p className="text-sm text-muted-foreground italic bg-muted/50 p-2 rounded">
                          Clinical Indication: {r.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      {isPhysicalTest(r.test_name) ? (
                        <Button 
                          size="sm" 
                          variant="default"
                          className="bg-green-700 hover:bg-green-800"
                          onClick={() => handleApprovePhysicalTest(r)}
                          disabled={approvingId === r.id}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {approvingId === r.id ? "Approving..." : "Approve Done"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="default" onClick={() => setResultDialogReport(r)}>
                          Enter Results
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {resultDialogReport && (
        <LabResultEntryDialog
          report={resultDialogReport}
          open={!!resultDialogReport}
          onClose={() => setResultDialogReport(null)}
          onUpload={onUpload}
          uploadingId={uploadingId}
          onRefresh={onRefresh}
        />
      )}

      <RegisterSampleDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={onRefresh}
      />
    </div>
  );
}
