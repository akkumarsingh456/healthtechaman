import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, User, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  program: string;
  branch: string | null;
  user_id: string | null;
}

interface Doctor {
  id: string;
  name: string;
  designation: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: () => void;
}

const COMMON_TESTS = [
  "Complete Blood Count (CBC)",
  "Liver Function Test (LFT)",
  "Thyroid Profile",
  "Lipid Profile",
  "Blood Sugar (Fasting)",
  "Blood Sugar (PP)",
  "Urinalysis",
  "X-Ray",
  "ECG",
  "ESR",
  "Renal Function Test (RFT)",
  "Uric Acid",
  "Hemoglobin",
  "Widal Test",
  "Dengue NS1",
  "Malaria (Smear)",
];

export default function RegisterSampleDialog({ open, onClose, onRegistered }: Props) {
  const { toast } = useToast();
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [testName, setTestName] = useState("");
  const [customTest, setCustomTest] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("medical_officers").select("id, name, designation").then(({ data }) => {
        if (data) setDoctors(data);
      });
    }
  }, [open]);

  useEffect(() => {
    if (!studentSearch.trim() || studentSearch.length < 2) {
      setStudents([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const q = studentSearch.trim();
      const { data } = await supabase
        .from("students")
        .select("id, full_name, roll_number, program, branch, user_id")
        .or(`roll_number.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(10);
      setStudents(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [studentSearch]);

  const handleSubmit = async () => {
    const finalTest = testName === "custom" ? customTest.trim() : testName;
    if (!selectedStudent || !finalTest) {
      toast({ title: "Missing fields", description: "Select a student and test type", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("lab_reports").insert({
        student_id: selectedStudent.id,
        test_name: finalTest,
        doctor_id: selectedDoctorId || null,
        notes: notes.trim() || null,
        uploaded_by: user.id,
        status: "pending",
      });
      if (error) throw error;

      // Notify student
      if (selectedStudent.user_id) {
        await supabase.from("notifications").insert({
          user_id: selectedStudent.user_id,
          title: "🧪 Lab Sample Registered",
          message: `A new lab test "${finalTest}" has been registered for you. You will be notified when results are ready.`,
          type: "lab_report",
        });
      }

      toast({ title: "✅ Sample Registered", description: `${finalTest} registered for ${selectedStudent.full_name}` });
      resetForm();
      onRegistered();
      onClose();
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStudentSearch("");
    setStudents([]);
    setSelectedStudent(null);
    setSelectedDoctorId("");
    setTestName("");
    setCustomTest("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Register New Sample
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Student Search */}
          <div className="space-y-2">
            <Label>Patient <span className="text-destructive">*</span></Label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{selectedStudent.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedStudent.roll_number} • {selectedStudent.program}{selectedStudent.branch ? ` • ${selectedStudent.branch}` : ""}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setStudentSearch(""); }}>Change</Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by roll number or name..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
                {students.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {students.map(s => (
                      <button
                        key={s.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                        onClick={() => { setSelectedStudent(s); setStudents([]); setStudentSearch(""); }}
                      >
                        <span>{s.full_name}</span>
                        <Badge variant="outline" className="text-xs">{s.roll_number}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Type */}
          <div className="space-y-2">
            <Label>Test Type <span className="text-destructive">*</span></Label>
            <Select value={testName} onValueChange={setTestName}>
              <SelectTrigger><SelectValue placeholder="Select test type" /></SelectTrigger>
              <SelectContent>
                {COMMON_TESTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                <SelectItem value="custom">Other (Custom)</SelectItem>
              </SelectContent>
            </Select>
            {testName === "custom" && (
              <Input placeholder="Enter custom test name..." value={customTest} onChange={e => setCustomTest(e.target.value)} />
            )}
          </div>

          {/* Referring Doctor */}
          <div className="space-y-2">
            <Label>Referring Doctor</Label>
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger><SelectValue placeholder="Select doctor (optional)" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name} — {d.designation}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clinical Notes */}
          <div className="space-y-2">
            <Label>Clinical Indication / Notes</Label>
            <Textarea
              placeholder="e.g. Patient complains of fatigue, fever for 3 days..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !selectedStudent || (!testName || (testName === "custom" && !customTest.trim()))}>
              {submitting ? "Registering..." : "Register Sample"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
