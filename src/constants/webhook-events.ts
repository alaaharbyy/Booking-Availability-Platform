export const WebhookEventType = {
  TEST: "webhook.test",
  BOOKING_RESERVED: "booking.reserved",
  BOOKING_CONFIRMED: "booking.confirmed",
  BOOKING_CANCELLED: "booking.cancelled",
  BOOKING_EXPIRED: "booking.expired",
} as const;

export type WebhookEventType =
  (typeof WebhookEventType)[keyof typeof WebhookEventType];
