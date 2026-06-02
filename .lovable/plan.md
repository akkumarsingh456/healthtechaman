## Goal

1. Make sure **25edi0049** (and every student) always sees their saved data on `/student/profile`, and that saving the form never silently blanks out previously-saved fields.
2. Add a **Google Drive JSON backup** that runs **automatically on every save** of a student profile or medical-leave record — so even if the database is ever lost, there is a long-term copy you own in Google Drive.

No website settings, no design, no auth flow changes.

## Confirmed facts (already verified just now against the live backend)

For roll number `25edi0049` (Annie):
- `students` row: present, 1 record (last updated 2026-05-03).
- `student_profiles` row: present, 1 record, blood_group `A+`, father_name `ajksj`, mother_name `asas`, emergency_contact `******`.
- `medical_leave_requests`: 13 records spanning Feb–Apr.

So the data is **not** being erased on the backend. The blanking is purely a frontend load/save bug.

## Part A — Fix “profile keeps appearing blank”

1. **`src/pages/StudentProfilePage.tsx`**
   - Render the existing `healthProfile` state in the Profile tab (blood group, allergies, medications, emergency contacts, father/mother info, COVID status). Today the data is fetched but several fields are not surfaced in the UI, which is what makes it feel “erased”.
   - Add a soft “Last saved” line using `student.updated_at` so the user can see the record is still there.
   - Keep the existing fetch query and RLS — they already work.

2. **`src/pages/StudentRegistration.tsx`** (root cause of overwrites)
   - Stop sending `null`/`false` for fields the user did not touch. Build the update payload from only the keys that have a defined, non-empty value, and merge it on top of the existing row instead of `update(medicalData)` with explicit nulls.
   - For boolean declarations (`accuracy_confirmation`, `code_of_conduct`, `photo_video_consent`, `medical_authorization`), use `OR existing` semantics so an unchecked re-submit does not flip a previously approved consent back to `false`.
   - Switch the two-step “check then insert/update” to a single `upsert` on `student_profiles` keyed on `student_id` (the column already has `UNIQUE`), which removes the race where a failed insert leaves the row empty.

3. **`src/hooks/useStudentAutoFill.ts`**
   - Replace `.single()` with `.maybeSingle()` on the `students` query so a transient RLS hiccup doesn’t throw and wipe `studentData` to `null`.

No RLS, no schema changes.

## Part B — Automatic Google Drive JSON backup

1. **Connector**
   - Use the existing Lovable Google Drive connector (gateway-based, OAuth handled for you). I will call `standard_connectors--connect` with `connector_id: google_drive` so you can pick the Google account that owns the backup folder.

2. **Edge function `backup-student-to-drive`**
   - Input: `{ student_id: uuid }`.
   - Reads the student’s full picture from the database with the service role: `students`, `student_profiles`, `medical_leave_requests`, `leave_approval_workflow`, `health_visits`, `prescriptions` + `prescription_items`, `lab_reports`, `appointments`.
   - Bundles it into one JSON document with `student.roll_number`, `backed_up_at`, and a `version` counter.
   - Uploads to Google Drive via the connector gateway:
     - Folder: `NITW Health Portal Backups / <roll_number>/`
     - Filename: `<roll_number>__<ISO timestamp>.json` (new file each save — full version history)
     - Plus overwrites `<roll_number>__latest.json` so the latest snapshot is always one click away.
   - Returns 200 even if Drive is temporarily unreachable, so saves never get blocked (same resilience rule we use for email).

3. **Trigger points** (auto on every save, as requested)
   - `StudentRegistration.onSubmit` → after the upsert succeeds.
   - `StudentProfilePage.handleSaveContact` → after the contact update succeeds.
   - Medical-leave submit/return/clearance flows already in place → after each successful write.
   - Fired fire-and-forget so the UI does not wait on Drive.

4. **One-time backfill**
   - Add a tiny “Backup all students now” button on the admin page (admin-only) that loops every student and calls the edge function, so historical data — including Annie’s 13 leave records — gets seeded in Drive immediately.

## Part C — Validation

- Reload `/student/profile` as Annie → verify blood group, parents, allergies, medications, emergency contact all show.
- Edit only the phone field and save → verify father/mother/blood group are still there (no blank-out).
- Check the Google Drive folder → verify `25edi0049__latest.json` exists and the dated snapshot file appears for each save.
- Backend health and RLS unchanged; site settings untouched.

## Approval needed before I start coding

- Confirm “go” on this plan.
- After confirm, I will trigger the Google Drive connection picker so you can sign in to the Google account that will hold the backups.
