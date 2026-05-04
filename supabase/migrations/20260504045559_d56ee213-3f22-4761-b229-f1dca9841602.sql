DELETE FROM public.contact_submissions
WHERE submission_type = 'contact'
  AND lower(email) NOT LIKE '%@student.nitw.ac.in';