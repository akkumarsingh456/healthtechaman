import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type AutoScanStatus = "idle" | "checking" | "online" | "offline" | "retrying";

// Free connectivity probes — no auth, no key required, CORS-safe (no-cors HEAD).
const PROBES = [
  "https://www.google.com/generate_204",
  "https://www.cloudflare.com/cdn-cgi/trace",
  "https://www.gstatic.com/generate_204",
];

async function pingOnce(signal: AbortSignal): Promise<boolean> {
  for (const url of PROBES) {
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store", signal });
      // no-cors gives an opaque response; reaching this line means the request completed.
      return true;
    } catch {
      // try the next probe
    }
  }
  return false;
}

/**
 * Auto-scan-on-load: verifies internet connectivity on every website open using
 * free public HEAD probes (google/cloudflare/gstatic 204 endpoints).
 * - Runs immediately on mount
 * - Retries with exponential backoff (1s, 2s, 4s, 8s, capped 30s) — never gives up silently
 * - Re-runs whenever the browser reports it went back online
 */
export function useAutoScanOnLoad() {
  const [status, setStatus] = useState<AutoScanStatus>("idle");
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const runScan = async () => {
      if (cancelled) return;
      clearTimer();

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("offline");
        timerRef.current = window.setTimeout(runScan, 5000);
        return;
      }

      setStatus(attemptRef.current === 0 ? "checking" : "retrying");
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const to = window.setTimeout(() => ctrl.abort(), 6000);

      const ok = await pingOnce(ctrl.signal);
      window.clearTimeout(to);
      if (cancelled) return;

      if (ok) {
        setStatus("online");
        attemptRef.current = 0;
        notifiedRef.current = false;
        return;
      }

      attemptRef.current += 1;
      // exponential backoff: 1s, 2s, 4s, 8s, 16s, cap 30s
      const delay = Math.min(1000 * 2 ** (attemptRef.current - 1), 30000);
      setStatus("retrying");
      if (attemptRef.current === 3 && !notifiedRef.current) {
        notifiedRef.current = true;
        toast.warning("Connectivity check failing", {
          description: "Retrying in the background. Some features may be limited.",
        });
      }
      timerRef.current = window.setTimeout(runScan, delay);
    };

    const onOnline = () => {
      attemptRef.current = 0;
      runScan();
    };
    const onOffline = () => {
      setStatus("offline");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && status !== "online") runScan();
    };

    // Kick off immediately
    runScan();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimer();
      abortRef.current?.abort();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}