CREATE OR REPLACE FUNCTION public.get_public_reviews()
RETURNS TABLE (
  id uuid,
  name text,
  sender_role text,
  college_name text,
  branch text,
  year text,
  subject text,
  rating integer,
  message text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.id, cs.name, cs.sender_role, cs.college_name, cs.branch, cs.year,
         cs.subject, cs.rating, cs.message, cs.created_at
  FROM public.contact_submissions cs
  WHERE cs.submission_type = 'review'
    AND coalesce(cs.ai_validation_status, 'valid') <> 'spam'
    AND cs.created_at > timestamptz '2026-08-02 12:15:00+00'
  ORDER BY cs.created_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_public_reviews() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_reviews() TO anon, authenticated;