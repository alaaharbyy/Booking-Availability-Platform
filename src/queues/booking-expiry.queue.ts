import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../lib/redis.js";

export const BOOKING_EXPIRY_QUEUE = "booking-expiry";
export const BOOKING_EXPIRY_SCHEDULER_ID = "expire-stale-reservations";
export const BOOKING_EXPIRY_JOB_NAME = "expire-stale";

export const bookingExpiryQueue = new Queue(BOOKING_EXPIRY_QUEUE, {
  connection: redisConnection,
});

export async function registerBookingExpiryScheduler(): Promise<void> {
  await bookingExpiryQueue.upsertJobScheduler(
    BOOKING_EXPIRY_SCHEDULER_ID,
    { every: env.bookingExpiryPollIntervalMs },
    { name: BOOKING_EXPIRY_JOB_NAME, data: {} },
  );
}

export async function closeBookingExpiryQueue(): Promise<void> {
  await bookingExpiryQueue.close();
}
