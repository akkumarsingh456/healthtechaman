CREATE TABLE public.public_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_review_events TO anon, authenticated;
GRANT ALL ON public.public_review_events TO service_role;

ALTER TABLE public.public_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view review refresh events"
ON public.public_review_events
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.notify_public_review_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submission_type = 'review'
     AND coalesce(NEW.ai_validation_status, 'valid') <> 'spam'
     AND NEW.created_at > timestamptz '2026-08-02 12:15:00+00' THEN
    INSERT INTO public.public_review_events (review_id)
    VALUES (NEW.id)
    ON CONFLICT (review_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_public_review_created() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_public_review_created() TO service_role;

CREATE TRIGGER notify_public_review_created_after_insert
AFTER INSERT ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_public_review_created();

ALTER PUBLICATION supabase_realtime ADD TABLE public.public_review_events;