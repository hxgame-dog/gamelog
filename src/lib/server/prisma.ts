import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var __telemetryPrisma__: PrismaClient | undefined;
  var __telemetryPrismaAdapter__: PrismaPg | undefined;
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrismaClient() {
  if (!hasDatabaseUrl()) {
    return null;
  }

  if (!global.__telemetryPrisma__) {
    global.__telemetryPrismaAdapter__ =
      global.__telemetryPrismaAdapter__ ?? new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    global.__telemetryPrisma__ = new PrismaClient({
      adapter: global.__telemetryPrismaAdapter__
    });
  }

  return global.__telemetryPrisma__;
}
