import { describe, expect, it } from "vitest";
import { isPaid, orderMessage } from "#lib/order-status";

describe("isPaid", () => {
  it.each([
    ["paid", true],
    ["processing", true],
    ["unknown", true], // Stripe unreachable: show the order as normal
    ["unpaid", false],
    ["abandoned", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isPaid(status)).toBe(expected);
  });
});

describe("orderMessage", () => {
  it("asks for payment before anything else", () => {
    expect(orderMessage("draft", "unpaid").title).toBe("Your order is waiting for payment");
  });

  it("explains an order that can no longer be paid", () => {
    expect(orderMessage("draft", "abandoned").title).toBe("This order wasn't paid");
  });

  it("says a slow payment is still on its way", () => {
    expect(orderMessage("draft", "processing").title).toBe("Your payment is processing");
  });

  it("follows Printful once the order is paid", () => {
    expect(orderMessage("pending", "paid").title).toBe("Your order is being processed");
    expect(orderMessage("partial", "paid").title).toBe("Part of your order has shipped");
    expect(orderMessage("fulfilled", "paid").title).toBe("Your order has been shipped");
    expect(orderMessage("canceled", "paid").title).toBe("Your order has been canceled");
  });

  it("flags orders Printful can't fulfil", () => {
    expect(orderMessage("failed", "paid").title).toBe("There's a problem with your order");
    expect(orderMessage("onhold", "paid").title).toBe("There's a problem with your order");
  });
});
