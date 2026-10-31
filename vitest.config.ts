/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// getViteConfig gives tests the same setup as the app: the #aliases and
// Astro's virtual modules (astro:env, astro:content...).
export default getViteConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Placeholder secrets so astro:env validates; tests never call the real APIs
    env: {
      PRINTFUL_API_TOKEN: "test-printful-token",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    },
  },
});
