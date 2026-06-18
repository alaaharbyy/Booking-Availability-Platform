import { z } from "zod";
import {
  defaultSearchEndDate,
  defaultSearchStartDate,
} from "../../utils/utils.js";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

function emptyToUndefined(value: unknown): unknown {
  return value === undefined || value === null || value === "" ? undefined : value;
}

export const optionalTrimmedStringSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

export const defaultPartySizeQuerySchema = z.preprocess(
  (value) => emptyToUndefined(value) ?? 1,
  z.coerce.number().int().min(1).max(100),
);

export const defaultSearchStartDateSchema = z.preprocess(
  (value) => emptyToUndefined(value) ?? defaultSearchStartDate(),
  dateStringSchema,
);

export const defaultSearchEndDateSchema = z.preprocess(
  (value) => emptyToUndefined(value) ?? defaultSearchEndDate(),
  dateStringSchema,
);

export const optionalUuidSchema = z.preprocess(
  emptyToUndefined,
  z.uuid().optional(),
);
