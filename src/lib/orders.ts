import { getCollection } from "astro:content";
import type Stripe from "stripe";
import { toMinorUnits, variantImage, variantLabel } from "#lib/catalog";
import type { PaymentState } from "#lib/order-status";
import {
  customerTotals,
  toOrderTotals,
  totalsMetadata,
  type OrderTotals,
} from "#lib/pricing";
import { printful } from "#lib/printful/client";
import type { PrintfulOrder } from "#lib/printful/types";
import { stripe } from "#lib/stripe";

/** A line on an order summary. Prices are in minor units (pence/cents). */
export interface OrderLine {
  id: number;
  name: string;
  variant: string;
  image: string | undefined;
  quantity: number;
  price: number;
}

/** An address as shown on order pages, already split into display lines. */
export interface DisplayAddress {
  name: string;
  lines: string[];
}


export interface OrderSummary {
  order: PrintfulOrder;
  paymentIntent: Stripe.PaymentIntent | null;
  payment: PaymentState;
  currency: string;
  lines: OrderLine[];
  totals: OrderTotals;
  email: string | null;
  shippingAddress: DisplayAddress;
  billingAddress: DisplayAddress | null;
  card: { brand: string; last4: string } | null;
}

/**
 * Everything needed to show a placed order, keyed by the payment intent ID
 * (which is also the Printful order's external ID). Line items come from the
 * Printful order and totals from what Stripe actually charged, so nothing
 * displayed depends on data sent by the browser.
 */
export async function getOrderSummary(paymentIntentId: string): Promise<OrderSummary> {
  const order = await printful<PrintfulOrder>(`/orders/@${paymentIntentId}`);

  const paymentIntent = await stripe.paymentIntents
    .retrieve(paymentIntentId, { expand: ["payment_method"] })
    .catch((error) => {
      console.error("Failed to fetch payment intent:", error);
      return null;
    });

  const paymentMethod =
    typeof paymentIntent?.payment_method === "object"
      ? paymentIntent.payment_method
      : null;

  const { recipient } = order;
  const payment = await paymentState(order, paymentIntent);

  return {
    order,
    paymentIntent,
    payment,
    currency: (paymentIntent?.currency ?? order.retail_costs.currency).toUpperCase(),
    lines: await orderLines(order),
    // An unpaid order shows what's due now; a paid one what was charged
    totals:
      payment.status === "unpaid" ? amountDue(order) : chargedTotals(order, paymentIntent),
    email: recipient.email ?? paymentIntent?.receipt_email ?? null,
    shippingAddress: {
      name: recipient.name,
      lines: compact([
        recipient.address1,
        recipient.address2,
        compact([recipient.city, recipient.state_code, recipient.zip]).join(", "),
        recipient.country_code,
        recipient.phone,
      ]),
    },
    billingAddress: paymentMethod ? billingAddress(paymentMethod.billing_details) : null,
    card: paymentMethod?.card
      ? { brand: paymentMethod.card.brand, last4: paymentMethod.card.last4 }
      : null,
  };
}

const PAYABLE_STATUSES: Stripe.PaymentIntent.Status[] = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
];

/**
 * Work out whether the order still needs paying. If it does, make sure the
 * payment intent charges the draft order's current total (Printful may have
 * re-priced it since checkout), so the customer can pay it from the order page.
 */
async function paymentState(
  order: PrintfulOrder,
  paymentIntent: Stripe.PaymentIntent | null,
): Promise<PaymentState> {
  if (!paymentIntent) return { status: "unknown" };
  if (paymentIntent.status === "succeeded") return { status: "paid" };
  if (paymentIntent.status === "processing") return { status: "processing" };
  if (
    order.status !== "draft" ||
    !PAYABLE_STATUSES.includes(paymentIntent.status) ||
    !paymentIntent.client_secret
  ) {
    return { status: "abandoned" };
  }

  try {
    const totals = customerTotals(order);
    if (totals.currency !== paymentIntent.currency) {
      throw new Error(`Order is in ${totals.currency}, payment in ${paymentIntent.currency}`);
    }
    if (paymentIntent.amount !== totals.total) {
      await stripe.paymentIntents.update(paymentIntent.id, {
        amount: totals.total,
        metadata: totalsMetadata(totals),
      });
    }
  } catch (error) {
    console.error(`Can't take payment for order ${order.id}:`, error);
    return { status: "abandoned" };
  }

  return { status: "unpaid", clientSecret: paymentIntent.client_secret };
}

function amountDue(order: PrintfulOrder): OrderTotals {
  return toOrderTotals(customerTotals(order));
}

/**
 * What the customer was charged. The checkout action records the breakdown in
 * the payment intent metadata; if it's missing, re-price the Printful order.
 */
function chargedTotals(
  order: PrintfulOrder,
  paymentIntent: Stripe.PaymentIntent | null,
): OrderTotals {
  const metadata = paymentIntent?.metadata;
  if (!paymentIntent || !metadata?.customer_total) return amountDue(order);

  return {
    currency: paymentIntent.currency,
    subtotal: toMinorUnits(metadata.retail_subtotal),
    shipping: toMinorUnits(metadata.retail_shipping),
    vat: toMinorUnits(metadata.vat_amount_to_customer),
    total: paymentIntent.amount_received || paymentIntent.amount,
  };
}

async function orderLines(order: PrintfulOrder): Promise<OrderLine[]> {
  // Include unsellable variants: a past order may contain discontinued items
  const variants = await getCollection("variants");
  const byExternalId = new Map(variants.map((v) => [v.data.external_id, v.data]));

  return order.items.map((item) => {
    const variant = item.external_variant_id
      ? byExternalId.get(item.external_variant_id)
      : undefined;

    return {
      id: item.id,
      name: item.name,
      variant: variant ? variantLabel(variant) : "",
      image: variant
        ? variantImage(variant)
        : item.files?.[0]?.preview_url || item.product?.image,
      quantity: item.quantity,
      price: toMinorUnits(item.retail_price),
    };
  });
}

function billingAddress(
  details: Stripe.PaymentMethod.BillingDetails,
): DisplayAddress | null {
  const { address, name } = details;
  if (!address?.line1) return null;

  return {
    name: name ?? "",
    lines: compact([
      address.line1,
      address.line2,
      compact([address.city, address.state, address.postal_code]).join(", "),
      address.country,
    ]),
  };
}

const compact = (values: (string | null | undefined)[]) =>
  values.filter((value): value is string => Boolean(value));
