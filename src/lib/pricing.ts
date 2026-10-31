import { getCollection } from "astro:content";
import { PASS_THROUGH_VAT } from "astro:env/server";
import type { CartLine } from "#actions/shared/schemas";
import { getVariantsByExternalId, toMinorUnits } from "#lib/catalog";
import { StoreError } from "#lib/errors";
import type { PrintfulCostEstimate } from "#lib/printful/types";

const UK_VAT_RATE = 0.2;

/** What the customer pays for an order. Amounts are in minor units (pence/cents). */
export interface OrderTotals {
  currency: string;
  subtotal: number;
  shipping: number;
  vat: number;
  total: number;
}

/**
 * Turn client cart lines into Printful order items using the prices synced
 * from Printful. The client only tells us *what* and *how many*, never the
 * price, so a tampered cart can't change what the customer is charged.
 */
export async function resolveOrderItems(lines: CartLine[]) {
  const variants = await getVariantsByExternalId();

  const unavailable = findUnavailable(
    lines.map((line) => line.external_variant_id),
    variants,
  );
  if (unavailable.length > 0) {
    throw new StoreError("ITEM_UNAVAILABLE", unavailable.join(", "));
  }

  return lines.map((line) => {
    const variant = variants.get(line.external_variant_id)!;

    return {
      external_variant_id: variant.external_id,
      quantity: line.quantity,
      retail_price: variant.retail_price,
      name: variant.name,
    };
  });
}

/** The variant IDs that aren't for sale (any more), in the order given */
export function findUnavailable(ids: string[], variants: ReadonlyMap<string, unknown>) {
  return [...new Set(ids)].filter((id) => !variants.has(id));
}

/** Item subtotal in minor units, priced from the synced catalog. */
export async function itemsSubtotal(lines: CartLine[]) {
  const items = await resolveOrderItems(lines);
  return items.reduce(
    (sum, item) => sum + toMinorUnits(item.retail_price) * item.quantity,
    0,
  );
}

/** The store currency, taken from the synced Printful variants. */
export async function getStoreCurrency() {
  const [variant] = await getCollection("variants");
  return (variant?.data.currency ?? "GBP").toLowerCase();
}

/**
 * What the customer pays for a Printful order/estimate, in minor units.
 *
 * Items are charged at our retail prices and shipping at Printful's cost.
 * VAT is added on top when PASS_THROUGH_VAT is set; otherwise it's absorbed.
 * Printful's own tax/VAT (costs.tax, costs.vat) is what Printful bills *us*,
 * so it's reported for margin tracking but never added to the customer total.
 */
export function customerTotals(
  { costs, retail_costs }: PrintfulCostEstimate,
  { passThroughVat = PASS_THROUGH_VAT ?? false } = {},
) {
  // Shipping comes from `costs` (Printful's billing currency) while items come
  // from `retail_costs`. Adding the two only makes sense in the same currency.
  if (costs.currency.toLowerCase() !== retail_costs.currency.toLowerCase()) {
    throw new StoreError(
      "CURRENCY_MISMATCH",
      `Printful bills in ${costs.currency} but retail prices are in ${retail_costs.currency}`,
    );
  }

  const subtotal = toMinorUnits(retail_costs.subtotal);
  const shipping = toMinorUnits(costs.shipping);
  const vat = passThroughVat ? Math.round((subtotal + shipping) * UK_VAT_RATE) : 0;
  const total = subtotal + shipping + vat;
  const printfulCost = toMinorUnits(costs.total);

  return {
    currency: retail_costs.currency.toLowerCase(),
    subtotal,
    shipping,
    vat,
    total,
    printfulTax: toMinorUnits(costs.tax),
    printfulVat: toMinorUnits(costs.vat),
    printfulCost,
    profit: total - printfulCost,
    vatRegistered: passThroughVat,
  };
}

/** Just the customer-facing part of customerTotals() */
export function toOrderTotals({
  currency,
  subtotal,
  shipping,
  vat,
  total,
}: OrderTotals): OrderTotals {
  return { currency, subtotal, shipping, vat, total };
}

/** Format minor units as a Stripe metadata-friendly decimal string. */
const toDecimalString = (minor: number) => (minor / 100).toFixed(2);

/**
 * The price breakdown recorded on a payment intent, for order pages and
 * reporting. Write it whenever the payment intent amount is set from an order.
 */
export function totalsMetadata(totals: ReturnType<typeof customerTotals>) {
  return {
    retail_subtotal: toDecimalString(totals.subtotal),
    retail_shipping: toDecimalString(totals.shipping),
    vat_amount_to_customer: toDecimalString(totals.vat),
    vat_amount_from_printful: toDecimalString(totals.printfulVat),
    tax_amount_from_printful: toDecimalString(totals.printfulTax),
    vat_registered: totals.vatRegistered.toString(),
    customer_total: toDecimalString(totals.total),
    actual_costs_total: toDecimalString(totals.printfulCost),
    profit: toDecimalString(totals.profit),
  };
}
