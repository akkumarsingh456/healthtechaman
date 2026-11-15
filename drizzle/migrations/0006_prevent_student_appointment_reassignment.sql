CREATE OR REPLACE FUNCTION public.guard_student_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.patient_id = auth.uid() THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'Students cannot transfer appointments to another account';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('pending', 'cancelled') THEN
      RAISE EXCEPTION 'Students may reschedule or cancel appointments but cannot confirm or complete them';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
