import { Worker } from "bullmq";
import { logger } from "../lib/logger.js";
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
        logger.info("Expired stale reservations", { count });
      } else {
        logger.debug("Booking expiry job completed", { expired: 0 });
      }
    },
    { connection: redisConnection },
  );

  worker.on("failed", (job, err) => {
    logger.error("Booking expiry job failed", { jobId: job?.id, jobName: job?.name }, err);
  });

  return worker;
}

export async function stopBookingExpiryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
