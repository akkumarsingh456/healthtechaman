import { useEffect, useState } from "react";
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

export function useGeminiAutoRefresh() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [report, setReport] = useState<RefreshReport | null>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as RefreshReport) : null;
    } catch { return null; }
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    let pending = false;
    let attempts = 0;
    let lastRouteCheck = 0;

    const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };
    const schedule = (delay: number) => {
      clearTimer();
      if (!cancelled) timer = setTimeout(() => void run(), delay);
    };

    const run = async () => {
      if (cancelled) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        if (!navigator.onLine) { setStatus("offline"); schedule(5000); return; }
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!sessionData.session) { setStatus("signed-out"); schedule(INTERVAL_MS); return; }

        setStatus("checking");
        const { data, error } = await supabase.functions.invoke("gemini-auto-refresh", { body: {} });
        if (cancelled) return;
        if (error || !(data as RefreshReport)?.ok) {
          attempts += 1;
          setStatus("retrying");
          schedule(Math.min(1000 * 2 ** Math.min(attempts - 1, 5), 30_000));
          return;
        }

        attempts = 0;
        const result = data as RefreshReport;
        setReport(result);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch { /* storage unavailable */ }
        setStatus(result.synced ? "repaired" : "fresh");
        await queryClient.invalidateQueries({ refetchType: "active" });
        window.dispatchEvent(new CustomEvent("app:data-refreshed", { detail: result }));
        schedule(INTERVAL_MS);
      } catch {
        if (!cancelled) {
          attempts += 1;
          setStatus("retrying");
          schedule(Math.min(1000 * 2 ** Math.min(attempts - 1, 5), 30_000));
        }
      } finally {
        running = false;
        if (pending && !cancelled) { pending = false; void run(); }
      }
    };

    const onOnline = () => { attempts = 0; void run(); };
    const onOffline = () => setStatus("offline");
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    const authListener = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        attempts = 0; void run();
      } else if (event === "SIGNED_OUT") { setStatus("signed-out"); setReport(null); }
    });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    void run();

    return () => {
      cancelled = true; clearTimer();
      authListener.data.subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  useEffect(() => {
    const now = Date.now();
    if (now - (window as any).__geminiAutoRefreshRouteCheck < ROUTE_COOLDOWN_MS) return;
    (window as any).__geminiAutoRefreshRouteCheck = now;
    // Route changes trigger a refresh, but the global timer remains single-instance.
    window.dispatchEvent(new CustomEvent("app:auto-refresh-route"));
  }, [location.pathname]);

  return { status, report };
}
