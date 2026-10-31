import type { z } from "astro/zod";
import type {
  printfulFileSchema,
  printfulProductDetailSchema,
  printfulProductSchema,
  printfulVariantProductSchema,
  printfulVariantSchema,
} from "./schema";

// Catalog types are inferred from the content collection schemas so the two
// can't drift. `z.input` is the raw API shape (before defaults are applied).
export type PrintfulProduct = z.input<typeof printfulProductSchema>;
export type PrintfulVariant = z.input<typeof printfulVariantSchema>;
export type PrintfulProductDetail = z.input<typeof printfulProductDetailSchema>;
export type PrintfulFile = z.input<typeof printfulFileSchema>;
export type PrintfulVariantProduct = z.input<typeof printfulVariantProductSchema>;

/** Money values from Printful are decimal strings in major units, e.g. "8.08". */
type Money = string;

export interface PrintfulCosts {
  currency: string;
  subtotal: Money;
  discount: Money;
  shipping: Money;
  digitization: Money;
  additional_fee: Money;
  fulfillment_fee: Money;
  retail_delivery_fee: Money;
  tax: Money;
  vat: Money;
  total: Money;
}

export interface PrintfulRetailCosts {
  currency: string;
  subtotal: Money | null;
  discount: Money | null;
  shipping: Money | null;
  tax: Money | null;
  vat: Money | null;
  total: Money | null;
}

/** Response of POST /orders/estimate-costs */
export interface PrintfulCostEstimate {
  costs: PrintfulCosts;
  retail_costs: PrintfulRetailCosts;
}

export interface PrintfulOrderItem {
  id: number;
  external_id: string | null;
  variant_id: number;
  sync_variant_id: number;
  external_variant_id: string | null;
  quantity: number;
  price: Money;
  retail_price: Money | null;
  name: string;
  files?: PrintfulFile[];
  product?: PrintfulVariantProduct;
}

export interface PrintfulShipment {
  id: number;
  carrier: string;
  service: string;
  tracking_number: string;
  tracking_url: string;
  created: number;
  ship_date: string;
  shipped_at: number;
  reshipment: boolean;
}

export type PrintfulOrderStatus =
  | "draft"
  | "pending"
  | "failed"
  | "canceled"
  | "inprocess"
  | "onhold"
  | "partial"
  | "fulfilled";

export interface PrintfulRecipient {
  name: string;
  company?: string | null;
  address1: string;
  address2?: string | null;
  city: string;
  state_code?: string | null;
  state_name?: string | null;
  country_code: string;
  country_name?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** A Printful v1 order, as returned by GET/POST/PUT /orders */
export interface PrintfulOrder extends PrintfulCostEstimate {
  id: number;
  external_id: string | null;
  status: PrintfulOrderStatus;
  shipping: string;
  shipping_service_name: string;
  recipient: PrintfulRecipient;
  created: number;
  updated: number;
  items: PrintfulOrderItem[];
  shipments: PrintfulShipment[];
}
