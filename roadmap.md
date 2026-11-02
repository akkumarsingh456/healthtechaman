# Security fix roadmap (Nov 2, 2026 deep scan)

## Quick code fixes
- [ ] CSV formula injection — neutralize leading =+-@ in SecurityDashboard.tsx exports (2 findings)
- [ ] Chatbot: strip assistant-role messages from client-supplied history
- [ ] Chatbot: mitigate public metered-AI usage (rate limits exist; document)
- [ ] Sanitize lab report HTML before iframe/print (LabReportViewer.tsx, printDocument.ts)
- [ ] contact_submissions insert policy: validated WITH CHECK (in progress)

## Edge function ownership checks
- [ ] student-data-sync: derive roll from verified email, not client input (record takeover)
- [ ] gemini-auto-refresh: same takeover vector
- [ ] share-health-report: only own records (or doctor role)
- [ ] compose-gmail-share: only own records
- [ ] backup-student-to-drive: only own records
- [ ] send-registration-email: rate limit / restrict recipients
- [ ] send-appointment-notification: mask student emails
- [ ] compose-contact-mail + validate-contact-submission: rate limit public AI

## RLS migrations
- [ ] medical_leave_requests: only doctors can mark medically cleared
- [ ] appointments: only doctor/staff can mark confirmed
- [ ] issued_documents: ownership check per doc type (verified-document forgery)

## Intentional (document, ignore)
- [ ] verify-document public by design (QR scan shows document without login)
- [ ] Shared demo password by design (dummy data)
- [ ] mentors / medical_officers / working_staff phones & lists (dummy data, reviewed)
- [ ] public_review_events / empanelled_hospitals / management_team / visiting_doctors / ambulance_service public lists
