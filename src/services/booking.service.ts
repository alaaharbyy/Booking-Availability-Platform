import {
  AuditEventType,
  BookingStatus,
  type Prisma,
} from "../generated/prisma/client.js";
import { AuditEntityType } from "../constants/entity-types.js";
import { env } from "../config/env.js";
import { ConflictError, NotFoundError } from "../errors/index.js";
import { withAuditedTransaction, logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import type {
  BookingDetailResult,
  BookingSummary,
} from "../schemas/responses/booking.responses.js";
import type { CreateBookingBody } from "../schemas/requests/booking.requests.js";
import { generateBookingReference } from "../utils/utils.js";
import { assertTransition, isCancellable } from "./booking-state.js";
import { calculatePricingPreview } from "./pricing.service.js";

/** Atomically adjust slot.reserved; fails if version mismatch or capacity exceeded. */
async function adjustSlotReserved(
  tx: Prisma.TransactionClient,
  slotId: string,
  tenantId: string,
  delta: number,
  expectedVersion: number,
): Promise<void> {
  if (delta > 0) {
    const updated = await tx.$executeRaw`
      UPDATE availability_slots
      SET reserved = reserved + ${delta}, version = version + 1
      WHERE id = ${slotId}::uuid
        AND "tenantId" = ${tenantId}::uuid
        AND version = ${expectedVersion}
        AND capacity - reserved >= ${delta}
    `;
    if (updated === 0) {
      throw new ConflictError("Slot no longer available");
    }
    return;
  }

  const release = Math.abs(delta);
  const updated = await tx.$executeRaw`
    UPDATE availability_slots
    SET reserved = reserved - ${release}, version = version + 1
    WHERE id = ${slotId}::uuid
      AND "tenantId" = ${tenantId}::uuid
      AND version = ${expectedVersion}
      AND reserved >= ${release}
  `;
  if (updated === 0) {
    throw new ConflictError("Failed to release slot reservation");
  }
}

async function appendStatusHistory(
  tx: Prisma.TransactionClient,
  bookingId: string,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus,
  actorUserId: string | null,
  reason?: string,
): Promise<void> {
  await tx.bookingStatusHistory.create({
    data: {
      bookingId,
      fromStatus,
      toStatus,
      actorUserId,
      reason: reason ?? null,
    },
  });
}

function toBookingSummary(booking: {
  reference: string;
  status: BookingStatus;
  partySize: number;
  totalPrice: Prisma.Decimal;
  reservedUntil: Date | null;
}): BookingSummary {
  return {
    booking_ref: booking.reference,
    status: booking.status,
    party_size: booking.partySize,
    total_price: booking.totalPrice.toString(),
    reserved_until: booking.reservedUntil?.toISOString() ?? null,
  };
}

async function findOwnedBooking(
  tenantId: string,
  userId: string,
  reference: string,
) {
  const booking = await prisma.booking.findFirst({
    where: { tenantId, userId, reference },
    include: {
      experience: { select: { id: true, title: true } },
      slot: { select: { id: true, startsAt: true, endsAt: true, version: true } },
      history: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

export async function createReservation(
  tenantId: string,
  userId: string,
  body: CreateBookingBody,
): Promise<BookingSummary> {
  const slot = await prisma.availabilitySlot.findFirst({
    where: { id: body.slot_id, tenantId },
    include: {
      experience: {
        include: {
          supplier: {
            include: { pricingRules: { where: { active: true } } },
          },
        },
      },
    },
  });

  if (!slot || !slot.experience.active) {
    throw new NotFoundError("Slot not found");
  }

  if (slot.capacity - slot.reserved < body.party_size) {
    throw new ConflictError("Slot no longer available");
  }

  const pricingPreview = calculatePricingPreview(
    slot.experience.basePrice,
    body.party_size,
    slot.experience.supplier.pricingRules,
    slot.startsAt,
  );

  const reservedUntil = new Date(
    Date.now() + env.bookingReserveTtlSeconds * 1000,
  );

  const booking = await withAuditedTransaction(
    async (tx) => {
      await adjustSlotReserved(
        tx,
        slot.id,
        tenantId,
        body.party_size,
        slot.version,
      );

      const created = await tx.booking.create({
        data: {
          reference: generateBookingReference(),
          tenantId,
          userId,
          experienceId: slot.experienceId,
          slotId: slot.id,
          partySize: body.party_size,
          totalPrice: pricingPreview.totalPrice,
          status: BookingStatus.RESERVED,
          reservedUntil,
        },
      });

      await appendStatusHistory(
        tx,
        created.id,
        null,
        BookingStatus.RESERVED,
        userId,
      );

      return created;
    },
    (created) => ({
      eventType: AuditEventType.BOOKING_RESERVED,
      tenantId,
      actorUserId: userId,
      entityType: AuditEntityType.Booking,
      entityId: created.id,
      metadata: {
        booking_ref: created.reference,
        slot_id: slot.id,
        party_size: body.party_size,
      },
    }),
  );

  return toBookingSummary(booking);
}

export async function getBookingDetail(
  tenantId: string,
  userId: string,
  reference: string,
): Promise<BookingDetailResult> {
  const booking = await findOwnedBooking(tenantId, userId, reference);

  return {
    ...toBookingSummary(booking),
    experience: {
      id: booking.experience.id,
      title: booking.experience.title,
    },
    slot: {
      id: booking.slot.id,
      starts_at: booking.slot.startsAt.toISOString(),
      ends_at: booking.slot.endsAt.toISOString(),
    },
    timeline: booking.history.map((entry) => ({
      from_status: entry.fromStatus,
      to_status: entry.toStatus,
      reason: entry.reason,
      actor_user_id: entry.actorUserId,
      at: entry.createdAt.toISOString(),
    })),
  };
}

export async function confirmReservation(
  tenantId: string,
  userId: string,
  reference: string,
): Promise<BookingSummary> {
  const booking = await findOwnedBooking(tenantId, userId, reference);

  assertTransition(booking.status, BookingStatus.CONFIRMED); 

  if (booking.reservedUntil && booking.reservedUntil < new Date()) {
    throw new ConflictError("Reservation hold has expired");
  }

  const updated = await withAuditedTransaction(
    async (tx) => {
      const confirmed = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED, reservedUntil: null },
      });

      await appendStatusHistory(
        tx,
        booking.id,
        booking.status,
        BookingStatus.CONFIRMED,
        userId,
      );

      return confirmed;
    },
    {
      eventType: AuditEventType.BOOKING_CONFIRMED,
      tenantId,
      actorUserId: userId,
      entityType: AuditEntityType.Booking,
      entityId: booking.id,
      metadata: {
        booking_ref: booking.reference,
        previousStatus: booking.status,
      },
    },
  );

  return toBookingSummary(updated);
}

export async function cancelReservation(
  tenantId: string,
  userId: string,
  reference: string,
  reason: string,
): Promise<BookingSummary> {
  const booking = await prisma.booking.findFirst({
    where: { tenantId, userId, reference },
    include: {
      slot: { select: { version: true } },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  if (!isCancellable(booking.status)) {
    throw new ConflictError(`Cannot cancel booking in ${booking.status} status`);
  }

  assertTransition(booking.status, BookingStatus.CANCELLED);

  const updated = await withAuditedTransaction(
    async (tx) => {
      await adjustSlotReserved(
        tx,
        booking.slotId,
        tenantId,
        -booking.partySize,
        booking.slot.version,
      );

      const cancelled = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, reservedUntil: null },
      });

      await appendStatusHistory(
        tx,
        booking.id,
        booking.status,
        BookingStatus.CANCELLED,
        userId,
        reason,
      );

      return cancelled;
    },
    {
      eventType: AuditEventType.BOOKING_CANCELLED,
      tenantId,
      actorUserId: userId,
      entityType: AuditEntityType.Booking,
      entityId: booking.id,
      metadata: {
        booking_ref: booking.reference,
        reason,
        previousStatus: booking.status,
      },
    },
  );

  return toBookingSummary(updated);
}

const EXPIRY_BATCH_SIZE = 50;

async function expireReservation(booking: {
  id: string;
  tenantId: string;
  slotId: string;
  partySize: number;
  reference: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: {
        id: booking.id,
        status: BookingStatus.RESERVED,
        reservedUntil: { lt: new Date() },
      },
      data: { status: BookingStatus.EXPIRED, reservedUntil: null },
    });

    if (claimed.count === 0) {
      return false;
    }

    const slot = await tx.availabilitySlot.findFirst({
      where: { id: booking.slotId, tenantId: booking.tenantId },
      select: { version: true },
    });

    if (!slot) {
      throw new ConflictError("Slot not found while expiring reservation");
    }

    await adjustSlotReserved(
      tx,
      booking.slotId,
      booking.tenantId,
      -booking.partySize,
      slot.version,
    );

    await appendStatusHistory(
      tx,
      booking.id,
      BookingStatus.RESERVED,
      BookingStatus.EXPIRED,
      null,
      "Reservation hold expired",
    );

    await logAudit(tx, {
      eventType: AuditEventType.BOOKING_EXPIRED,
      tenantId: booking.tenantId,
      actorUserId: null,
      entityType: AuditEntityType.Booking,
      entityId: booking.id,
      metadata: {
        booking_ref: booking.reference,
        previousStatus: BookingStatus.RESERVED,
      },
    });

    return true;
  });
}

/** Marks overdue RESERVED bookings as EXPIRED and releases slot capacity. */
export async function expireStaleReservations(): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: {
      status: BookingStatus.RESERVED,
      reservedUntil: { lt: new Date() },
    },
    select: {
      id: true,
      tenantId: true,
      slotId: true,
      partySize: true,
      reference: true,
    },
    take: EXPIRY_BATCH_SIZE,
    orderBy: { reservedUntil: "asc" },
  });

  let expired = 0;

  for (const booking of stale) {
    try {
      const didExpire = await expireReservation(booking);
      if (didExpire) {
        expired++;
      }
    } catch {
      // Version conflict or concurrent cancel/confirm — retry on next poll.
    }
  }

  return expired;
}
