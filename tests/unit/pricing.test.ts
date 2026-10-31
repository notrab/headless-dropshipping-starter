import { describe, expect, it } from "vitest";
import { StoreError } from "#lib/errors";
import { customerTotals, findUnavailable, toOrderTotals, totalsMetadata } from "#lib/pricing";
import { costEstimate } from "../fixtures";

describe("customerTotals", () => {
  it("charges retail prices for items and Printful's cost for shipping", () => {
    const totals = customerTotals(costEstimate(), { passThroughVat: false });

    expect(totals).toMatchObject({
      currency: "gbp",
      subtotal: 3500,
      shipping: 519,
      vat: 0,
      total: 4019,
    });
  });

  it("adds 20% VAT on items and shipping when passing VAT through", () => {
    const totals = customerTotals(costEstimate(), { passThroughVat: true });

    // (3500 + 519) * 0.2 = 803.8 → 804
    expect(totals.vat).toBe(804);
    expect(totals.total).toBe(3500 + 519 + 804);
  });

  it("rounds VAT to the nearest penny without floating point drift", () => {
    // 0.1 + 0.2 style inputs: £10.10 + £0.20 → 1030p, VAT 206p
    const totals = customerTotals(costEstimate({ subtotal: "10.10", shipping: "0.20" }), {
      passThroughVat: true,
    });

    expect(totals.subtotal).toBe(1010);
    expect(totals.shipping).toBe(20);
    expect(totals.vat).toBe(206);
    expect(Number.isInteger(totals.total)).toBe(true);
  });

  it("never adds Printful's own tax or VAT to what the customer pays", () => {
    const totals = customerTotals(costEstimate(), { passThroughVat: false });

    expect(totals.printfulVat).toBe(403);
    expect(totals.total).toBe(totals.subtotal + totals.shipping);
  });

  it("reports the margin against what Printful bills", () => {
    const totals = customerTotals(costEstimate(), { passThroughVat: false });

    expect(totals.printfulCost).toBe(2417);
    expect(totals.profit).toBe(4019 - 2417);
  });

  it("refuses to add up amounts in different currencies", () => {
    const estimate = costEstimate({ costsCurrency: "USD", retailCurrency: "GBP" });

    expect(() => customerTotals(estimate)).toThrow(StoreError);
    expect(() => customerTotals(estimate)).toThrow(/CURRENCY_MISMATCH/);
  });

  it("treats currency codes case-insensitively", () => {
    const estimate = costEstimate({ costsCurrency: "gbp", retailCurrency: "GBP" });

    expect(customerTotals(estimate).currency).toBe("gbp");
  });
});

describe("toOrderTotals", () => {
  it("keeps only the customer-facing amounts", () => {
    const totals = toOrderTotals(customerTotals(costEstimate(), { passThroughVat: false }));

    expect(totals).toEqual({
      currency: "gbp",
      subtotal: 3500,
      shipping: 519,
      vat: 0,
      total: 4019,
    });
  });
});

describe("totalsMetadata", () => {
  it("records the breakdown as decimal strings Stripe metadata can hold", () => {
    const metadata = totalsMetadata(customerTotals(costEstimate(), { passThroughVat: true }));

    expect(metadata).toMatchObject({
      retail_subtotal: "35.00",
      retail_shipping: "5.19",
      vat_amount_to_customer: "8.04",
      customer_total: "48.23",
      vat_registered: "true",
    });
    for (const value of Object.values(metadata)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("findUnavailable", () => {
  const variants = new Map([
    ["tee_m", {}],
    ["cap", {}],
  ]);

  it("returns every ID the catalog doesn't sell, in cart order", () => {
    expect(findUnavailable(["gone_1", "tee_m", "gone_2", "cap"], variants)).toEqual([
      "gone_1",
      "gone_2",
    ]);
  });

  it("returns nothing when everything is for sale", () => {
    expect(findUnavailable(["cap", "tee_m"], variants)).toEqual([]);
  });

  it("lists a repeated ID once", () => {
    expect(findUnavailable(["gone", "gone"], variants)).toEqual(["gone"]);
  });
});
