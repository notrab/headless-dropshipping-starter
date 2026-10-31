import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import {
  printfulLoader,
  printfulVariantsLoader,
  printfulProductSchema,
  printfulVariantSchema,
} from "./lib/printful";

const products = defineCollection({
  loader: printfulLoader(),
  schema: printfulProductSchema,
});

const variants = defineCollection({
  loader: printfulVariantsLoader(),
  schema: printfulVariantSchema,
});

// Optional Markdown for product pages: src/content/products/<product id>.md,
// where the id is the Printful sync product ID from the product's URL. The body
// is shown under the add-to-cart form; the frontmatter sets the page's
// metadata. Files starting with _ are ignored.
const productDetails = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/products" }),
  schema: ({ image }) =>
    z.object({
      /** Browser tab and link preview title. Defaults to the product name. */
      title: z.string().optional(),
      /** Search results and link previews */
      description: z.string().optional(),
      /** Link preview image, relative to the Markdown file. Defaults to the mockup. */
      image: image().optional(),
      imageAlt: z.string().optional(),
    }),
});

// Markdown pages (terms, privacy, refunds), served at /pages/[id]
const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

// Optional homepage hero: src/content/home.md. The body is shown above the
// products, and **bold** words in the heading stand out from the rest. The
// frontmatter sets the homepage's metadata. Delete the file for no hero.
const home = defineCollection({
  loader: glob({ pattern: "home.md", base: "./src/content" }),
  schema: z.object({
    /** Browser tab and link preview title. Defaults to the store name. */
    title: z.string().optional(),
    /** Search results and link previews */
    description: z.string().optional(),
  }),
});

export const collections = {
  products,
  variants,
  productDetails,
  pages,
  home,
};
