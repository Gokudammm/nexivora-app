#!/usr/bin/env node
/**
 * Zero-install PostgreSQL for local development.
 *
 * ADR-021. The problem: ADR-003 requires real PostgreSQL in development,
 * because full-text search and `pg_trgm` duplicate detection are core product
 * features and stubbing them locally means the two most important queries are
 * first executed in production. But the standard ways of getting Postgres on a
 * Windows machine all have friction:
 *
 *   - The EDB installer needs UAC elevation and installs a system service.
 *   - Docker Desktop is a large install and needs virtualisation enabled.
 *   - `embedded-postgres` on npm is a reasonable wrapper, but every one of its
 *     releases is tagged `-beta`, and a permanently-beta dependency in the dev
 *     bootstrap is a risk we do not need to take.
 *
 * So this downloads the **official PostgreSQL binaries-only ZIP** — the same
 * build EDB ships, without the installer — unpacks it into a gitignored folder,
 * and runs it as an ordinary user process on a high port.
 *
 * The result is real PostgreSQL 16 with the real contrib extensions. Dev is
 * production, which is the whole point of ADR-003.
 *
 * Usage:
 *   npm run db:up       download if needed, init if needed, start, ensure db
 *   npm run db:down     stop
 *   npm run db:status   is it running, and what does it contain
 *   npm run db:destroy  stop and delete the data directory (not the binaries)
 */

import { spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");

/* Pinned deliberately. A dev database that silently changes major version
   between machines is exactly the class of problem ADR-003 exists to avoid. */
const PG_VERSION = "16.8-1";
const PG_MAJOR = "16";

const ROOT = join(APP, ".postgres");
const ZIP = join(ROOT, `postgresql-${PG_VERSION}-windows-x64-binaries.zip`);
const BIN_ROOT = join(ROOT, "pgsql");
const BIN = join(BIN_ROOT, "bin");
const DATA = join(ROOT, "data");
const LOG = join(ROOT, "postgres.log");
const PWFILE = join(ROOT, "pwfile");

const PORT = process.env.PGPORT ?? "5433"; // not 5432: never fight an existing install
const USER = "nexivora";
const PASSWORD = "nexivora";
const DB = "nexivora";

const DOWNLOAD_URL = `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip`;

const isWindows = process.platform === "win32";
const exe = (name) => join(BIN, isWindows ? `${name}.exe` : name);

function log(message) {
  console.log(`  ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
    env: { ...process.env, PGPASSWORD: PASSWORD, ...(options.env ?? {}) },
  });
  return result;
}

/* -------------------------------------------------------------- download */

async function ensureBinaries() {
  if (existsSync(exe("pg_ctl"))) return;

  if (!isWindows) {
    console.error(
      "\n  This bootstrap downloads Windows binaries. On macOS or Linux install\n" +
        "  PostgreSQL 16 with your package manager, or run the Docker one-liner in\n" +
        "  docs/DEPLOYMENT.md, then set DATABASE_URL and skip `npm run db:up`.\n",
    );
    process.exit(1);
  }

  mkdirSync(ROOT, { recursive: true });

  if (!existsSync(ZIP)) {
    log(`Downloading PostgreSQL ${PG_VERSION} binaries (~130 MB, once)…`);
    const response = await fetch(DOWNLOAD_URL, { redirect: "follow" });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: HTTP ${response.status} from ${DOWNLOAD_URL}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(ZIP));
    log("Downloaded.");
  }

  log("Extracting…");
  // Expand-Archive is built into Windows PowerShell; no extra tooling needed.
  const extract = run("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -Path '${ZIP}' -DestinationPath '${ROOT}' -Force`,
  ]);
  if (extract.status !== 0) {
    throw new Error(`Extract failed:\n${extract.stderr || extract.stdout}`);
  }

  if (!existsSync(exe("pg_ctl"))) {
    throw new Error(`Extracted, but ${exe("pg_ctl")} is missing. Check the archive layout.`);
  }
  log(`Binaries ready at ${BIN_ROOT}`);
}

/* ------------------------------------------------------------------ init */

function ensureCluster() {
  if (existsSync(join(DATA, "PG_VERSION"))) {
    const version = readFileSync(join(DATA, "PG_VERSION"), "utf8").trim();
    if (version !== PG_MAJOR) {
      throw new Error(
        `Existing data directory is PostgreSQL ${version}, expected ${PG_MAJOR}.\n` +
          `      Run \`npm run db:destroy\` to remove it and start again.`,
      );
    }
    return;
  }

  log("Initialising the cluster…");
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(PWFILE, PASSWORD, "utf8");

  const init = run(exe("initdb"), [
    "-D",
    DATA,
    "-U",
    USER,
    `--pwfile=${PWFILE}`,
    "-E",
    "UTF8",
    "--locale=C",
  ]);
  rmSync(PWFILE, { force: true });

  if (init.status !== 0) {
    throw new Error(`initdb failed:\n${init.stderr || init.stdout}`);
  }

  // Bind to localhost only. This is a development database on a developer's
  // machine; it has no business accepting connections from the network.
  const conf = join(DATA, "postgresql.conf");
  writeFileSync(
    conf,
    `${readFileSync(conf, "utf8")}\n# Nexivora dev defaults\nlisten_addresses = 'localhost'\nport = ${PORT}\n`,
    "utf8",
  );
  log("Cluster initialised.");
}

/* --------------------------------------------------------------- control */

function isRunning() {
  if (!existsSync(join(DATA, "PG_VERSION"))) return false;
  const status = run(exe("pg_ctl"), ["-D", DATA, "status"]);
  return status.status === 0;
}

async function start() {
  if (isRunning()) {
    log(`Already running on port ${PORT}.`);
    return;
  }
  log(`Starting on port ${PORT}…`);
  const started = run(exe("pg_ctl"), ["-D", DATA, "-l", LOG, "-o", `-p ${PORT}`, "-w", "start"]);
  if (started.status !== 0) {
    const tail = existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").slice(-15).join("\n") : "";
    throw new Error(`Start failed:\n${started.stderr || started.stdout}\n${tail}`);
  }

  if (!(await waitForDatabase("postgres", 45000))) {
    throw new Error(`PostgreSQL did not report ready on port ${PORT} after startup.`);
  }

  log("Running.");
}

function stop() {
  if (!isRunning()) {
    log("Not running.");
    return;
  }
  const stopped = run(exe("pg_ctl"), ["-D", DATA, "-m", "fast", "-w", "stop"]);
  if (stopped.status !== 0) throw new Error(`Stop failed:\n${stopped.stderr || stopped.stdout}`);
  log("Stopped.");
}

function psql(sql, database = "postgres") {
  return run(exe("psql"), ["-h", "localhost", "-p", PORT, "-U", USER, "-d", database, "-tAc", sql]);
}

async function waitForDatabase(database = "postgres", timeoutMs = 45000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const ready = run(exe("pg_isready"), [
      "-h",
      "localhost",
      "-p",
      PORT,
      "-U",
      USER,
      "-d",
      database,
    ]);

    if (ready.status === 0) return true;
    await delay(250);
  }

  return false;
}

/**
 * The database and its extensions.
 *
 * `pg_trgm` and `unaccent` are not optional decoration — they are what
 * duplicate-project detection and accent-insensitive search are built on
 * (ADR-003). If they are missing, Phase 3 has nothing to build against.
 */
async function ensureDatabase() {
  if (!(await waitForDatabase("postgres"))) {
    throw new Error(`PostgreSQL did not accept connections on port ${PORT} in time.`);
  }

  const exists = psql(`SELECT 1 FROM pg_database WHERE datname = '${DB}'`);
  if (exists.stdout.trim() !== "1") {
    log(`Creating database "${DB}"…`);
    const created = psql(`CREATE DATABASE ${DB}`);
    if (created.status !== 0) throw new Error(`CREATE DATABASE failed:\n${created.stderr}`);
  }

  if (!(await waitForDatabase(DB))) {
    throw new Error(`PostgreSQL did not accept connections for database "${DB}" in time.`);
  }

  for (const extension of ["pg_trgm", "unaccent", "citext"]) {
    const result = psql(`CREATE EXTENSION IF NOT EXISTS ${extension}`, DB);
    if (result.status !== 0) {
      throw new Error(`CREATE EXTENSION ${extension} failed:\n${result.stderr}`);
    }
  }
  log("Database and extensions ready (pg_trgm, unaccent, citext).");
}

function verify() {
  // Prove pg_trgm actually works rather than assuming the CREATE succeeded.
  const similarity = psql("SELECT similarity('nexivora', 'nexivore')", DB);
  const version = psql("SHOW server_version", DB);
  return {
    version: version.stdout.trim(),
    similarity: similarity.stdout.trim(),
    ok: similarity.status === 0 && Number(similarity.stdout.trim()) > 0,
  };
}

function connectionUrl() {
  return `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`;
}

/* ------------------------------------------------------------------ main */

const command = process.argv[2] ?? "up";
console.log("");

try {
  switch (command) {
    case "up": {
      await ensureBinaries();
      ensureCluster();
      await start();
      await ensureDatabase();
      const check = verify();
      if (!check.ok)
        throw new Error("pg_trgm is installed but similarity() did not return a value.");
      log(`PostgreSQL ${check.version} · similarity('nexivora','nexivore') = ${check.similarity}`);
      console.log(`\n  DATABASE_URL="${connectionUrl()}"\n`);
      break;
    }

    case "down":
      stop();
      break;

    case "status": {
      if (!existsSync(exe("pg_ctl"))) {
        log("Binaries not downloaded. Run `npm run db:up`.");
        break;
      }
      if (!isRunning()) {
        log("Not running. Run `npm run db:up`.");
        break;
      }
      const check = verify();
      log(`Running on port ${PORT} · PostgreSQL ${check.version}`);
      log(`pg_trgm: ${check.ok ? "working" : "NOT WORKING"}`);
      const tables = psql(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        DB,
      );
      log(`Tables in public schema: ${tables.stdout.trim()}`);
      console.log(`\n  DATABASE_URL="${connectionUrl()}"\n`);
      break;
    }

    case "destroy":
      stop();
      log("Removing the data directory (binaries are kept)…");
      rmSync(DATA, { recursive: true, force: true });
      log("Gone. `npm run db:up` will rebuild it.");
      break;

    default:
      console.error(`  Unknown command "${command}". Use: up | down | status | destroy\n`);
      process.exit(1);
  }
} catch (error) {
  console.error(`\n  ✖ ${error.message}\n`);
  process.exit(1);
}
