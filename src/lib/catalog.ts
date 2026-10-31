import { getCollection, type CollectionEntry } from "astro:content";
import type { CartItem } from "#stores/cartStore";

export type Variant = CollectionEntry<"variants">["data"];

/** Printful decimal string or major-unit number → minor units (pence/cents). */
export function toMinorUnits(value: string | number | null | undefined) {
  const major = typeof value === "number" ? value : parseFloat(value || "0");
  return Math.round(major * 100);
}

/** Products per storefront page: `/`, then `/page/2`, `/page/3`... */
export const PRODUCTS_PER_PAGE = 24;

export interface Paginated<T> {
  items: T[];
  page: number;
  lastPage: number;
}

/** One page of `items` (pages start at 1). An out-of-range page is empty. */
export function paginate<T>(items: T[], page: number, perPage: number): Paginated<T> {
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page,
    lastPage: Math.max(1, Math.ceil(items.length / perPage)),
  };
}

/** The URL of a storefront page. Page 1 is the homepage. */
export function pageHref(page: number) {
  return page === 1 ? "/" : `/page/${page}`;
}

/** Whether a variant can be shown in the store and ordered. */
export function isSellable(variant: Variant) {
  return (
    variant.synced &&
    !variant.is_ignored &&
    variant.availability_status !== "discontinued" &&
    variant.availability_status !== "out_of_stock"
  );
}

/** Sellable variants of one product, in Printful's order. */
export async function getProductVariants(productId: number) {
  const variants = await getCollection(
    "variants",
    ({ data }) => data.sync_product_id === productId && isSellable(data),
  );
  return variants.map((v) => v.data);
}

/** All sellable variants, keyed by external ID (what the cart stores). */
export async function getVariantsByExternalId() {
  const variants = await getCollection("variants", ({ data }) => isSellable(data));
  return new Map(variants.map((v) => [v.data.external_id, v.data]));
}

/** The mockup with the design on it, falling back to the blank catalog photo. */
export function variantImage(variant: Variant) {
  const preview = variant.files.find((file) => file.type === "preview");
  return preview?.preview_url || variant.product.image;
}

/** e.g. "Black / M", or the Printful variant name if it has neither. */
export function variantLabel(variant: Variant) {
  return [variant.color, variant.size].filter(Boolean).join(" / ") || variant.name;
}

export function variantPrice(variant: Variant) {
  return toMinorUnits(variant.retail_price);
}

/**
 * The cart line for a variant, built on the server so browser scripts only
 * have to pass it to `$store.cart.addItem()`. The price is for display only;
 * checkout always re-prices from Printful.
 */
export function toCartItem(
  variant: Variant,
  productName: string,
): Omit<CartItem, "quantity"> {
  return {
    id: variant.external_id,
    name: productName,
    variant: variantLabel(variant),
    color: variant.color,
    size: variant.size,
    price: variantPrice(variant),
    currency: variant.currency,
    image: variantImage(variant),
  };
}
