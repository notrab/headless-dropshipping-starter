/**
 * Store error codes.
 *
 * Every error we expect is listed here, with the HTTP-style status it maps to
 * and a message that's safe to show customers. Throw a `StoreError` with one
 * of these codes from anywhere on the server; actions turn it into a response
 * (see actions/shared/handle-errors.ts). Anything else is treated as a bug:
 * logged in full, and reported to the customer as a generic failure.
 *
 * This module has no Astro imports so it can be used (and tested) anywhere.
 */

export const ErrorCode = {
  ITEM_UNAVAILABLE: {
    status: "CONFLICT",
    message: "One or more items in your cart are no longer available.",
  },
  ALREADY_PAID: {
    status: "CONFLICT",
    message: "This order has already been paid.",
  },
  INVALID_SESSION: {
    status: "FORBIDDEN",
    message: "Your checkout session has expired. Please refresh the page and try again.",
  },
  ADDRESS_REJECTED: {
    status: "BAD_REQUEST",
    message: "We can't ship to that address. Please check it and try again.",
  },
  PRINTFUL_BUSY: {
    status: "TOO_MANY_REQUESTS",
    message: "We're very busy right now. Please try again in a minute.",
  },
  CURRENCY_MISMATCH: {
    status: "INTERNAL_SERVER_ERROR",
    message: "We can't take payment for this order right now. Please contact us.",
  },
} as const;

export type ErrorCode = keyof typeof ErrorCode;

export class StoreError extends Error {
  readonly code: ErrorCode;

  /**
   * @param code What went wrong; decides the status and customer message
   * @param detail Extra context for the logs. Never shown to customers.
   */
  constructor(code: ErrorCode, detail?: string, options?: ErrorOptions) {
    super(detail ? `${code}: ${detail}` : code, options);
    this.name = "StoreError";
    this.code = code;
  }

  /** The message that's safe to show the customer */
  get publicMessage() {
    return ErrorCode[this.code].message;
  }
}
