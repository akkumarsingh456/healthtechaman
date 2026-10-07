import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, FileText, ExternalLink, Download, Printer, ArrowLeft, Calendar, CheckCircle2, Eye } from "lucide-react";
import { format } from "date-fns";
import { printDocument, getNitwHeaderHtml } from "@/lib/print/printDocument";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LabReportViewer, { printLabReport } from "@/components/lab/LabReportViewer";

/** Formats raw lab notes into a styled summary */
function FormattedLabNotes({ notes }: { notes: string }) {
  if (!notes.startsWith("LAB RESULTS")) {
    return <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{notes}</p>;
  }
  // Parse "Name: value unit (Ref: range)" entries
  const lines = notes.split("\n").filter(l => l.trim());
  const params: Array<{ name: string; value: string; rest: string; isHigh: boolean; isLow: boolean }> = [];
  let techNotes = "";
  let sampleQuality = "";
  
  for (const line of lines) {
    if (line.startsWith("LAB RESULTS:")) continue;
    if (line.startsWith("Technician Notes:")) { techNotes = line.replace("Technician Notes:", "").trim(); continue; }
    if (line.startsWith("Sample Quality:")) { sampleQuality = line.replace("Sample Quality:", "").trim(); continue; }
    const match = line.match(/^(.+?):\s*(.+?)\s+(\S+)\s+\(Ref:\s*(.+?)\)\s*(.*)?$/);
    if (match) {
      const isHigh = (match[5] || "").includes("HIGH");
      const isLow = (match[5] || "").includes("LOW");
      params.push({ name: match[1].trim(), value: match[2].trim(), rest: `${match[3]} (Ref: ${match[4]})`, isHigh, isLow });
    }
  }

  if (params.length === 0) {
    return <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{notes}</p>;
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {params.map((p, i) => (
          <span key={i} className="text-xs">
            <span className="text-muted-foreground">{p.name}:</span>{" "}
            <span className={`font-semibold ${p.isHigh ? "text-red-600" : p.isLow ? "text-red-600" : "text-foreground"}`}>
              {p.value}
            </span>{" "}
            <span className="text-muted-foreground/70">{p.rest}</span>
            {p.isHigh && <span className="text-red-500 text-[10px] ml-0.5">↑</span>}
            {p.isLow && <span className="text-red-500 text-[10px] ml-0.5">↓</span>}
          </span>
        ))}
      </div>
      {techNotes && techNotes !== "None" && (
        <p className="text-xs text-muted-foreground italic">Notes: {techNotes}</p>
      )}
    </div>
  );
}

interface LabReport {
  id: string;
  test_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  report_file_url: string | null;
  report_file_name: string | null;
  student_id: string;
  doctor_id: string | null;
  student?: { full_name: string; roll_number: string; branch: string | null; program: string };
  doctor?: { name: string; designation: string };
}

interface Props {
  reports: LabReport[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

interface StudentGroup {
  student: LabReport["student"];
  rollNumber: string;
  total: number;
  pending: number;
  completed: number;
  reports: LabReport[];
}

const getSignedUrl = async (storagePath: string): Promise<string | null> => {
  if (storagePath.startsWith("http")) return storagePath;
  const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(storagePath, 3600);
  if (error) { console.error("Signed URL error:", error); return null; }
  return data.signedUrl;
};

export default function LabStudentRecords({ reports, searchQuery, onSearchChange }: Props) {
  const [selectedStudent, setSelectedStudent] = useState<StudentGroup | null>(null);
  const [viewingReport, setViewingReport] = useState<LabReport | null>(null);
  const { toast } = useToast();

  const studentMap = new Map<string, StudentGroup>();
  reports.forEach(r => {
    if (!r.student) return;
    const key = r.student.roll_number;
    const existing = studentMap.get(key);
    if (existing) {
      existing.total++;
      if (r.status === "pending") existing.pending++;
      else existing.completed++;
      existing.reports.push(r);
    } else {
      studentMap.set(key, {
        student: r.student,
        rollNumber: r.student.roll_number,
        total: 1,
        pending: r.status === "pending" ? 1 : 0,
        completed: r.status === "completed" ? 1 : 0,
        reports: [r],
      });
    }
  });

  const students = Array.from(studentMap.values()).filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.student?.full_name?.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q);
  });

  const handleViewFile = async (r: LabReport) => {
    if (!r.report_file_url) return;
    const url = await getSignedUrl(r.report_file_url);
    if (url) window.open(url, "_blank");
    else toast({ title: "Error", description: "Could not load file", variant: "destructive" });
  };

  const handlePrintReport = async (r: LabReport) => {
    const reportNo = `LR/${format(new Date(r.created_at), "yyyyMMdd")}/${r.id.slice(0, 6).toUpperCase()}`;

    let fileEmbed = "";
    if (r.report_file_url) {
      const url = await getSignedUrl(r.report_file_url);
      if (url) {
        const isPdf = r.report_file_name?.toLowerCase().endsWith(".pdf");
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(r.report_file_name || "");
        if (isPdf) {
          fileEmbed = `<div class="section"><div class="section-title">ATTACHED REPORT</div><iframe src="${url}" style="width:100%;height:600px;border:1px solid #ddd;border-radius:4px;" title="Lab Report"></iframe></div>`;
        } else if (isImage) {
          fileEmbed = `<div class="section"><div class="section-title">ATTACHED REPORT</div><img src="${url}" style="max-width:100%;border:1px solid #ddd;border-radius:4px;" alt="Lab Report" /></div>`;
        } else {
          fileEmbed = `<div class="section"><div class="section-title">ATTACHED REPORT</div><div class="info-box"><strong>File:</strong> ${r.report_file_name}<br/><a href="${url}" target="_blank">Download File</a></div></div>`;
        }
      }
    }

    const bodyHtml = `
      ${getNitwHeaderHtml("LABORATORY REPORT")}
      <div class="doc-title">
        <h3>LABORATORY INVESTIGATION REPORT</h3>
        <div class="cert-no">Report No.: ${reportNo}</div>
      </div>
      <div class="section">
        <div class="section-title">PATIENT DETAILS</div>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">Patient Name:</span><span>${r.student?.full_name || "N/A"}</span></div>
          <div class="info-item"><span class="info-label">Roll Number:</span><span>${r.student?.roll_number || "N/A"}</span></div>
          <div class="info-item"><span class="info-label">Programme:</span><span>${r.student?.program || "N/A"}</span></div>
          ${r.student?.branch ? `<div class="info-item"><span class="info-label">Branch:</span><span>${r.student.branch}</span></div>` : ""}
          <div class="info-item"><span class="info-label">Referring Doctor:</span><span>Dr. ${r.doctor?.name || "N/A"}</span></div>
          <div class="info-item"><span class="info-label">Date of Report:</span><span>${format(new Date(r.updated_at), "dd MMMM yyyy")}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">TEST: ${r.test_name.toUpperCase()}</div>
        <div class="body-text" style="white-space:pre-line">${r.notes || "Results attached as file."}</div>
      </div>
      ${fileEmbed}
      <div class="signature-section">
        <div class="signature-box"><div class="signature-line">Lab Technician</div></div>
        <div class="signature-box"><div class="signature-line">Pathologist</div></div>
      </div>
    `;
    await printDocument({ title: `Lab Report — ${r.student?.full_name}`, bodyHtml, documentId: reportNo, documentType: "LAB_REPORT" });
  };

  const labReportViewer = (
    <LabReportViewer
      open={!!viewingReport}
      onOpenChange={(open) => { if (!open) setViewingReport(null); }}
      title={viewingReport ? `${viewingReport.test_name} — ${viewingReport.student?.full_name} (${viewingReport.student?.roll_number})` : ''}
      reportFileUrl={viewingReport?.report_file_url || null}
      fallbackNotes={viewingReport?.notes}
      studentName={viewingReport?.student?.full_name}
      rollNumber={viewingReport?.student?.roll_number}
      doctorName={viewingReport?.doctor?.name}
      testDate={viewingReport?.created_at}
    />
  );

  if (selectedStudent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">{selectedStudent.student?.full_name}</h2>
            <p className="text-xs text-muted-foreground">{selectedStudent.rollNumber} • {selectedStudent.student?.program}{selectedStudent.student?.branch ? ` • ${selectedStudent.student.branch}` : ""}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Badge variant="outline"><FileText className="w-3 h-3 mr-1" />{selectedStudent.total} total</Badge>
          {selectedStudent.pending > 0 && <Badge className="bg-amber-100 text-amber-700">{selectedStudent.pending} pending</Badge>}
          {selectedStudent.completed > 0 && <Badge className="bg-emerald-100 text-emerald-700">{selectedStudent.completed} completed</Badge>}
        </div>

        <div className="space-y-2">
          {selectedStudent.reports.map(r => (
            <Card key={r.id} className={`border-l-4 ${r.status === "completed" ? "border-l-emerald-500" : "border-l-amber-500"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={r.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{r.test_name}</Badge>
                      <Badge variant="outline" className="text-xs">{r.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(r.updated_at), "dd MMM yyyy, hh:mm a")}</span>
                      {r.doctor?.name && <span>{r.doctor.name}</span>}
                      {r.status === "completed" && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Verified</span>}
                    </div>
                    {r.report_file_name && <p className="text-xs text-muted-foreground mt-1">📎 {r.report_file_name}</p>}
                    {r.notes && <FormattedLabNotes notes={r.notes} />}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.report_file_url ? (
                      <Button variant="outline" size="sm" onClick={() => setViewingReport(r)}>
                        <Eye className="w-3 h-3 mr-1" />View Report
                      </Button>
                    ) : r.status === "completed" && r.notes ? (
                      <Button variant="outline" size="sm" onClick={() => setViewingReport(r)}>
                        <Eye className="w-3 h-3 mr-1" />View Results
                      </Button>
                    ) : null}
                    {r.status === "completed" && (
                      <Button variant="ghost" size="sm" onClick={async () => {
                        if (r.report_file_url) {
                          const ok = await printLabReport(r.report_file_url);
                          if (!ok) toast({ title: "Error", description: "Could not print", variant: "destructive" });
                        } else {
                          handlePrintReport(r);
                        }
                      }}>
                        <Printer className="w-3 h-3 mr-1" />Print
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {labReportViewer}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <User className="w-5 h-5" />
        Student Directory — Lab Records
      </h2>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search students..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} className="pl-10" />
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No student records found</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {students.map(s => (
            <Card key={s.rollNumber} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedStudent(s)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{s.student?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.rollNumber} • {s.student?.program}</p>
                    {s.student?.branch && <p className="text-xs text-muted-foreground">{s.student.branch}</p>}
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-xs"><FileText className="w-3 h-3 mr-1" />{s.total} tests</Badge>
                  {s.pending > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">{s.pending} pending</Badge>}
                  {s.completed > 0 && <Badge className="bg-emerald-100 text-emerald-700 text-xs">{s.completed} done</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {labReportViewer}
    </div>
  );
}
