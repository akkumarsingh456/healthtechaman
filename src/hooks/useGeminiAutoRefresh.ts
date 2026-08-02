import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RefreshStatus = "idle" | "checking" | "fresh" | "repaired" | "retrying" | "offline" | "signed-out";

export interface RefreshReport {
  ok: boolean;
  roles?: string[];
  roll_number?: string | null;
  counts?: Record<string, number>;
  issues?: string[];
  repairs?: string[];
  synced?: boolean;
  diagnosis?: string;
  ai?: string;
  checked_at?: string;
  error?: string;
}

const CACHE_KEY = "gemini-auto-refresh:last";
const INTERVAL_MS = 60_000;

/**
 * Always-on background refresh for every logged-in section.
 * Runs on every page load and on every route change, then keeps
 * refreshing every 60s. Powered by the project's own free Gemini API key
 * (edge function `gemini-auto-refresh`) — independent of Lovable credits.
 */
export function useGeminiAutoRefresh() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [report, setReport] = useState<RefreshReport | null>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as RefreshReport) : null;
    } catch {
      return null;
    }
  });
  const runningRef = useRef(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const schedule = (ms: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(run, ms);
    };

    const run = async () => {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setStatus("offline");
          schedule(5000);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          setStatus("signed-out");
          schedule(INTERVAL_MS);
          return;
        }

        setStatus((s) => (s === "idle" ? "checking" : s === "fresh" || s === "repaired" ? s : "checking"));

        const { data, error } = await supabase.functions.invoke("gemini-auto-refresh", { body: {} });
        if (cancelled) return;

        if (error || !(data as RefreshReport)?.ok) {
          attemptRef.current += 1;
          setStatus("retrying");
          schedule(Math.min(1000 * 2 ** (attemptRef.current - 1), 30_000));
          return;
        }

        attemptRef.current = 0;
        const res = data as RefreshReport;
        setReport(res);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(res));
        } catch {
          /* ignore quota errors */
        }
        setStatus(res.synced ? "repaired" : "fresh");

        // Records may have been re-linked — pull correct data into the UI.
        if (res.synced) queryClient.invalidateQueries();
        else queryClient.invalidateQueries({ refetchType: "active" });

        schedule(INTERVAL_MS);
      } finally {
        runningRef.current = false;
      }
    };

    const kick = () => run();
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(kick, { timeout: 600 });
    } else {
      window.setTimeout(kick, 0);
    }

    const onOnline = () => {
      attemptRef.current = 0;
      run();
    };
    const onOffline = () => setStatus("offline");
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimer();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Re-run on every route change so each page loads verified data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return { status, report };
}
