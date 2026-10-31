/**
 * A small in-memory cache for Printful answers that don't change minute to
 * minute (shipping rates, cost estimates), so a customer flicking between
 * shipping options doesn't spend the store's shared rate limit each time.
 *
 * It lives in one server instance's memory: serverless platforms run several
 * and recycle them, so it's a saving, not a guarantee.
 */
export class TtlCache<T> {
  private entries = new Map<string, { value: Promise<T>; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  /** The cached value for `key`, or the result of `load()`, cached for next time */
  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const value = load();
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    // Only successes are worth keeping
    value.catch(() => this.entries.delete(key));

    // Drop the oldest entries once full (Maps iterate in insertion order)
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
    return value;
  }
}

/** A stable cache key for a request body: same data, same key, any key order */
export function cacheKey(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
