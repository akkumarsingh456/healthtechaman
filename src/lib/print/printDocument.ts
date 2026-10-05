import { format } from "date-fns";
import { generateQRDataUrl } from "@/hooks/useQRCode";
import { getFooterStyles, getFooterHtml } from "./generateVerificationQR";
import { newVerificationCode, getCodeVerifyUrl, saveIssuedDocument } from "./issuedDocuments";

/**
 * Shared print utility that opens a new window with full WYSIWYG styling.
 * All documents go through this single function to guarantee identical output.
 */
export interface PrintDocumentOptions {
  title: string;
  bodyHtml: string;
  /** Extra CSS appended inside <style>. Caller can override defaults. */
  extraCss?: string;
  documentId: string;
  documentType: string;
  /** If false/undefined the verification footer is appended automatically. */
  skipFooter?: boolean;
}

export const printDocument = async (opts: PrintDocumentOptions) => {
  const { title, bodyHtml, extraCss = "", documentId, documentType, skipFooter } = opts;
  const verifyCode = newVerificationCode();
  const verificationUrl = getCodeVerifyUrl(verifyCode);
  const qrDataUrl = await generateQRDataUrl(verificationUrl, 80);
  const currentDate = format(new Date(), "PPP");

  const printWindow = window.open("", "", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow popups to print documents.");
    return;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          /* ===== Base reset & typography ===== */
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
            position: relative;
          }

          /* ===== WATERMARK — flattened, non-removable ===== */
          body::before {
            content: 'NOT AN OFFICIAL DOCUMENT – DO NOT USE FOR LEAVE, CERTIFICATION, OR ANY OFFICIAL PURPOSE    NOT AN OFFICIAL DOCUMENT – DO NOT USE FOR LEAVE, CERTIFICATION, OR ANY OFFICIAL PURPOSE    NOT AN OFFICIAL DOCUMENT – DO NOT USE FOR LEAVE, CERTIFICATION, OR ANY OFFICIAL PURPOSE    NOT AN OFFICIAL DOCUMENT – DO NOT USE FOR LEAVE, CERTIFICATION, OR ANY OFFICIAL PURPOSE    NOT AN OFFICIAL DOCUMENT – DO NOT USE FOR LEAVE, CERTIFICATION, OR ANY OFFICIAL PURPOSE    NOT AN OFFICIAL DOCUMENT – DO NOT USE FOR LEAVE, CERTIFICATION, OR ANY OFFICIAL PURPOSE';
            position: fixed;
            top: -50%;
            left: -50%;
            width: 300%;
            height: 300%;
            font-size: 28px;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: 900;
            color: rgba(180,0,0,0.12);
            transform: rotate(-35deg);
            transform-origin: center center;
            z-index: 9999;
            pointer-events: none;
            white-space: nowrap;
            line-height: 120px;
            word-spacing: 40px;
            letter-spacing: 2px;
            overflow: hidden;
          }
          body::after {
            content: 'STUDENT PROJECT – NOT VALID FOR OFFICIAL USE    STUDENT PROJECT – NOT VALID FOR OFFICIAL USE    STUDENT PROJECT – NOT VALID FOR OFFICIAL USE    STUDENT PROJECT – NOT VALID FOR OFFICIAL USE    STUDENT PROJECT – NOT VALID FOR OFFICIAL USE    STUDENT PROJECT – NOT VALID FOR OFFICIAL USE';
            position: fixed;
            top: -50%;
            left: -25%;
            width: 300%;
            height: 300%;
            font-size: 22px;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: 900;
            color: rgba(0,0,180,0.08);
            transform: rotate(-55deg);
            transform-origin: center center;
            z-index: 9998;
            pointer-events: none;
            white-space: nowrap;
            line-height: 150px;
            word-spacing: 60px;
            letter-spacing: 1px;
            overflow: hidden;
          }
          /* Top disclaimer bar */
          .watermark-top-bar {
            text-align: center;
            font-size: 8pt;
            color: #999999;
            border-bottom: 1px solid #ddd;
            padding-bottom: 6px;
            margin-bottom: 12px;
            font-family: Arial, sans-serif;
          }
          /* Bottom disclaimer bar */
          .watermark-bottom-bar {
            text-align: center;
            font-size: 8pt;
            color: #999999;
            border-top: 1px solid #ddd;
            padding-top: 6px;
            margin-top: 16px;
            font-family: Arial, sans-serif;
          }

          /* ===== Institutional header ===== */
          .nitw-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            border-bottom: 2px solid #1e3a5f;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .nitw-header img.emblem {
            width: 75px;
            height: 90px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .nitw-header .text {
            flex: 1;
            text-align: center;
          }
          .nitw-header h1 {
            font-size: 20px;
            color: #1e3a5f;
            letter-spacing: 1px;
            font-weight: 700;
            margin-bottom: 2px;
          }
          .nitw-header h2 {
            font-size: 17px;
            color: #1e3a5f;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .nitw-header .subtitle {
            font-size: 10px;
            color: #666;
          }
          .nitw-header .address { font-size: 10px; color: #666; }
          .nitw-header .health-centre {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
          }
          .nitw-header .hc-title {
            font-size: 14px;
            font-weight: 600;
            color: #0066cc;
          }
          .nitw-header .hc-contact {
            font-size: 10px;
            color: #666;
            margin-top: 2px;
          }

          /* ===== Document title ===== */
          .doc-title {
            text-align: center;
            margin: 20px 0;
          }
          .doc-title h3 {
            font-size: 18px;
            text-decoration: underline;
            color: #003366;
            letter-spacing: 0.5px;
            font-weight: bold;
          }
          .doc-title .cert-no {
            font-size: 11px;
            color: #888;
            margin-top: 6px;
          }

          /* ===== Info grids ===== */
          .ref-date {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #333;
            margin-bottom: 16px;
          }
          .section { margin-bottom: 18px; page-break-inside: avoid; }
          .section-title {
            font-weight: bold;
            color: #003366;
            font-size: 13px;
            text-transform: uppercase;
            border-bottom: 1px solid #ddd;
            padding-bottom: 4px;
            margin-bottom: 8px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .info-item { display: flex; font-size: 12px; }
          .info-label { font-weight: bold; min-width: 140px; color: #333; }
          .full-width { grid-column: 1 / -1; }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin: 10px 0;
          }

          /* ===== Tables ===== */
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
          th { background: #f0f4f8; text-align: left; padding: 8px; border: 1px solid #ddd; font-size: 11px; color: #333; }
          td { padding: 8px; border: 1px solid #ddd; }

          /* ===== Body text ===== */
          .body-text { text-align: justify; font-size: 13px; line-height: 1.7; margin: 16px 0; }
          .body-text p { margin-bottom: 10px; }

          /* ===== Notes box ===== */
          .notes-box {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 10px 14px;
            margin: 15px 0;
            font-size: 12px;
            font-style: italic;
          }

          /* ===== Priority badge ===== */
          .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 8px;
          }
          .priority-low { background: #dcfce7; color: #166534; }
          .priority-medium { background: #fef3c7; color: #92400e; }
          .priority-high { background: #fee2e2; color: #991b1b; }

          /* ===== Signature block ===== */
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .signature-box { text-align: center; }
          .online-signature {
            font-family: 'Brush Script MT', 'Segoe Script', cursive;
            font-size: 22px;
            color: #003366;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 35px;
            padding-top: 6px;
            font-size: 11px;
          }
          .doctor-type { font-size: 10px; color: #666; margin-top: 2px; }
          .emblem-area { text-align: center; }
          .emblem-area img { width: 80px; height: 95px; object-fit: contain; }
          .emblem-label { font-size: 9px; color: #003366; margin-top: 4px; font-weight: 500; }

          /* ===== Mentor section ===== */
          .mentor-section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin: 15px 0;
          }
          .mentor-title {
            font-weight: bold;
            color: #0369a1;
            font-size: 12px;
            margin-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }

          /* ===== Hospital box ===== */
          .hospital-box {
            background: #f0f7ff;
            border: 1px solid #cce0ff;
            border-radius: 6px;
            padding: 12px;
            margin-top: 8px;
          }
          .hospital-name { font-weight: bold; font-size: 14px; color: #003366; margin-bottom: 8px; }
          .hospital-detail { font-size: 11px; color: #444; margin: 4px 0; }
          .emergency-number { color: #c53030; font-weight: bold; }

          /* ===== Directions ===== */
          .directions-box {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 6px;
            padding: 10px;
            margin-top: 8px;
            font-size: 11px;
          }
          .directions-title { font-weight: bold; color: #065f46; margin-bottom: 5px; }

          /* ===== Status badges ===== */
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .status-approved { background: #d4edda; color: #155724; }
          .status-pending { background: #fff3cd; color: #856404; }

          /* ===== Footer / Date line ===== */
          .doc-footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #888;
          }
          .doc-footer p { margin: 3px 0; }

          ${getFooterStyles()}

          /* ===== Caller overrides ===== */
          ${extraCss}

          /* ===== Print media ===== */
          @media print {
            body { padding: 20px; }
            body::before, body::after {
              position: fixed;
            }
            .watermark-top-bar, .watermark-bottom-bar, .watermark-legal-bar {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page { margin: 15mm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="watermark-top-bar">⚠️ This is a student project document. No official validity. NOT for official use.</div>
        ${bodyHtml}
        ${!skipFooter ? getFooterHtml(verifyCode, documentType, qrDataUrl, currentDate) : ""}
        <div class="watermark-legal-bar" style="text-align:center;font-size:9pt;color:#cc0000;border-top:2px solid #cc0000;padding:10px 8px;margin-top:20px;font-family:Arial,sans-serif;font-weight:bold;background:#fff5f5;">
          ⚠️ DISCLAIMER: This is not the official website of NIT Warangal. No medical claims or documents issued here are valid for official, legal, or medical purposes. All data is dummy or publicly available from the NIT Warangal website.
        </div>
        <div class="watermark-bottom-bar">⚠️ This is a student project document. No official validity. Do not use for medical leave or any official purpose.</div>
      </body>
    </html>
  `;
  printWindow.document.write(fullHtml);
  void saveIssuedDocument({ code: verifyCode, docType: documentType, title, html: fullHtml, sourceId: documentId });
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

/**
 * Returns the standard NIT Warangal header HTML.
 * Pass an optional subtitle (e.g. "PRESCRIPTION", "MEDICAL CERTIFICATE").
 */
export const getNitwHeaderHtml = (subtitle?: string): string => `
  <div class="nitw-header">
    <img src="/nitw-emblem.png" alt="NIT Warangal Official Emblem" class="emblem" />
    <div class="text">
      <h1>NATIONAL INSTITUTE OF TECHNOLOGY</h1>
      <h2>WARANGAL</h2>
      <p class="subtitle">(An Institution of National Importance under Ministry of Education, Govt. of India)</p>
      <p class="address">Warangal, Telangana - 506004</p>
      <div class="health-centre">
        <p class="hc-title">HEALTH CENTRE${subtitle ? ` — ${subtitle}` : ""}</p>
        <p class="hc-contact">Phone: 0870-2462022 | Email: healthcentre@nitw.ac.in</p>
      </div>
    </div>
  </div>
`;
