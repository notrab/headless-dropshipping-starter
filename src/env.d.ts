/// <reference types="astro/client" />

import type { Alpine as AlpineType } from "alpinejs";
import type { CartStore } from "./stores/cartStore";
import type { CheckoutStore } from "./stores/checkoutStore";

// This file is a module (it has imports), so globals must be declared explicitly
declare global {
  interface Window {
    Alpine: AlpineType;
    formatPrice: typeof import("./utils").formatPrice;
  }
}

declare module "alpinejs" {
  interface Stores {
    cart: CartStore;
    checkout: CheckoutStore;
  }
}

declare module "@alpinejs/persist" {
  import type { Alpine } from "alpinejs";
  const persist: (alpine: Alpine) => void;
  export default persist;
}
