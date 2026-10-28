import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * The Prisma singleton.
 *
 * Next's dev server re-evaluates modules on every hot reload. Without the
 * global cache below, each reload constructs a new PrismaClient, each opens its
 * own pool, and after twenty saves the database refuses connections — a failure
 * that looks like a database problem and is actually a module-lifetime problem.
 *
 * Prisma 7 requires a driver adapter: the datasource URL is no longer read from
 * schema.prisma (ADR-002). The CLI gets it from prisma.config.ts, the runtime
 * gets it from here, and both read the same validated `env`.
 */

const createClient = () => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    // Queries are noisy and rarely what you want; warnings and errors always are.
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

type Client = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: Client };

export const db: Client = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
