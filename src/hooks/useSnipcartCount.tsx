import { useReducer, useEffect } from "react";

import { hasSnipcart } from "../lib/has-snipcart";

const initialState = {
  cart: {
    items: {
      count: 0,
      items: [],
    },
  },
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET":
      return {
        ...state,
        ...action.payload,
      };
    default:
      throw new Error(`No such action ${action.type}`);
  }
};

const useSnipcartCount = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (hasSnipcart()) {
      const unsubscribe = window.Snipcart.store.subscribe(() => {
        const itemsCount = window.Snipcart.store.getState();

        dispatch({ type: "SET", payload: itemsCount });
      });

      return unsubscribe;
    }
  }, []);

  return state;
};

export default useSnipcartCount;
