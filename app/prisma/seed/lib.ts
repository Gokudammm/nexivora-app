import { createHash, scryptSync, randomBytes } from "node:crypto";

import type { $Enums } from "@prisma/client";

import type { ProofTier, ProjectStatus as ContentStatus } from "../../src/content/types.ts";

/**
 * Seed utilities.
 *
 * Two rules govern everything in `prisma/seed/`:
 *
 *  1. **It is deterministic.** Every random choice comes from the PRNG below,
 *     seeded with a constant. `npm run db:reset` twice produces byte-identical
 *     data. A demo that looks different every time is a demo you cannot write
 *     documentation, tests or a screenshot against.
 *
 *  2. **It does not duplicate `src/content/`.** The Phase 2 fixtures are the
 *     contract; the seed imports them. Where the seed invents data it is data
 *     the public site never renders — cohort filler, workspace activity, the
 *     ledger. If a fact appears on a public page, it comes from `src/content/`.
 */

/* -------------------------------------------------------------------- rng */

/**
 * mulberry32. Small, fast, and — the only property that matters here —
 * reproducible across machines and Node versions, which `Math.random()` is not.
 */
export function makeRng(seed: number) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  const pick = <T>(items: readonly T[]): T => {
    const value = items[Math.floor(next() * items.length)];
    if (value === undefined) throw new Error("pick() from an empty list");
    return value;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const a = out[i];
      const b = out[j];
      if (a !== undefined && b !== undefined) {
        out[i] = b;
        out[j] = a;
      }
    }
    return out;
  };

  const sample = <T>(items: readonly T[], count: number): T[] =>
    shuffle(items).slice(0, Math.min(count, items.length));

  /** True with probability `p`. Named for how it reads at the call site. */
  const chance = (p: number) => next() < p;

  const dateBetween = (from: Date, to: Date) =>
    new Date(from.getTime() + next() * (to.getTime() - from.getTime()));

  return { next, int, pick, shuffle, sample, chance, dateBetween };
}

export type Rng = ReturnType<typeof makeRng>;

/** One seed for the whole run, so every module draws from the same stream. */
export const SEED = 20260909;

/* ------------------------------------------------------------------- ids */

/**
 * Deterministic ids.
 *
 * Prisma's `cuid(2)` default is random, which would make every reset produce
 * different primary keys — fine for the app, useless for a seed whose rows have
 * to reference each other across modules without threading return values
 * through every function. A stable hash of a natural key gives us both.
 *
 * These are only ever generated here. Application code always uses the schema
 * default.
 */
export function seedId(kind: string, ...parts: (string | number)[]): string {
  const digest = createHash("sha256")
    .update(`${kind}:${parts.join(":")}`)
    .digest("base64url");
  // cuid2 shape: a leading letter then lowercase alphanumerics.
  return `s${digest
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 23)}`;
}

/* -------------------------------------------------------------- passwords */

/**
 * The demo password, hashed with scrypt from `node:crypto` — no dependency, and
 * a real KDF rather than a placeholder, so the seeded accounts can actually be
 * signed into once Phase 4 lands.
 *
 * Format: `scrypt$N$salt$hash`, all base64url. Phase 4 must either verify this
 * scheme or re-seed; it is recorded in the phase summary as a hand-off note.
 *
 * The password is public on purpose. These are demo accounts in a local
 * database with no real data — pretending otherwise would just mean nobody can
 * open the demo.
 */
export const DEMO_PASSWORD = "nexivora-demo";

const SCRYPT_COST = 16384;

export function hashPassword(password: string, salt?: Buffer): string {
  const useSalt = salt ?? randomBytes(16);
  const derived = scryptSync(password, useSalt, 32, { N: SCRYPT_COST, r: 8, p: 1 });
  return `scrypt$${SCRYPT_COST}$${useSalt.toString("base64url")}$${derived.toString("base64url")}`;
}

/**
 * Hashed once and reused for every seeded account. scrypt is deliberately slow
 * — hashing it ~90 times would add seconds to a reset that has a 20-second
 * budget, and there is no threat model under which the demo accounts need
 * distinct salts.
 */
export const DEMO_PASSWORD_HASH = hashPassword(
  DEMO_PASSWORD,
  Buffer.from("nexivora-demo-seed-salt-01", "utf8").subarray(0, 16),
);

/* ------------------------------------------------------------- enum maps */

/**
 * The fixtures use the vocabulary the public site reads in; the database uses
 * the vocabulary the domain model needs. These are the only two places that
 * translation happens, so a mismatch is a compile error rather than a subtly
 * wrong row.
 */
export const PROJECT_STATUS: Record<ContentStatus, $Enums.ProjectStatus> = {
  draft: "DRAFT",
  proposed: "PROPOSED",
  approved: "APPROVED",
  progress: "IN_PROGRESS",
  review: "UNDER_REVIEW",
  completed: "COMPLETED",
  archived: "ARCHIVED",
};

export const PROOF_TIER: Record<ProofTier, $Enums.ProofTier> = {
  self: "SELF",
  evidenced: "WORKSPACE_EVIDENCED",
  attested: "FACULTY_ATTESTED",
};

export const OPPORTUNITY_TYPE: Record<string, $Enums.OpportunityType> = {
  internship: "INTERNSHIP",
  job: "JOB",
  research: "RESEARCH",
  hackathon: "HACKATHON",
};

/* ---------------------------------------------------------------- timing */

export function iso(date: string): Date {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Seed: unparseable date "${date}"`);
  return parsed;
}

export function daysAfter(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/* ----------------------------------------------------------------- report */

const started = Date.now();

export function step(label: string, count?: number): void {
  const elapsed = `${((Date.now() - started) / 1000).toFixed(2)}s`.padStart(7);
  const suffix = count === undefined ? "" : ` (${count})`;
  console.log(`  ${elapsed}  ${label}${suffix}`);
}
