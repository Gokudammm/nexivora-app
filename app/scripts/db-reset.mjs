#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import "dotenv/config";

/**
 * Rebuild the development database from empty: drop, migrate, seed.
 *
 * Why this exists instead of `prisma migrate reset`:
 *
 *   · Prisma 7 gates that command behind an interactive consent prompt, so it
 *     cannot run unattended — correctly, since it destroys everything.
 *   · It drops and recreates the schema, which takes the extensions with it and
 *     then reinstalls them through the migration. Doing the drop ourselves
 *     keeps that explicit and visible.
 *
 * The guards below are the important part. This command is unrecoverable, so it
 * refuses to run anywhere it might not be a development database.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Run `npm run db:up` first.");
  process.exit(1);
}

/* ------------------------------------------------------------------ guards */

if (process.env.NODE_ENV === "production") {
  console.error("db:reset refuses to run with NODE_ENV=production.");
  process.exit(1);
}

const { hostname, port, pathname } = new URL(url);

if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  console.error(
    `db:reset refuses to run against a non-local host (${hostname}).\n` +
      "This destroys every row. If you genuinely mean to reset a remote database, do it by hand.",
  );
  process.exit(1);
}

const database = pathname.replace(/^\//, "");

/* -------------------------------------------------------------------- run */

const root = path.resolve(import.meta.dirname, "..");
const psql = path.join(
  root,
  ".postgres",
  "pgsql",
  "bin",
  process.platform === "win32" ? "psql.exe" : "psql",
);
const pgIsReady = path.join(
  root,
  ".postgres",
  "pgsql",
  "bin",
  process.platform === "win32" ? "pg_isready.exe" : "pg_isready",
);

async function waitForDatabase() {
  const started = Date.now();

  while (Date.now() - started < 45000) {
    const result = spawnSync(
      pgIsReady,
      ["-h", hostname, "-p", port || "5432", "-U", new URL(url).username, "-d", "postgres"],
      {
        cwd: root,
        stdio: "pipe",
        shell: false,
        env: { ...process.env, PGPASSWORD: new URL(url).password },
      },
    );

    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Database ${database} did not become ready at ${hostname}:${port} in time.`);
}

function run(label, command, args, options = {}) {
  process.stdout.write(`${label}\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    console.error(`\n${label} failed (exit ${result.status ?? "signal"}).`);
    process.exit(result.status ?? 1);
  }
}

// Dropping the schema takes the extensions with it; the search_infrastructure
// migration recreates them, which is exactly the path a fresh clone follows.
if (existsSync(psql) && existsSync(pgIsReady)) {
  await waitForDatabase();

  run(
    `Dropping schema "public" in ${database} at ${hostname}:${port}`,
    psql,
    [
      "-h",
      hostname,
      "-p",
      port || "5432",
      "-U",
      new URL(url).username,
      "-d",
      database,
      "-q",
      "-c",
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    ],
    { env: { ...process.env, PGPASSWORD: new URL(url).password } },
  );
} else {
  console.error(
    `psql was not found at ${psql}.\n` +
      "Run `npm run db:up` first, or drop and recreate the public schema by hand.",
  );
  process.exit(1);
}

// Invoke node against the CLI's JS entry rather than going through npm: on
// Windows, spawning `npm.cmd` without a shell fails outright, and spawning it
// *with* one is a needless shell in the middle of a destructive command. This
// also guarantees the pinned local Prisma runs rather than whatever `npx`
// would fetch from the registry (ADR-002).
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

run("Applying migrations", process.execPath, [prismaCli, "migrate", "deploy"]);
run("Seeding", process.execPath, [path.join(root, "prisma", "seed", "index.ts")]);
