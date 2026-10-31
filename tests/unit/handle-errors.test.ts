import { ActionError } from "astro:actions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleErrors, toActionError } from "#actions/shared/handle-errors";
import { ErrorCode, StoreError } from "#lib/errors";
import { PrintfulApiError } from "#lib/printful/client";

// These tests expect errors to be logged; keep the output quiet
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
afterEach(() => vi.clearAllMocks());

describe("toActionError", () => {
  it("turns store errors into their status and customer message", () => {
    const error = toActionError(new StoreError("ITEM_UNAVAILABLE", "ext_123"), "test");

    expect(error).toBeInstanceOf(ActionError);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe(ErrorCode.ITEM_UNAVAILABLE.message);
    expect(error.message).not.toContain("ext_123");
  });

  it("logs store errors that point at a problem on our side", () => {
    toActionError(new StoreError("CURRENCY_MISMATCH", "USD vs GBP"), "checkout");

    expect(console.error).toHaveBeenCalledOnce();
  });

  it("treats a Printful 400 as an address the customer can fix", () => {
    const error = toActionError(
      new PrintfulApiError(400, { error: { message: "Recipient: Invalid zip" } }),
      "test",
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe(ErrorCode.ADDRESS_REJECTED.message);
  });

  it("hides other Printful failures, e.g. a bad API token", () => {
    const error = toActionError(
      new PrintfulApiError(401, { error: { message: "The access token provided is invalid" } }),
      "test",
    );

    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).not.toContain("token");
  });

  it("never leaks unexpected error messages to customers", () => {
    const error = toActionError(new Error("No such payment_intent: 'pi_secret'"), "test");

    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).not.toContain("pi_secret");
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("passes ActionErrors through untouched", () => {
    const original = new ActionError({ code: "NOT_FOUND", message: "Gone" });

    expect(toActionError(original, "test")).toBe(original);
  });
});

describe("handleErrors", () => {
  it("returns the handler's result", async () => {
    const handler = handleErrors("test", async (n: number) => n * 2);

    await expect(handler(21)).resolves.toBe(42);
  });

  it("converts anything the handler throws", async () => {
    const handler = handleErrors("test", async () => {
      throw new StoreError("ALREADY_PAID");
    });

    await expect(handler(undefined)).rejects.toMatchObject({
      code: "CONFLICT",
      message: ErrorCode.ALREADY_PAID.message,
    });
  });
});
