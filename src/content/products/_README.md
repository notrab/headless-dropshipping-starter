# Product content

Add a Markdown file here to add a description to a product page and control
its metadata. Name it after the product's ID, which is the number in its URL:
`/products/398666195` reads `398666195.md`.

```md
---
title: Heavyweight Logo Hoodie
description: A heavyweight hoodie with our logo, printed to order.
image: ./hoodie-lifestyle.jpg
imageAlt: The hoodie worn outdoors
---

Made from 80% cotton, 20% polyester, with a soft brushed inside.

## Sizing

Runs true to size. Size up for a relaxed fit.
```

The body is regular Markdown (headings, lists, links) and appears under the
add-to-cart form. Everything in the frontmatter is optional:

| Field | Used for | If left out |
| --- | --- | --- |
| `title` | Browser tab and link preview title | The product name from Printful |
| `description` | Search results and link previews | No description |
| `image` | Link preview image (Slack, iMessage, X...) | The product's Printful mockup |
| `imageAlt` | Describes the preview image | The product name |

- `image` is a path relative to this file. Put the photo in this folder; it's
  checked at build time and resized for previews (1200px wide or more is best).
- The heading on the page always uses the Printful product name.
- Link previews need the store's public address: set `SITE_URL` in `.env`
  (Vercel and Netlify provide it automatically).
- Products without a file keep their default page.
- Files starting with `_` (like this one) are ignored.
- If a file doesn't match any product, `astro build` prints a warning.
