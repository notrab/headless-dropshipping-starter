import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "£35.00" if every price is the same, otherwise "From £30.00" */
export function formatPriceRange(minorUnits: number[], currencyCode = "GBP"): string {
  if (minorUnits.length === 0) return "Unavailable";
  const min = Math.min(...minorUnits);
  const prefix = min === Math.max(...minorUnits) ? "" : "From ";
  return prefix + formatPrice(min, currencyCode);
}

/** A Unix timestamp (seconds, as Printful sends) as e.g. "Oct 30, 2026, 1:04 PM" */
export function formatDateTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format an amount in minor units (pence/cents) as currency, e.g. 3500 → "£35.00" */
export function formatPrice(minorUnits: number, currencyCode = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
  }).format(minorUnits / 100);
}
