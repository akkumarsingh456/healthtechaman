-- 1) Fix privilege escalation: restrict self-insert into user_roles to 'student' only
DROP POLICY IF EXISTS "Users can insert own initial role" ON public.user_roles;
CREATE POLICY "Users can insert own initial student role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'student'::app_role);

-- 2) Remove overly broad lab-reports SELECT policy that exposes all files to any authenticated user
DROP POLICY IF EXISTS "Authenticated users can view lab reports" ON storage.objects;

-- 3) Make student-photos bucket private and require authentication to view
UPDATE storage.buckets SET public = false WHERE id = 'student-photos';
DROP POLICY IF EXISTS "Anyone can view student photos" ON storage.objects;
CREATE POLICY "Authenticated users can view student photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'student-photos');