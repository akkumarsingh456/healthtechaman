CREATE OR REPLACE FUNCTION public.guard_student_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.patient_id = auth.uid()
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('pending', 'cancelled') THEN
    RAISE EXCEPTION 'Students may reschedule or cancel appointments but cannot confirm or complete them';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_student_medical_leave_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = OLD.student_id AND s.user_id = auth.uid()
  ) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
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
