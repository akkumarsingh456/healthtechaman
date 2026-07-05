import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoScanOnLoad } from "./useAutoScanOnLoad";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

describe("useAutoScanOnLoad", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    // @ts-expect-error override
    global.fetch = fetchMock;
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports online when the first probe succeeds", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() => useAutoScanOnLoad());

    await vi.waitFor(() => expect(result.current).toBe("online"));
    expect(fetchMock).toHaveBeenCalled();
  });

  it("retries with backoff while offline and recovers when back online", async () => {
    // All probes fail initially
    fetchMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAutoScanOnLoad());

    // First attempt runs immediately and fails -> retrying scheduled
    await vi.waitFor(() => expect(result.current).toBe("retrying"));
    const failedAttempts = fetchMock.mock.calls.length;
    expect(failedAttempts).toBeGreaterThan(0);

    // Advance through backoff windows; more retries should fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // 1s backoff
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000); // 2s backoff
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(failedAttempts);
    expect(result.current).toBe("retrying");

    // Now network recovers
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000); // next backoff
    });

    await vi.waitFor(() => expect(result.current).toBe("online"));
  });

  it("shows offline immediately when navigator.onLine is false", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true, writable: true });
    const { result } = renderHook(() => useAutoScanOnLoad());
    await vi.waitFor(() => expect(result.current).toBe("offline"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-scans when the browser fires an online event", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useAutoScanOnLoad());
    await vi.waitFor(() => expect(result.current).toBe("retrying"));

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(50);
    });

    await vi.waitFor(() => expect(result.current).toBe("online"));
  });
});