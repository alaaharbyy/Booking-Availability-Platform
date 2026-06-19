import "dotenv/config";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";
import {
  closeBookingExpiryQueue,
  registerBookingExpiryScheduler,
} from "./queues/booking-expiry.queue.js";
import { closeRedisCacheClient } from "./lib/redis-cache.js";
import {
  startBookingExpiryWorker,
  stopBookingExpiryWorker,
} from "./workers/booking-expiry.worker.js";

logger.info("Starting application", {
  port: env.port,
  nodeEnv: process.env.NODE_ENV ?? "development",
});

const server = app.listen(env.port, () => {
  void (async () => {
    try {
      await registerBookingExpiryScheduler();
      startBookingExpiryWorker();
      logger.info("Server ready", {
        url: `http://localhost:${env.port}`,
        bookingExpiryPollIntervalMs: env.bookingExpiryPollIntervalMs,
        availabilityCacheTtlSeconds: env.availabilityCacheTtlSeconds,
      });
    } catch (err) {
      logger.error("Failed to start booking expiry worker", undefined, err);
      process.exit(1);
    }
  })();
});

async function shutdown(): Promise<void> {
  logger.info("Shutting down application");
  await stopBookingExpiryWorker();
  await closeBookingExpiryQueue();
  await closeRedisCacheClient();
  server.close(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
