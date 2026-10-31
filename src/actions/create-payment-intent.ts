import { z } from "astro/zod";
import { CartLinesSchema } from "#actions/shared/schemas";
import { getStoreCurrency, itemsSubtotal } from "#lib/pricing";
import { newCheckoutToken, stripe } from "#lib/stripe";

export const CreatePaymentIntentInput = z.object({
  items: CartLinesSchema,
});

/**
 * Start a checkout: a payment intent for the cart's item subtotal, priced on
 * the server. estimateOrder and checkout update the amount once shipping and
 * VAT are known.
 */
export async function createPaymentIntent({
  items,
}: z.infer<typeof CreatePaymentIntentInput>) {
  const checkoutToken = newCheckoutToken();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: await itemsSubtotal(items),
    currency: await getStoreCurrency(),
    metadata: { source: "checkout_page", checkout_token: checkoutToken },
    automatic_payment_methods: { enabled: true },
  });

  if (!paymentIntent.client_secret) {
    throw new Error(`Stripe returned no client secret for ${paymentIntent.id}`);
  }

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    checkoutToken,
  };
}
