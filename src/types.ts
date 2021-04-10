import type { NextApiRequest } from "next";

export type SnipcartWebhookEvent =
  | "order.completed"
  | "order.status.changed"
  | "order.paymentStatus.changed"
  | "order.trackingNumber.changed"
  | "order.refund.created"
  | "order.notification.created"
  | "subscription.created"
  | "subscription.cancelled"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.invoice.created"
  | "shippingrates.fetch"
  | "taxes.calculate";

export interface SnipcartWebhookContent {
  discounts: { [key: string]: any };
  items: { [key: string]: any };
  user: { [key: string]: any };
  shippingRateUserDefinedId?: string;
  [key: string]: any;
}

export interface SnipcartRequest extends NextApiRequest {
  body: {
    eventName: SnipcartWebhookEvent;
    mode: string;
    createdOn: string;
    content: SnipcartWebhookContent;
  };
}

export interface ISyncProduct {
  id: string;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
}

export interface PrintfulProduct {
  id: string;
  name: string;
}
