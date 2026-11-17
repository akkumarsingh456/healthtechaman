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
const ROUTE_COOLDOWN_MS = 15_000;
const LAST_CHECK_KEY = "gemini-auto-refresh:last-check";

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
const pendingRef = useRef(false);
const runRef = useRef<(() => Promise<void>) | null>(null);
const scheduleRef = useRef<((ms: number) => void) | null>(null);

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
      if (!cancelled) timerRef.current = window.setTimeout(run, ms);
    };

    const run = async () => {
      if (cancelled) return;
if (runningRef.current) {
pendingRef.current = true;
return;
}
      runningRef.current = true;
      let shouldRunPending = false;
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

        if (res.synced) {
          queryClient.invalidateQueries();
          window.dispatchEvent(new CustomEvent("app:data-refreshed", { detail: res }));
        }
 else {
         queryClient.invalidateQueries({ refetchType: "active" });
     window.dispatchEvent(new CustomEvent("app:data-refreshed", { detail: res }));
 }
        schedule(INTERVAL_MS);
      } finally {
      if (pendingRef.current && !cancelled) {
        pendingRef.current = false;
        shouldRunPending = true;
      }
        runningRef.current = false;
      }
      if (shouldRunPending && !cancelled) {
        void run();
      }
    };

   runRef.current = run;
    scheduleRef.current = schedule;

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
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        attemptRef.current = 0;
        void run();
      } else if (event === "SIGNED_OUT") {
        setStatus("signed-out");
        setReport(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimer();
      runRef.current = null;
      scheduleRef.current = null;
      authListener.subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Re-run on every route change so each page loads verified data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const kick = () => {
      let checkedAt = 0;
      try {
        checkedAt = Number(sessionStorage.getItem(LAST_CHECK_KEY) || 0);
      } catch {
        checkedAt = 0;
      }
      if (Date.now() - checkedAt < ROUTE_COOLDOWN_MS) {
        if (timerRef.current === null && !runningRef.current) {
          scheduleRef.current?.(INTERVAL_MS);
        }
        return;
      }
      try {
        sessionStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
      } catch {
        /* ignore storage errors */
      }
      void runRef.current?.();
    };

    if (typeof (window as any).requestIdleCallback === "function") {
      idleId = (window as any).requestIdleCallback(kick, { timeout: 600 });
    } else {
      timeoutId = window.setTimeout(kick, 0);
    }

    return () => {
      if (idleId !== null && typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [location.pathname]);

  return { status, report };
}
