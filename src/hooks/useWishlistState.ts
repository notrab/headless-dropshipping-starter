import { useContext } from "react";

import { WishlistStateContext } from "../context/wishlist";

const useWishlistState = () => {
  const context = useContext(WishlistStateContext);

  if (!context)
    throw new Error("useWishlistState must be used within a WishlistProvider");

  return context;
};

export default useWishlistState;
