import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftOrder } from "../fixtures";

// Fake Printful and Stripe: these tests are about what we do with their answers
const printful = vi.fn();
const stripe = {
  paymentIntents: { retrieve: vi.fn(), update: vi.fn() },
};
vi.mock("#lib/printful/client", () => ({ printful }));
vi.mock("#lib/stripe", () => ({ stripe }));
vi.mock("astro:env/server", () => ({ PASS_THROUGH_VAT: false }));
vi.mock("astro:content", () => ({ getCollection: async () => [] }));

const { getOrderSummary } = await import("#lib/orders");

function paymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}) {
  return {
    id: "pi_123",
    status: "requires_payment_method",
    amount: 4019,
    amount_received: 0,
    currency: "gbp",
    client_secret: "pi_123_secret_abc",
    metadata: {},
    payment_method: null,
    receipt_email: null,
    ...overrides,
  } as Stripe.PaymentIntent;
}

beforeEach(() => {
  vi.clearAllMocks();
  printful.mockResolvedValue(draftOrder());
});

describe("getOrderSummary payment state", () => {
  it("offers payment for an unpaid draft", async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent());

    const { payment, totals } = await getOrderSummary("pi_123");

    expect(payment).toEqual({ status: "unpaid", clientSecret: "pi_123_secret_abc" });
    expect(totals.total).toBe(4019);
    expect(stripe.paymentIntents.update).not.toHaveBeenCalled();
  });

  it("corrects the payment amount when the draft has been re-priced", async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent({ amount: 100 }));

    await getOrderSummary("pi_123");

    expect(stripe.paymentIntents.update).toHaveBeenCalledWith(
      "pi_123",
      expect.objectContaining({
        amount: 4019,
        metadata: expect.objectContaining({ customer_total: "40.19" }),
      }),
    );
  });

  it("won't take payment when the order and payment currencies differ", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent({ currency: "usd" }));

    const { payment } = await getOrderSummary("pi_123");

    expect(payment.status).toBe("abandoned");
    expect(stripe.paymentIntents.update).not.toHaveBeenCalled();
  });

  it.each([
    ["succeeded", "paid"],
    ["processing", "processing"],
    ["canceled", "abandoned"],
  ] as const)("reports a %s payment as %s", async (stripeStatus, expected) => {
    stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent({ status: stripeStatus }));

    const { payment } = await getOrderSummary("pi_123");

    expect(payment.status).toBe(expected);
  });

  it("doesn't offer payment once Printful has confirmed the order", async () => {
    printful.mockResolvedValue(draftOrder({ status: "pending" }));
    stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent());

    const { payment } = await getOrderSummary("pi_123");

    expect(payment.status).toBe("abandoned");
  });

  it("still shows the order when Stripe can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stripe.paymentIntents.retrieve.mockRejectedValue(new Error("network down"));

    const { payment, totals } = await getOrderSummary("pi_123");

    expect(payment.status).toBe("unknown");
    expect(totals.total).toBe(4019);
  });
});

describe("getOrderSummary totals", () => {
  it("shows what was charged for a paid order", async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paymentIntent({
        status: "succeeded",
        amount: 4019,
        amount_received: 4019,
        metadata: {
          retail_subtotal: "35.00",
          retail_shipping: "5.19",
          vat_amount_to_customer: "0.00",
          customer_total: "40.19",
        },
      }),
    );

    const { totals } = await getOrderSummary("pi_123");

    expect(totals).toEqual({ currency: "gbp", subtotal: 3500, shipping: 519, vat: 0, total: 4019 });
  });

  it("shows the billing address and card Stripe has on file", async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paymentIntent({
        status: "succeeded",
        payment_method: {
          card: { brand: "visa", last4: "4242" },
          billing_details: {
            name: "Bill Payer",
            address: { line1: "1 Billing Road", line2: null, city: "Leeds", state: null, postal_code: "LS1 1AA", country: "GB" },
          },
        } as Stripe.PaymentMethod,
      }),
    );

    const summary = await getOrderSummary("pi_123");

    expect(summary.card).toEqual({ brand: "visa", last4: "4242" });
    expect(summary.billingAddress).toEqual({
      name: "Bill Payer",
      lines: ["1 Billing Road", "Leeds, LS1 1AA", "GB"],
    });
    expect(summary.shippingAddress.lines[0]).toBe("10 Downing Street");
  });
});
