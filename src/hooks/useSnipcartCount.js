import { useReducer, useEffect } from "react";

const initialState = {
  cart: {
    items: [],
    count: 0,
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
    if (typeof window !== "undefined" && window.Snipcart !== "undefined") {
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
