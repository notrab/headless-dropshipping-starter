/**
 * The checkout page's Stripe flow. State lives in the Alpine checkout store
 * ($store.checkout); this module mounts Stripe Elements, keeps the store in
 * sync with what the customer enters, and runs the submit flow:
 *
 *   checkCart → createPaymentIntent → (address) getShippingMethods
 *   → estimateOrder → (Pay) elements.submit → checkout
 *   → stripe.confirmPayment → /thankyou
 *
 * Checkout only starts with a cart the store can sell. Anything that isn't
 * for sale sends the customer back to the cart page, which names it. If an
 * item goes mid-checkout, the order summary marks it and checkout re-prices
 * once it's removed.
 */
import { loadStripe } from "@stripe/stripe-js";
import type {
  Stripe,
  StripeAddressElementChangeEvent,
  StripeElements,
} from "@stripe/stripe-js";
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from "astro:env/client";
import { actions } from "astro:actions";
import { elementsAppearance } from "#lib/stripe-elements";

type StripeAddressValue = Pick<StripeAddressElementChangeEvent, "complete" | "value">;
type StripeAddress = StripeAddressValue["value"]["address"];

const SHIPPING_COUNTRIES = ["US", "CA", "GB", "AU"];

const cart = () => window.Alpine.store("cart");
const checkout = () => window.Alpine.store("checkout");

let stripe: Stripe | null = null;
let elements: StripeElements | null = null;

// Whether initialize() has run (or is running) for this cart
let started = false;

// Cart lines as sent to the server: which variant and how many, never prices
function cartLines() {
  return cart().items.map((item) => ({
    external_variant_id: item.id,
    quantity: item.quantity,
  }));
}

// --- Shipping -----------------------------------------------------------

let lastShippingFetchKey: string | null = null;

// Load shipping options for an address, then re-price the order
async function fetchShippingMethods(address: StripeAddress, phone?: string) {
  // Stripe fires change events for every keystroke; skip repeat lookups
  const fetchKey = JSON.stringify([
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
    phone,
  ]);
  if (lastShippingFetchKey === fetchKey) return;
  lastShippingFetchKey = fetchKey;
  // The address may change again before this lookup returns
  const isLatest = () => lastShippingFetchKey === fetchKey;

  const store = checkout();
  store.isFetchingShippingMethods = true;
  try {
    const { data, error } = await actions.getShippingMethods({
      address,
      phone,
      items: cartLines(),
    });
    if (!isLatest()) return;
    if (error) throw error;
    store.setAvailableShippingMethods(data);
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    store.setAvailableShippingMethods([]);
  } finally {
    if (isLatest()) store.isFetchingShippingMethods = false;
  }

  if (isLatest()) await store.fetchEstimate();
}

function onShippingAddressChange(event: StripeAddressValue) {
  const store = checkout();
  const { name, phone, address } = event.value;
  store.validation.shippingAddress = event.complete;

  // Price as soon as there's enough to quote shipping, even if another
  // field (e.g. phone) is still missing
  if (!address.line1 || !address.city || !address.country || !address.postal_code) {
    return;
  }

  store.shippingAddress = { ...address, name, phone };
  fetchShippingMethods(address, phone);
}

// --- Stripe Elements ------------------------------------------------------

// Called by watchCart() once the cart is non-empty and everything in it is for sale
async function initialize() {
  try {
    // 1. A payment intent for the cart (priced on the server)
    const { data, error } = await actions.createPaymentIntent({ items: cartLines() });
    if (error) {
      showMessage(error.message);
      // Something went out of stock since the page loaded: watchCart() sends
      // the customer to the cart once checkAvailability() finds it
      if (error.code === "CONFLICT") {
        started = false;
        await cart().checkAvailability();
      }
      return;
    }

    const store = checkout();
    store.paymentIntentId = data.paymentIntentId;
    store.checkoutToken = data.checkoutToken;

    // 2. Stripe Elements bound to that payment intent
    stripe = await loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY);
    if (!stripe) throw new Error("Failed to load Stripe");

    const stripeElements = stripe.elements({
      clientSecret: data.clientSecret,
      appearance: elementsAppearance(),
    });
    elements = stripeElements;

    // Pre-fill what the customer entered on a previous visit
    const saved = store.shippingAddress;
    const linkAuth = stripeElements.create("linkAuthentication", {
      defaultValues: { email: store.email ?? "" },
    });
    const payment = stripeElements.create("payment", { layout: "tabs" });
    const shippingAddress = stripeElements.create("address", {
      mode: "shipping",
      allowedCountries: SHIPPING_COUNTRIES,
      blockPoBox: true,
      fields: { phone: "always" },
      ...(saved && {
        defaultValues: {
          name: saved.name,
          phone: saved.phone ?? undefined,
          address: {
            line1: saved.line1,
            line2: saved.line2 ?? undefined,
            city: saved.city,
            state: saved.state ?? undefined,
            postal_code: saved.postal_code ?? undefined,
            country: saved.country,
          },
        },
      }),
    });
    // Stripe attaches the billing address to the payment method itself
    const billingAddress = stripeElements.create("address", {
      mode: "billing",
      allowedCountries: SHIPPING_COUNTRIES,
      fields: { phone: "never" },
    });

    linkAuth.mount("#link-auth-element");
    payment.mount("#payment-element");
    shippingAddress.mount("#shipping-address-element");
    billingAddress.mount("#billing-address-element");

    // 3. Keep the checkout store in sync with what the customer enters
    store.validation.email = Boolean(store.email);
    linkAuth.on("change", (event) => {
      store.email = event.value.email;
      store.validation.email = event.complete && !!event.value.email;
    });
    payment.on("change", (event) => {
      // Card errors are shown inline by the Payment Element itself
      store.validation.payment = event.complete;
    });
    shippingAddress.on("change", onShippingAddressChange);
    // A pre-filled address doesn't fire "change", so price it once ready.
    // Only when there is one: getValue() also shows validation errors, which
    // a first-time visitor shouldn't see before they've typed anything.
    if (saved) {
      shippingAddress.on("ready", async () => {
        onShippingAddressChange(await shippingAddress.getValue());
      });
    }
    billingAddress.on("change", (event) => {
      store.validation.billingAddress = event.complete;
    });

    // 4. Re-pricing also updates the payment intent amount on the server;
    // refresh Elements so wallet sheets (Apple Pay etc.) show it
    window.Alpine.effect(() => {
      if (store.totals) stripeElements.fetchUpdates();
    });
  } catch (error) {
    console.error("Error initializing checkout:", error);
    showMessage("Failed to initialize payment form. Please refresh and try again.");
  }
}

// --- Submit -----------------------------------------------------------------

function missingFields() {
  const { validation } = checkout();
  return [
    !validation.email && "email address",
    !validation.shippingAddress && "shipping address",
    !validation.shippingMethod && "shipping method",
    !validation.payment && "payment information",
    !validation.billingAddress && "billing address",
  ].filter(Boolean);
}

async function handleSubmit(event: Event) {
  event.preventDefault();

  const store = checkout();
  const { email, shippingAddress, selectedShippingMethod, paymentIntentId, checkoutToken } =
    store;

  if (!store.isFormValid || !email || !shippingAddress || !selectedShippingMethod) {
    showMessage(`Please complete the following: ${missingFields().join(", ")}`);
    return;
  }
  if (!stripe || !elements || !paymentIntentId || !checkoutToken) {
    showMessage("Payment system not initialized.");
    return;
  }

  hideMessage();
  store.isSubmitting = true;
  let redirecting = false;
  try {
    // 1. Validate the payment form and collect wallet details. This must run
    // first, while we're still handling the click.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      showMessage(submitError.message ?? "Please check your payment details.");
      return;
    }

    // 2. Create the Printful draft order and set the payment intent amount
    // from it, before any money is taken
    const totalShown = store.orderTotal;
    const { data, error } = await actions.checkout({
      paymentIntentId,
      checkoutToken,
      shippingAddress,
      shippingMethod: {
        id: selectedShippingMethod.id,
        name: selectedShippingMethod.name,
      },
      items: cartLines(),
      email,
    });
    // Action errors carry a message that's safe to show the customer
    if (error) {
      showMessage(error.message);
      // Name any items that went out of stock (or were removed from the store)
      if (error.code === "CONFLICT") await cart().checkAvailability();
      return;
    }

    store.totals = data.totals;

    // 3. Never charge a different amount from the one on the Pay button
    if (data.totals.total !== totalShown) {
      showMessage("Your order total has been updated. Please review it and try again.");
      return;
    }

    // 4. Take payment. Redirect-based methods come back to return_url;
    // everything else resolves here.
    const returnUrl = new URL("/thankyou", window.location.origin);
    const { error: paymentError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl.href, receipt_email: email },
      redirect: "if_required",
    });

    if (paymentError) {
      const isCustomerError =
        paymentError.type === "card_error" || paymentError.type === "validation_error";
      showMessage(
        isCustomerError && paymentError.message
          ? paymentError.message
          : "An unexpected error occurred. Please try again.",
      );
      return;
    }

    returnUrl.searchParams.set("payment_intent", paymentIntentId);
    redirecting = true;
    window.location.href = returnUrl.href;
  } catch (error) {
    console.error("Payment error:", error);
    showMessage("An unexpected error occurred. Please try again.");
  } finally {
    // Stay disabled while leaving for the thank you page
    if (!redirecting) store.isSubmitting = false;
  }
}

function showMessage(text: string) {
  const container = document.getElementById("validation-errors");
  if (!container) return;

  container.textContent = text;
  container.classList.remove("hidden");
}

function hideMessage() {
  document.getElementById("validation-errors")?.classList.add("hidden");
}

// Start checkout when every item in the cart can be bought, and send the
// customer back to the cart if any can't. Once the payment form is up, an
// item that goes is marked here instead, and removing it re-prices the order.
async function watchCart() {
  await cart().checkAvailability();

  let blocked = false;
  window.Alpine.effect(() => {
    const { isEmpty, unavailableMessage } = cart();

    if (isEmpty || (unavailableMessage && !started)) {
      window.location.href = "/cart";
    } else if (unavailableMessage) {
      blocked = true;
      showMessage(unavailableMessage);
    } else if (!started) {
      started = true;
      // Outside the effect, so what initialize() reads isn't tracked here
      queueMicrotask(initialize);
    } else if (blocked) {
      blocked = false;
      hideMessage();
      queueMicrotask(() => checkout().fetchEstimate());
    }
  });
}

document.getElementById("payment-form")?.addEventListener("submit", handleSubmit);
// Alpine starts in its own module script; it's ready by DOMContentLoaded
document.addEventListener("DOMContentLoaded", watchCart);

