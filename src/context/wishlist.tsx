import React, { createContext, useReducer, useEffect } from "react";

import useLocalStorage from "../hooks/useLocalStorage";

import type { PrintfulProduct } from "../types";

interface InitialState {
  items: [];
}

interface WishlistProviderState extends InitialState {
  addItem: (item: PrintfulProduct) => void;
  removeItem: (id: PrintfulProduct["id"]) => void;
  isSaved: (id: PrintfulProduct["id"]) => boolean;
  hasItems: boolean;
}

const ADD_PRODUCT = "ADD_PRODUCT";
const REMOVE_PRODUCT = "REMOVE_PRODUCT";

type Actions =
  | { type: typeof ADD_PRODUCT; payload: PrintfulProduct }
  | { type: typeof REMOVE_PRODUCT; payload: PrintfulProduct["id"] };

export const WishlistStateContext = createContext(null);
export const WishlistDispatchContext = createContext(null);

const initialState: InitialState = {
  items: [],
};

const reducer = (state: WishlistProviderState, { type, payload }: Actions) => {
  switch (type) {
    case ADD_PRODUCT:
      return { ...state, items: [...state.items, payload] };
    case REMOVE_PRODUCT:
      return {
        ...state,
        items: state.items.filter((i: PrintfulProduct) => i.id !== payload),
      };
    default:
      throw new Error(`Invalid action: ${type}`);
  }
};

export const WishlistProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [savedWishlist, saveWishlist] = useLocalStorage(
    "items-wishlist",
    JSON.stringify(initialState)
  );
  const [state, dispatch] = useReducer(reducer, JSON.parse(savedWishlist));

  useEffect(() => {
    saveWishlist(JSON.stringify(state));
  }, [state, saveWishlist]);

  const addItem = (item: PrintfulProduct) => {
    if (!item.id) return;

    const existing = state.items.find((i: PrintfulProduct) => i.id === item.id);

    if (existing) return dispatch({ type: REMOVE_PRODUCT, payload: item.id });

    dispatch({ type: ADD_PRODUCT, payload: item });
  };

  const removeItem = (id: PrintfulProduct["id"]) => {
    if (!id) return;

    dispatch({ type: REMOVE_PRODUCT, payload: id });
  };

  const isSaved = (id: PrintfulProduct["id"]) =>
    state.items.some((i: PrintfulProduct) => i.id === id);

  const hasItems = state.items.length > 0;

  return (
    <WishlistDispatchContext.Provider value={{ addItem, removeItem }}>
      <WishlistStateContext.Provider value={{ ...state, isSaved, hasItems }}>
        {children}
      </WishlistStateContext.Provider>
    </WishlistDispatchContext.Provider>
  );
};
