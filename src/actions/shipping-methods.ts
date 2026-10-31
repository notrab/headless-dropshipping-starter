import { z } from "astro/zod";
import { AddressSchema, CartLinesSchema } from "#actions/shared/schemas";
import { cacheKey, TtlCache } from "#lib/cache";
import { toMinorUnits } from "#lib/catalog";
import { getStoreCurrency } from "#lib/pricing";
import { printful, toPrintfulRecipient } from "#lib/printful/client";
import { printfulShippingRateSchema } from "#lib/printful/schema";

export const ShippingMethodsInput = z.object({
  address: AddressSchema,
  phone: z.string().optional(),
  items: CartLinesSchema,
  locale: z.enum(["en_US", "es_ES"]).optional(),
});

/** A shipping option as shown at checkout. `rate` is in minor units (pence/cents). */
export interface ShippingMethod {
  id: string;
  name: string;
  rate: number;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

// Rates for the same items to the same address don't change minute to minute
const rateCache = new TtlCache<ShippingMethod[]>(5 * 60_000);

/** Shipping options for an address, quoted in the store currency. */
export async function getShippingMethods({
  address,
  phone,
  items,
  locale,
}: z.infer<typeof ShippingMethodsInput>): Promise<ShippingMethod[]> {
  // Printful quotes rates in USD unless told otherwise
  const currency = (await getStoreCurrency()).toUpperCase();
  const key = cacheKey({ address, items, currency, locale });

  return rateCache.get(key, async () => {
    const rates = printfulShippingRateSchema.array().parse(
      await printful("/shipping/rates", {
        method: "POST",
        body: {
          recipient: toPrintfulRecipient({ ...address, phone }),
          items,
          currency,
          ...(locale && { locale }),
        },
      }),
    );
    return rates.map(toShippingMethod);
  });
}

function toShippingMethod(rate: z.infer<typeof printfulShippingRateSchema>): ShippingMethod {
  return {
    id: rate.id,
    name: rate.name,
    rate: toMinorUnits(rate.rate),
    currency: rate.currency.toLowerCase(),
    minDeliveryDays: rate.minDeliveryDays,
    maxDeliveryDays: rate.maxDeliveryDays,
  };
}
