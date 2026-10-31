import { z } from "astro/zod";
import { CartLinesSchema, NamedAddressSchema } from "#actions/shared/schemas";
import { cacheKey, TtlCache } from "#lib/cache";
import { customerTotals, resolveOrderItems, toOrderTotals } from "#lib/pricing";
import { printful, toPrintfulRecipient } from "#lib/printful/client";
import type { PrintfulCostEstimate } from "#lib/printful/types";
import { getOwnedPaymentIntent, stripe } from "#lib/stripe";

// Printful's costs for the same items, address and shipping method don't change
// minute to minute. Only the price-relevant fields go in the key, so customers
// with the same cart and address share an estimate.
const estimateCache = new TtlCache<PrintfulCostEstimate>(5 * 60_000);

export const EstimateOrderInput = z.object({
  items: CartLinesSchema,
  shippingAddress: NamedAddressSchema,
  email: z.email().optional(),
  shipping: z.string().optional(), // Shipping method ID, e.g. "STANDARD"
  // When set, the payment intent's amount is updated to the estimated total, so
  // wallet payment sheets (Apple Pay etc.) show it before the customer pays
  payment: z
    .object({ paymentIntentId: z.string(), checkoutToken: z.string() })
    .optional(),
});

/**
 * Price the order with Printful once the shipping address is known, so the
 * checkout page can show the real total, and keep the payment intent amount in
 * step with it. Item prices come from the synced Printful variants, never the
 * browser. The checkout action re-prices before any money is taken.
 */
export async function estimateOrder({
  items,
  shippingAddress,
  email,
  shipping,
  payment,
}: z.infer<typeof EstimateOrderInput>) {
  const { name: _name, phone: _phone, ...address } = shippingAddress;
  const orderItems = await resolveOrderItems(items);
  const estimate = await estimateCache.get(
    cacheKey({ address, shipping, items: orderItems }),
    () =>
      printful<PrintfulCostEstimate>("/orders/estimate-costs", {
        method: "POST",
        body: {
          recipient: toPrintfulRecipient(shippingAddress, email),
          ...(shipping && { shipping }),
          items: orderItems,
        },
      }),
  );

  const totals = customerTotals(estimate);

  if (payment) {
    const paymentIntent = await getOwnedPaymentIntent(
      payment.paymentIntentId,
      payment.checkoutToken,
    );
    await stripe.paymentIntents.update(paymentIntent.id, { amount: totals.total });
  }

  return toOrderTotals(totals);
}
