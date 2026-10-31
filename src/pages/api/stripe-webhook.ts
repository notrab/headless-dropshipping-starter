import type { APIRoute } from "astro";
import { STRIPE_WEBHOOK_SECRET } from "astro:env/server";
import { stripe } from "#lib/stripe";
import { printful } from "#lib/printful/client";
import type { PrintfulOrder } from "#lib/printful/types";
import { customerTotals } from "#lib/pricing";

/**
 * Stripe Webhook Handler
 *
 * On payment_intent.succeeded, confirms the draft Printful order whose ID was
 * stored in the payment intent metadata by the checkout action.
 *
 * SECURITY:
 * - Verifies the webhook signature
 * - Re-prices the draft order and refuses to fulfil it unless the customer
 *   paid exactly its total, in its currency. A mismatch is flagged in the
 *   payment intent metadata for manual review (refund or confirm by hand).
 * - Idempotent: Stripe retries are a no-op once the order is confirmed
 */
export const POST: APIRoute = async ({ request }) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  if (event.type !== "payment_intent.succeeded") {
    return Response.json({ received: true });
  }

  const paymentIntent = event.data.object;
  const draftOrderId = paymentIntent.metadata.printful_draft_order_id;

  if (!draftOrderId) {
    console.error(`No draft order ID on payment intent ${paymentIntent.id}`);
    return new Response("No draft order ID", { status: 200 }); // Don't retry
  }

  try {
    const order = await printful<PrintfulOrder>(`/orders/${draftOrderId}`);

    if (order.status !== "draft") {
      return Response.json({ received: true, status: order.status });
    }

    const { total, currency } = customerTotals(order);
    if (
      paymentIntent.currency !== currency ||
      paymentIntent.amount_received !== total
    ) {
      console.error(
        `Payment ${paymentIntent.id} received ${paymentIntent.amount_received} ${paymentIntent.currency}, order ${draftOrderId} requires ${total} ${currency}. Not confirming.`,
      );
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: { printful_order_status: "amount_mismatch" },
      });
      return new Response("Amount mismatch", { status: 200 }); // Needs manual review
    }

    await printful(`/orders/${draftOrderId}/confirm`, { method: "POST" });

    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        printful_order_status: "confirmed",
        printful_order_confirmed_at: new Date().toISOString(),
      },
    });

    return Response.json({ success: true, orderId: draftOrderId });
  } catch (error) {
    console.error("Error confirming Printful order:", error);
    // 500 so Stripe retries
    return new Response("Error confirming order", { status: 500 });
  }
};
