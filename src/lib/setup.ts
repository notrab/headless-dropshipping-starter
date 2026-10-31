/**
 * Store setup checks: is Printful connected, are there products, are the
 * Stripe keys right. Shared by `npm run setup`, the checklist printed when
 * `astro dev`/`astro build` start, and the homepage setup guide.
 *
 * No Astro imports (the CLI runs this with plain Node), and results never
 * include secret values, only whether each one is right.
 */

export interface SetupEnv {
  PRINTFUL_API_TOKEN?: string;
  PRINTFUL_STORE_ID?: string;
  STRIPE_SECRET_KEY?: string;
  PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export type CheckStatus = "ok" | "problem" | "skipped";

export interface SetupCheck {
  id: string;
  title: string;
  status: CheckStatus;
  /** What's wrong and how to fix it (when not ok) */
  help?: string;
  /** Where to go to fix it */
  link?: string;
}

export interface PrintfulStore {
  id: number;
  name: string;
}

const PRINTFUL = "https://api.printful.com";
export const LINKS = {
  printfulToken: "https://developers.printful.com/tokens",
  printfulProducts: "https://www.printful.com/dashboard/default/stores",
  stripeKeys: "https://dashboard.stripe.com/apikeys",
  stripeWebhooks: "https://dashboard.stripe.com/webhooks",
};

type Fetch = typeof fetch;

/** Run every check, in order. Later checks are skipped when an earlier one they depend on fails. */
export async function checkSetup(env: SetupEnv, fetchImpl: Fetch = fetch): Promise<SetupCheck[]> {
  return [
    ...(await checkPrintful(env, fetchImpl)),
    ...(await checkStripe(env, fetchImpl)),
  ];
}

export const isReady = (checks: SetupCheck[]) => checks.every((c) => c.status === "ok");

// --- Printful ------------------------------------------------------------------

/** The Printful stores a token can see. Throws a readable Error on a bad token. */
export async function listPrintfulStores(token: string, fetchImpl: Fetch = fetch) {
  const response = await fetchImpl(`${PRINTFUL}/stores`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Printful didn't accept this token");
  }
  if (!response.ok) throw new Error(`Printful returned ${response.status}`);
  const { result } = (await response.json()) as { result: PrintfulStore[] };
  return result.map(({ id, name }) => ({ id, name }));
}

/** How many products the store has in Printful */
export async function countPrintfulProducts(token: string, storeId?: string, fetchImpl: Fetch = fetch) {
  const response = await fetchImpl(`${PRINTFUL}/store/products?limit=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(storeId && { "X-PF-Store-Id": storeId }),
    },
  });
  if (!response.ok) throw new Error(`Printful returned ${response.status}`);
  const body = (await response.json()) as { paging?: { total: number }; result: unknown[] };
  return body.paging?.total ?? body.result.length;
}

async function checkPrintful(env: SetupEnv, fetchImpl: Fetch): Promise<SetupCheck[]> {
  const token = env.PRINTFUL_API_TOKEN;
  const connection: SetupCheck = { id: "printful-token", title: "Printful connected", status: "ok" };
  const products: SetupCheck = { id: "printful-products", title: "Products in Printful", status: "skipped" };

  if (!token) {
    return [
      {
        ...connection,
        status: "problem",
        help: "Set PRINTFUL_API_TOKEN to a Printful private token with access to your store.",
        link: LINKS.printfulToken,
      },
      products,
    ];
  }

  let stores: PrintfulStore[];
  try {
    stores = await listPrintfulStores(token, fetchImpl);
  } catch (error) {
    return [
      {
        ...connection,
        status: "problem",
        help: `${(error as Error).message}. Check PRINTFUL_API_TOKEN, or create a new token.`,
        link: LINKS.printfulToken,
      },
      products,
    ];
  }

  if (env.PRINTFUL_STORE_ID && !stores.some((s) => String(s.id) === env.PRINTFUL_STORE_ID)) {
    return [
      {
        ...connection,
        status: "problem",
        help: `PRINTFUL_STORE_ID doesn't match a store this token can see. Use one of: ${formatStores(stores)}.`,
      },
      products,
    ];
  }
  if (!env.PRINTFUL_STORE_ID && stores.length > 1) {
    return [
      {
        ...connection,
        status: "problem",
        help: `This token can see ${stores.length} stores. Set PRINTFUL_STORE_ID to one of: ${formatStores(stores)}.`,
      },
      products,
    ];
  }

  try {
    const count = await countPrintfulProducts(token, env.PRINTFUL_STORE_ID, fetchImpl);
    return [
      connection,
      count > 0
        ? { ...products, status: "ok", title: `${count} product${count === 1 ? "" : "s"} in Printful` }
        : {
            ...products,
            status: "problem",
            help: "Your Printful store has no products yet. Add some in the Printful dashboard, then rebuild.",
            link: LINKS.printfulProducts,
          },
    ];
  } catch (error) {
    return [connection, { ...products, status: "problem", help: (error as Error).message }];
  }
}

const formatStores = (stores: PrintfulStore[]) =>
  stores.map((s) => `${s.id} (${s.name})`).join(", ");

// --- Stripe --------------------------------------------------------------------

/** "test" or "live", from a Stripe key's prefix (sk_test_, pk_live_, rk_test_...) */
export function stripeMode(key: string | undefined) {
  return key?.match(/^(?:sk|pk|rk)_(test|live)_/)?.[1] as "test" | "live" | undefined;
}

/** Whether Stripe accepts a secret key. Throws a readable Error if not. */
export async function verifyStripeKey(secretKey: string, fetchImpl: Fetch = fetch) {
  const response = await fetchImpl("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (response.status === 401) throw new Error("Stripe didn't accept this secret key");
  if (!response.ok) throw new Error(`Stripe returned ${response.status}`);
}

async function checkStripe(env: SetupEnv, fetchImpl: Fetch): Promise<SetupCheck[]> {
  const secret = env.STRIPE_SECRET_KEY;
  const publishable = env.PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const checks: SetupCheck[] = [];

  // Secret key
  const secretCheck: SetupCheck = { id: "stripe-secret", title: "Stripe secret key", status: "ok" };
  if (!secret) {
    checks.push({ ...secretCheck, status: "problem", help: "Set STRIPE_SECRET_KEY (starts with sk_).", link: LINKS.stripeKeys });
  } else if (!stripeMode(secret) || secret.startsWith("pk_")) {
    checks.push({
      ...secretCheck,
      status: "problem",
      help: "STRIPE_SECRET_KEY should start with sk_test_ or sk_live_ (or rk_ for a restricted key).",
      link: LINKS.stripeKeys,
    });
  } else {
    try {
      await verifyStripeKey(secret, fetchImpl);
      checks.push({ ...secretCheck, title: `Stripe secret key (${stripeMode(secret)} mode)` });
    } catch (error) {
      checks.push({ ...secretCheck, status: "problem", help: `${(error as Error).message}.`, link: LINKS.stripeKeys });
    }
  }

  // Publishable key, which must be from the same mode as the secret key
  const publishableCheck: SetupCheck = { id: "stripe-publishable", title: "Stripe publishable key", status: "ok" };
  if (!publishable) {
    checks.push({
      ...publishableCheck,
      status: "problem",
      help: "Set PUBLIC_STRIPE_PUBLISHABLE_KEY (starts with pk_).",
      link: LINKS.stripeKeys,
    });
  } else if (!publishable.startsWith("pk_") || !stripeMode(publishable)) {
    checks.push({
      ...publishableCheck,
      status: "problem",
      help: "PUBLIC_STRIPE_PUBLISHABLE_KEY should start with pk_test_ or pk_live_.",
      link: LINKS.stripeKeys,
    });
  } else if (stripeMode(secret) && stripeMode(secret) !== stripeMode(publishable)) {
    checks.push({
      ...publishableCheck,
      status: "problem",
      help: `Your secret key is ${stripeMode(secret)} mode but the publishable key is ${stripeMode(publishable)} mode. Use a matching pair.`,
      link: LINKS.stripeKeys,
    });
  } else {
    checks.push(publishableCheck);
  }

  // Webhook secret: optional. With it, paid orders are confirmed in Printful
  // automatically; without it, they wait as drafts for the owner to confirm.
  const webhook = env.STRIPE_WEBHOOK_SECRET;
  checks.push(
    !webhook
      ? { id: "stripe-webhook", title: "Orders confirmed by hand in Printful (no webhook)", status: "ok" }
      : webhook.startsWith("whsec_")
        ? { id: "stripe-webhook", title: "Orders confirmed automatically (Stripe webhook)", status: "ok" }
        : {
            id: "stripe-webhook",
            title: "Stripe webhook secret",
            status: "problem",
            help: "STRIPE_WEBHOOK_SECRET should start with whsec_. Leave it unset to confirm orders in Printful yourself.",
            link: LINKS.stripeWebhooks,
          },
  );

  return checks;
}

/** The checklist as plain text, for terminals */
export function formatChecklist(checks: SetupCheck[]) {
  const icon = { ok: "✓", problem: "✗", skipped: "–" } as const;
  return checks
    .map((check) => {
      const lines = [`  ${icon[check.status]} ${check.title}`];
      if (check.status === "problem" && check.help) {
        lines.push(...check.help.split("\n").map((line) => `      ${line}`));
      }
      if (check.status === "problem" && check.link) lines.push(`      ${check.link}`);
      return lines.join("\n");
    })
    .join("\n");
}
