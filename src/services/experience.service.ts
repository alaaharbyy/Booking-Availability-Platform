import { Prisma } from "../generated/prisma/client.js";
import type { Prisma as PrismaTypes } from "../generated/prisma/client.js";
import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/prisma.js";
import type {
  ExperienceDetailResult,
  ExperienceSearchItem,
  ExperienceSearchResult,
} from "../schemas/responses/experience.responses.js";
import type {
  ExperienceDetailQuery,
  ExperienceSearchQuery,
} from "../schemas/requests/experience.requests.js";
import { endDateExclusive, parseUtcDate } from "../utils/utils.js";
import { calculatePricingPreview } from "./pricing.service.js";

function buildExperienceWhere(
  query: ExperienceSearchQuery,
): PrismaTypes.ExperienceWhereInput {
  const experienceWhere: PrismaTypes.ExperienceWhereInput = {
    active: true,
    capacity: { gte: query.party_size },
  };

  if (query.destination) {
    experienceWhere.destination = {
      contains: query.destination,
      mode: "insensitive",
    };
  }

  if (query.supplier_id) {
    experienceWhere.supplierId = query.supplier_id;
  }

  if (query.min_price !== undefined || query.max_price !== undefined) {
    experienceWhere.basePrice = {
      ...(query.min_price !== undefined ? { gte: query.min_price } : {}),
      ...(query.max_price !== undefined ? { lte: query.max_price } : {}),
    };
  }

  return experienceWhere;
}

type GroupedExperienceRow = {
  id: string;
  title: string;
  destination: string;
  description: string | null;
  basePrice: PrismaTypes.Decimal;
  capacity: number;
  supplier_id: string;
  supplier_name: string;
  available_slots: number;
  earliest_slot_at: Date;
};

type SlotPricingRow = {
  id: string;
  experienceId: string;
  startsAt: Date;
};

export async function searchExperiences(
  tenantId: string,
  query: ExperienceSearchQuery,
): Promise<ExperienceSearchResult> {
  const startAt = parseUtcDate(query.start_date);
  const endAt = endDateExclusive(query.end_date);

  const matchingExperiences = await prisma.experience.findMany({
    where: {
      tenantId,
      ...buildExperienceWhere(query),
    },
    select: { id: true },
  });

  const experienceIds = matchingExperiences.map((experience) => experience.id);
  if (experienceIds.length === 0) {
    return {
      items: [],
      pagination: {
        page: query.page,
        pageSize: query.page_size,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  const slotFilters = Prisma.join(
    [
      Prisma.sql`e.id IN (${Prisma.join(experienceIds.map((id) => Prisma.sql`${id}::uuid`))})`,
      Prisma.sql`sl."tenantId" = ${tenantId}::uuid`,
      Prisma.sql`sl."startsAt" >= ${startAt}`,
      Prisma.sql`sl."startsAt" < ${endAt}`,
      Prisma.sql`sl.capacity - sl.reserved >= ${query.party_size}`,
    ],
    " AND ",
  );

  const groupedFrom = Prisma.sql`
    FROM experiences e
    INNER JOIN suppliers sup ON sup.id = e."supplierId"
    INNER JOIN availability_slots sl ON sl."experienceId" = e.id
    WHERE ${slotFilters}
    GROUP BY
      e.id,
      e.title,
      e.destination,
      e.description,
      e."basePrice",
      e.capacity,
      sup.id,
      sup.name
  `;

  const [{ total_items }] = await prisma.$queryRaw<[{ total_items: number }]>`
    SELECT COUNT(*)::int AS total_items
    FROM (
      SELECT e.id
      ${groupedFrom}
    ) grouped_experiences
  `;

  const totalPages =
    total_items === 0 ? 0 : Math.ceil(total_items / query.page_size);
  const offset = (query.page - 1) * query.page_size;

  const orderBy =
    query.sort_by === "title"
      ? Prisma.sql`e.title ${Prisma.raw(query.sort_order === "desc" ? "DESC" : "ASC")}`
      : query.sort_by === "available_spots"
        ? Prisma.sql`available_slots ${Prisma.raw(query.sort_order === "desc" ? "DESC" : "ASC")}`
        : Prisma.sql`earliest_slot_at ${Prisma.raw(query.sort_order === "desc" ? "DESC" : "ASC")}`;

  const groupedRows = await prisma.$queryRaw<GroupedExperienceRow[]>`
    SELECT
      e.id,
      e.title,
      e.destination,
      e.description,
      e."basePrice",
      e.capacity,
      sup.id AS supplier_id,
      sup.name AS supplier_name,
      COUNT(sl.id)::int AS available_slots,
      MIN(sl."startsAt") AS earliest_slot_at
    ${groupedFrom}
    ORDER BY ${orderBy}
    ${
      query.sort_by === "price"
        ? Prisma.empty
        : Prisma.sql`LIMIT ${query.page_size} OFFSET ${offset}`
    }
  `;

  const pageExperienceIds =
    query.sort_by === "price"
      ? experienceIds
      : groupedRows.map((row) => row.id);
  const fromPriceByExperienceId = new Map<string, string>();

  let pageRows = groupedRows;

  if (pageExperienceIds.length > 0) {
    const slotRows = await prisma.$queryRaw<SlotPricingRow[]>`
      SELECT sl.id, sl."experienceId", sl."startsAt"
      FROM availability_slots sl
      WHERE sl."tenantId" = ${tenantId}::uuid
        AND sl."experienceId" IN (${Prisma.join(pageExperienceIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND sl."startsAt" >= ${startAt}
        AND sl."startsAt" < ${endAt}
        AND sl.capacity - sl.reserved >= ${query.party_size}
    `;

    const experiencesWithRules = await prisma.experience.findMany({
      where: { tenantId, id: { in: pageExperienceIds } },
      include: {
        supplier: {
          include: {
            pricingRules: {
              where: { active: true },
            },
          },
        },
      },
    });
    const experienceById = new Map(
      experiencesWithRules.map((experience) => [experience.id, experience]),
    );

    for (const slot of slotRows) {
      const experience = experienceById.get(slot.experienceId);
      if (!experience) {
        continue;
      }

      const pricingPreview = calculatePricingPreview(
        experience.basePrice,
        query.party_size,
        experience.supplier.pricingRules,
        slot.startsAt,
      );
      const totalPrice = Number(pricingPreview.totalPrice);
      const existingFromPrice = fromPriceByExperienceId.get(slot.experienceId);

      if (existingFromPrice === undefined || totalPrice < Number(existingFromPrice)) {
        fromPriceByExperienceId.set(slot.experienceId, pricingPreview.totalPrice);
      }
    }

    if (query.sort_by === "price") {
      pageRows = [...groupedRows].sort((left, right) => {
        const leftPrice = Number(fromPriceByExperienceId.get(left.id) ?? left.basePrice);
        const rightPrice = Number(fromPriceByExperienceId.get(right.id) ?? right.basePrice);
        return query.sort_order === "asc"
          ? leftPrice - rightPrice
          : rightPrice - leftPrice;
      });
      pageRows = pageRows.slice(offset, offset + query.page_size);
    }
  }

  const items: ExperienceSearchItem[] = pageRows.map((row) => ({
    id: row.id,
    title: row.title,
    destination: row.destination,
    description: row.description,
    basePrice: row.basePrice.toString(),
    capacity: row.capacity,
    supplier: {
      id: row.supplier_id,
      name: row.supplier_name,
    },
    partySize: query.party_size,
    fromPrice:
      fromPriceByExperienceId.get(row.id) ?? row.basePrice.toString(),
    availableSlots: row.available_slots,
    earliestSlotAt: row.earliest_slot_at.toISOString(),
  }));

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.page_size,
      totalItems: total_items,
      totalPages,
    },
  };
}

export async function getExperienceDetail(
  tenantId: string,
  experienceId: string,
  query: ExperienceDetailQuery,
): Promise<ExperienceDetailResult> {
  const experience = await prisma.experience.findFirst({
    where: {
      id: experienceId,
      tenantId,
      active: true,
    },
    include: {
      supplier: {
        include: {
          pricingRules: {
            where: { active: true },
          },
        },
      },
    },
  });

  if (!experience) {
    throw new NotFoundError("Experience not found");
  }

  const slotFilters = [
    Prisma.sql`s."experienceId" = ${experienceId}::uuid`,
    Prisma.sql`s."tenantId" = ${tenantId}::uuid`,
    Prisma.sql`s.capacity - s.reserved >= ${query.party_size}`,
  ];

  if (query.slot_id) {
    slotFilters.push(Prisma.sql`s.id = ${query.slot_id}::uuid`);
  }

  if (query.start_date) {
    slotFilters.push(
      Prisma.sql`s."startsAt" >= ${parseUtcDate(query.start_date)}`,
    );
  }

  if (query.end_date) {
    slotFilters.push(
      Prisma.sql`s."startsAt" < ${endDateExclusive(query.end_date)}`,
    );
  }

  const slots = await prisma.$queryRaw<
    {
      id: string;
      startsAt: Date;
      endsAt: Date;
      capacity: number;
      reserved: number;
    }[]
  >`
    SELECT s.id, s."startsAt", s."endsAt", s.capacity, s.reserved
    FROM availability_slots s
    WHERE ${Prisma.join(slotFilters, " AND ")}
    ORDER BY s."startsAt" ASC
  `;

  if (query.slot_id && slots.length === 0) {
    throw new NotFoundError("Slot not found for this experience");
  }

  const slotPreviews = slots.map((slot) => ({
    slotId: slot.id,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    slotCapacity: slot.capacity,
    reserved: slot.reserved,
    availableSpots: slot.capacity - slot.reserved,
    pricingPreview: calculatePricingPreview(
      experience.basePrice,
      query.party_size,
      experience.supplier.pricingRules,
      slot.startsAt,
    ),
  }));

  const pricingPreview = calculatePricingPreview(
    experience.basePrice,
    query.party_size,
    experience.supplier.pricingRules,
    slots[0]?.startsAt,
  );

  return {
    id: experience.id,
    title: experience.title,
    destination: experience.destination,
    description: experience.description,
    basePrice: experience.basePrice.toString(),
    capacity: experience.capacity,
    supplier: {
      id: experience.supplier.id,
      name: experience.supplier.name,
      email: experience.supplier.email,
    },
    partySize: query.party_size,
    pricingPreview,
    slots: slotPreviews,
  };
}
