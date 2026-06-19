import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AuditLogListQuery } from "../schemas/requests/admin.requests.js";
import type {
  AuditLogListItem,
  AuditLogListResult,
} from "../schemas/responses/admin.responses.js";
import { endDateExclusive, parseUtcDate } from "../utils/utils.js";

function toMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toAuditLogListItem(log: {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: { id: string; email: string } | null;
}): AuditLogListItem {
  return {
    id: log.id,
    event_type: log.eventType,
    entity_type: log.entityType,
    entity_id: log.entityId,
    actor: log.actor,
    metadata: toMetadata(log.metadata),
    created_at: log.createdAt.toISOString(),
  };
}

export async function listAuditLogs(
  tenantId: string,
  query: AuditLogListQuery,
): Promise<AuditLogListResult> {
  const where: Prisma.AuditLogWhereInput = { tenantId };

  if (query.event_type) {
    where.eventType = query.event_type;
  }

  if (query.entity_type) {
    where.entityType = query.entity_type;
  }

  if (query.entity_id) {
    where.entityId = query.entity_id;
  }

  if (query.actor_user_id) {
    where.actorUserId = query.actor_user_id;
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: parseUtcDate(query.from) } : {}),
      ...(query.to ? { lt: endDateExclusive(query.to) } : {}),
    };
  }

  const [totalItems, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: query.sort_order },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
      include: {
        actor: { select: { id: true, email: true } },
      },
    }),
  ]);

  return {
    items: logs.map(toAuditLogListItem),
    pagination: {
      page: query.page,
      pageSize: query.page_size,
      totalItems,
      totalPages:
        totalItems === 0 ? 0 : Math.ceil(totalItems / query.page_size),
    },
  };
}
