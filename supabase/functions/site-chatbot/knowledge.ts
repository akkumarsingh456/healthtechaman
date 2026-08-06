export const SITE_KNOWLEDGE = `
# ABHA Campus Care — NIT Warangal Digital Health Centre Portal

## About / Disclaimer
- Personal academic project by Aman Kumar (1st year B.Sc. B.Ed. ITEP Mathematics, NIT Warangal), team leader.
- NOT the official website of NIT Warangal. NOT officially accepted or endorsed. No document issued here is valid for official, legal or medical purposes.
- All roll numbers, phone numbers and patient data are dummy/demo data. Other data is public data from the NIT Warangal website.
- Team (10 members): Ashutosh Tiwari, Parameshwar Varfa, Ayush Dutta, Preetham T, Rishi, Abhinav Singh, Shakamudi Hasini, Vishesh Sharma, Micheal Alvi, Akshika, Jashmi.
- Contact: akkumarsingh456@gmail.com | Telegram http://t.me/Amankumar456 | Instagram | LinkedIn.
- Presented to College Administration, Dean of P&D, HOD Mathematics, CDIS Head, and ERP Technical Officer Sudipta Manna sir — appreciated, but not officially adopted. The institute is separately building its own simpler system (basic appointment/doctor/pharmacy with front-desk login).
- Tagline: "For the Heart, From the Heart." Copyright 2026.

## Problem it solves
Institute Health Centres run on pen and paper: long queues, no online OPD, no electronic health records, poor emergency communication, complex medical-leave/attendance approval, and safety concerns for off-campus treatment.

## Roles supported
Student, Doctor (Medical Officer), Lab Officer, Pharmacy, Medical Staff, Faculty Mentor, Admin.

## Feature list by role

### Student portal (/ home dashboard, /student/profile)
- Home dashboard: stats grid (Upcoming appointments, Total Visits, Prescriptions, Lab Tests), today's schedule, critical status banners.
- Quick Book: 1-click pending appointment from the dashboard.
- Book appointment (/appointments): 3 steps — AI symptom triage, select date & time, confirm. AI triage assigns priority; High and Medium priority are restricted to TODAY only; the time picker is class-schedule aware (student picks a free window).
- My Appointments (/my-appointments): upcoming/past, reschedule, Add to Calendar (Google Calendar link).
- Health records (/health-dashboard): visit history, prescriptions, lab reports (PDF view + print), certificates.
- Student profile: personal details, academic details, faculty mentor assignment, blood group, allergies, vaccination records, profile completion indicator, profile photo (AI validated, 2MB limit).
- Medical leave (/medical-leave): apply for leave, view previous approved/denied/pending requests with a 5-stage visual timeline.
- Share Health Report: email health report / referral letter / leave certificate PDFs to HOD, mentor, dean; AI (Gemini) drafts the mail, you can review and edit it before sending.
- Notifications: prescription issued, leave status, appointment reminders.

### Doctor dashboard (/doctor/dashboard, /doctor/profile)
- Live patient queue with AI priority badge and AI symptom summary.
- Approve/deny appointments; after approval two actions: (1) write Prescription, (2) Issue Medical Leave.
- Clinical Safety Guardrail: while prescribing, the system checks patient allergies plus pharmacy stock/expiry and shows inline alerts with "use suggested alternative".
- Prescriptions: diagnosis, medicines (keyword search from medicine list), dosage/frequency/duration/meal timing, external referrals; 0 rest days allowed.
- Medical leave & referral: off-campus referral letters, empanelled hospital recommendation, follow-up tracker for returning students.
- Shift exchange: transfer a whole shift's appointments to another doctor.
- Student records search by roll number; treatment overview and analytics; emergency/ambulance dispatch (BLS/ALS/CCU auto-selected by case type).

### Lab Officer dashboard (/lab/dashboard)
- Register new sample (only existing roll numbers allowed), pending tests / processing queue, upload results with structured flags, PDF report upload (10MB), completed tests, report viewer + print, analytics.

### Pharmacy dashboard (/pharmacy/dashboard)
- Prescription queue, dispensing records, medicine inventory with stock/expiry, low-stock warnings; dispensing auto-decrements stock.

### Medical Staff dashboard (/staff/home, /staff/dashboard)
- Patient vitals, first-aid log, ambulance requests, emergency alerts, active medical leave cases, printing certificates/referral letters.

### Faculty Mentor (/mentor/home, /mentor/dashboard, /mentor/profile)
- Mentee overview, student health alerts, medical-leave approvals, recent visits.

### Admin (/admin)
- Contact submissions & reviews, medical officers and visiting doctors management, mentors, student–mentor assignment, security dashboard (login/audit logs, PDF/CSV export), staff account provisioning, system backup.

## Cross-cutting features
- Medical leave approval chain: Doctor -> Mentor -> HOD -> Academic Dean, with emergency bypass; visual 5-stage tracking timeline for both staff and students.
- Emergency: /emergency page, ambulance queue and dispatch, GPS + timestamp audit logging.
- Hospital recommendation agent: for high-priority cases it ranks the closest empanelled/tie-up hospitals by real distance (23 hospitals), default NITW Health Centre.
- Auto-scan / auto-sync agent: on every page load a background Gemini-powered scan verifies that all records are correctly fetched and self-repairs mismatched links; a floating indicator shows Verified / Repaired / Retrying.
- Documents: all PDFs (leave letter, referral letter, medical certificate, lab report) are watermarked and carry the red non-official disclaimer, include a verification QR code, and print WYSIWYG.
- Privacy: phone numbers, Aadhaar and parent details are masked with ****** in the UI and in PDFs. Reviews show the reviewer name but hide the email; only admins see emails.
- Contact & Reviews on the home page: Save Message (stored) and Send Mail (AI-composed mail to akkumarsingh456@gmail.com); reviews are moderated by Gemini for profanity/spam and shown in an animated feed with role icons.
- Security: role-based access control with row-level security, separate user_roles table, no anonymous signup, leaked-password protection, session recovery safeties.

## Key benefits
100% paperless, real-time tracking, role-based access, secure & compliant, scalable across campuses, data analytics for health trends.

## How to sign in
Go to /auth ("Sign In"), choose your account type (Student / Doctor / Medical Staff department), then enter email and password.
- Students sign up themselves with their @student.nitw.ac.in email.
- Doctors, Lab Officers, Pharmacy and Medical Staff CANNOT self sign up — their accounts are pre-provisioned by the admin.
- Admin access is restricted to akkumarsingh456@gmail.com only.

## Demo / test accounts (dummy data, for demonstration only)
These are DUMMY demo logins published by the project owner in the official project PDF. They contain no personal data, so you MAY share them freely when a visitor asks for a login for these roles.
- Student: an25edi0049@student.nitw.ac.in (Annie, roll 25EDI0049) — or sign up with your own official college Gmail.
- Doctor: doctor@nitw.ac.in (Dr. Anchoori Karthik) or sr25edi0050@student.nitw.ac.in (Dr. Test Doctor 2). Other Gmail IDs are blocked for doctor login to prevent misuse.
- Lab Officer: labofficer@nitw.ac.in (only this ID).
- Pharmacy: pharmacy@nitw.ac.in (only this ID).
- Medical Staff: medicalstaff@nitw.ac.in (only this ID).
- Password for ALL the demo accounts above is the same: Aman@kumar@456#
- Admin: akkumarsingh456@gmail.com — owner only. Never share the admin password.
- Faculty / Mentor login: credentials are NOT shared. If asked, say faculty/mentor demo credentials are private and they should contact Aman Kumar at akkumarsingh456@gmail.com.
- Always remind users these are dummy demo accounts for demonstration only; anyone can also create their own student account with Sign Up.
`;
