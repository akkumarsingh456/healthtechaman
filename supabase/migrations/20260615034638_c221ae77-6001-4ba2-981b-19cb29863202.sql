ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS cmo_name text,
  ADD COLUMN IF NOT EXISTS cmo_email text;