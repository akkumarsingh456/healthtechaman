## Goal
On `/student/profile` add: (1) full leave history with doctor→mentor→HOD→Dean timeline + PDF downloads, (2) saved recipient emails (Mentor/HOD/Dean), (3) "Share health report" that emails PDFs + records in-app share.

## Where leave lives (for the user)
- **Apply / view leaves**: `/medical-leave` → tabs "My Referrals" and "New Referral" (doctor-initiated). Students complete departure form there.
- **Approval stages**: rendered by `LeaveApprovalWorkflowTimeline` showing Doctor → Mentor → HOD → Dean states from `leave_approval_workflow` row tied to each `medical_leave_requests.id`.

## DB changes (single migration)
1. `student_profiles`: add `mentor_email`, `hod_email`, `dean_email`, `hod_name`, `dean_name` (text, nullable).
2. New `health_share_recipients` table → records each share (sender student, recipient email/role, files JSON, message, sent_at). RLS: student can insert/select own; admins all.
3. New private storage bucket `student-health-uploads` for student-uploaded PDFs. RLS: student writes/reads own folder; doctors read all.

## Edge function `share-health-report`
- Input: `{ leaveRequestId?, recipients: [{role,email,name}], uploadedFileUrls: [{name,url}], includeReferral?, includeLeaveCertificate?, message? }`
- Auth: validates session, fetches student + leave record, signs storage URLs (1h), sends email via Resend (already in secrets) with links + optional inline summary, inserts row(s) into `health_share_recipients`. Returns 200 always (resilient).

## Frontend (`src/pages/StudentProfilePage.tsx`)
New "Medical Leave History & Sharing" card with subsections:
- **Recipients card**: form to save mentor/HOD/Dean name+email (writes to `student_profiles`). @nitw.ac.in validation per existing memory.
- **Leave history**: list ALL `medical_leave_requests` for student, expandable rows showing `LeaveApprovalWorkflowTimeline`, badges, dates. Action buttons: "Download Referral", "Download Leave Certificate" (uses existing `PrintableReferralLetter` / `PrintableLeaveLetter` via `printDocument`), "Share…".
- **Share dialog** (`ShareHealthReportDialog.tsx`): multi-select recipients (prefilled), file picker (uploads to bucket via supabase storage), checkboxes for system referral/leave certificate, optional message. Calls edge function. Toasts result.

## Testing
After build, manually test on `/student/profile` as `25edi0049`: save recipient emails, expand a past leave to verify timeline renders all four stages, open share dialog, upload a small PDF, send to a test address.

## Files
- migration (new)
- `supabase/functions/share-health-report/index.ts` (new)
- `src/components/student/ShareHealthReportDialog.tsx` (new)
- `src/components/student/StudentLeaveHistoryCard.tsx` (new)
- `src/components/student/RecipientEmailsCard.tsx` (new)
- `src/pages/StudentProfilePage.tsx` (edit — mount new components)
