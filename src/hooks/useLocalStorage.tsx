import * as React from "react";

export default function useLocalStorage(
  key: string,
  initialValue: string
): [string, (value: Function | string) => void] {
  const [storedValue, setStoredValue] = React.useState(() => {
    try {
      const item =
        typeof window !== "undefined" && window.localStorage.getItem(key);

      return item ? item : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: Function | string) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      setStoredValue(valueToStore);

      window.localStorage.setItem(key, valueToStore);
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}
