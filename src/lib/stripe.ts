import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import { StoreError } from "#lib/errors";

// Bump the API version here, in one place, after reading Stripe's changelog
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-10-28.endive",
});

/**
 * Who can do what with a payment intent:
 * - The client secret lets a browser *pay* it. Order pages show it so a
 *   customer can finish an unpaid order.
 * - The checkout token lets a browser *change the order* behind it (items,
 *   address, amount). Only the checkout page that created the payment intent
 *   has it. It's kept in metadata, which Stripe never sends to browsers.
 */
export const newCheckoutToken = () => crypto.randomUUID();

/** Retrieve a payment intent, checking the caller holds its checkout token. */
export async function getOwnedPaymentIntent(
  paymentIntentId: string,
  checkoutToken: string,
) {
  const paymentIntent = await stripe.paymentIntents
    .retrieve(paymentIntentId)
    .catch((error: unknown) => {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        throw new StoreError("INVALID_SESSION", error.message, { cause: error });
      }
      throw error;
    });
  if (paymentIntent.metadata.checkout_token !== checkoutToken) {
    throw new StoreError("INVALID_SESSION", `Wrong checkout token for ${paymentIntentId}`);
  }
  return paymentIntent;
}
