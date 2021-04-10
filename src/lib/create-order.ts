import { printful } from "./printful-client";

import type { SnipcartWebhookContent } from "../types";

type PrintfulShippingItem = {
  external_variant_id: string;
  quantity: number;
};

const createOrder = async ({
  invoiceNumber,
  email,
  user,
  items,
  shippingRateUserDefinedId,
}: SnipcartWebhookContent) => {
  const { shippingAddress } = user;

  const printfulRecipient = {
    ...(shippingAddress.address1 && { address1: shippingAddress.address1 }),
    ...(shippingAddress.address2 && { address2: shippingAddress.address2 }),
    ...(shippingAddress.city && { city: shippingAddress.city }),
    ...(shippingAddress.country && { country_code: shippingAddress.country }),
    ...(shippingAddress.shippingAddressProvince && {
      state_code: shippingAddress.shippingAddressProvince,
    }),
    ...(shippingAddress.postalCode && { zip: shippingAddress.postalCode }),
    ...(shippingAddress.phone && { phone: shippingAddress.phone }),
    email,
  };

  const printfulItems: PrintfulShippingItem[] = items.map(
    (item): PrintfulShippingItem => ({
      external_variant_id: item.id,
      quantity: item.quantity,
    })
  );

  const { result } = await printful.post("orders", {
    external_id: invoiceNumber,
    recipient: printfulRecipient,
    items: printfulItems,
    shipping: shippingRateUserDefinedId,
  });

  return result;
};

export default createOrder;
