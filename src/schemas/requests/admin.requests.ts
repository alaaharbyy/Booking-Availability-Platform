import { z } from "zod";
import { AuditEventType } from "../../generated/prisma/client.js";
import {
  dateStringSchema,
  optionalTrimmedStringSchema,
  optionalUuidSchema,
} from "./shared.requests.js";

const auditEventTypeValues = Object.values(AuditEventType) as [
  (typeof AuditEventType)[keyof typeof AuditEventType],
  ...(typeof AuditEventType)[keyof typeof AuditEventType][],
];

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
};

export const adminBookingListQuerySchema = z
  .object({
    status: z
      .enum(["RESERVED", "CONFIRMED", "CANCELLED", "EXPIRED"])
      .optional(),
    user_id: optionalUuidSchema,
    experience_id: optionalUuidSchema,
    reference: optionalTrimmedStringSchema,
    created_from: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    created_to: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    slot_from: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    slot_to: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    sort_by: z
      .enum(["created_at", "status", "total_price", "slot_starts_at"])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    ...paginationFields,
  })
  .refine(
    (data) =>
      data.created_from === undefined ||
      data.created_to === undefined ||
      data.created_to >= data.created_from,
    {
      message: "created_to must be on or after created_from",
      path: ["created_to"],
    },
  )
  .refine(
    (data) =>
      data.slot_from === undefined ||
      data.slot_to === undefined ||
      data.slot_to >= data.slot_from,
    {
      message: "slot_to must be on or after slot_from",
      path: ["slot_to"],
    },
  );

export const auditLogListQuerySchema = z
  .object({
    event_type: z.enum(auditEventTypeValues).optional(),
    entity_type: optionalTrimmedStringSchema,
    entity_id: optionalUuidSchema,
    actor_user_id: optionalUuidSchema,
    from: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    to: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    ...paginationFields,
  })
  .refine(
    (data) =>
      data.from === undefined ||
      data.to === undefined ||
      data.to >= data.from,
    {
      message: "to must be on or after from",
      path: ["to"],
    },
  );

export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>;
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
