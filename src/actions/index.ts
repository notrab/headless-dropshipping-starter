import { defineAction } from "astro:actions";
import { handleErrors } from "#actions/shared/handle-errors";
import { checkCart, CheckCartInput } from "#actions/check-cart";
import { checkout, CheckoutInput } from "#actions/checkout";
import { createPaymentIntent, CreatePaymentIntentInput } from "#actions/create-payment-intent";
import { estimateOrder, EstimateOrderInput } from "#actions/estimate-order";
import { getShippingMethods, ShippingMethodsInput } from "#actions/shipping-methods";

/**
 * Every server action the browser can call. Each one validates its input,
 * runs a plain handler function, and turns any error into a response that's
 * safe to show customers (see shared/handle-errors.ts).
 */
export const server = {
  createPaymentIntent: defineAction({
    input: CreatePaymentIntentInput,
    handler: handleErrors("createPaymentIntent", createPaymentIntent),
  }),
  getShippingMethods: defineAction({
    input: ShippingMethodsInput,
    handler: handleErrors("getShippingMethods", getShippingMethods),
  }),
  estimateOrder: defineAction({
    input: EstimateOrderInput,
    handler: handleErrors("estimateOrder", estimateOrder),
  }),
  checkCart: defineAction({
    input: CheckCartInput,
    handler: handleErrors("checkCart", checkCart),
  }),
  checkout: defineAction({
    input: CheckoutInput,
    handler: handleErrors("checkout", checkout),
  }),
};
