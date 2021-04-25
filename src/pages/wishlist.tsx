import useWishlistState from "../hooks/useWishlistState";

import ProductGrid from "../components/ProductGrid";

const WishlistPage = () => {
  const { hasItems, items } = useWishlistState();

  return (
    <>
      <div className="text-center pb-6 md:pb-12">
        <h1 className="text-xl md:text-3xl lg:text-5xl font-bold">Wishlist</h1>
      </div>

      {hasItems ? (
        <ProductGrid products={items} />
      ) : (
        <p className="text-center text-gray-500">Your list is empty</p>
      )}
    </>
  );
};

export default WishlistPage;
