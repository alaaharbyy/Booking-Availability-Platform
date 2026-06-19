import { randomUUID } from "node:crypto";
import type { WebhookEventType } from "../constants/webhook-events.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { deliverWebhook } from "./webhook-delivery.service.js";

export async function dispatchBookingWebhook(
  tenantId: string,
  event: WebhookEventType,
  bookingId: string,
): Promise<void> {
  const webhook = await prisma.tenantWebhook.findUnique({
    where: { tenantId, active: true },
  });

  if (!webhook) {
    logger.debug("Skipping booking webhook — no active webhook registered", {
      tenantId,
      event,
      bookingId,
    });
    return;
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: {
      user: { select: { id: true, email: true } },
      experience: { select: { id: true, title: true } },
      slot: { select: { id: true, startsAt: true, endsAt: true } },
    },
  });

  if (!booking) {
    logger.warn("Skipping booking webhook — booking not found", {
      tenantId,
      event,
      bookingId,
    });
    return;
  }

  const payload = {
    event,
    occurred_at: new Date().toISOString(),
    tenant_id: tenantId,
    data: {
      booking_ref: booking.reference,
      status: booking.status,
      party_size: booking.partySize,
      total_price: booking.totalPrice.toString(),
      reserved_until: booking.reservedUntil?.toISOString() ?? null,
      user: booking.user,
      experience: booking.experience,
      slot: {
        id: booking.slot.id,
        starts_at: booking.slot.startsAt.toISOString(),
        ends_at: booking.slot.endsAt.toISOString(),
      },
    },
  };

  const result = await deliverWebhook(webhook, payload, randomUUID());

  if (!result.delivered) {
    logger.warn("Booking webhook delivery failed", {
      tenantId,
      event,
      bookingRef: booking.reference,
      statusCode: result.status_code,
      error: result.error,
      durationMs: result.duration_ms,
    });
    return;
  }

  logger.info("Booking webhook delivered", {
    tenantId,
    event,
    bookingRef: booking.reference,
    statusCode: result.status_code,
    durationMs: result.duration_ms,
  });
}

export function enqueueBookingWebhook(
  tenantId: string,
  event: WebhookEventType,
  bookingId: string,
): void {
  void dispatchBookingWebhook(tenantId, event, bookingId).catch((err) => {
    logger.error("Booking webhook dispatch error", { tenantId, event, bookingId }, err);
  });
}
