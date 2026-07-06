
-- 1. Students can view their own ambulance requests
CREATE POLICY "Students can view own ambulance requests"
ON public.ambulance_requests
FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

-- 2. Tighten student-photos bucket SELECT to owner folder or staff roles
DROP POLICY IF EXISTS "Authenticated users can view student photos" ON storage.objects;

CREATE POLICY "Users can view own student photo or staff can view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'medical_staff'::app_role)
    OR has_role(auth.uid(), 'lab_officer'::app_role)
    OR has_role(auth.uid(), 'pharmacy'::app_role)
    OR has_role(auth.uid(), 'mentor'::app_role)
  )
);

-- 3. Harden medical_officers self-insert: require admin OR (doctor role + self)
-- Existing "Doctors can insert own profile" already requires has_role doctor + auth.uid()=user_id.
-- Add explicit safeguard: recreate with additional check that the row's user_id has no existing profile
-- to prevent duplicate/impersonation, and ensure has_role remains authoritative.
DROP POLICY IF EXISTS "Doctors can insert own profile" ON public.medical_officers;

CREATE POLICY "Doctors can insert own profile"
ON public.medical_officers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND has_role(auth.uid(), 'doctor'::app_role)
  AND NOT EXISTS (SELECT 1 FROM public.medical_officers WHERE user_id = auth.uid())
);
