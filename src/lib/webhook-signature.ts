import { createHmac } from "node:crypto";

export function signWebhookPayload(
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

export function webhookSignatureHeaders(
  secret: string,
  rawBody: string,
  eventId: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(secret, timestamp, rawBody);

  return {
    "Content-Type": "application/json",
    "User-Agent": "Booking-Availability-Platform/1.0",
    "X-Webhook-Id": eventId,
    "X-Webhook-Timestamp": String(timestamp),
    "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
  };
}
