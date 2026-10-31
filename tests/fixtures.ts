import type { Variant } from "#lib/catalog";
import type { PrintfulCostEstimate, PrintfulOrder } from "#lib/printful/types";

/** A Printful cost estimate in GBP: £35 of items, £5.19 shipping */
export function costEstimate(overrides: {
  subtotal?: string;
  shipping?: string;
  costsCurrency?: string;
  retailCurrency?: string;
} = {}): PrintfulCostEstimate {
  const {
    subtotal = "35.00",
    shipping = "5.19",
    costsCurrency = "GBP",
    retailCurrency = "GBP",
  } = overrides;

  return {
    costs: {
      currency: costsCurrency,
      subtotal: "14.95",
      discount: "0.00",
      shipping,
      digitization: "0.00",
      additional_fee: "0.00",
      fulfillment_fee: "0.00",
      retail_delivery_fee: "0.00",
      tax: "0.00",
      vat: "4.03",
      total: "24.17",
    },
    retail_costs: {
      currency: retailCurrency,
      subtotal,
      discount: "0.00",
      shipping: null,
      tax: null,
      vat: null,
      total: null,
    },
  };
}

/** A draft Printful order built around costEstimate() */
export function draftOrder(overrides: Partial<PrintfulOrder> = {}): PrintfulOrder {
  return {
    ...costEstimate(),
    id: 1001,
    external_id: "pi_123",
    status: "draft",
    shipping: "STANDARD",
    shipping_service_name: "Flat Rate",
    recipient: {
      name: "Test Customer",
      address1: "10 Downing Street",
      city: "London",
      country_code: "GB",
      zip: "SW1A 2AA",
      email: "test@example.com",
    },
    created: 1_790_000_000,
    updated: 1_790_000_000,
    items: [],
    shipments: [],
    ...overrides,
  };
}

/** A synced Printful variant: a black medium hoodie at £35 */
export function variant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: 1,
    external_id: "ext_hoodie_black_m",
    sync_product_id: 10,
    name: "Hoodie - Black / M",
    synced: true,
    variant_id: 100,
    retail_price: "35.00",
    currency: "GBP",
    is_ignored: false,
    sku: null,
    product: { variant_id: 100, product_id: 50, image: "https://example.com/blank.png", name: "Hoodie" },
    files: [{ type: "preview", preview_url: "https://example.com/mockup.png", options: [] }],
    options: [],
    main_category_id: null,
    warehouse_product_id: null,
    warehouse_product_variant_id: null,
    size: "M",
    color: "Black",
    availability_status: "active",
    ...overrides,
  };
}
