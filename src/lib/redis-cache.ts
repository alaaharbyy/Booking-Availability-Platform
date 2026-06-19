import Redis from "ioredis";
import { env } from "../config/env.js";

let client: Redis | null = null;

export function getRedisCacheClient(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  }

  return client;
}

export async function closeRedisCacheClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
