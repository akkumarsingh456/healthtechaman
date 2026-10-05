import { newVerificationCode, getCodeVerifyUrl, saveIssuedDocument } from "./issuedDocuments";
import { format } from "date-fns";
import { generateQRDataUrl } from "@/hooks/useQRCode";
import { getFooterStyles, getFooterHtml } from "./generateVerificationQR";

interface LabReportHtmlOptions {
  reportId: string;
  testName: string;
  studentName: string;
  rollNumber: string;
  program: string;
  branch: string;
  doctorName: string;
  testDate: string;
  parameters: Array<{ name: string; value: string; unit: string; refRange: string; flag: string }>;
  techNotes: string;
  sampleOk: boolean;
}

/**
 * Convert the NITW emblem to a base64 data URL so it works inside blob: contexts.
 */
async function getEmblemBase64(): Promise<string> {
  try {
    const res = await fetch("/nitw-emblem.png");
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return "/nitw-emblem.png";
  }
}

/**
 * Generates a full self-contained HTML document for a lab report,
 * identical to the Print Report view. Returns a Blob that can be
 * stored in Supabase Storage and displayed in an iframe/object tag.
 */
export async function generateLabReportHtmlBlob(opts: LabReportHtmlOptions): Promise<Blob> {
  const reportNo = `LR/${format(new Date(opts.testDate), "yyyyMMdd")}/${opts.reportId.slice(0, 6).toUpperCase()}`;
  const verifyCode = newVerificationCode();
  const verificationUrl = getCodeVerifyUrl(verifyCode);
  const [qrDataUrl, emblemBase64] = await Promise.all([
    generateQRDataUrl(verificationUrl, 80),
    getEmblemBase64(),
  ]);
  const currentDate = format(new Date(), "PPP");

  const rowsHtml = opts.parameters.map(p => {
    const flagHtml = p.flag === "high" || p.flag === "High"
      ? '<span style="color:red;font-weight:bold">↑ HIGH</span>'
      : p.flag === "low" || p.flag === "Low"
        ? '<span style="color:red;font-weight:bold">↓ LOW</span>'
        : p.flag === "normal" || p.flag === "Normal"
          ? '<span style="color:green">✓ Normal</span>'
          : "—";
    return `<tr>
      <td>${p.name}</td>
      <td><strong>${p.value || "—"}</strong></td>
      <td>${p.unit}</td>
      <td>${p.refRange}</td>
      <td>${flagHtml}</td>
    </tr>`;
  }).join("");

  const bodyHtml = `
    <div class="nitw-header">
      <img src="${emblemBase64}" alt="NIT Warangal Official Emblem" class="emblem" />
      <div class="text">
        <h1>NATIONAL INSTITUTE OF TECHNOLOGY</h1>
        <h2>WARANGAL</h2>
        <p class="subtitle">(An Institution of National Importance under Ministry of Education, Govt. of India)</p>
        <p class="address">Warangal, Telangana - 506004</p>
        <div class="health-centre">
          <p class="hc-title">HEALTH CENTRE — LABORATORY REPORT</p>
          <p class="hc-contact">Phone: 0870-2462022 | Email: healthcentre@nitw.ac.in</p>
        </div>
      </div>
    </div>
    <div class="doc-title">
      <h3>LABORATORY INVESTIGATION REPORT</h3>
      <div class="cert-no">Report No.: ${reportNo}</div>
    </div>
    <div class="section">
      <div class="section-title">PATIENT DETAILS</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Patient Name:</span><span>${opts.studentName}</span></div>
        <div class="info-item"><span class="info-label">Roll Number:</span><span>${opts.rollNumber}</span></div>
        <div class="info-item"><span class="info-label">Programme:</span><span>${opts.program}</span></div>
        <div class="info-item"><span class="info-label">Branch:</span><span>${opts.branch || "N/A"}</span></div>
        <div class="info-item"><span class="info-label">Referring Doctor:</span><span>Dr. ${opts.doctorName}</span></div>
        <div class="info-item"><span class="info-label">Test Date:</span><span>${format(new Date(opts.testDate), "dd MMM yyyy")}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">TEST: ${opts.testName.toUpperCase()}</div>
      <table>
        <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th><th>Flag</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${opts.techNotes ? `<div class="notes-box"><strong>Technician Notes:</strong> ${opts.techNotes}</div>` : ""}
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">Lab Technician</div>
        <div class="doctor-type">NIT Warangal Health Centre</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Pathologist</div>
        <div class="doctor-type">NIT Warangal Health Centre</div>
      </div>
    </div>
  `;

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Lab Report — ${opts.studentName}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      color: #1a1a1a;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .nitw-header {
      display: flex; align-items: flex-start; gap: 16px;
      border-bottom: 2px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 24px;
    }
    .nitw-header img.emblem { width: 75px; height: 90px; object-fit: contain; flex-shrink: 0; }
    .nitw-header .text { flex: 1; text-align: center; }
    .nitw-header h1 { font-size: 20px; color: #1e3a5f; letter-spacing: 1px; font-weight: 700; margin-bottom: 2px; }
    .nitw-header h2 { font-size: 17px; color: #1e3a5f; font-weight: 700; margin-bottom: 4px; }
    .nitw-header .subtitle { font-size: 10px; color: #666; }
    .nitw-header .address { font-size: 10px; color: #666; }
    .nitw-header .health-centre { margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd; }
    .nitw-header .hc-title { font-size: 14px; font-weight: 600; color: #0066cc; }
    .nitw-header .hc-contact { font-size: 10px; color: #666; margin-top: 2px; }
    .doc-title { text-align: center; margin: 20px 0; }
    .doc-title h3 { font-size: 18px; text-decoration: underline; color: #003366; letter-spacing: 0.5px; font-weight: bold; }
    .doc-title .cert-no { font-size: 11px; color: #888; margin-top: 6px; }
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section-title { font-weight: bold; color: #003366; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item { display: flex; font-size: 12px; }
    .info-label { font-weight: bold; min-width: 140px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th { background: #f0f4f8; text-align: left; padding: 8px; border: 1px solid #ddd; font-size: 11px; color: #333; }
    td { padding: 8px; border: 1px solid #ddd; }
    .notes-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; margin: 15px 0; font-size: 12px; font-style: italic; }
    .signature-section { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid #333; margin-top: 35px; padding-top: 6px; font-size: 11px; }
    .doctor-type { font-size: 10px; color: #666; margin-top: 2px; }
    ${getFooterStyles()}
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  ${getFooterHtml(reportNo, "LAB_REPORT", qrDataUrl, currentDate)}
</body>
</html>`;

  void saveIssuedDocument({ code: verifyCode, docType: "LAB_REPORT", title: `Lab Report — ${opts.studentName}`, html: fullHtml, sourceId: reportNo });
  return new Blob([fullHtml], { type: "text/html" });
}
