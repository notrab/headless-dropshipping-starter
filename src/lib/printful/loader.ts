import type { Loader, LoaderContext } from "astro/loaders";
import { PrintfulApiError } from "./client";
import { getAllProducts, getAllVariants } from "./fetchers";

type Entry = { id: number } & object;

async function storeAll(context: LoaderContext, entries: Entry[]) {
  const { store, parseData, generateDigest } = context;
  store.clear();

  for (const entry of entries) {
    const id = entry.id.toString();
    const data = await parseData({
      id,
      data: entry as unknown as Record<string, unknown>,
    });
    store.set({ id, data, digest: generateDigest(data) });
  }
}

/**
 * Load a collection from Printful. If Printful rejects the token:
 * - in dev, carry on with an empty catalog, so the site still starts and the
 *   homepage can show the setup guide;
 * - in a build, stop with an explanation (failing keeps the last good
 *   deployment live, rather than publishing an empty store).
 */
async function loadFromPrintful(
  context: LoaderContext,
  what: string,
  fetchEntries: () => Promise<Entry[]>,
) {
  context.logger.info(`Loading ${what} from Printful...`);
  try {
    const entries = await fetchEntries();
    await storeAll(context, entries);
    context.logger.info(`Loaded ${entries.length} ${what}`);
  } catch (error) {
    const rejected =
      error instanceof PrintfulApiError && (error.status === 401 || error.status === 403);
    if (!rejected) throw error;

    const explanation =
      `Printful rejected PRINTFUL_API_TOKEN (${error.message.replace(/\.$/, "")}). ` +
      "Run `npm run setup` to connect your store.";
    if (import.meta.env.DEV) {
      context.logger.warn(`${explanation} Continuing with no ${what}.`);
      context.store.clear();
      return;
    }
    throw new Error(explanation, { cause: error });
  }
}

export function printfulLoader(): Loader {
  return {
    name: "printful-loader",
    load: (context) => loadFromPrintful(context, "products", getAllProducts),
  };
}

export function printfulVariantsLoader(): Loader {
  return {
    name: "printful-variants-loader",
    load: (context) =>
      loadFromPrintful(context, "variants", async () => getAllVariants(await getAllProducts())),
  };
}
