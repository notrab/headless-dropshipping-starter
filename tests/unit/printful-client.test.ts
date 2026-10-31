import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({ PRINTFUL_API_TOKEN: "test", PRINTFUL_STORE_ID: undefined }));

const fetchMock = vi.fn();

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}
const ok = (result: unknown, remaining = 100, extra: Record<string, unknown> = {}) =>
  respond(200, { code: 200, result, ...extra }, {
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": "60",
  });
const limited = (retryAfter: number) =>
  respond(429, { code: 429, error: { message: "Too many requests" } }, { "retry-after": String(retryAfter) });

// The client keeps rate limit state per module, so each test gets a fresh copy
async function loadClient() {
  vi.resetModules();
  return import("#lib/printful/client");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("printful()", () => {
  it("returns the response's result", async () => {
    const { printful } = await loadClient();
    fetchMock.mockResolvedValueOnce(ok({ id: 1 }));

    await expect(printful("/orders/1")).resolves.toEqual({ id: 1 });
  });

  it("throws PrintfulApiError for other failures", async () => {
    const { printful, PrintfulApiError } = await loadClient();
    fetchMock.mockResolvedValueOnce(respond(400, { error: { message: "Bad zip" } }));

    await expect(printful("/shipping/rates")).rejects.toBeInstanceOf(PrintfulApiError);
  });
});

describe("customer-facing requests (not patient)", () => {
  it("fail fast with PRINTFUL_BUSY on a long rate limit, without waiting", async () => {
    const { printful } = await loadClient();
    fetchMock.mockResolvedValueOnce(limited(38));

    await expect(printful("/orders/estimate-costs")).rejects.toMatchObject({ code: "PRINTFUL_BUSY" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wait out a short rate limit once", async () => {
    const { printful } = await loadClient();
    fetchMock.mockResolvedValueOnce(limited(1)).mockResolvedValueOnce(ok("rates"));

    const result = printful("/shipping/rates");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toBe("rates");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("don't call Printful at all when the limit is known to be used up", async () => {
    const { printful } = await loadClient();
    fetchMock.mockResolvedValueOnce(ok("first", 3)); // 3 left is under the reserve

    await printful("/orders/1");
    await expect(printful("/orders/2")).rejects.toMatchObject({ code: "PRINTFUL_BUSY" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("build-time requests (patient)", () => {
  it("wait for the window to reset before running out", async () => {
    const { printful } = await loadClient();
    fetchMock.mockResolvedValueOnce(ok("first", 3)).mockResolvedValueOnce(ok("second"));

    await printful("/store/products/1", { patient: true });
    const second = printful("/store/products/2", { patient: true });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(second).resolves.toBe("second");
  });

  it("sit out repeated 429s", async () => {
    const { printful } = await loadClient();
    fetchMock
      .mockResolvedValueOnce(limited(30))
      .mockResolvedValueOnce(limited(30))
      .mockResolvedValueOnce(ok("done"));

    const result = printful("/store/products/1", { patient: true });
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(result).resolves.toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("give up eventually rather than hanging the build", async () => {
    const { printful } = await loadClient();
    fetchMock.mockImplementation(async () => limited(1));

    const result = printful("/store/products/1", { patient: true });
    const assertion = expect(result).rejects.toMatchObject({ code: "PRINTFUL_BUSY" });
    await vi.advanceTimersByTimeAsync(10_000);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(6); // first try + 5 retries
  });
});

describe("getAllProducts()", () => {
  const products = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: from + i, is_ignored: false }));

  it("pages through the catalog and stops at the reported total", async () => {
    vi.resetModules();
    const { getAllProducts } = await import("#lib/printful/fetchers");
    fetchMock
      .mockResolvedValueOnce(ok(products(0, 100), 100, { paging: { total: 200, offset: 0, limit: 100 } }))
      .mockResolvedValueOnce(ok(products(100, 100), 100, { paging: { total: 200, offset: 100, limit: 100 } }));

    const all = await getAllProducts();

    expect(all).toHaveLength(200);
    // No third request for an empty page, even though the last page was full
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is fetched once when both content loaders ask for it", async () => {
    vi.resetModules();
    const { getAllProducts } = await import("#lib/printful/fetchers");
    fetchMock.mockResolvedValue(ok(products(0, 3), 100, { paging: { total: 3, offset: 0, limit: 100 } }));

    await Promise.all([getAllProducts(), getAllProducts()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
