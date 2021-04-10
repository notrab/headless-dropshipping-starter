import type { NextApiResponse } from "next";

import createOrder from "../../../lib/create-order";

import type { SnipcartRequest, SnipcartWebhookEvent } from "../../../types";

export default async (req: SnipcartRequest, res: NextApiResponse) => {
  const allowedEvents: SnipcartWebhookEvent[] = [
    "order.completed",
    "taxes.calculate",
    "shippingrates.fetch",
  ];

  const { eventName, content } = req.body;

  if (req.method === "POST") {
    if (allowedEvents.includes(eventName)) {
      try {
        switch (eventName) {
          case "order.completed":
            await createOrder(content);
            break;
          default:
            throw new Error("No such event handler exists");
        }

        res.status(204).json({ message: "Processed webhook" });
      } catch (err) {
        res.status(500).json({ message: "Something went wrong" });
      }
    }

    res.status(200).json({ message: "Nothing to process" });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
};
