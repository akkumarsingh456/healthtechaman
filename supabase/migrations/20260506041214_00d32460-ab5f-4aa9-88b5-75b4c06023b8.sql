
-- Allow students to view workflow for their own leave requests
CREATE POLICY "Students can view own leave workflow"
ON public.leave_approval_workflow
FOR SELECT
USING (
  medical_leave_request_id IN (
    SELECT mlr.id
    FROM public.medical_leave_requests mlr
    JOIN public.students s ON s.id = mlr.student_id
    WHERE s.user_id = auth.uid()
  )
);

-- Allow mentors to view workflow for their mentees
CREATE POLICY "Mentors can view mentee leave workflow"
ON public.leave_approval_workflow
FOR SELECT
USING (
  has_role(auth.uid(), 'mentor'::app_role)
  AND medical_leave_request_id IN (
    SELECT mlr.id
    FROM public.medical_leave_requests mlr
    JOIN public.students s ON s.id = mlr.student_id
    JOIN public.mentors m ON m.id = s.mentor_id
    WHERE m.user_id = auth.uid()
  )
);

-- Allow medical_staff to view all workflow rows
CREATE POLICY "Medical staff can view leave workflow"
ON public.leave_approval_workflow
FOR SELECT
USING (has_role(auth.uid(), 'medical_staff'::app_role));
