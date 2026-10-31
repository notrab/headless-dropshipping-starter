import type { PrintfulOrderStatus } from "#lib/printful/types";

// What to tell a customer about their order. Pure functions, no API calls.

/**
 * Where the customer's payment stands:
 * - paid: Stripe has the money
 * - processing: the money is on its way (e.g. a bank debit)
 * - unpaid: the order is waiting for payment and can still be paid
 * - abandoned: the payment can't be completed any more
 * - unknown: Stripe couldn't be reached
 */
export type PaymentState =
  | { status: "paid" | "processing" | "unknown" }
  | { status: "unpaid"; clientSecret: string }
  | { status: "abandoned" };

export type PaymentStatus = PaymentState["status"];

/** Whether the customer has paid (or we can't tell), so the order is under way */
export function isPaid(status: PaymentStatus) {
  return status !== "unpaid" && status !== "abandoned";
}

export interface StatusMessage {
  title: string;
  body: string;
}

const processing: StatusMessage = {
  title: "Your order is being processed",
  body: "We're currently processing your order. You'll receive an email with tracking information once your order ships.",
};

const problem: StatusMessage = {
  title: "There's a problem with your order",
  body: "Your order can't be fulfilled right now. Please contact us and we'll sort it out.",
};

const paymentMessages: Partial<Record<PaymentStatus, StatusMessage>> = {
  unpaid: {
    title: "Your order is waiting for payment",
    body: "We haven't received payment for this order yet. Complete it below and we'll start getting your order ready.",
  },
  abandoned: {
    title: "This order wasn't paid",
    body: "Payment for this order didn't go through and it can no longer be completed. Please place a new order, or contact us if you need help.",
  },
  processing: {
    title: "Your payment is processing",
    body: "Your payment is on its way. We'll start getting your order ready as soon as it arrives.",
  },
};

const fulfilmentMessages: Record<PrintfulOrderStatus, StatusMessage> = {
  draft: processing,
  pending: processing,
  inprocess: processing,
  onhold: problem,
  failed: problem,
  canceled: {
    title: "Your order has been canceled",
    body: "This order was canceled. Please contact us if you have any questions.",
  },
  partial: {
    title: "Part of your order has shipped",
    body: 'Some of your items are on the way. Use the "Track shipment" link for the latest delivery information.',
  },
  fulfilled: {
    title: "Your order has been shipped",
    body: 'Your order has been shipped. Use the "Track shipment" link for the latest delivery information.',
  },
};

/**
 * The headline for an order page. Payment comes first: until it's in, the
 * Printful status is just "draft", which says nothing useful.
 */
export function orderMessage(
  orderStatus: PrintfulOrderStatus,
  paymentStatus: PaymentStatus,
): StatusMessage {
  return paymentMessages[paymentStatus] ?? fulfilmentMessages[orderStatus] ?? processing;
}
