import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Download, User, Calendar, Search, Printer, Eye, RefreshCw, FileText } from "lucide-react";
import { format } from "date-fns";
import { printDocument, getNitwHeaderHtml } from "@/lib/print/printDocument";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateLabReportHtmlBlob } from "@/lib/print/generateLabReportHtml";
import { escapeHtml, sanitizeHtmlDocument } from "@/lib/htmlSanitizer";

/** Formatted lab notes block for the View Results dialog */
function FormattedLabNotesBlock({ notes }: { notes: string }) {
  if (!notes.startsWith("LAB RESULTS")) {
    return <div className="border rounded-lg p-4 text-sm whitespace-pre-line bg-background">{notes}</div>;
  }
  const lines = notes.split("\n").filter(l => l.trim());
  const params: Array<{ name: string; value: string; unit: string; ref: string; isHigh: boolean; isLow: boolean }> = [];
  let techNotes = "";
  let sampleQuality = "";

  for (const line of lines) {
    if (line.startsWith("LAB RESULTS:")) continue;
    if (line.startsWith("Technician Notes:")) { techNotes = line.replace("Technician Notes:", "").trim(); continue; }
    if (line.startsWith("Sample Quality:")) { sampleQuality = line.replace("Sample Quality:", "").trim(); continue; }
    const match = line.match(/^(.+?):\s*(.+?)\s+(\S+)\s+\(Ref:\s*(.+?)\)\s*(.*)?$/);
    if (match) {
      params.push({
        name: match[1].trim(), value: match[2].trim(), unit: match[3].trim(), ref: match[4].trim(),
        isHigh: (match[5] || "").includes("HIGH"), isLow: (match[5] || "").includes("LOW"),
      });
    }
  }

  if (params.length === 0) {
    return <div className="border rounded-lg p-4 text-sm whitespace-pre-line bg-background">{notes}</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs">
            <th className="text-left p-2 font-medium">Parameter</th>
            <th className="text-left p-2 font-medium">Result</th>
            <th className="text-left p-2 font-medium">Unit</th>
            <th className="text-left p-2 font-medium">Ref. Range</th>
            <th className="text-left p-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className={`border-t ${p.isHigh || p.isLow ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
              <td className="p-2 text-muted-foreground">{p.name}</td>
              <td className="p-2 font-bold">{p.value}</td>
              <td className="p-2 text-muted-foreground text-xs">{p.unit}</td>
              <td className="p-2 text-muted-foreground text-xs">{p.ref}</td>
              <td className="p-2">
                {p.isHigh && <span className="text-red-600 font-semibold text-xs">↑ HIGH</span>}
                {p.isLow && <span className="text-red-600 font-semibold text-xs">↓ LOW</span>}
                {!p.isHigh && !p.isLow && <span className="text-green-600 text-xs">✓ Normal</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(techNotes && techNotes !== "None") && (
        <div className="border-t p-2 text-xs text-muted-foreground italic">
          <strong>Technician Notes:</strong> {techNotes}
        </div>
      )}
      {sampleQuality && (
        <div className="border-t p-2 text-xs text-muted-foreground">
          <strong>Sample Quality:</strong> {sampleQuality}
        </div>
      )}
    </div>
  );
}

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
  student?: { full_name: string; roll_number: string; branch: string | null; program: string };
  doctor?: { name: string; designation: string };
}

interface Props {
  reports: LabReport[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh?: () => void;
}

const getSignedUrl = async (storagePath: string): Promise<string | null> => {
  // If it's already a full URL (legacy data), return as-is
  if (storagePath.startsWith("http")) return storagePath;
  const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(storagePath, 3600);
  if (error) { console.error("Signed URL error:", error); return null; }
  return data.signedUrl;
};

export default function LabCompletedTests({ reports, searchQuery, onSearchChange, onRefresh }: Props) {
  const { toast } = useToast();
  const [viewReport, setViewReport] = useState<LabReport | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const filtered = reports.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.student?.full_name?.toLowerCase().includes(q) || 
           r.student?.roll_number?.toLowerCase().includes(q) || 
           r.test_name.toLowerCase().includes(q);
  });

  const [pdfViewContent, setPdfViewContent] = useState<string | null>(null);
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [pdfViewTitle, setPdfViewTitle] = useState("");

  const handleViewFile = async (r: LabReport) => {
    if (!r.report_file_url) return;
    const url = await getSignedUrl(r.report_file_url);
    if (!url) {
      toast({ title: "Error", description: "Could not load file", variant: "destructive" });
      return;
    }
    setPdfViewTitle(`${r.test_name} — ${r.student?.full_name} (${r.student?.roll_number})`);
    setPdfViewUrl(url);
    // For HTML reports, fetch content and use srcdoc for proper rendering
    if (isHtmlReport(r)) {
      try {
        const res = await fetch(url);
        const html = await res.text();
        setPdfViewContent(sanitizeHtmlDocument(html));
      } catch {
        setPdfViewContent(null);
      }
    } else {
      setPdfViewContent(null);
    }
  };

  const isHtmlReport = (r: LabReport) => r.report_file_url?.endsWith(".html") || r.report_file_name?.endsWith(".html");

  const handlePrintFile = async (r: LabReport) => {
    if (!r.report_file_url) { handlePrint(r); return; }
    const url = await getSignedUrl(r.report_file_url);
    if (url) {
      if (isHtmlReport(r)) {
        try {
          const res = await fetch(url);
          const html = await res.text();
          const blob = new Blob([sanitizeHtmlDocument(html)], { type: "text/html" });
          const blobUrl = URL.createObjectURL(blob);
          const printWin = window.open(blobUrl, "_blank");
          if (printWin) printWin.addEventListener("load", () => setTimeout(() => printWin.print(), 600));
        } catch {
          toast({ title: "Error", description: "Could not load file for printing", variant: "destructive" });
        }
      } else {
        const printWin = window.open(url, "_blank");
        if (printWin) printWin.addEventListener("load", () => setTimeout(() => printWin.print(), 600));
      }
    } else {
      toast({ title: "Error", description: "Could not load file for printing", variant: "destructive" });
    }
  };

  const handlePrint = async (r: LabReport) => {
    const reportNo = `LR/${format(new Date(r.created_at), "yyyyMMdd")}/${r.id.slice(0, 6).toUpperCase()}`;

    // Get signed URL for embedding in print
    let fileEmbed = "";
    if (r.report_file_url) {
      const url = await getSignedUrl(r.report_file_url);
      if (url) {
        const isPdf = r.report_file_name?.toLowerCase().endsWith(".pdf");
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(r.report_file_name || "");
        if (isPdf) {
          fileEmbed = `<div class="section"><div class="section-title">ATTACHED REPORT</div><iframe src="${escapeHtml(url)}" style="width:100%;height:600px;border:1px solid #ddd;border-radius:4px;" title="Lab Report"></iframe></div>`;
        } else if (isImage) {
          fileEmbed = `<div class="section"><div class="section-title">ATTACHED REPORT</div><img src="${escapeHtml(url)}" style="max-width:100%;border:1px solid #ddd;border-radius:4px;" alt="Lab Report" /></div>`;
        } else {
          fileEmbed = `<div class="section"><div class="section-title">ATTACHED REPORT</div><div class="info-box"><strong>File:</strong> ${escapeHtml(r.report_file_name)}<br/><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Download File</a></div></div>`;
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
          <div class="info-item"><span class="info-label">Patient Name:</span><span>${escapeHtml(r.student?.full_name || "N/A")}</span></div>
          <div class="info-item"><span class="info-label">Roll Number:</span><span>${escapeHtml(r.student?.roll_number || "N/A")}</span></div>
          <div class="info-item"><span class="info-label">Programme:</span><span>${escapeHtml(r.student?.program || "N/A")}</span></div>
          <div class="info-item"><span class="info-label">Referring Doctor:</span><span>Dr. ${escapeHtml(r.doctor?.name || "N/A")}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">TEST: ${escapeHtml(r.test_name.toUpperCase())}</div>
        <div class="body-text" style="white-space:pre-line">${escapeHtml(r.notes || "Results attached as file.")}</div>
      </div>
      ${fileEmbed}
      <div class="signature-section">
        <div class="signature-box"><div class="signature-line">Lab Technician</div></div>
        <div class="signature-box"><div class="signature-line">Pathologist</div></div>
      </div>
    `;
    await printDocument({ title: `Lab Report — ${r.student?.full_name}`, bodyHtml, documentId: reportNo, documentType: "LAB_REPORT" });
  };

  const handleGeneratePdf = async (r: LabReport) => {
    if (!r.notes) {
      toast({ title: "Error", description: "No results data to generate PDF from", variant: "destructive" });
      return;
    }
    setGeneratingPdf(r.id);
    try {
      // Parse notes to extract parameters
      const lines = r.notes.split("\n").filter(l => l.includes(":") && !l.startsWith("Technician") && !l.startsWith("Sample") && !l.startsWith("LAB"));
      const pdfParams = lines.map(line => {
        const match = line.match(/^(.+?):\s*(.+?)\s*(\S+)\s*\(Ref:\s*(.+?)\)\s*(.*)?$/);
        if (match) {
          const flag = match[5]?.includes("HIGH") ? "High" : match[5]?.includes("LOW") ? "Low" : "Normal";
          return { name: match[1].trim(), value: match[2].trim(), unit: match[3].trim(), refRange: match[4].trim(), flag };
        }
        // Simpler format: "Name: value unit (Ref: range)"
        const simpleMatch = line.match(/^(.+?):\s*(.+?)\s+(\S+)\s+\(Ref:\s*(.+?)\)/);
        if (simpleMatch) {
          return { name: simpleMatch[1].trim(), value: simpleMatch[2].trim(), unit: simpleMatch[3].trim(), refRange: simpleMatch[4].trim(), flag: "Normal" as string };
        }
        return null;
      }).filter(Boolean) as Array<{ name: string; value: string; unit: string; refRange: string; flag: string }>;

      if (pdfParams.length === 0) {
        toast({ title: "Error", description: "Could not parse results from notes", variant: "destructive" });
        setGeneratingPdf(null);
        return;
      }

      // Extract tech notes
      const techNotesMatch = r.notes.match(/Technician Notes:\s*(.+)/);
      const techNotes = techNotesMatch?.[1]?.trim() || "";
      const sampleOkMatch = r.notes.match(/Sample Quality:\s*(.+)/);
      const sampleOk = sampleOkMatch?.[1]?.trim() === "OK";

      const htmlBlob = await generateLabReportHtmlBlob({
        reportId: r.id,
        testName: r.test_name,
        studentName: r.student?.full_name || "N/A",
        rollNumber: r.student?.roll_number || "N/A",
        program: r.student?.program || "N/A",
        branch: r.student?.branch || "N/A",
        doctorName: r.doctor?.name || "N/A",
        testDate: r.created_at,
        parameters: pdfParams,
        techNotes,
        sampleOk,
      });

      const fileName = `${r.student_id}/${Date.now()}_${r.test_name.replace(/\s+/g, '_')}_Report.html`;
      const { error: uploadError } = await supabase.storage
        .from("lab-reports")
        .upload(fileName, htmlBlob, { contentType: "text/html" });

      if (uploadError) throw uploadError;

      const { error } = await supabase.from("lab_reports").update({
        report_file_url: fileName,
        report_file_name: `${r.test_name}_Report.html`,
      }).eq("id", r.id);

      if (error) throw error;

      toast({ title: "✅ PDF Generated", description: `PDF report created for ${r.test_name}` });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate PDF", variant: "destructive" });
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">✅ Completed Tests</h2>
        <Badge className="bg-emerald-100 text-emerald-700">{filtered.length} completed</Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search completed tests..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No completed reports</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{r.student?.full_name}</span>
                      <Badge variant="outline" className="text-xs">{r.student?.roll_number}</Badge>
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">{r.test_name}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(r.updated_at), "dd MMM yyyy, hh:mm a")}</span>
                      <span><CheckCircle2 className="w-3 h-3 inline text-emerald-500" /> Verified</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.report_file_url ? (
                      <Button variant="outline" size="sm" onClick={() => handleViewFile(r)}>
                        <Eye className="w-3 h-3 mr-1" />View Report
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setViewReport(r)}>
                          <Eye className="w-3 h-3 mr-1" />View Results
                        </Button>
                        {r.notes && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => handleGeneratePdf(r)}
                            disabled={generatingPdf === r.id}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${generatingPdf === r.id ? 'animate-spin' : ''}`} />
                            {generatingPdf === r.id ? 'Generating...' : 'Generate PDF'}
                          </Button>
                        )}
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handlePrintFile(r)}>
                      <Printer className="w-3 h-3 mr-1" />Print
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Results Dialog */}
      {viewReport && (
        <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                Lab Results — {viewReport.test_name}
              </DialogTitle>
            </DialogHeader>
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{viewReport.student?.full_name} ({viewReport.student?.roll_number})</p>
                <p className="text-xs text-muted-foreground">{viewReport.student?.program} • {viewReport.student?.branch || "N/A"}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Completed: {format(new Date(viewReport.updated_at), "dd MMM yyyy, hh:mm a")}
            </div>
            {viewReport.notes ? (
              <FormattedLabNotesBlock notes={viewReport.notes} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No entered results. Check attached file.</p>
            )}
            <div className="flex gap-2 justify-end">
              {viewReport.report_file_url && (
                <Button variant="default" size="sm" onClick={() => handleViewFile(viewReport)}>
                  <Eye className="w-4 h-4 mr-1" />Open PDF Report
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => handlePrint(viewReport)}>
                <Printer className="w-4 h-4 mr-1" />Print
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PDF/HTML Viewer Dialog */}
      {(pdfViewUrl || pdfViewContent) && (
        <Dialog open={!!(pdfViewUrl || pdfViewContent)} onOpenChange={() => { setPdfViewUrl(null); setPdfViewContent(null); }}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4 text-primary" />
                {pdfViewTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full rounded-lg border overflow-hidden bg-white relative">
              {pdfViewContent ? (
                <iframe
                  srcDoc={pdfViewContent}
                  className="w-full h-full border-0"
                  title="Lab Report"
                />
              ) : pdfViewUrl ? (
                <iframe
                  src={pdfViewUrl}
                  className="w-full h-full border-0"
                  title="Lab Report"
                />
              ) : null}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              {pdfViewUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={pdfViewUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-1" />Download
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                if (pdfViewContent) {
                  const blob = new Blob([pdfViewContent], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                } else if (pdfViewUrl) {
                  window.open(pdfViewUrl, "_blank");
                }
              }}>
                <Eye className="w-4 h-4 mr-1" />Open in New Tab
              </Button>
              <Button variant="default" size="sm" onClick={() => {
                if (pdfViewContent) {
                  const blob = new Blob([pdfViewContent], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const w = window.open(url, "_blank");
                  if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 600));
                } else if (pdfViewUrl) {
                  const w = window.open(pdfViewUrl, "_blank");
                  if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 600));
                }
              }}>
                <Printer className="w-4 h-4 mr-1" />Print
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
