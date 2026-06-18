import type { AuditEntityType } from "../constants/entity-types.js";
import type { AuditEventType, Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

export type AuditContext = {
  eventType: AuditEventType;
  tenantId?: string | null;
  actorUserId?: string | null;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

async function logAudit(
  tx: Prisma.TransactionClient,
  audit: AuditContext,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: audit.tenantId ?? null,
      actorUserId: audit.actorUserId ?? null,
      eventType: audit.eventType,
      entityType: audit.entityType,
      entityId: audit.entityId ?? null,
      metadata: audit.metadata,
    },
  });
}

export async function withAuditedTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  audit: AuditContext | ((result: T) => AuditContext),
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await fn(tx);
    const context = typeof audit === "function" ? audit(result) : audit;
    await logAudit(tx, context);
    return result;
  });
}
