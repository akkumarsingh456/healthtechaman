-- Keep mentor contact details available only to the profile owner and administrators.
DROP POLICY IF EXISTS "Authenticated users can view mentors" ON public.mentors;
CREATE POLICY "Mentors can view own profile or admins can view all"
ON public.mentors FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Students may cancel their own booking, but cannot confirm it themselves.
CREATE OR REPLACE FUNCTION public.guard_student_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'student')
     AND OLD.patient_id = auth.uid()
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Students may cancel appointments but cannot set appointment status';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_student_appointment_status ON public.appointments;
CREATE TRIGGER guard_student_appointment_status
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_student_appointment_status();

-- Students can complete their leave and return forms, but cannot alter clinical
-- referral, approval, priority, or doctor-clearance fields.
CREATE OR REPLACE FUNCTION public.guard_student_medical_leave_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'student') AND EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = OLD.student_id AND s.user_id = auth.uid()
  ) THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.referring_doctor_id IS DISTINCT FROM OLD.referring_doctor_id
       OR NEW.referral_date IS DISTINCT FROM OLD.referral_date
       OR NEW.referral_hospital IS DISTINCT FROM OLD.referral_hospital
       OR NEW.expected_duration IS DISTINCT FROM OLD.expected_duration
       OR NEW.doctor_notes IS DISTINCT FROM OLD.doctor_notes
       OR NEW.status NOT IN ('on_leave', 'returned')
       OR NEW.rest_days IS DISTINCT FROM OLD.rest_days
       OR NEW.academic_leave_approved IS DISTINCT FROM OLD.academic_leave_approved
       OR NEW.approved_by_doctor_id IS DISTINCT FROM OLD.approved_by_doctor_id
       OR NEW.approval_date IS DISTINCT FROM OLD.approval_date
       OR NEW.health_priority IS DISTINCT FROM OLD.health_priority
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
       OR NEW.health_centre_visited IS DISTINCT FROM OLD.health_centre_visited
       OR NEW.doctor_clearance IS DISTINCT FROM OLD.doctor_clearance
       OR NEW.doctor_clearance_date IS DISTINCT FROM OLD.doctor_clearance_date
       OR NEW.cleared_by_doctor_id IS DISTINCT FROM OLD.cleared_by_doctor_id
       OR NEW.referral_type IS DISTINCT FROM OLD.referral_type THEN
      RAISE EXCEPTION 'Students may update only their leave and return form fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_student_medical_leave_update ON public.medical_leave_requests;
CREATE TRIGGER guard_student_medical_leave_update
BEFORE UPDATE ON public.medical_leave_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_student_medical_leave_update();
