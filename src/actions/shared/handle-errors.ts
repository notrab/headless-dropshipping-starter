import { ActionError } from "astro:actions";
import { PrintfulApiError } from "#lib/printful/client";
import { ErrorCode, StoreError } from "#lib/errors";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Turn anything a handler throws into an ActionError that's safe to send to
 * the browser. Known store errors keep their customer message; everything
 * else is logged in full and replaced with a generic message, so internal
 * details (Stripe/Printful errors, IDs, stack traces) never reach customers.
 */
export function toActionError(error: unknown, action: string): ActionError {
  if (error instanceof ActionError) return error;

  if (error instanceof StoreError) {
    const { status } = ErrorCode[error.code];
    if (status === "INTERNAL_SERVER_ERROR") console.error(`[${action}]`, error);
    return new ActionError({ code: status, message: error.publicMessage });
  }

  // Printful answers a bad recipient with a 400; anything else (401, 5xx...)
  // is a problem on our side
  if (error instanceof PrintfulApiError && error.status === 400) {
    console.warn(`[${action}] Printful rejected the request:`, error.message);
    return toActionError(new StoreError("ADDRESS_REJECTED", error.message), action);
  }

  console.error(`[${action}]`, error);
  return new ActionError({ code: "INTERNAL_SERVER_ERROR", message: GENERIC_MESSAGE });
}

/** Wrap an action handler so every error it throws goes through toActionError */
export function handleErrors<Input, Output>(
  action: string,
  handler: (input: Input) => Promise<Output>,
) {
  return async (input: Input) => {
    try {
      return await handler(input);
    } catch (error) {
      throw toActionError(error, action);
    }
  };
}
