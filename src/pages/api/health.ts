import type { APIRoute } from "astro";

/**
 * For container health checks (e.g. bunny.net Magic Containers). Answers
 * without calling Printful or Stripe, so a busy minute at either doesn't get
 * a healthy container restarted.
 */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response("ok", { headers: { "Cache-Control": "no-store" } });
