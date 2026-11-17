import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isRateLimited } from "../_shared/ipRateLimit.ts";

Deno.test("rate limit allows eight requests and blocks the ninth in a minute", () => {
  const key = `rate-test-eight-${crypto.randomUUID()}`;
  for (let request = 1; request <= 8; request += 1) {
    assertEquals(isRateLimited(key, 8, 60_000, 1_000), false);
  }
  assertEquals(isRateLimited(key, 8, 60_000, 1_001), true);
});

Deno.test("rate limit resets when the request window expires", () => {
  const key = `rate-test-window-${crypto.randomUUID()}`;
  assertEquals(isRateLimited(key, 1, 60_000, 1_000), false);
  assertEquals(isRateLimited(key, 1, 60_000, 2_000), true);
  assertEquals(isRateLimited(key, 1, 60_000, 61_000), false);
});

Deno.test("rate limits are isolated by client key", () => {
  const key = `rate-test-keys-${crypto.randomUUID()}`;
  assertEquals(isRateLimited(`${key}-a`, 1, 60_000, 1_000), false);
  assertEquals(isRateLimited(`${key}-a`, 1, 60_000, 1_001), true);
  assertEquals(isRateLimited(`${key}-b`, 1, 60_000, 1_001), false);
});