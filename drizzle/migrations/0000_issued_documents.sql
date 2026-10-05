CREATE TABLE public.issued_documents (
  code text PRIMARY KEY,
  doc_type text NOT NULL,
  title text NOT NULL,
  source_id text,
  html text NOT NULL,
  issued_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.issued_documents TO authenticated;
GRANT ALL ON public.issued_documents TO service_role;
ALTER TABLE public.issued_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can register documents they issue" ON public.issued_documents
  FOR INSERT TO authenticated WITH CHECK (issued_by = auth.uid() AND length(html) < 3000000 AND code ~ '^[A-Z0-9]{12,32}$');
CREATE POLICY "Issuers can view their documents" ON public.issued_documents
  FOR SELECT TO authenticated USING (issued_by = auth.uid());
CREATE INDEX issued_documents_source_idx ON public.issued_documents (source_id);