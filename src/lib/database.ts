import { ServiceUnavailableError } from "../errors/index.js";
import { prisma } from "./prisma.js";

export async function assertDatabaseHealthy(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new ServiceUnavailableError("Database is not reachable", {
      database: "disconnected",
    });
  }
}
