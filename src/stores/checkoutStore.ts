import type { Alpine } from "alpinejs";
import type { NamedAddress } from "#actions/shared/schemas";
import type { ShippingMethod } from "#actions/shipping-methods";
import type { OrderTotals } from "#lib/pricing";

export type CheckoutAddress = NamedAddress;
export type CheckoutShippingMethod = ShippingMethod;
export type { OrderTotals };

/** Whether each part of the checkout form is complete */
export interface ValidationState {
  email: boolean;
  payment: boolean;
  shippingAddress: boolean;
  billingAddress: boolean;
  shippingMethod: boolean;
}

/**
 * Checkout state. The checkout page assigns plain fields directly (e.g.
 * `store.isSubmitting = true`); only behaviour with rules lives in methods.
 */
export interface CheckoutStore {
  paymentIntentId: string | null;
  /** Lets this browser change the order behind the payment intent (lib/stripe.ts) */
  checkoutToken: string | null;
  email: string | null;
  shippingAddress: CheckoutAddress | null;
  availableShippingMethods: CheckoutShippingMethod[];
  selectedShippingMethod: CheckoutShippingMethod | null;
  /** What the customer will be charged, as priced by the server (minor units) */
  totals: OrderTotals | null;
  validation: ValidationState;

  // Loading states
  isPricing: boolean;
  isSubmitting: boolean;
  isFetchingShippingMethods: boolean;

  // Computed (amounts in minor units)
  readonly isFormValid: boolean;
  /** True while anything that affects the price is in flight */
  readonly isBusy: boolean;
  readonly subtotal: number;
  readonly shippingCost: number | null;
  readonly vatAmount: number;
  readonly orderTotal: number;

  setAvailableShippingMethods(methods: CheckoutShippingMethod[]): void;
  selectShippingMethod(method: CheckoutShippingMethod): void;
  changeShippingMethod(method: CheckoutShippingMethod): Promise<void>;
  fetchEstimate(): Promise<void>;
}

export function initCheckoutStore(Alpine: Alpine) {
  // Estimates can overlap when the customer changes things quickly; only the
  // most recent one may update the totals
  let latestEstimate = 0;

  const store: CheckoutStore = {
    paymentIntentId: null,
    checkoutToken: null,

    // Remembered between visits so returning customers don't retype them
    email: Alpine.$persist(null).as("checkout-email") as unknown as string | null,
    shippingAddress: Alpine.$persist(null).as("checkout-shipping-address") as unknown as CheckoutAddress | null,

    availableShippingMethods: [],
    selectedShippingMethod: null,
    totals: null,

    validation: {
      email: false,
      payment: false,
      shippingAddress: false,
      billingAddress: false,
      shippingMethod: false,
    },

    isPricing: false,
    isSubmitting: false,
    isFetchingShippingMethods: false,

    get isFormValid() {
      return Object.values(this.validation).every(Boolean);
    },

    get isBusy() {
      return this.isSubmitting || this.isPricing || this.isFetchingShippingMethods;
    },

    // Prefer the server's figures: cart prices are cached in localStorage and
    // may be stale. Fall back to the cart until an address has been priced.
    get subtotal() {
      return this.totals?.subtotal ?? Alpine.store("cart").cartTotal;
    },

    get shippingCost() {
      return this.totals?.shipping ?? this.selectedShippingMethod?.rate ?? null;
    },

    get vatAmount() {
      return this.totals?.vat ?? 0;
    },

    get orderTotal() {
      return this.totals?.total ?? this.subtotal + (this.shippingCost ?? 0);
    },

    setAvailableShippingMethods(methods) {
      this.availableShippingMethods = methods;

      // Keep the current choice if it's still offered, otherwise pick the first
      const current = methods.find((m) => m.id === this.selectedShippingMethod?.id);
      const next = current ?? methods[0];
      if (next) {
        this.selectShippingMethod(next);
      } else {
        this.selectedShippingMethod = null;
        this.validation.shippingMethod = false;
      }
    },

    selectShippingMethod(method) {
      this.selectedShippingMethod = method;
      this.validation.shippingMethod = true;
    },

    /** The customer picked a shipping option: select it and re-price */
    async changeShippingMethod(method) {
      this.selectShippingMethod(method);
      await this.fetchEstimate();
    },

    /**
     * Price the order with Printful for the current address and shipping
     * method. The server also sets the payment intent amount to match.
     */
    async fetchEstimate() {
      const cart = Alpine.store("cart");
      if (cart.isEmpty || !this.shippingAddress || !this.selectedShippingMethod) {
        return;
      }

      const request = ++latestEstimate;
      this.isPricing = true;
      try {
        const { actions } = await import("astro:actions");
        const { data, error } = await actions.estimateOrder({
          items: cart.items.map((item) => ({
            external_variant_id: item.id,
            quantity: item.quantity,
          })),
          shippingAddress: this.shippingAddress,
          email: this.email || undefined,
          shipping: this.selectedShippingMethod.id,
          payment:
            this.paymentIntentId && this.checkoutToken
              ? { paymentIntentId: this.paymentIntentId, checkoutToken: this.checkoutToken }
              : undefined,
        });
        if (request !== latestEstimate) return;
        if (error) throw error;

        this.totals = data;
      } catch (error) {
        // Leave the previous totals; checkout re-prices before charging anyway
        console.error("Failed to fetch estimate:", error);
      } finally {
        if (request === latestEstimate) this.isPricing = false;
      }
    },
  };

  Alpine.store("checkout", store);
}
