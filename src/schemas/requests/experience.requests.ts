import { z } from "zod";
import {
  dateStringSchema,
  defaultPartySizeQuerySchema,
  defaultSearchEndDateSchema,
  defaultSearchStartDateSchema,
  optionalTrimmedStringSchema,
  optionalUuidSchema,
} from "./shared.requests.js";

export const experienceSearchQuerySchema = z
  .object({
    destination: optionalTrimmedStringSchema,
    start_date: defaultSearchStartDateSchema,
    end_date: defaultSearchEndDateSchema,
    party_size: defaultPartySizeQuerySchema,
    supplier_id: optionalUuidSchema,
    min_price: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      z.coerce.number().min(0).optional(),
    ),
    max_price: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      z.coerce.number().min(0).optional(),
    ),
    sort_by: z
      .enum(["starts_at", "price", "title", "available_spots"])
      .default("starts_at"),
    sort_order: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "end_date must be on or after start_date",
    path: ["end_date"],
  })
  .refine(
    (data) =>
      data.min_price === undefined ||
      data.max_price === undefined ||
      data.max_price >= data.min_price,
    {
      message: "max_price must be greater than or equal to min_price",
      path: ["max_price"],
    },
  );

export const experienceDetailQuerySchema = z
  .object({
    party_size: defaultPartySizeQuerySchema,
    slot_id: optionalUuidSchema,
    start_date: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
    end_date: z.preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : value,
      dateStringSchema.optional(),
    ),
  })
  .refine(
    (data) =>
      data.start_date === undefined ||
      data.end_date === undefined ||
      data.end_date >= data.start_date,
    {
      message: "end_date must be on or after start_date",
      path: ["end_date"],
    },
  );

export const experienceIdParamsSchema = z.object({
  id: z.uuid(),
});

export type ExperienceSearchQuery = z.infer<typeof experienceSearchQuerySchema>;
export type ExperienceDetailQuery = z.infer<typeof experienceDetailQuerySchema>;
export type ExperienceIdParams = z.infer<typeof experienceIdParamsSchema>;
