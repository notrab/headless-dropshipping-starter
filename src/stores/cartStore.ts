import type { Alpine } from "alpinejs";

/** Matches the server's limit in CartLineSchema */
export const MAX_QUANTITY = 100;

export interface CartItem {
  /** The Printful sync variant's external ID; what checkout sends to the server */
  id: string;
  name: string;
  /** e.g. "Black / M" */
  variant: string;
  color: string | null;
  size: string | null;
  /**
   * Unit price in minor units (pence/cents), cached when the item was added.
   * Display only: checkout always re-prices from Printful on the server.
   */
  price: number;
  currency: string;
  image: string;
  quantity: number;
}

export interface CartStore {
  items: CartItem[];
  /** IDs of items the store no longer sells, from checkAvailability() */
  unavailableIds: string[];

  // Computed
  isEmpty: boolean;
  totalItems: number;
  cartTotal: number;
  currency: string;
  unavailableItems: CartItem[];
  /** Names the unavailable items, or null when there are none */
  unavailableMessage: string | null;

  addItem(item: Omit<CartItem, "quantity">, quantity?: number): void;
  removeItem(itemId: string): void;
  updateItemQuantity(itemId: string, quantity: number): void;
  emptyCart(): void;
  isUnavailable(itemId: string): boolean;
  /** Ask the server which items can no longer be bought */
  checkAvailability(): Promise<void>;
}

const clampQuantity = (quantity: number) => Math.min(MAX_QUANTITY, quantity);

/** "Tee (Navy / XS)", or just the name when there's nothing to choose */
const describeItem = (item: CartItem) =>
  item.variant && item.variant !== item.name ? `${item.name} (${item.variant})` : item.name;

export function initCartStore(Alpine: Alpine) {
  const store: CartStore = {
    items: Alpine.$persist([]).as("alpine-cart") as unknown as CartItem[],
    unavailableIds: [],

    get isEmpty() {
      return this.items.length === 0;
    },

    get totalItems() {
      return this.items.reduce((sum, item) => sum + item.quantity, 0);
    },

    get cartTotal() {
      return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },

    get currency() {
      return this.items[0]?.currency || "GBP";
    },

    get unavailableItems() {
      return this.items.filter((item) => this.unavailableIds.includes(item.id));
    },

    get unavailableMessage() {
      const items = this.unavailableItems;
      if (items.length === 0) return null;

      // Each item is marked in the list too, so name one but count several
      return items.length === 1
        ? `${describeItem(items[0])} is no longer available. Remove it from your cart to continue.`
        : `${items.length} items in your cart are no longer available. Remove them to continue.`;
    },

    addItem(item, quantity = 1) {
      const existing = this.items.find((i) => i.id === item.id);

      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + quantity);
      } else {
        this.items.push({ ...item, quantity: clampQuantity(quantity) });
      }
    },

    removeItem(itemId) {
      this.items = this.items.filter((item) => item.id !== itemId);
    },

    updateItemQuantity(itemId, quantity) {
      const item = this.items.find((i) => i.id === itemId);
      if (!item) return;

      if (quantity <= 0) {
        this.removeItem(itemId);
      } else {
        item.quantity = clampQuantity(quantity);
      }
    },

    emptyCart() {
      this.items = [];
    },

    isUnavailable(itemId) {
      return this.unavailableIds.includes(itemId);
    },

    async checkAvailability() {
      if (this.isEmpty) return;

      try {
        const { actions } = await import("astro:actions");
        const { data, error } = await actions.checkCart({
          ids: this.items.map((item) => item.id),
        });
        if (error) throw error;

        this.unavailableIds = data.unavailable;
      } catch (error) {
        // Checkout checks again on the server before taking payment
        console.error("Failed to check cart availability:", error);
      }
    },
  };

  Alpine.store("cart", store);
}
