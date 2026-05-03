import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { getCompactFooterStyles, getCompactFooterHtml } from "@/lib/print/generateVerificationQR";
import { generateQRDataUrl } from "@/hooks/useQRCode";
import { format } from "date-fns";
interface HospitalInfo {
  name: string;
  location: string;
  entitlement?: string;
  phone?: string;
  emergency?: string;
  address?: string;
  directions?: string;
  mapUrl?: string;
  specialties?: string[];
}

interface StudentEmergencyContacts {
  emergencyContact?: string;
  emergencyRelationship?: string;
  fatherName?: string;
  fatherContact?: string;
  motherName?: string;
  motherContact?: string;
  mentorName?: string;
  mentorContact?: string;
  personalPhone?: string;
  aadharNumber?: string;
}

interface PrintableHospitalCardProps {
  hospital: HospitalInfo;
  studentName?: string;
  studentRollNumber?: string;
  studentProgram?: string;
  studentBranch?: string;
  referralDate?: string;
  emergencyContacts?: StudentEmergencyContacts;
  illnessDescription?: string;
  doctorNotes?: string;
}

const PrintableHospitalCard = ({ 
  hospital, 
  studentName, 
  studentRollNumber,
  studentProgram,
  studentBranch,
  referralDate,
  emergencyContacts,
  illnessDescription,
  doctorNotes
}: PrintableHospitalCardProps) => {
  const handlePrint = async () => {
    const documentId = `HC-${Date.now().toString(36).toUpperCase()}`;
    const verificationUrl = `${window.location.origin}/verify?doc=hospital-card&id=${documentId}`;
    const qrDataUrl = await generateQRDataUrl(verificationUrl, 60);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the hospital card');
      return;
    }

    const currentDate = referralDate || format(new Date(), 'PPP');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hospital Referral Card - ${hospital.name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: #fff;
            color: #1a1a1a;
          }
          .card {
            max-width: 450px;
            margin: 0 auto;
            border: 2px solid #1a365d;
            border-radius: 12px;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .header {
            background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
            color: white;
            padding: 16px;
          }
          .header-content {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .header-emblem {
            width: 50px;
            height: 60px;
            object-fit: contain;
            flex-shrink: 0;
            background: white;
            padding: 4px;
            border-radius: 4px;
          }
          .header-text {
            flex: 1;
            text-align: center;
          }
          .header h1 {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 2px;
            letter-spacing: 0.5px;
          }
          .header h2 {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 2px;
          }
          .header .subtitle {
            font-size: 8px;
            opacity: 0.9;
            margin-bottom: 4px;
          }
          .header .health-centre {
            font-size: 11px;
            font-weight: 400;
            opacity: 0.95;
            border-top: 1px solid rgba(255,255,255,0.3);
            padding-top: 4px;
            margin-top: 4px;
          }
          .hospital-name {
            background: #edf2f7;
            padding: 12px 16px;
            border-bottom: 1px solid #e2e8f0;
          }
          .hospital-name h3 {
            font-size: 16px;
            font-weight: 700;
            color: #1a365d;
            margin-bottom: 4px;
          }
          .hospital-name p {
            font-size: 12px;
            color: #4a5568;
          }
          .content {
            padding: 16px;
          }
          .info-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px dashed #e2e8f0;
          }
          .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .info-row .label {
            font-size: 10px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .info-row .value {
            font-size: 13px;
            color: #1a1a1a;
            line-height: 1.4;
          }
          .emergency {
            background: #fed7d7;
            border: 1px solid #fc8181;
            border-radius: 8px;
            padding: 10px 12px;
            margin-top: 12px;
          }
          .emergency .label {
            color: #c53030;
            font-weight: 600;
            font-size: 11px;
          }
          .emergency .value {
            color: #c53030;
            font-weight: 700;
            font-size: 18px;
          }
          .student-info {
            background: #f0fff4;
            border-top: 2px solid #1a365d;
            padding: 12px 16px;
          }
          .student-info h4 {
            font-size: 10px;
            color: #276749;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .student-info p {
            font-size: 12px;
            color: #1a1a1a;
            margin-bottom: 3px;
          }
          .student-info p strong {
            color: #1a365d;
          }
          .emergency-contacts {
            background: #fff5f5;
            border-top: 2px solid #c53030;
            padding: 12px 16px;
          }
          .emergency-contacts h4 {
            font-size: 10px;
            color: #c53030;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .contact-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .contact-item {
            background: white;
            border: 1px solid #feb2b2;
            border-radius: 6px;
            padding: 8px;
          }
          .contact-item .contact-label {
            font-size: 9px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .contact-item .contact-name {
            font-size: 11px;
            color: #1a365d;
            font-weight: 600;
            margin-bottom: 1px;
          }
          .contact-item .contact-phone {
            font-size: 12px;
            color: #c53030;
            font-weight: 700;
          }
          .primary-contact {
            grid-column: span 2;
            background: #c53030;
            border-color: #c53030;
          }
          .primary-contact .contact-label {
            color: #fed7d7;
          }
          .primary-contact .contact-name {
            color: white;
          }
          .primary-contact .contact-phone {
            color: white;
            font-size: 16px;
          }
          .footer {
            background: #1a365d;
            color: white;
            padding: 10px 16px;
            text-align: center;
            font-size: 10px;
          }
          .specialties {
280:             display: flex;
281:             flex-wrap: wrap;
282:             gap: 4px;
283:             margin-top: 4px;
284:           }
285:           .specialty-tag {
286:             background: #e2e8f0;
287:             padding: 2px 8px;
288:             border-radius: 10px;
289:             font-size: 10px;
290:             color: #4a5568;
291:           }
          .medical-details {
            background: #fffbeb;
            border-top: 2px solid #d97706;
            padding: 12px 16px;
          }
          .medical-details h4 {
            font-size: 10px;
            color: #92400e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .medical-details .detail-item {
            margin-bottom: 8px;
          }
          .medical-details .detail-label {
            font-size: 9px;
            color: #92400e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .medical-details .detail-value {
            font-size: 12px;
            color: #1a1a1a;
            line-height: 1.4;
          }
          .doctor-notes-value {
            font-style: italic;
            color: #4a5568 !important;
            border-left: 3px solid #d97706;
            padding-left: 8px;
          }
          ${getCompactFooterStyles()}
          @media print {
            body {
              padding: 0;
            }
            .card {
              border: 2px solid #1a365d;
            }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="header-content">
              <img src="/nitw-emblem.png" alt="NIT Warangal" class="header-emblem" />
              <div class="header-text">
                <h1>NATIONAL INSTITUTE OF TECHNOLOGY</h1>
                <h2>WARANGAL</h2>
                <p class="subtitle">(An Institution of National Importance under Ministry of Education, Govt. of India)</p>
                <p class="health-centre">Health Centre - Hospital Referral Card</p>
              </div>
            </div>
          </div>
          
          <div class="hospital-name">
            <h3>🏥 ${hospital.name}</h3>
            <p>📍 ${hospital.location}</p>
          </div>
          
          <div class="content">
            ${hospital.address ? `
              <div class="info-row">
                <div>
                  <div class="label">Full Address</div>
                  <div class="value">${hospital.address}</div>
                </div>
              </div>
            ` : ''}
            
            ${hospital.phone ? `
              <div class="info-row">
                <div>
                  <div class="label">Contact Number</div>
                  <div class="value">📞 ${hospital.phone}</div>
                </div>
              </div>
            ` : ''}
            
            ${hospital.directions ? `
              <div class="info-row">
                <div>
                  <div class="label">Directions from NIT Warangal</div>
                  <div class="value">🧭 ${hospital.directions}</div>
                </div>
              </div>
            ` : ''}

            ${hospital.specialties && hospital.specialties.length > 0 ? `
              <div class="info-row">
                <div>
                  <div class="label">Specialties Available</div>
                  <div class="specialties">
                    ${hospital.specialties.map(s => `<span class="specialty-tag">${s}</span>`).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
            
            ${hospital.emergency ? `
              <div class="emergency">
                <div class="label">🚨 HOSPITAL EMERGENCY HELPLINE</div>
                <div class="value">${hospital.emergency}</div>
              </div>
            ` : ''}
          </div>
          
          ${(() => {
            const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
            return (studentName || studentRollNumber) ? `
            <div class="student-info">
              <h4>👤 Student Details</h4>
              ${studentName ? `<p><strong>Name:</strong> ${esc(studentName)}</p>` : ''}
              ${studentRollNumber ? `<p><strong>Roll No:</strong> ${esc(studentRollNumber)}</p>` : ''}
              ${emergencyContacts?.aadharNumber ? `<p><strong>Aadhaar No:</strong> ${esc(emergencyContacts.aadharNumber)}</p>` : ''}
              ${emergencyContacts?.fatherName ? `<p><strong>Father's Name:</strong> ${esc(emergencyContacts.fatherName)}</p>` : ''}
              ${studentProgram ? `<p><strong>Program:</strong> ${esc(studentProgram)}</p>` : ''}
              ${studentBranch ? `<p><strong>Branch:</strong> ${esc(studentBranch)}</p>` : ''}
              ${emergencyContacts?.personalPhone ? `<p><strong>Student Phone:</strong> ${esc(emergencyContacts.personalPhone)}</p>` : ''}
              <p><strong>Referral Date:</strong> ${currentDate}</p>
            </div>
          ` : `
            <div class="student-info">
              <h4>Referral Date</h4>
              <p>${currentDate}</p>
            </div>
          `;
          })()}
          
          ${illnessDescription || doctorNotes ? `
            <div class="medical-details">
              <h4>🩺 Medical Information</h4>
              ${illnessDescription ? `
                <div class="detail-item">
                  <div class="detail-label">Illness / Condition</div>
                  <div class="detail-value">${String(illnessDescription).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>
                </div>
              ` : ''}
              ${doctorNotes ? `
                <div class="detail-item">
                  <div class="detail-label">Doctor's Notes</div>
                  <div class="detail-value doctor-notes-value">${String(doctorNotes).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${emergencyContacts ? `
            <div class="emergency-contacts">
              <h4>🆘 Emergency Contacts</h4>
              <div class="contact-grid">
                ${emergencyContacts.emergencyContact ? `
                  <div class="contact-item primary-contact">
                    <div class="contact-label">Primary Emergency Contact${emergencyContacts.emergencyRelationship ? ` (${String(emergencyContacts.emergencyRelationship).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))})` : ''}</div>
                    <div class="contact-phone">📞 ${String(emergencyContacts.emergencyContact).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>
                  </div>
                ` : ''}
                
                ${emergencyContacts.fatherName || emergencyContacts.fatherContact ? `
                  <div class="contact-item">
                    <div class="contact-label">Father</div>
                    ${emergencyContacts.fatherName ? `<div class="contact-name">${String(emergencyContacts.fatherName).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>` : ''}
                    ${emergencyContacts.fatherContact ? `<div class="contact-phone">📞 ${String(emergencyContacts.fatherContact).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>` : ''}
                  </div>
                ` : ''}
                
                ${emergencyContacts.motherName || emergencyContacts.motherContact ? `
                  <div class="contact-item">
                    <div class="contact-label">Mother</div>
                    ${emergencyContacts.motherName ? `<div class="contact-name">${String(emergencyContacts.motherName).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>` : ''}
                    ${emergencyContacts.motherContact ? `<div class="contact-phone">📞 ${String(emergencyContacts.motherContact).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>` : ''}
                  </div>
                ` : ''}
                
                ${emergencyContacts.mentorName || emergencyContacts.mentorContact ? `
                  <div class="contact-item">
                    <div class="contact-label">Faculty Mentor</div>
                    ${emergencyContacts.mentorName ? `<div class="contact-name">${String(emergencyContacts.mentorName).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>` : ''}
                    ${emergencyContacts.mentorContact ? `<div class="contact-phone">📞 ${String(emergencyContacts.mentorContact).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</div>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          ${getCompactFooterHtml(documentId, qrDataUrl)}
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="gap-2"
    >
      <Printer className="h-4 w-4" />
      Print Hospital Card
    </Button>
  );
};

export default PrintableHospitalCard;
