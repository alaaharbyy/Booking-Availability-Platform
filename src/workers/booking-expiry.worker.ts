import { Worker } from "bullmq";
import { expireStaleReservations } from "../services/booking.service.js";
import {
  BOOKING_EXPIRY_QUEUE,
  BOOKING_EXPIRY_JOB_NAME,
} from "../queues/booking-expiry.queue.js";
import { redisConnection } from "../lib/redis.js";

let worker: Worker | null = null;

export function startBookingExpiryWorker(): Worker {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    BOOKING_EXPIRY_QUEUE,
    async (job) => {
      if (job.name !== BOOKING_EXPIRY_JOB_NAME) {
        return;
      }

      const count = await expireStaleReservations();
      if (count > 0) {
        console.log(`Expired ${count} stale reservation(s)`);
      }
    },
    { connection: redisConnection },
  );

  worker.on("failed", (job, err) => {
    console.error(`Booking expiry job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function stopBookingExpiryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
