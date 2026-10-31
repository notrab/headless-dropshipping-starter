import { describe, expect, it, vi } from "vitest";
import { checkSetup, formatChecklist, isReady, stripeMode, type SetupEnv } from "#lib/setup";

const goodEnv: SetupEnv = {
  PRINTFUL_API_TOKEN: "pf-token",
  STRIPE_SECRET_KEY: "sk_test_abc",
  PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fake Printful + Stripe. Override per test. */
function fakeApis({
  stores = [{ id: 1, name: "Shop" }],
  productCount = 9,
  printfulStatus = 200,
  stripeStatus = 200,
} = {}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/stores")) return json(printfulStatus, { result: stores });
    if (url.includes("/store/products")) return json(200, { result: [], paging: { total: productCount } });
    if (url.includes("api.stripe.com")) return json(stripeStatus, {});
    throw new Error(`Unexpected request: ${url}`);
  }) as unknown as typeof fetch;
}

const statusOf = (checks: Awaited<ReturnType<typeof checkSetup>>) =>
  Object.fromEntries(checks.map((c) => [c.id, c.status]));

describe("checkSetup", () => {
  it("passes a complete setup", async () => {
    const checks = await checkSetup(goodEnv, fakeApis());

    expect(isReady(checks)).toBe(true);
    expect(checks.find((c) => c.id === "printful-products")?.title).toBe("9 products in Printful");
  });

  it("explains a missing Printful token, and skips what depends on it", async () => {
    const checks = await checkSetup({ ...goodEnv, PRINTFUL_API_TOKEN: undefined }, fakeApis());

    expect(statusOf(checks)).toMatchObject({ "printful-token": "problem", "printful-products": "skipped" });
    expect(checks[0].help).toMatch(/PRINTFUL_API_TOKEN/);
  });

  it("explains a token Printful rejects", async () => {
    const checks = await checkSetup(goodEnv, fakeApis({ printfulStatus: 401 }));

    expect(checks[0]).toMatchObject({ status: "problem", help: expect.stringMatching(/didn't accept/) });
  });

  it("asks which store when a token can see several", async () => {
    const stores = [{ id: 1, name: "Shop" }, { id: 2, name: "Other" }];
    const checks = await checkSetup(goodEnv, fakeApis({ stores }));

    expect(checks[0].help).toMatch(/PRINTFUL_STORE_ID/);
    expect(checks[0].help).toContain("2 (Other)");
  });

  it("accepts a chosen store, and flags one the token can't see", async () => {
    const stores = [{ id: 1, name: "Shop" }, { id: 2, name: "Other" }];

    expect(isReady(await checkSetup({ ...goodEnv, PRINTFUL_STORE_ID: "2" }, fakeApis({ stores })))).toBe(true);
    const wrong = await checkSetup({ ...goodEnv, PRINTFUL_STORE_ID: "99" }, fakeApis({ stores }));
    expect(wrong[0].help).toMatch(/doesn't match/);
  });

  it("points to the Printful dashboard when there are no products", async () => {
    const checks = await checkSetup(goodEnv, fakeApis({ productCount: 0 }));

    expect(checks[1]).toMatchObject({ status: "problem", link: expect.stringContaining("printful.com") });
  });

  it("catches test and live Stripe keys being mixed", async () => {
    const checks = await checkSetup(
      { ...goodEnv, PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc" },
      fakeApis(),
    );

    expect(checks.find((c) => c.id === "stripe-publishable")?.help).toMatch(/test mode.*live mode/);
  });

  it("catches keys pasted into the wrong variable", async () => {
    const checks = await checkSetup(
      { ...goodEnv, STRIPE_SECRET_KEY: "pk_test_abc", PUBLIC_STRIPE_PUBLISHABLE_KEY: "sk_test_abc" },
      fakeApis(),
    );

    expect(statusOf(checks)).toMatchObject({ "stripe-secret": "problem", "stripe-publishable": "problem" });
  });

  it("explains a secret key Stripe rejects", async () => {
    const checks = await checkSetup(goodEnv, fakeApis({ stripeStatus: 401 }));

    expect(checks.find((c) => c.id === "stripe-secret")?.help).toMatch(/didn't accept/);
  });

  it("accepts no webhook secret, and says orders are confirmed by hand", async () => {
    const checks = await checkSetup({ ...goodEnv, STRIPE_WEBHOOK_SECRET: undefined }, fakeApis());
    const webhook = checks.find((c) => c.id === "stripe-webhook");

    expect(webhook?.status).toBe("ok");
    expect(webhook?.title).toMatch(/by hand/);
  });

  it("flags a webhook secret that isn't a whsec_ secret", async () => {
    const checks = await checkSetup({ ...goodEnv, STRIPE_WEBHOOK_SECRET: "nope" }, fakeApis());

    expect(statusOf(checks)["stripe-webhook"]).toBe("problem");
  });

  it("never puts secret values in the results", async () => {
    const env = { ...goodEnv, PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc", STRIPE_WEBHOOK_SECRET: "bad" };
    const output = formatChecklist(await checkSetup(env, fakeApis({ printfulStatus: 401 })));

    for (const secret of ["pf-token", "sk_test_abc", "pk_live_abc", "bad\n"]) {
      expect(output).not.toContain(secret);
    }
  });
});

describe("stripeMode", () => {
  it.each([
    ["sk_test_123", "test"],
    ["pk_live_123", "live"],
    ["rk_test_123", "test"],
    ["whsec_123", undefined],
    [undefined, undefined],
  ])("%s → %s", (key, mode) => {
    expect(stripeMode(key)).toBe(mode);
  });
});
