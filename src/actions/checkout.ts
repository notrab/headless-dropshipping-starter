import { z } from "astro/zod";
import { CartLinesSchema, NamedAddressSchema } from "#actions/shared/schemas";
import { StoreError } from "#lib/errors";
import {
  customerTotals,
  resolveOrderItems,
  toOrderTotals,
  totalsMetadata,
} from "#lib/pricing";
import { PrintfulApiError, printful, toPrintfulRecipient } from "#lib/printful/client";
import type { PrintfulOrder } from "#lib/printful/types";
import { getOwnedPaymentIntent, stripe } from "#lib/stripe";

export const CheckoutInput = z.object({
  paymentIntentId: z.string().min(1),
  // Proves this browser started the checkout (see lib/stripe.ts)
  checkoutToken: z.string().min(1),
  shippingAddress: NamedAddressSchema,
  shippingMethod: z.object({ id: z.string(), name: z.string() }),
  items: CartLinesSchema,
  email: z.email("Valid email is required"),
});

/**
 * Called just before the browser confirms payment:
 * 1. Resolve item prices from the synced Printful variants (never the browser)
 * 2. Create (or, on retry, update) a DRAFT Printful order to lock in costs
 * 3. Set the payment intent amount to what the customer owes for that draft
 *
 * After payment, the Stripe webhook checks the amount received against the
 * draft order and confirms it with Printful.
 */
export async function checkout({
  paymentIntentId,
  checkoutToken,
  shippingAddress,
  shippingMethod,
  items,
  email,
}: z.infer<typeof CheckoutInput>) {
  const paymentIntent = await getOwnedPaymentIntent(paymentIntentId, checkoutToken);
  if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
    throw new StoreError("ALREADY_PAID", paymentIntentId);
  }

  const draft = await saveDraftOrder(paymentIntentId, {
    recipient: toPrintfulRecipient(shippingAddress, email),
    shipping: shippingMethod.id,
    items: await resolveOrderItems(items),
    external_id: paymentIntentId,
  });

  const totals = customerTotals(draft);
  if (totals.currency !== paymentIntent.currency) {
    throw new StoreError(
      "CURRENCY_MISMATCH",
      `Order ${draft.id} is in ${totals.currency}, payment in ${paymentIntent.currency}`,
    );
  }

  // Stripe metadata values are capped at 500 chars, so keep these small.
  // The draft order holds the full item and address details.
  await stripe.paymentIntents.update(paymentIntentId, {
    amount: totals.total,
    receipt_email: email,
    metadata: {
      printful_draft_order_id: draft.id.toString(),
      shipping_method_id: shippingMethod.id,
      shipping_method_name: shippingMethod.name,
      customer_email: email,
      ...totalsMetadata(totals),
    },
  });

  return { draftOrderId: draft.id, totals: toOrderTotals(totals) };
}

/**
 * Update the draft order for this payment intent, or create it on the first
 * attempt. A previous attempt (e.g. a declined card) may already have created
 * one, and external_id must be unique, so updating comes first.
 */
async function saveDraftOrder(paymentIntentId: string, order: object) {
  try {
    return await printful<PrintfulOrder>(`/orders/@${paymentIntentId}`, {
      method: "PUT",
      body: order,
    });
  } catch (error) {
    if (!(error instanceof PrintfulApiError && error.status === 404)) throw error;

    return printful<PrintfulOrder>("/orders", {
      method: "POST",
      body: { ...order, confirm: false },
    });
  }
}
