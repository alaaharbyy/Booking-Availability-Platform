import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AdminBookingListQuery } from "../schemas/requests/admin.requests.js";
import type {
  AdminBookingListItem,
  AdminBookingListResult,
} from "../schemas/responses/admin.responses.js";
import { endDateExclusive, parseUtcDate } from "../utils/utils.js";

function buildBookingOrderBy(
  query: AdminBookingListQuery,
): Prisma.BookingOrderByWithRelationInput {
  const direction = query.sort_order;

  switch (query.sort_by) {
    case "status":
      return { status: direction };
    case "total_price":
      return { totalPrice: direction };
    case "slot_starts_at":
      return { slot: { startsAt: direction } };
    case "created_at":
    default:
      return { createdAt: direction };
  }
}

function toAdminBookingListItem(booking: {
  reference: string;
  status: AdminBookingListItem["status"];
  partySize: number;
  totalPrice: Prisma.Decimal;
  reservedUntil: Date | null;
  createdAt: Date;
  user: { id: string; email: string };
  experience: { id: string; title: string };
  slot: { id: string; startsAt: Date; endsAt: Date };
}): AdminBookingListItem {
  return {
    booking_ref: booking.reference,
    status: booking.status,
    party_size: booking.partySize,
    total_price: booking.totalPrice.toString(),
    reserved_until: booking.reservedUntil?.toISOString() ?? null,
    created_at: booking.createdAt.toISOString(),
    user: booking.user,
    experience: booking.experience,
    slot: {
      id: booking.slot.id,
      starts_at: booking.slot.startsAt.toISOString(),
      ends_at: booking.slot.endsAt.toISOString(),
    },
  };
}

export async function listTenantBookings(
  tenantId: string,
  query: AdminBookingListQuery,
): Promise<AdminBookingListResult> {
  const where: Prisma.BookingWhereInput = { tenantId };

  if (query.status) {
    where.status = query.status;
  }

  if (query.user_id) {
    where.userId = query.user_id;
  }

  if (query.experience_id) {
    where.experienceId = query.experience_id;
  }

  if (query.reference) {
    where.reference = query.reference;
  }

  if (query.created_from || query.created_to) {
    where.createdAt = {
      ...(query.created_from
        ? { gte: parseUtcDate(query.created_from) }
        : {}),
      ...(query.created_to
        ? { lt: endDateExclusive(query.created_to) }
        : {}),
    };
  }

  if (query.slot_from || query.slot_to) {
    where.slot = {
      startsAt: {
        ...(query.slot_from ? { gte: parseUtcDate(query.slot_from) } : {}),
        ...(query.slot_to ? { lt: endDateExclusive(query.slot_to) } : {}),
      },
    };
  }

  const [totalItems, bookings] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: buildBookingOrderBy(query),
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
      include: {
        user: { select: { id: true, email: true } },
        experience: { select: { id: true, title: true } },
        slot: { select: { id: true, startsAt: true, endsAt: true } },
      },
    }),
  ]);

  return {
    items: bookings.map(toAdminBookingListItem),
    pagination: {
      page: query.page,
      pageSize: query.page_size,
      totalItems,
      totalPages:
        totalItems === 0 ? 0 : Math.ceil(totalItems / query.page_size),
    },
  };
}
