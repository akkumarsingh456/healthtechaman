import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentSyncResult {
  ok: boolean;
  synced?: boolean;
  student_id?: string;
  roll_number?: string;
  counts?: {
    medical_leaves: number;
    health_visits: number;
    prescriptions: number;
    lab_reports: number;
    appointments: number;
  };
  issues?: string[];
  repairs?: string[];
  error?: string;
}

/**
 * AI-style auto-sync guard for the logged-in student.
 * Detects whether their data is reachable and silently re-links
 * the student record if the auth uid has drifted. Runs once on
 * mount and can be re-run manually.
 */
export function useStudentDataSync(opts?: { rollNumberHint?: string; auto?: boolean }) {
  const { rollNumberHint, auto = true } = opts || {};
  const [result, setResult] = useState<StudentSyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const ranRef = useRef(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-data-sync", {
        body: { roll_number_hint: rollNumberHint },
      });
      if (error) {
        setResult({ ok: false, error: error.message });
      } else {
        setResult(data as StudentSyncResult);
      }
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || "sync failed" });
    } finally {
      setLoading(false);
    }
  }, [rollNumberHint]);

  useEffect(() => {
    if (!auto || ranRef.current) return;
    ranRef.current = true;
    run();
  }, [auto, run]);

  return { result, loading, run };
}