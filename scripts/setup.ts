/**
 * Store setup.
 *
 *   npm run setup            Walks through each key, checks it, writes .env
 *   npm run setup:check  Just checks the current setup (exits 1 on problems)
 *
 * Runs with plain Node (which strips the TypeScript types).
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import {
  checkSetup,
  countPrintfulProducts,
  formatChecklist,
  isReady,
  LINKS,
  listPrintfulStores,
  stripeMode,
  verifyStripeKey,
  type SetupEnv,
} from "#lib/setup";

const ENV_FILE = ".env";

// --- .env file ---------------------------------------------------------------

function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

/** Update keys in place (keeping comments and order), append new ones */
function writeEnvFile(updates: Record<string, string>) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split("\n") : [];
  const remaining = new Map(Object.entries(updates));

  const updated = lines.map((line) => {
    const key = line.match(/^\s*#?\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (!key || !remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of remaining) updated.push(`${key}=${value}`);

  if (existsSync(ENV_FILE)) copyFileSync(ENV_FILE, `${ENV_FILE}.backup`);
  writeFileSync(ENV_FILE, updated.join("\n").replace(/\n*$/, "\n"));
}

/**
 * Line-by-line prompts that also work with piped input (scripts, CI), where
 * every line arrives at once: lines are queued until asked for, and once the
 * input ends every question gets an empty answer.
 */
function createPrompter() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
  });
  const queued: string[] = [];
  const waiting: ((line: string) => void)[] = [];
  let ended = false;

  rl.on("line", (line) => {
    const resolve = waiting.shift();
    if (!resolve) return void queued.push(line);
    // Piped input isn't echoed, so show the answer
    if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
    resolve(line);
  });
  rl.on("close", () => {
    ended = true;
    for (const resolve of waiting.splice(0)) resolve("");
  });

  return {
    get ended() {
      return ended && queued.length === 0;
    },
    question(text: string): Promise<string> {
      process.stdout.write(text);
      const line = queued.shift();
      if (line !== undefined || ended) {
        // Piped input isn't echoed, so show the answer
        if (!process.stdin.isTTY) process.stdout.write(`${line ?? ""}\n`);
        return Promise.resolve(line ?? "");
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    close: () => rl.close(),
  };
}

const mask = (value: string) => (value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : "…");

// --- Check only ----------------------------------------------------------------

async function check() {
  const env: SetupEnv = { ...readEnvFile(), ...process.env };
  const checks = await checkSetup(env);
  console.log(`\nStore setup\n\n${formatChecklist(checks)}\n`);
  if (!isReady(checks)) {
    console.log("Run `npm run setup` to fix these.\n");
    process.exitCode = 1;
  }
}

// --- Interactive setup ------------------------------------------------------

async function setup() {
  const rl = createPrompter();
  const current = readEnvFile();
  const updates: Record<string, string> = {};

  /** Ask for a value; Enter keeps the current one. `validate` returns an error message, or nothing. */
  async function ask(
    key: string,
    question: string,
    validate?: (value: string) => Promise<string | void>,
  ): Promise<string | undefined> {
    for (;;) {
      const existing = updates[key] ?? current[key];
      const hint = existing ? ` [Enter keeps ${mask(existing)}]` : "";
      const answer = (await rl.question(`${question}${hint}: `)).trim() || existing;
      if (!answer) return undefined;
      const problem = await validate?.(answer);
      if (!problem) {
        if (answer !== current[key]) updates[key] = answer;
        return answer;
      }
      console.log(`  ✗ ${problem}`);
      // Out of input (piped): leave this one as it was rather than loop forever
      if (rl.ended) return undefined;
    }
  }

  console.log(`
Let's connect your store. Press Enter to keep a value that's already set.
`);

  // 1. Printful
  console.log(`1. Printful
   Create a private token with access to your store: ${LINKS.printfulToken}
`);
  let stores: { id: number; name: string }[] = [];
  const token = await ask("PRINTFUL_API_TOKEN", "   Printful token", async (value) => {
    try {
      stores = await listPrintfulStores(value);
    } catch (error) {
      return (error as Error).message;
    }
  });

  if (token && stores.length > 1) {
    console.log("\n   This token can see more than one store:");
    stores.forEach((store, i) => console.log(`     ${i + 1}. ${store.name} (${store.id})`));
    for (;;) {
      const answer = (await rl.question("   Which store? Enter its number: ")).trim();
      const store = stores[Number(answer) - 1];
      if (store) {
        updates.PRINTFUL_STORE_ID = String(store.id);
        break;
      }
      console.log("  ✗ Pick a number from the list");
      if (rl.ended) break;
    }
  }

  if (token) {
    const storeId = updates.PRINTFUL_STORE_ID ?? current.PRINTFUL_STORE_ID;
    const count = await countPrintfulProducts(token, storeId).catch(() => undefined);
    console.log(
      count === undefined
        ? "   Couldn't count your products; `npm run setup:check` will try again."
        : count > 0
          ? `   ✓ Connected: ${count} product${count === 1 ? "" : "s"}`
          : `   ! Connected, but the store has no products yet. Add some: ${LINKS.printfulProducts}`,
    );
  }

  // 2. Stripe keys
  console.log(`
2. Stripe
   Copy your API keys from ${LINKS.stripeKeys}
   (use test keys while you're trying things out)
`);
  const secret = await ask("STRIPE_SECRET_KEY", "   Secret key (sk_...)", async (value) => {
    if (!stripeMode(value) || value.startsWith("pk_")) return "That doesn't look like a secret key (sk_test_... or sk_live_...)";
    try {
      await verifyStripeKey(value);
    } catch (error) {
      return (error as Error).message;
    }
  });
  await ask("PUBLIC_STRIPE_PUBLISHABLE_KEY", "   Publishable key (pk_...)", async (value) => {
    if (!value.startsWith("pk_") || !stripeMode(value)) return "That doesn't look like a publishable key (pk_test_... or pk_live_...)";
    if (secret && stripeMode(secret) !== stripeMode(value)) {
      return `Your secret key is ${stripeMode(secret)} mode; use the ${stripeMode(secret)} publishable key`;
    }
  });

  // 3. Webhook
  console.log(`
3. Stripe webhook (optional: confirms paid orders in Printful automatically)
   Skip it to confirm each order yourself in Printful, which is a good way
   to start. To add it, run this in another terminal locally and copy the
   whsec_... it prints:
     stripe listen --forward-to localhost:4321/api/stripe-webhook
   In production, add an endpoint for https://<your-site>/api/stripe-webhook
   listening to payment_intent.succeeded: ${LINKS.stripeWebhooks}
`);
  await ask("STRIPE_WEBHOOK_SECRET", "   Webhook secret (whsec_..., Enter to skip)", async (value) => {
    if (!value.startsWith("whsec_")) return "Webhook secrets start with whsec_";
  });

  // 4. Optional extras
  console.log("\n4. Optional (Enter to skip)\n");
  await ask("STORE_NAME", "   Store name");
  await ask("SUPPORT_EMAIL", "   Support email");
  await ask("SITE_URL", "   Public URL, e.g. https://shop.example.com (Vercel/Netlify set this for you)");

  // Save
  const changed = Object.keys(updates);
  if (changed.length === 0) {
    console.log("\nNothing changed.");
  } else {
    const save = await rl.question(`\nSave ${changed.join(", ")} to ${ENV_FILE}? [Y/n] `);
    if (/^n/i.test(save.trim())) {
      console.log("Not saved.");
    } else {
      writeEnvFile(updates);
      console.log(`Saved.${existsSync(`${ENV_FILE}.backup`) ? ` The previous version is in ${ENV_FILE}.backup.` : ""}`);
    }
  }
  rl.close();

  await check();
  console.log(`Remember to add the same variables to your hosting provider (Vercel, Netlify...).
If a dev server is already running, restart it to pick up the changes:
  npx astro dev stop && npm run dev
`);
}

await (process.argv.includes("--check") ? check() : setup());
