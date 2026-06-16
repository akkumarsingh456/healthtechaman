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
  const cacheKey = `student-sync-cache:${rollNumberHint || "self"}`;
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — instant on subsequent pages

  const readCache = (): StudentSyncResult | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.data as StudentSyncResult;
    } catch {
      return null;
    }
  };

  const [result, setResult] = useState<StudentSyncResult | null>(() => readCache());
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
        const res = data as StudentSyncResult;
        setResult(res);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res }));
        } catch {}
      }
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || "sync failed" });
    } finally {
      setLoading(false);
    }
  }, [rollNumberHint, cacheKey]);

  useEffect(() => {
    if (!auto || ranRef.current) return;
    ranRef.current = true;
    // If we have a fresh cached result, skip the network call entirely —
    // banner appears in a fraction of a second on every page navigation.
    const cached = readCache();
    if (cached) return;
    run();
  }, [auto, run]);

  return { result, loading, run };
}