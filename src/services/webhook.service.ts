import { randomBytes, randomUUID } from "node:crypto";
import { AuditEntityType } from "../constants/entity-types.js";
import { AuditEventType } from "../generated/prisma/client.js";
import { NotFoundError } from "../errors/index.js";
import { withAuditedTransaction } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import type {
  RegisterWebhookBody,
  TestWebhookBody,
} from "../schemas/requests/webhook.requests.js";
import type {
  WebhookRegistrationResult,
  WebhookTestResult,
} from "../schemas/responses/webhook.responses.js";
import { deliverWebhook } from "./webhook-delivery.service.js";
import { WebhookEventType } from "../constants/webhook-events.js";

function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

function toRegistrationResult(
  webhook: {
    id: string;
    url: string;
    secret: string;
    active: boolean;
    createdAt: Date;
  },
  created: boolean,
): WebhookRegistrationResult {
  return {
    id: webhook.id,
    url: webhook.url,
    secret: webhook.secret,
    active: webhook.active,
    created_at: webhook.createdAt.toISOString(),
    created,
  };
}

export async function registerWebhook(
  tenantId: string,
  actorUserId: string,
  body: RegisterWebhookBody,
): Promise<WebhookRegistrationResult> {
  const secret = generateWebhookSecret();
  const existing = await prisma.tenantWebhook.findUnique({
    where: { tenantId },
  });

  if (existing) {
    const updated = await withAuditedTransaction(
      async (tx) =>
        tx.tenantWebhook.update({
          where: { tenantId },
          data: {
            url: body.url,
            secret,
            active: true,
          },
        }),
      {
        eventType: AuditEventType.WEBHOOK_UPDATED,
        tenantId,
        actorUserId,
        entityType: AuditEntityType.TenantWebhook,
        entityId: existing.id,
        metadata: { url: body.url },
      },
    );

    logger.info("Webhook updated", { tenantId, url: body.url });
    return toRegistrationResult(updated, false);
  }

  const created = await withAuditedTransaction(
    async (tx) =>
      tx.tenantWebhook.create({
        data: {
          tenantId,
          url: body.url,
          secret,
          active: true,
        },
      }),
    (webhook) => ({
      eventType: AuditEventType.WEBHOOK_CREATED,
      tenantId,
      actorUserId,
      entityType: AuditEntityType.TenantWebhook,
      entityId: webhook.id,
      metadata: { url: body.url },
    }),
  );

  logger.info("Webhook created", { tenantId, url: body.url });
  return toRegistrationResult(created, true);
}

export async function sendTestWebhook(
  tenantId: string,
  body: TestWebhookBody = {},
): Promise<WebhookTestResult> {
  const webhook = await prisma.tenantWebhook.findUnique({
    where: { tenantId, active: true },
  });

  if (!webhook) {
    throw new NotFoundError("No webhook registered for this tenant");
  }

  const payload = {
    event: WebhookEventType.TEST,
    occurred_at: new Date().toISOString(),
    tenant_id: tenantId,
    data:
      body.data ?? {
        message: "This is a test event from Booking Availability Platform",
      },
  };

  const result = await deliverWebhook(webhook, payload, randomUUID());

  if (result.delivered) {
    logger.info("Test webhook delivered", {
      tenantId,
      statusCode: result.status_code,
      durationMs: result.duration_ms,
    });
  } else {
    logger.warn("Test webhook delivery failed", {
      tenantId,
      statusCode: result.status_code,
      error: result.error,
      durationMs: result.duration_ms,
    });
  }

  return result;
}
