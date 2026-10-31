import type { Alpine } from "alpinejs";
import persist from "@alpinejs/persist";
import { initCartStore } from "./stores/cartStore";
import { initCheckoutStore } from "./stores/checkoutStore";
import { formatPrice } from "./utils";

export default (Alpine: Alpine) => {
  // Used in x-text expressions across the store, e.g. formatPrice(item.price, item.currency)
  window.formatPrice = formatPrice;

  Alpine.plugin(persist);
  initCartStore(Alpine);
  initCheckoutStore(Alpine);
};
