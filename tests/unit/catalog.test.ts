import { describe, expect, it } from "vitest";
import {
  isSellable,
  pageHref,
  paginate,
  toCartItem,
  toMinorUnits,
  variantImage,
  variantLabel,
  variantPrice,
} from "#lib/catalog";
import { variant } from "../fixtures";

describe("toMinorUnits", () => {
  it.each([
    ["35.00", 3500],
    ["16.50", 1650],
    ["0.29", 29], // 0.29 * 100 = 28.999999999999996 without rounding
    ["8.08", 808],
    [19.99, 1999],
    ["", 0],
    [null, 0],
    [undefined, 0],
  ])("%j → %i", (input, expected) => {
    expect(toMinorUnits(input)).toBe(expected);
  });
});

describe("isSellable", () => {
  it("sells synced, active variants", () => {
    expect(isSellable(variant())).toBe(true);
    expect(isSellable(variant({ availability_status: "temporary_out_of_stock" }))).toBe(true);
  });

  it.each([
    ["not synced", { synced: false }],
    ["ignored", { is_ignored: true }],
    ["discontinued", { availability_status: "discontinued" as const }],
    ["out of stock", { availability_status: "out_of_stock" as const }],
  ])("hides variants that are %s", (_, overrides) => {
    expect(isSellable(variant(overrides))).toBe(false);
  });
});

describe("variant display", () => {
  it("labels by colour and size", () => {
    expect(variantLabel(variant())).toBe("Black / M");
    expect(variantLabel(variant({ size: null }))).toBe("Black");
    expect(variantLabel(variant({ color: null, size: null }))).toBe("Hoodie - Black / M");
  });

  it("prefers the mockup over the blank catalog photo", () => {
    expect(variantImage(variant())).toBe("https://example.com/mockup.png");
    expect(variantImage(variant({ files: [] }))).toBe("https://example.com/blank.png");
  });

  it("prices in minor units", () => {
    expect(variantPrice(variant({ retail_price: "16.50" }))).toBe(1650);
  });
});

describe("toCartItem", () => {
  it("builds the cart line the browser stores", () => {
    expect(toCartItem(variant(), "Hoodie")).toEqual({
      id: "ext_hoodie_black_m",
      name: "Hoodie",
      variant: "Black / M",
      color: "Black",
      size: "M",
      price: 3500,
      currency: "GBP",
      image: "https://example.com/mockup.png",
    });
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 50 }, (_, i) => i + 1);

  it("slices out the requested page", () => {
    expect(paginate(items, 1, 24)).toEqual({ items: items.slice(0, 24), page: 1, lastPage: 3 });
    expect(paginate(items, 3, 24).items).toEqual([49, 50]);
  });

  it("always has at least one page, even with nothing to show", () => {
    expect(paginate([], 1, 24)).toEqual({ items: [], page: 1, lastPage: 1 });
  });

  it("returns nothing for pages past the end", () => {
    expect(paginate(items, 4, 24).items).toEqual([]);
  });
});

describe("pageHref", () => {
  it("uses the homepage for page 1 and /page/N after", () => {
    expect(pageHref(1)).toBe("/");
    expect(pageHref(2)).toBe("/page/2");
  });
});
