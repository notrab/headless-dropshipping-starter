import { z } from "astro/zod";
import { getVariantsByExternalId } from "#lib/catalog";
import { findUnavailable } from "#lib/pricing";

export const CheckCartInput = z.object({
  /** External variant IDs from the cart */
  ids: z.array(z.string().min(1)).max(500),
});

/**
 * Which of the cart's variants can no longer be bought, so the cart and
 * checkout pages can name them. A lookup in the synced catalog; no Printful
 * calls.
 */
export async function checkCart({ ids }: z.infer<typeof CheckCartInput>) {
  return { unavailable: findUnavailable(ids, await getVariantsByExternalId()) };
}
