import { describe, expect, it, vi } from "vitest";
import { cacheKey, TtlCache } from "#lib/cache";

describe("TtlCache", () => {
  it("reuses a value until it expires", async () => {
    let now = 0;
    const cache = new TtlCache<string>(1_000, 10, () => now);
    const load = vi.fn(async () => "rates");

    await cache.get("k", load);
    now = 999;
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(1);

    now = 1_000;
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between callers asking at the same time", async () => {
    const cache = new TtlCache<string>(1_000);
    const load = vi.fn(async () => "rates");

    await Promise.all([cache.get("k", load), cache.get("k", load)]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("doesn't keep failures", async () => {
    const cache = new TtlCache<string>(1_000);

    await expect(cache.get("k", async () => Promise.reject(new Error("busy")))).rejects.toThrow();
    await expect(cache.get("k", async () => "rates")).resolves.toBe("rates");
  });

  it("drops the oldest entries when full", async () => {
    const cache = new TtlCache<string>(60_000, 2);
    const load = vi.fn(async () => "x");

    await cache.get("a", load);
    await cache.get("b", load);
    await cache.get("c", load); // pushes out "a"
    await cache.get("a", load);

    expect(load).toHaveBeenCalledTimes(4);
  });
});

describe("cacheKey", () => {
  it("ignores key order", () => {
    expect(cacheKey({ a: 1, b: { c: 2, d: 3 } })).toBe(cacheKey({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it("keeps array order, which matters", () => {
    expect(cacheKey([1, 2])).not.toBe(cacheKey([2, 1]));
  });
});
