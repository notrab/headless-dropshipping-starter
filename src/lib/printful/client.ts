import { PRINTFUL_API_TOKEN, PRINTFUL_STORE_ID } from "astro:env/server";
import { StoreError } from "#lib/errors";
import { RateLimiter } from "./rate-limit";

const BASE_URL = "https://api.printful.com";

export class PrintfulApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Printful API error: ${status}`;
    super(message);
  }
}

export interface PrintfulRequest {
  method?: string;
  body?: unknown;
  /**
   * Wait out rate limits instead of failing. For builds (syncing the catalog),
   * where taking longer is fine. Customer-facing requests leave this off so a
   * busy minute fails fast with a friendly message, rather than holding a
   * serverless function open until it times out.
   */
  patient?: boolean;
}

export interface PrintfulPaging {
  total: number;
  offset: number;
  limit: number;
}

// Shared by every request from this process. Keep a few requests in hand for
// ones already in flight (the catalog sync runs 5 at a time).
const limiter = new RateLimiter(5);

/** Longest a customer-facing request will wait for the rate limit */
const MAX_CUSTOMER_WAIT_MS = 2_000;
/** How many 429s a patient request sits out before giving up */
const MAX_PATIENT_RETRIES = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal Printful v1 client: auth, the optional store header (needed when a
 * token has access to more than one store), and rate limiting. Returns the
 * response's `result`.
 */
export async function printful<T = unknown>(path: string, init: PrintfulRequest = {}) {
  return (await request<T>(path, init)).result;
}

/** Like printful(), for list endpoints: also returns the `paging` info */
export async function printfulList<T>(path: string, init: PrintfulRequest = {}) {
  return request<T[]>(path, init);
}

async function request<T>(
  path: string,
  init: PrintfulRequest,
  attempt = 0,
): Promise<{ result: T; paging?: PrintfulPaging }> {
  await waitForCapacity(init.patient);

  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${PRINTFUL_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(PRINTFUL_STORE_ID && { "X-PF-Store-Id": PRINTFUL_STORE_ID }),
    },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  limiter.record(response.headers);

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 60);
    limiter.recordLimited(retryAfter);

    const canWait = init.patient
      ? attempt < MAX_PATIENT_RETRIES
      : attempt === 0 && retryAfter * 1000 <= MAX_CUSTOMER_WAIT_MS;
    if (!canWait) {
      console.warn(`[printful] Rate limited on ${path}; resets in ${retryAfter}s`);
      throw new StoreError("PRINTFUL_BUSY", `${path}: rate limited for ${retryAfter}s`);
    }
    // waitForCapacity() on the retry sits out the rest of the window
    return request<T>(path, init, attempt + 1);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PrintfulApiError(response.status, body);
  }
  return body;
}

/** Wait until there's room under the rate limit (or fail, if not patient) */
async function waitForCapacity(patient = false) {
  for (let wait = limiter.delay(); wait > 0; wait = limiter.delay()) {
    if (!patient && wait > MAX_CUSTOMER_WAIT_MS) {
      console.warn(`[printful] Near the rate limit; resets in ${Math.ceil(wait / 1000)}s`);
      throw new StoreError("PRINTFUL_BUSY", `Rate limit resets in ${Math.ceil(wait / 1000)}s`);
    }
    await sleep(wait);
  }
}

interface RecipientAddress {
  name?: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
  phone?: string | null;
}

export function toPrintfulRecipient(address: RecipientAddress, email?: string) {
  return {
    ...(address.name && { name: address.name }),
    address1: address.line1,
    ...(address.line2 && { address2: address.line2 }),
    city: address.city,
    ...(address.state && { state_code: address.state }),
    country_code: address.country,
    ...(address.postal_code && { zip: address.postal_code }),
    ...(address.phone && { phone: address.phone }),
    ...(email && { email }),
  };
}
