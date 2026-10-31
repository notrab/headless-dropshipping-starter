/**
 * Tracks Printful's rate limit: 120 requests per store over a rolling minute,
 * shared by the build and every customer. Each response reports what's left
 * (X-RateLimit-Remaining) and when the window resets (X-RateLimit-Reset), so we
 * can slow down before hitting the limit rather than after.
 */
export class RateLimiter {
  private remaining = Infinity;
  private resetAt = 0;

  /**
   * @param reserve Requests to keep in hand, for ones already in flight
   * @param now Clock, swappable in tests
   */
  constructor(
    private readonly reserve: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Update from a response's rate limit headers */
  record(headers: Headers) {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (remaining !== null && Number.isFinite(Number(remaining))) {
      this.remaining = Number(remaining);
    }
    if (reset !== null && Number.isFinite(Number(reset))) {
      this.resetAt = this.now() + Number(reset) * 1000;
    }
  }

  /** Printful said stop (429): nothing left until `retryAfterSeconds` from now */
  recordLimited(retryAfterSeconds: number) {
    this.remaining = 0;
    this.resetAt = this.now() + retryAfterSeconds * 1000;
  }

  /**
   * How long to wait before the next request, in milliseconds. Returns 0 when
   * it's fine to go now, and counts that request against what's left.
   */
  delay(): number {
    const now = this.now();
    // Once the window has reset we don't know the new count until the next
    // response tells us, so go ahead
    if (now >= this.resetAt) this.remaining = Infinity;

    if (this.remaining > this.reserve) {
      this.remaining--;
      return 0;
    }
    return this.resetAt - now;
  }
}
