import { z } from "zod";

export const createBookingBodySchema = z.object({
  slot_id: z.uuid(),
  party_size: z.coerce.number().int().min(1),
});

export const cancelBookingBodySchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required"),
});

export const bookingRefParamsSchema = z.object({
  ref: z.string().trim().min(1),
});

export type CreateBookingBody = z.infer<typeof createBookingBodySchema>;
export type CancelBookingBody = z.infer<typeof cancelBookingBodySchema>;
export type BookingRefParams = z.infer<typeof bookingRefParamsSchema>;
