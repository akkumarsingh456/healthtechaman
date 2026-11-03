-- Replace the tautological insert policy on contact_submissions with a validated one:
-- the public forms (Save Message / review) still work, but empty, oversized or malformed
-- submissions are rejected at the database level.
DROP POLICY IF EXISTS "Anyone can submit contact forms" ON public.contact_submissions;

CREATE POLICY "Anyone can submit a valid contact or review"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  submission_type IN ('contact', 'review')
  AND length(btrim(name)) BETWEEN 2 AND 120
  AND length(btrim(email)) <= 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND length(btrim(message)) BETWEEN 1 AND 4000
  AND (subject IS NULL OR length(btrim(subject)) <= 300)
  AND (rating IS NULL OR rating BETWEEN 1 AND 5)
  AND (sender_role IS NOT NULL AND length(btrim(sender_role)) BETWEEN 1 AND 60)
);