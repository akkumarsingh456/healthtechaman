
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS ai_priority text CHECK (ai_priority IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS free_time_window text,
  ADD COLUMN IF NOT EXISTS triage_details jsonb;
