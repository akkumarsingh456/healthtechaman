
-- Add recipient email fields to student_profiles
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS mentor_email text,
  ADD COLUMN IF NOT EXISTS hod_name text,
  ADD COLUMN IF NOT EXISTS hod_email text,
  ADD COLUMN IF NOT EXISTS dean_name text,
  ADD COLUMN IF NOT EXISTS dean_email text;

-- Share log table
CREATE TABLE IF NOT EXISTS public.health_share_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  medical_leave_request_id uuid,
  recipient_role text NOT NULL,
  recipient_name text,
  recipient_email text NOT NULL,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_referral boolean NOT NULL DEFAULT false,
  include_leave_certificate boolean NOT NULL DEFAULT false,
  message text,
  email_status text NOT NULL DEFAULT 'pending',
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.health_share_recipients TO authenticated;
GRANT ALL ON public.health_share_recipients TO service_role;

ALTER TABLE public.health_share_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own shares"
ON public.health_share_recipients FOR SELECT TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
);

CREATE POLICY "Students insert own shares"
ON public.health_share_recipients FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_health_share_student ON public.health_share_recipients(student_id, created_at DESC);

-- Storage policies for student-health-uploads bucket (bucket created separately)
CREATE POLICY "Students upload own health files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-health-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students read own health files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-health-uploads'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Students delete own health files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-health-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
