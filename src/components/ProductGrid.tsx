import Product from "./Product";

const ProductGrid = ({ products }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="grid gap-6 sm:gap-10 lg:gap-12 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <Product key={product.id} {...product} />
      ))}
    </div>
  );
};

export default ProductGrid;
