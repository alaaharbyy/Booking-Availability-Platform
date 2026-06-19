import "dotenv/config";
import { env } from "./config/env.js";
import { app } from "./app.js";
import {
  closeBookingExpiryQueue,
  registerBookingExpiryScheduler,
} from "./queues/booking-expiry.queue.js";
import { closeRedisCacheClient } from "./lib/redis-cache.js";
import {
  startBookingExpiryWorker,
  stopBookingExpiryWorker,
} from "./workers/booking-expiry.worker.js";

const server = app.listen(env.port, () => {
  void (async () => {
    try {
      await registerBookingExpiryScheduler();
      startBookingExpiryWorker();
      console.log(`Server listening on http://localhost:${env.port}`);
    } catch (err) {
      console.error("Failed to start booking expiry worker:", err);
      process.exit(1);
    }
  })();
});

async function shutdown(): Promise<void> {
  await stopBookingExpiryWorker();
  await closeBookingExpiryQueue();
  await closeRedisCacheClient();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
