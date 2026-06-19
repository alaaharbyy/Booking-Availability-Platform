import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { getRedisCacheClient } from "./redis-cache.js";

const PREFIX = "avail";

function queryHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function searchCacheKey(tenantId: string, query: unknown): string {
  return `${PREFIX}:${tenantId}:search:${queryHash(query)}`;
}

function detailCacheKey(
  tenantId: string,
  experienceId: string,
  query: unknown,
): string {
  return `${PREFIX}:${tenantId}:detail:${experienceId}:${queryHash(query)}`;
}

export async function getCachedSearch<T>(
  tenantId: string,
  query: unknown,
): Promise<T | null> {
  const raw = await getRedisCacheClient().get(searchCacheKey(tenantId, query));
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as T;
}

export async function setCachedSearch(
  tenantId: string,
  query: unknown,
  result: unknown,
): Promise<void> {
  await getRedisCacheClient().set(
    searchCacheKey(tenantId, query),
    JSON.stringify(result),
    "EX",
    env.availabilityCacheTtlSeconds,
  );
}

export async function getCachedDetail<T>(
  tenantId: string,
  experienceId: string,
  query: unknown,
): Promise<T | null> {
  const raw = await getRedisCacheClient().get(
    detailCacheKey(tenantId, experienceId, query),
  );
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as T;
}

export async function setCachedDetail(
  tenantId: string,
  experienceId: string,
  query: unknown,
  result: unknown,
): Promise<void> {
  await getRedisCacheClient().set(
    detailCacheKey(tenantId, experienceId, query),
    JSON.stringify(result),
    "EX",
    env.availabilityCacheTtlSeconds,
  );
}

/** Deletes all availability cache keys for a tenant (`avail:{tenantId}:*`). */
export async function invalidateTenantAvailability(
  tenantId: string,
): Promise<void> {
  const redis = getRedisCacheClient();
  const pattern = `${PREFIX}:${tenantId}:*`;
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

export function enqueueAvailabilityInvalidation(tenantId: string): void {
  void invalidateTenantAvailability(tenantId).catch((err) => {
    console.error(
      `Availability cache invalidation failed for tenant ${tenantId}:`,
      err,
    );
  });
}
