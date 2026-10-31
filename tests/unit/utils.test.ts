import { describe, expect, it } from "vitest";
import { formatDateTime, formatPrice, formatPriceRange } from "#utils";

describe("formatPrice", () => {
  it("formats minor units as currency", () => {
    expect(formatPrice(3500, "GBP")).toBe("£35.00");
    expect(formatPrice(1999, "USD")).toBe("US$19.99");
    expect(formatPrice(0)).toBe("£0.00");
  });

  it("accepts lowercase currency codes, as Stripe returns them", () => {
    expect(formatPrice(4019, "gbp")).toBe("£40.19");
  });
});

describe("formatPriceRange", () => {
  it("shows a single price when every variant costs the same", () => {
    expect(formatPriceRange([3500, 3500], "GBP")).toBe("£35.00");
  });

  it("shows the lowest price as 'From' when prices differ", () => {
    expect(formatPriceRange([3800, 3500, 4200], "GBP")).toBe("From £35.00");
  });

  it("handles products with nothing to sell", () => {
    expect(formatPriceRange([], "GBP")).toBe("Unavailable");
  });
});

describe("formatDateTime", () => {
  it("formats Printful's Unix timestamps (seconds, not milliseconds)", () => {
    // 2026-10-30T13:04:00Z; the hour depends on the machine's timezone
    expect(formatDateTime(1_793_365_440)).toMatch(/^Oct 30, 2026, \d{1,2}:04 [AP]M$/);
  });
});
