import type { Appearance } from "@stripe/stripe-js";

// Browser-side Stripe helpers, shared by checkout and the order page

/** Stripe Elements styling that follows the store theme (body[data-theme]) */
export function elementsAppearance(): Appearance {
  const themes = {
    sharp: { paddingX: "12px", borderRadius: "0", borderColor: "#d1d5db" },
    round: { paddingX: "20px", borderRadius: "9999px", borderColor: "#d1d5db" },
    brutalist: { paddingX: "12px", borderRadius: "0", borderColor: "#212529" },
  };
  const theme =
    themes[document.body.dataset.theme as keyof typeof themes] ?? themes.sharp;

  return {
    theme: "stripe",
    variables: {
      colorPrimary: "#000000",
      colorBackground: "#ffffff",
      colorText: "#32325d",
      colorDanger: "#e74c3c",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSizeBase: "1rem",
      spacingUnit: "8px",
      borderRadius: theme.borderRadius,
    },
    rules: {
      ".Input": {
        boxShadow: "none",
        borderColor: theme.borderColor,
        borderRadius: theme.borderRadius,
        paddingLeft: theme.paddingX,
        paddingRight: theme.paddingX,
        paddingTop: "12px",
        paddingBottom: "12px",
      },
      ".Input:focus": { boxShadow: "none" },
    },
  };
}
