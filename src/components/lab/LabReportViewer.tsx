import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Printer, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { escapeHtml, sanitizeHtmlDocument, sanitizeHtmlFragment } from "@/lib/htmlSanitizer";

interface LabReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  reportFileUrl: string | null;
  reportFileName?: string | null;
  /** Text notes to render if no file URL exists */
  fallbackNotes?: string | null;
  studentName?: string;
  rollNumber?: string;
  doctorName?: string;
  testDate?: string;
}

const getSignedUrl = async (storagePath: string): Promise<string | null> => {
  if (storagePath.startsWith("http")) return storagePath;
  const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(storagePath, 3600);
  if (error) { console.error("Signed URL error:", error); return null; }
  return data.signedUrl;
};

export async function openLabReport(reportFileUrl: string) {
  const url = await getSignedUrl(reportFileUrl);
  if (!url) return false;
  if (reportFileUrl.endsWith(".html")) {
    const res = await fetch(url);
    const html = sanitizeHtmlDocument(await res.text());
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  } else {
    window.open(url, "_blank");
  }
  return true;
}

export async function printLabReport(reportFileUrl: string) {
  const url = await getSignedUrl(reportFileUrl);
  if (!url) return false;
  if (reportFileUrl.endsWith(".html")) {
    const res = await fetch(url);
    const html = sanitizeHtmlDocument(await res.text());
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, "_blank");
    if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 600));
  } else {
    const w = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 600));
  }
  return true;
}

/** Build a self-contained HTML document from text notes for display in iframe */
function buildFallbackHtml(opts: {
  title: string;
  notes: string;
  studentName?: string;
  rollNumber?: string;
  doctorName?: string;
  testDate?: string;
}): string {
  const lines = opts.notes.split("\n").filter(l => l.trim());
  const params: { name: string; value: string; unit: string; refRange: string; flag: string }[] = [];
  let techNotes = "";

  for (const line of lines) {
    if (line.startsWith("LAB RESULTS:")) continue;
    if (line.startsWith("Technician Notes:")) { techNotes = line.replace("Technician Notes:", "").trim(); continue; }
    if (line.startsWith("Sample Quality:")) continue;
    const match = line.match(/^(.+?):\s*(.+?)\s+(\S+)\s+\(Ref:\s*(.+?)\)\s*(.*)?$/);
    if (match) {
      const rawFlag = (match[5] || "").trim();
      const flag = rawFlag.includes("HIGH") ? "high" : rawFlag.includes("LOW") ? "low" : rawFlag.includes("Normal") ? "normal" : "";
      params.push({ name: match[1].trim(), value: match[2].trim(), unit: match[3].trim(), refRange: match[4].trim(), flag });
    }
  }

  const dateStr = opts.testDate ? format(new Date(opts.testDate), "dd MMM yyyy") : "N/A";

  // Every caller-controlled field is escaped before it touches the markup.
  const escTitle = escapeHtml(opts.title.toUpperCase());
  const escName = escapeHtml(opts.studentName);
  const escRoll = escapeHtml(opts.rollNumber);
  const escDoctor = escapeHtml(opts.doctorName);
  const escNotes = escapeHtml(opts.notes);
  const escTechNotes = escapeHtml(techNotes);

  const rowsHtml = params.length > 0 ? params.map(p => {
    const flagHtml = p.flag === "high"
      ? '<span style="color:red;font-weight:bold">↑ HIGH</span>'
      : p.flag === "low"
        ? '<span style="color:red;font-weight:bold">↓ LOW</span>'
        : p.flag === "normal"
          ? '<span style="color:green">✓ Normal</span>'
          : "—";
    return `<tr><td>${escapeHtml(p.name)}</td><td><strong>${escapeHtml(p.value)}</strong></td><td>${escapeHtml(p.unit)}</td><td>${escapeHtml(p.refRange)}</td><td>${flagHtml}</td></tr>`;
  }).join("") : `<tr><td colspan="5" style="text-align:center;padding:20px;color:#888;">Raw results below</td></tr>`;

  const rawBlock = params.length === 0
    ? `<div style="background:#f8f9fa;padding:16px;border-radius:8px;margin-top:16px;white-space:pre-line;font-size:13px;">${escNotes}</div>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Lab Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',Georgia,serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a;line-height:1.6}
  .header{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:20px;margin-bottom:24px}
  .header h1{font-size:20px;color:#1e3a5f;letter-spacing:1px}
  .header h2{font-size:17px;color:#1e3a5f}
  .header .subtitle{font-size:10px;color:#666}
  .header .hc{margin-top:8px;padding-top:8px;border-top:1px solid #ddd}
  .header .hc-title{font-size:14px;font-weight:600;color:#0066cc}
  .doc-title{text-align:center;margin:20px 0}
  .doc-title h3{font-size:18px;text-decoration:underline;color:#003366}
  .section{margin-bottom:18px}
  .section-title{font-weight:bold;color:#003366;font-size:13px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .info-item{display:flex;font-size:12px}
  .info-label{font-weight:bold;min-width:140px;color:#333}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
  th{background:#f0f4f8;text-align:left;padding:8px;border:1px solid #ddd;font-size:11px;color:#333}
  td{padding:8px;border:1px solid #ddd}
  .notes-box{background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin:15px 0;font-size:12px;font-style:italic}
  .sig{margin-top:40px;display:flex;justify-content:space-between}
  .sig-box{text-align:center}
  .sig-line{border-top:1px solid #333;margin-top:35px;padding-top:6px;font-size:11px}
</style></head><body>
  <div class="header">
    <h1>NATIONAL INSTITUTE OF TECHNOLOGY</h1>
    <h2>WARANGAL</h2>
    <p class="subtitle">(An Institution of National Importance under Ministry of Education, Govt. of India)</p>
    <div class="hc"><p class="hc-title">HEALTH CENTRE — LABORATORY REPORT</p></div>
  </div>
  <div class="doc-title"><h3>LABORATORY INVESTIGATION REPORT</h3></div>
  <div class="section">
    <div class="section-title">PATIENT DETAILS</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Patient Name:</span><span>${escName || "N/A"}</span></div>
      <div class="info-item"><span class="info-label">Roll Number:</span><span>${escRoll || "N/A"}</span></div>
      <div class="info-item"><span class="info-label">Referring Doctor:</span><span>Dr. ${escDoctor || "N/A"}</span></div>
      <div class="info-item"><span class="info-label">Test Date:</span><span>${dateStr}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">TEST: ${escTitle}</div>
    <table>
      <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th><th>Flag</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${rawBlock}
  </div>
  ${escTechNotes && escTechNotes !== "None" ? `<div class="notes-box"><strong>Technician Notes:</strong> ${escTechNotes}</div>` : ""}
  <div class="sig">
    <div class="sig-box"><div class="sig-line">Lab Technician</div></div>
    <div class="sig-box"><div class="sig-line">Pathologist</div></div>
  </div>
</body></html>`;
}

export default function LabReportViewer({ open, onOpenChange, title, reportFileUrl, fallbackNotes, studentName, rollNumber, doctorName, testDate }: LabReportViewerProps) {
  const { toast } = useToast();
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (reportFileUrl) {
        loadContent();
      } else if (fallbackNotes) {
        // Generate formatted HTML from text notes
        const testName = title.split("—")[0]?.trim() || title;
        setHtmlContent(buildFallbackHtml({ title: testName, notes: fallbackNotes, studentName, rollNumber, doctorName, testDate }));
        setSignedUrl(null);
        setLoading(false);
      }
    }
    if (!open) {
      setHtmlContent(null);
      setSignedUrl(null);
    }
  }, [open, reportFileUrl, fallbackNotes]);

  const loadContent = async () => {
    if (!reportFileUrl) return;
    setLoading(true);
    try {
      const url = await getSignedUrl(reportFileUrl);
      if (!url) throw new Error("Could not get URL");
      setSignedUrl(url);
      if (reportFileUrl.endsWith(".html")) {
        const res = await fetch(url);
        const html = await res.text();
        setHtmlContent(sanitizeHtmlDocument(html));
      } else {
        setHtmlContent(null);
      }
    } catch {
      toast({ title: "Error", description: "Could not load report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (htmlContent) {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 600));
    } else if (signedUrl) {
      const w = window.open(signedUrl, "_blank");
      if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 600));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <TestTube className="w-4 h-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full rounded-lg border overflow-hidden bg-white relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loading report...</div>
          ) : htmlContent ? (
            <iframe srcDoc={htmlContent} sandbox="" className="w-full h-full border-0" title="Lab Report" />
          ) : signedUrl ? (
            <iframe src={signedUrl} className="w-full h-full border-0" title="Lab Report" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No report available</div>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (htmlContent) {
              const blob = new Blob([htmlContent], { type: "text/html" });
              window.open(URL.createObjectURL(blob), "_blank");
            } else if (signedUrl) {
              window.open(signedUrl, "_blank");
            }
          }}>
            <Eye className="w-4 h-4 mr-1" />Open in New Tab
          </Button>
          <Button variant="default" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
