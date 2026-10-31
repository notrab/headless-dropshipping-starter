import type { AstroIntegration } from "astro";
import { loadEnv } from "vite";
import { checkSetup, formatChecklist, isReady, type SetupEnv } from "../lib/setup.ts";

/**
 * Prints the store setup checklist when `astro dev` or `astro build` starts,
 * so a missing or wrong key is explained (and how to fix it) before anything
 * else fails. Never blocks: a broken setup still fails where it always did.
 */
export function setupCheck(): AstroIntegration {
  return {
    name: "setup-check",
    hooks: {
      "astro:config:setup": async ({ command, logger }) => {
        if (command !== "dev" && command !== "build") return;

        const mode = command === "build" ? "production" : "development";
        const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as SetupEnv;

        // Don't hold up startup if Printful or Stripe are slow or we're offline
        const fetchWithTimeout: typeof fetch = (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(5_000) });

        let checks;
        try {
          checks = await checkSetup(env, fetchWithTimeout);
        } catch (error) {
          logger.warn(`Couldn't check the store setup: ${(error as Error).message}`);
          return;
        }

        if (isReady(checks)) {
          const products = checks.find((c) => c.id === "printful-products")?.title;
          logger.info(`Store setup looks good: ${products}`);
          return;
        }

        logger.warn(
          `Your store isn't fully set up yet:\n\n${formatChecklist(checks)}\n\n` +
            "  Run `npm run setup` to fix these, or `npm run setup:check` to check again.\n",
        );
      },
    },
  };
}
