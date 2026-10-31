import { describe, expect, it } from "vitest";
import { RateLimiter } from "#lib/printful/rate-limit";

function headers(remaining: number, resetSeconds: number) {
  return new Headers({
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(resetSeconds),
  });
}

describe("RateLimiter", () => {
  it("lets requests through before Printful has said anything", () => {
    const limiter = new RateLimiter(5, () => 0);

    expect(limiter.delay()).toBe(0);
  });

  it("keeps going while there's more than the reserve left", () => {
    const limiter = new RateLimiter(5, () => 0);
    limiter.record(headers(7, 30));

    expect(limiter.delay()).toBe(0); // 7 → 6
    expect(limiter.delay()).toBe(0); // 6 → 5
    expect(limiter.delay()).toBe(30_000); // 5 left is the reserve: wait for the reset
  });

  it("waits only until the window resets", () => {
    let now = 0;
    const limiter = new RateLimiter(5, () => now);
    limiter.record(headers(2, 40));

    now = 25_000;
    expect(limiter.delay()).toBe(15_000);
  });

  it("goes again once the window has reset", () => {
    let now = 0;
    const limiter = new RateLimiter(5, () => now);
    limiter.record(headers(0, 10));

    now = 10_000;
    expect(limiter.delay()).toBe(0);
  });

  it("stops completely after a 429 until Retry-After has passed", () => {
    let now = 0;
    const limiter = new RateLimiter(5, () => now);
    limiter.recordLimited(38);

    expect(limiter.delay()).toBe(38_000);
    now = 38_000;
    expect(limiter.delay()).toBe(0);
  });

  it("ignores missing or garbled headers", () => {
    const limiter = new RateLimiter(5, () => 0);
    limiter.record(new Headers({ "x-ratelimit-remaining": "lots" }));

    expect(limiter.delay()).toBe(0);
  });
});
