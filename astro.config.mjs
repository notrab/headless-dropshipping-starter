import alpinejs from "@astrojs/alpinejs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import icon from "astro-icon";

import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import { loadEnv } from "vite";
import { setupCheck } from "./src/integrations/setup-check.ts";

// The store's public address, used for absolute URLs in link previews and
// canonical links. Set SITE_URL, or let Vercel/Netlify provide it.
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const site =
  SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  process.env.URL || // Netlify
  undefined;

export default defineConfig({
  site,
  output: "server",
  trailingSlash: "ignore",
  // The first storefront page is the homepage (see src/pages/page/[page].astro)
  redirects: {
    "/page/1": "/",
  },
  // Astro 7 defaults to "jsx", which drops whitespace around line breaks
  // between text and inline elements ("our<a>Terms</a>"). Collapse it instead.
  compressHTML: true,

  integrations: [
    setupCheck(),
    icon(),
    alpinejs({
      entrypoint: "/src/entrypoint",
    }),
  ],

  env: {
    schema: {
      THEME: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      STORE_NAME: envField.string({
        context: "client",
        access: "public",
        default: "Swag Store",
      }),
      SUPPORT_EMAIL: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      LOGO_URL: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      LOGO_PATH: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_STRIPE_PUBLISHABLE_KEY: envField.string({
        context: "client",
        access: "public",
      }),
      PRINTFUL_API_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
      PRINTFUL_STORE_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      STRIPE_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      STRIPE_WEBHOOK_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      PASS_THROUGH_VAT: envField.boolean({
        context: "server",
        access: "public",
        default: false,
        optional: true,
      }),
      UK_VAT_NUMBER: envField.string({
        context: "server",
        access: "public",
        optional: true,
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  devToolbar: {
    enabled: false,
  },

  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: [400, 500, 600, 700],
    },
  ],

  // Netlify sets NETLIFY=true during builds. The Dockerfile sets
  // ASTRO_ADAPTER=node for a standalone Node server (bunny.net Magic
  // Containers, or any container host). Everything else gets Vercel.
  adapter:
    process.env.ASTRO_ADAPTER === "node"
      ? node({ mode: "standalone" })
      : process.env.NETLIFY
        ? netlify()
        : vercel(),
});
