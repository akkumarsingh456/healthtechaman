import { newVerificationCode, getCodeVerifyUrl, saveIssuedDocument } from "@/lib/print/issuedDocuments";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Building2, Calendar, User, GraduationCap, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { getFooterStyles, getFooterHtml } from "@/lib/print/generateVerificationQR";
import { generateQRDataUrl } from "@/hooks/useQRCode";

interface DoctorDetails {
  name: string;
  designation?: string;
  qualification?: string;
  isSenior?: boolean;
}

interface MentorDetails {
  name?: string;
  department?: string;
  phone?: string;
  email?: string;
}

interface AcademicDetails {
  hodName?: string;
  hodDepartment?: string;
  semester?: string;
  yearOfStudy?: string;
}

interface LeaveLetterData {
  id: string;
  studentName: string;
  rollNumber: string;
  program: string;
  branch?: string | null;
  batch?: string;
  referralHospital: string;
  illnessDescription?: string | null;
  doctorName?: string | null;
  doctorDetails?: DoctorDetails | null;
  mentorDetails?: MentorDetails | null;
  academicDetails?: AcademicDetails | null;
  referralDate: string;
  leaveStartDate?: string | null;
  expectedReturnDate?: string | null;
  restDays?: number | null;
  doctorNotes?: string | null;
  approvalDate?: string | null;
  status: string;
}

interface PrintableLeaveLetterProps {
  leaveData: LeaveLetterData;
  onClose?: () => void;
}

const PrintableLeaveLetter = ({ leaveData, onClose }: PrintableLeaveLetterProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const documentId = `ML-${leaveData.id.slice(0, 8).toUpperCase()}`;
    const verifyCode = newVerificationCode();
    const verificationUrl = getCodeVerifyUrl(verifyCode);
    const qrDataUrl = await generateQRDataUrl(verificationUrl, 80);
    const currentDate = format(new Date(), "PPP");

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medical Leave Letter - ${leaveData.studentName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Times New Roman', serif;
              padding: 40px;
              line-height: 1.6;
              color: #1a1a1a;
            }
            .header {
              margin-bottom: 30px;
              border-bottom: 2px solid #1e3a5f;
              padding-bottom: 20px;
            }
            .header-content {
              display: flex;
              align-items: flex-start;
              gap: 16px;
            }
            .header-emblem {
              width: 70px;
              height: 85px;
              object-fit: contain;
              flex-shrink: 0;
            }
            .header-text {
              flex: 1;
              text-align: center;
            }
            .header h1 {
              font-size: 20px;
              color: #1e3a5f;
              font-weight: 700;
              margin-bottom: 4px;
              letter-spacing: 1px;
            }
            .header h2 {
              font-size: 16px;
              color: #1e3a5f;
              font-weight: 600;
              margin-bottom: 4px;
            }
            .header .subtitle {
              font-size: 11px;
              color: #666;
              margin-bottom: 8px;
            }
            .header .health-centre {
              font-size: 14px;
              font-weight: 600;
              color: #0066cc;
              border-top: 1px solid #ddd;
              padding-top: 8px;
              margin-top: 8px;
            }
            .header .contact-info {
              font-size: 11px;
              color: #666;
              margin-top: 4px;
            }
            .title {
              text-align: center;
              margin: 25px 0;
            }
            .title h3 {
              font-size: 20px;
              text-decoration: underline;
              color: #003366;
            }
            .ref-date {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              font-size: 14px;
            }
            .content {
              margin: 20px 0;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-weight: bold;
              color: #003366;
              margin-bottom: 10px;
              font-size: 14px;
              text-transform: uppercase;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .info-item {
              display: flex;
            }
            .info-label {
              font-weight: bold;
              min-width: 150px;
              color: #333;
            }
            .info-value {
              color: #1a1a1a;
            }
            .full-width {
              grid-column: 1 / -1;
            }
            .body-text {
              text-align: justify;
              margin: 20px 0;
              font-size: 14px;
            }
            .mentor-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
            }
            .mentor-title {
              font-weight: bold;
              color: #0369a1;
              font-size: 13px;
              margin-bottom: 10px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 5px;
            }
            .signature-section {
              margin-top: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
            }
            .signature-box {
              text-align: center;
              min-width: 160px;
            }
            .signature-line {
              border-top: 1px solid #333;
              margin-top: 40px;
              padding-top: 8px;
            }
            .online-signature {
              font-family: 'Brush Script MT', 'Segoe Script', cursive;
              font-size: 24px;
              color: #003366;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .doctor-type {
              font-size: 11px;
              color: #666;
              margin-top: 3px;
            }
            .stamp-area {
              border: 3px double #003366;
              width: 110px;
              height: 110px;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            }
            .stamp-text {
              font-size: 9px;
              color: #003366;
              font-weight: bold;
              text-align: center;
            }
            .stamp-title {
              font-size: 11px;
              color: #003366;
              font-weight: bold;
              margin: 3px 0;
            }
            .stamp-institution {
              font-size: 8px;
              color: #666;
            }
            ${getFooterStyles()}
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .status-approved {
              background: #d4edda;
              color: #155724;
            }
            .status-pending {
              background: #fff3cd;
              color: #856404;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          ${getFooterHtml(verifyCode, 'Medical Leave Certificate', qrDataUrl, currentDate)}
        </body>
      </html>
    `;
    printWindow.document.write(fullHtml);
    void saveIssuedDocument({ code: verifyCode, docType: "Medical Leave Certificate", title: `Medical Leave Letter - ${leaveData.studentName}`, html: fullHtml, sourceId: documentId });
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleDownloadPDF = () => {
    // For now, trigger print which can save as PDF
    handlePrint();
  };

  const isApproved = leaveData.status === "on_leave" || leaveData.status === "returned";
  const currentDate = format(new Date(), "PPP");

  return (
    <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-0">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Medical Leave Letter</CardTitle>
              <p className="text-sm text-muted-foreground">
                Official document for academic department submission
              </p>
            </div>
          </div>
          <Badge 
            className={isApproved 
              ? "bg-green-100 text-green-800" 
              : "bg-amber-100 text-amber-800"
            }
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {isApproved ? "Approved" : "Pending"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 print:hidden">
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Letter
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="ml-auto">
              Close Preview
            </Button>
          )}
        </div>

        {/* Printable Content */}
        <div 
          ref={printRef} 
          className="bg-white border rounded-lg p-8 shadow-sm"
          style={{ minHeight: "842px" }} // A4 aspect
        >
          {/* Header */}
          <div className="header mb-6 pb-4 border-b-2 border-primary">
            <div className="flex items-start gap-4">
              <img 
                src="/nitw-emblem.png" 
                alt="NIT Warangal Official Emblem" 
                className="w-16 h-20 object-contain flex-shrink-0"
              />
              <div className="flex-1 text-center">
                <h1 className="text-xl font-bold text-primary tracking-wide">
                  NATIONAL INSTITUTE OF TECHNOLOGY
                </h1>
                <p className="text-lg font-semibold text-primary mt-1">WARANGAL</p>
                <p className="text-xs text-muted-foreground mt-1">
                  (An Institution of National Importance under Ministry of Education, Govt. of India)
                </p>
                <p className="text-xs text-muted-foreground">Warangal, Telangana - 506004</p>
                <div className="mt-2 pt-2 border-t border-muted">
                  <p className="text-sm font-semibold text-secondary">HEALTH CENTRE</p>
                  <p className="text-xs text-muted-foreground">
                    Phone: 0870-2462022 | Email: healthcentre@nitw.ac.in
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6">
            <h3 className="text-xl font-semibold underline text-primary">
              MEDICAL LEAVE CERTIFICATE
            </h3>
          </div>

          {/* Reference & Date */}
          <div className="flex justify-between text-sm mb-6">
            <div>
              <span className="font-semibold">Ref No:</span> NITW/HC/ML/{leaveData.id.slice(0, 8).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold">Date:</span> {currentDate}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Student Details */}
          <div className="mb-6">
            <h4 className="font-semibold text-sm uppercase text-primary border-b pb-2 mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Student Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex">
                <span className="font-semibold min-w-[140px]">Name:</span>
                <span>{leaveData.studentName}</span>
              </div>
              <div className="flex">
                <span className="font-semibold min-w-[140px]">Roll Number:</span>
                <span>{leaveData.rollNumber}</span>
              </div>
              <div className="flex">
                <span className="font-semibold min-w-[140px]">Program:</span>
                <span>{leaveData.program}</span>
              </div>
              {leaveData.branch && (
                <div className="flex">
                  <span className="font-semibold min-w-[140px]">Branch:</span>
                  <span>{leaveData.branch}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mentor & Academic Details */}
          {(leaveData.mentorDetails || leaveData.academicDetails) && (
            <div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h4 className="font-semibold text-sm uppercase text-sky-700 border-b border-slate-200 pb-2 mb-3">
                Academic & Mentorship Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {leaveData.mentorDetails?.name && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">Mentor Name:</span>
                    <span>{leaveData.mentorDetails.name}</span>
                  </div>
                )}
                {leaveData.mentorDetails?.department && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">Department:</span>
                    <span>{leaveData.mentorDetails.department}</span>
                  </div>
                )}
                {leaveData.mentorDetails?.phone && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">Mentor Contact:</span>
                    <span>{leaveData.mentorDetails.phone}</span>
                  </div>
                )}
                {leaveData.mentorDetails?.email && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">Mentor Email:</span>
                    <span>{leaveData.mentorDetails.email}</span>
                  </div>
                )}
                {leaveData.academicDetails?.hodName && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">HOD:</span>
                    <span>{leaveData.academicDetails.hodName}</span>
                  </div>
                )}
                {leaveData.academicDetails?.yearOfStudy && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">Year of Study:</span>
                    <span>{leaveData.academicDetails.yearOfStudy}</span>
                  </div>
                )}
                {leaveData.academicDetails?.semester && (
                  <div className="flex">
                    <span className="font-semibold min-w-[140px]">Semester:</span>
                    <span>{leaveData.academicDetails.semester}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Details */}
          <div className="mb-6">
            <h4 className="font-semibold text-sm uppercase text-primary border-b pb-2 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Medical Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex">
                <span className="font-semibold min-w-[140px]">Hospital:</span>
                <span>{leaveData.referralHospital}</span>
              </div>
              <div className="flex">
                <span className="font-semibold min-w-[140px]">Referring Doctor:</span>
                <span>{leaveData.doctorDetails?.name || leaveData.doctorName || "Campus Medical Officer"}</span>
              </div>
              {leaveData.doctorDetails?.designation && (
                <div className="flex">
                  <span className="font-semibold min-w-[140px]">Designation:</span>
                  <span>{leaveData.doctorDetails.designation}</span>
                </div>
              )}
              {leaveData.doctorDetails?.qualification && (
                <div className="flex">
                  <span className="font-semibold min-w-[140px]">Qualification:</span>
                  <span>{leaveData.doctorDetails.qualification}</span>
                </div>
              )}
              {leaveData.illnessDescription && (
                <div className="flex col-span-2">
                  <span className="font-semibold min-w-[140px]">Condition:</span>
                  <span>{leaveData.illnessDescription}</span>
                </div>
              )}
            </div>
          </div>

          {/* Leave Period */}
          <div className="mb-6">
            <h4 className="font-semibold text-sm uppercase text-primary border-b pb-2 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Leave Period
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex">
                <span className="font-semibold min-w-[140px]">Referral Date:</span>
                <span>{format(new Date(leaveData.referralDate), "PPP")}</span>
              </div>
              {leaveData.leaveStartDate && (
                <div className="flex">
                  <span className="font-semibold min-w-[140px]">Leave From:</span>
                  <span>{format(new Date(leaveData.leaveStartDate), "PPP")}</span>
                </div>
              )}
              {leaveData.expectedReturnDate && (
                <div className="flex">
                  <span className="font-semibold min-w-[140px]">Expected Return:</span>
                  <span>{format(new Date(leaveData.expectedReturnDate), "PPP")}</span>
                </div>
              )}
              {leaveData.restDays && (
                <div className="flex">
                  <span className="font-semibold min-w-[140px]">Rest Days:</span>
                  <span>{leaveData.restDays} days</span>
                </div>
              )}
            </div>
          </div>

          {/* Doctor's Remarks */}
          {leaveData.doctorNotes && (
            <div className="mb-6">
              <h4 className="font-semibold text-sm uppercase text-primary border-b pb-2 mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Doctor's Remarks
              </h4>
              <p className="text-sm bg-muted/50 p-3 rounded-lg italic">
                "{leaveData.doctorNotes}"
              </p>
            </div>
          )}

          {/* Body Text */}
          <div className="my-6 text-sm text-justify leading-relaxed">
            <p>
              This is to certify that <strong>{leaveData.studentName}</strong> (Roll No: <strong>{leaveData.rollNumber}</strong>), 
              a student of <strong>{leaveData.program}</strong>{leaveData.branch ? ` - ${leaveData.branch}` : ''}, 
              has been referred for medical treatment at <strong>{leaveData.referralHospital}</strong> and 
              is hereby granted medical leave from academic activities.
            </p>
            <p className="mt-3">
              The student is advised to take complete rest and follow the prescribed treatment. 
              {leaveData.restDays && ` A rest period of ${leaveData.restDays} days has been recommended.`}
            </p>
            <p className="mt-3">
              Kindly grant the necessary leave and academic relaxations as per institute norms.
            </p>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-3 gap-6 mt-12 pt-6">
            {/* CMO Official Seal */}
            <div className="text-center">
              <div className="border-3 border-double border-primary w-28 h-28 mx-auto flex flex-col items-center justify-center rounded-full bg-gradient-to-br from-slate-50 to-slate-100">
                <span className="text-[9px] font-bold text-primary text-center leading-tight">CHIEF MEDICAL OFFICER</span>
                <span className="text-[11px] font-bold text-primary my-1">SEAL</span>
                <span className="text-[8px] text-muted-foreground">NIT Warangal</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Official Seal</p>
            </div>
            
            {/* Doctor Signature */}
            <div className="text-center">
              <div className="h-10 flex items-center justify-center">
                <span className="font-['Brush_Script_MT','Segoe_Script',cursive] text-2xl text-primary italic">
                  {leaveData.doctorDetails?.name || leaveData.doctorName || "Medical Officer"}
                </span>
              </div>
              <div className="border-t border-foreground mt-2 pt-2">
                <p className="font-semibold text-sm">{leaveData.doctorDetails?.name || leaveData.doctorName || "Medical Officer"}</p>
                <p className="text-xs text-muted-foreground">{leaveData.doctorDetails?.designation || "Medical Officer"}</p>
                {leaveData.doctorDetails?.qualification && (
                  <p className="text-xs text-muted-foreground">{leaveData.doctorDetails.qualification}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {leaveData.doctorDetails?.isSenior ? "Senior Medical Officer" : "Medical Officer"}
                </p>
              </div>
            </div>

            {/* For Office Use */}
            <div className="text-center">
              <div className="border-t border-foreground mt-12 pt-2">
                <p className="font-semibold text-sm">Dean (Student Welfare)</p>
                <p className="text-xs text-muted-foreground">NIT Warangal</p>
                <p className="text-[10px] text-muted-foreground mt-1">(For leaves &gt; 7 days)</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-4 border-t text-xs text-muted-foreground text-center">
            <p>This is a digitally generated document with electronic signature. For verification, contact Health Centre.</p>
            <p className="mt-1">
              Generated on: {currentDate} | Document ID: {leaveData.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrintableLeaveLetter;
