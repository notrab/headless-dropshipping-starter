import { z } from "astro/zod";

export const printfulProductSchema = z.object({
  id: z.number(),
  external_id: z.string(),
  name: z.string(),
  variants: z.number(),
  synced: z.number(),
  thumbnail_url: z.url().nullable(),
  is_ignored: z.boolean(),
});

export const printfulFileOptionSchema = z.object({
  id: z.string(),
  value: z.unknown(),
});

export const printfulVariantOptionSchema = z.object({
  id: z.string(),
  value: z.unknown(),
});

export const printfulFileSchema = z.object({
  type: z.string().optional(),
  id: z.number().optional(),
  url: z.string().nullable().optional(),
  options: z.array(printfulFileOptionSchema).optional().default([]),
  hash: z.string().nullable().optional(),
  filename: z.string().optional(),
  mime_type: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  dpi: z.number().nullable().optional(),
  status: z.string().optional(),
  created: z.number().optional(),
  thumbnail_url: z.string().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  visible: z.boolean().optional(),
  is_temporary: z.boolean().optional(),
  stitch_count_tier: z.string().nullable().optional(),
});

export const printfulVariantProductSchema = z.object({
  variant_id: z.number(),
  product_id: z.number(),
  image: z.url(),
  name: z.string(),
});

export const printfulVariantSchema = z.object({
  id: z.number(),
  external_id: z.string(),
  sync_product_id: z.number(),
  name: z.string(),
  synced: z.boolean(),
  variant_id: z.number(),
  retail_price: z.string(),
  currency: z.string(),
  is_ignored: z.boolean(),
  sku: z.string().nullable(),
  product: printfulVariantProductSchema,
  files: z.array(printfulFileSchema).optional().default([]),
  options: z.array(printfulVariantOptionSchema).optional().default([]),
  main_category_id: z.number().nullable(),
  warehouse_product_id: z.number().nullable(),
  warehouse_product_variant_id: z.number().nullable(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  availability_status: z
    .enum(["active", "discontinued", "out_of_stock", "temporary_out_of_stock"])
    .optional()
    .default("active"),
});

export const printfulProductDetailSchema = z.object({
  sync_product: printfulProductSchema,
  sync_variants: z.array(printfulVariantSchema),
});

/** A shipping option from POST /shipping/rates */
export const printfulShippingRateSchema = z.object({
  id: z.string(),
  name: z.string(),
  rate: z.string(), // Decimal string in major units, e.g. "8.08"
  currency: z.string(),
  minDeliveryDays: z.number().int().optional(),
  maxDeliveryDays: z.number().int().optional(),
});

export type PrintfulProductSchema = z.infer<typeof printfulProductSchema>;
export type PrintfulVariantSchema = z.infer<typeof printfulVariantSchema>;
export type PrintfulProductDetailSchema = z.infer<
  typeof printfulProductDetailSchema
>;
