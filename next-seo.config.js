const description =
  "Launch your own fully automated store with Snipcart, Printful, and Next.js";
const title = "Your SWAG store";
const url = "https://swag.nextdropshippingstarter.com";

const seo = {
  title,
  titleTemplate: "%s | Next.js Dropshipping Starter",
  description,
  openGraph: {
    description,
    title,
    type: "website",
    url,
  },
  twitter: {
    handle: "@notrab",
    site: "@notrab",
  },
};

export { seo as defaultSeo, url as defaultUrl };
