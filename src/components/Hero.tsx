import * as React from "react";
import Image from "next/image";

import type { PrintfulProduct } from "../types";

type HeroProps = {
  product: PrintfulProduct;
};

const Hero: React.FC<HeroProps> = ({ product }) => (
  <div className="bg-gray-50 p-6 md:p-12">
    <div className="flex items-center">
      <div className="flex items-center justify-center flex-1 sm:flex-shrink-0 md:w-1/3 p-6">
        image
      </div>
      <div className="md:w-2/3">
        <h1 className="text-gray-900 text-xl md:text-3xl font-bold">
          {product.name}
        </h1>
      </div>
    </div>
  </div>
);

export default Hero;
