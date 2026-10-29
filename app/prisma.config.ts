import "dotenv/config";
import { defineConfig } from "prisma/config";

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();

if (process.env.VERCEL === "1" && !directDatabaseUrl) {
  throw new Error(
    "DIRECT_DATABASE_URL is required on Vercel for Prisma migrations. " +
      "Set it to your provider's direct (unpooled) PostgreSQL connection string.",
  );
}

/**
 * Prisma 7 configuration.
 *
 * **Prisma 7 moved the datasource URL out of `schema.prisma`** (ADR-002 predicted
 * exactly this). Runtime traffic and migrations can use different PostgreSQL
 * URLs, and conflating them can break migrations through a transaction pooler:
 *
 *   - **Here**, for the CLI — prefer `DIRECT_DATABASE_URL`, falling back to
 *     `DATABASE_URL` for local development.
 *   - **In a driver adapter**, `DATABASE_URL` is used for runtime queries —
 *     see `src/lib/db/client.ts`.
 *
 * `schema.prisma` now declares only the provider.
 *
 * Migrations deliberately run as a different, more privileged database user
 * than the application (docs/SECURITY.md §9).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed/index.ts",
  },
  datasource: {
    url: directDatabaseUrl || process.env.DATABASE_URL,
  },
});
