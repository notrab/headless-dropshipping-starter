/// <reference types="next" />
/// <reference types="next/types/global" />

declare module JSX {
  interface IntrinsicElements {
    "address-fields": {
      section: "top" | "bottom";
      children?: any;
    };
    "snipcart-label": {
      for: string;
      children?: any;
    };
    "snipcart-input": {
      name: string;
      children?: any;
    };
  }
}
