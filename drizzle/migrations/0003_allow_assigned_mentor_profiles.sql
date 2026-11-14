DROP POLICY IF EXISTS "Mentors can view own profile or admins can view all" ON public.mentors;
CREATE POLICY "Users can view their relevant mentor profiles"
ON public.mentors FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR id IN (
    SELECT s.mentor_id FROM public.students s WHERE s.user_id = auth.uid()
  )
);
