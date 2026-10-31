import { printful, printfulList } from "./client";
import type {
  PrintfulProduct,
  PrintfulProductDetail,
  PrintfulVariant,
} from "./types";

// The catalog sync runs at build time, so it can afford to wait out rate
// limits (`patient`); a large catalog just takes longer to sync.

/** Printful's maximum page size */
const PAGE_SIZE = 100;
/** Product details fetched at once. The rate limiter paces them per minute. */
const DETAIL_CONCURRENCY = 5;

/**
 * Both content loaders (products and variants) need the product list, and
 * they run in the same sync. Share one fetch between them, briefly, so the list
 * isn't requested twice; a later sync (e.g. in `astro dev`) fetches it afresh.
 */
const LIST_REUSE_MS = 60_000;
let productList: { promise: Promise<PrintfulProduct[]>; fetchedAt: number } | undefined;

export function getAllProducts(): Promise<PrintfulProduct[]> {
  if (!productList || Date.now() - productList.fetchedAt > LIST_REUSE_MS) {
    productList = { promise: fetchAllProducts(), fetchedAt: Date.now() };
    // Don't keep a failed fetch around for the next caller
    productList.promise.catch(() => (productList = undefined));
  }
  return productList.promise;
}

async function fetchAllProducts(): Promise<PrintfulProduct[]> {
  const products: PrintfulProduct[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { result, paging } = await printfulList<PrintfulProduct>(
      `/store/products?limit=${PAGE_SIZE}&offset=${offset}`,
      { patient: true },
    );
    products.push(...result);

    // Stop at the reported total; fall back to a short page if there's none
    const done = paging ? offset + PAGE_SIZE >= paging.total : result.length < PAGE_SIZE;
    if (done) break;
  }

  return products.filter((product) => !product.is_ignored);
}

export async function getAllVariants(
  products: PrintfulProduct[],
): Promise<PrintfulVariant[]> {
  const variants: PrintfulVariant[] = [];

  for (let i = 0; i < products.length; i += DETAIL_CONCURRENCY) {
    const batch = products.slice(i, i + DETAIL_CONCURRENCY);
    const details = await Promise.all(
      batch.map((product) =>
        printful<PrintfulProductDetail>(`/store/products/${product.id}`, { patient: true }),
      ),
    );
    for (const detail of details) {
      variants.push(...detail.sync_variants.filter((v) => !v.is_ignored));
    }
  }

  return variants;
}
