const requestsByKey = new Map<string, number[]>();

/** Best-effort per-function-isolate request limiter. */
export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (requestsByKey.get(key) ?? []).filter((time) => now >= time && now - time < windowMs);
  recent.push(now);
  requestsByKey.set(key, recent);

  if (requestsByKey.size > 5000) {
    for (const [entryKey, timestamps] of requestsByKey) {
      const active = timestamps.filter((time) => now >= time && now - time < windowMs);
      if (active.length) requestsByKey.set(entryKey, active);
      else requestsByKey.delete(entryKey);
    }
  }

  return recent.length > limit;
}