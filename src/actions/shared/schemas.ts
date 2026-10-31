import { z } from "astro/zod";

// Input schemas shared by several actions

export const AddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().nullable().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullish(),
  country: z.string().length(2, "Country code must be 2 characters"),
});

/** A shipping address: an address plus who it's for */
export const NamedAddressSchema = AddressSchema.extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().nullish(),
});

/**
 * A cart line as sent by the browser: which synced variant, and how many.
 * Prices are always looked up server-side (see lib/pricing.ts).
 */
export const CartLineSchema = z.object({
  external_variant_id: z.string().min(1),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
});

export const CartLinesSchema = z.array(CartLineSchema).min(1, "Your cart is empty");

export type Address = z.infer<typeof AddressSchema>;
export type NamedAddress = z.infer<typeof NamedAddressSchema>;
export type CartLine = z.infer<typeof CartLineSchema>;
