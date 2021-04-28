const withMDX = require("@next/mdx")({
  extension: /\.mdx$/,
});

module.exports = withMDX({
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  images: {
    domains: ["files.cdn.printful.com"],
  },
});
