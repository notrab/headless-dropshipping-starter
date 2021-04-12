import type { NextApiRequest, NextApiResponse } from "next";

import { printful } from "../../../lib/printful-client";

type Data = {
  id: string;
  price: number;
  url: string;
};

type Error = {
  errors: { key: string; message: string }[];
};

export default async (
  req: NextApiRequest,
  res: NextApiResponse<Data | Error>
) => {
  const { id } = req.query;

  try {
    const { result } = await printful.get(`store/variants/@${id}`);

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

    res.status(200).json({
      id: id as string,
      price: result.retail_price,
      url: `/api/products/${id}`,
    });
  } catch ({ error }) {
    console.log(error);
    res.status(404).json({
      errors: [
        {
          key: error?.message,
          message: error?.message,
        },
      ],
    });
  }
};
