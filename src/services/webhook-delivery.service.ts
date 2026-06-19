import { webhookSignatureHeaders } from "../lib/webhook-signature.js";
import type { WebhookTestResult } from "../schemas/responses/webhook.responses.js";

export async function deliverWebhook(
  webhook: { url: string; secret: string },
  payload: unknown,
  eventId: string,
): Promise<WebhookTestResult> {
  const rawBody = JSON.stringify(payload);
  const headers = webhookSignatureHeaders(webhook.secret, rawBody, eventId);
  const started = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });

    return {
      delivered: response.ok,
      status_code: response.status,
      duration_ms: Date.now() - started,
      ...(response.ok
        ? {}
        : { error: `Webhook endpoint returned ${response.status}` }),
    };
  } catch (err) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : "Delivery failed",
      duration_ms: Date.now() - started,
    };
  }
}
