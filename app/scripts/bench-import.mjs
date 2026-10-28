#!/usr/bin/env node
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import process from "node:process";
import { randomBytes } from "node:crypto";

import "dotenv/config";

import { autoMap, parseCsv } from "@/lib/import/csv";
import { IMPORT_FIELDS, planImport } from "@/lib/import/people";
import { hashPassword } from "@/lib/auth/password";

/**
 * IMPORT BENCHMARK — Phase 5 acceptance criterion 3.
 *
 * > A committed import of 500 rows completes in under 10 seconds.
 *
 * That is a number, so it is measured rather than assumed. The run creates 500
 * real users in one transaction against the real database, reports the timing,
 * and then **rolls the whole thing back** — a benchmark that leaves 500 people
 * in the demo college would be worse than no benchmark.
 *
 *   npm run bench:import
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `npm run db:up` first.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const ROWS = Number(process.argv[2] ?? 500);
const BUDGET_MS = 10_000;

const run = randomBytes(4).toString("hex");

/* ------------------------------------------------------------- the file */

const header = IMPORT_FIELDS.map((field) => field.label).join(",");
const lines = [header];

for (let i = 0; i < ROWS; i += 1) {
  lines.push(
    [
      `Bench Student ${i}`,
      "",
      `bench-${run}-${i}@bench.invalid`,
      `BENCH${run}${String(i).padStart(4, "0")}`,
      "Computer Science & Engineering",
      "B.Tech Computer Science & Engineering",
      String((i % 4) + 1),
      "Student",
    ].join(","),
  );
}

const csv = lines.join("\r\n");

/* ------------------------------------------------------------ the plan */

const parseStart = performance.now();
const parsed = parseCsv(csv);
const parseMs = performance.now() - parseStart;

const college = await db.college.findFirst({
  where: { slug: "nexivora-institute-of-technology" },
  select: { id: true },
});

if (!college) {
  console.error("Seed the database first: npm run db:reset");
  process.exit(1);
}

const existing = await db.membership.findMany({
  where: { collegeId: college.id },
  select: {
    userId: true,
    role: true,
    state: true,
    user: {
      select: { email: true, name: true, studentProfile: { select: { rollNumber: true } } },
    },
  },
});

const planStart = performance.now();
const plan = planImport(
  parsed.rows,
  autoMap(parsed.headers, IMPORT_FIELDS),
  existing.map((member) => ({
    userId: member.userId,
    email: member.user.email,
    name: member.user.name,
    rollNumber: member.user.studentProfile?.rollNumber ?? null,
    role: member.role,
    state: member.state,
  })),
);
const planMs = performance.now() - planStart;

/* ---------------------------------------------------------- the commit */

// One shared hash, as the real commit does: these accounts have no password
// until the invitee sets one, and hashing 500 times would dominate the budget
// with work that protects nothing.
const hashStart = performance.now();
const placeholderHash = await hashPassword(randomBytes(24).toString("base64url"));
const hashMs = performance.now() - hashStart;

let commitMs = 0;
let created = 0;

class Rollback extends Error {}

try {
  const start = performance.now();

  await db.$transaction(
    async (tx) => {
      for (const row of plan.rows) {
        if (row.outcome !== "create") continue;

        const user = await tx.user.create({
          data: {
            email: row.email,
            name: row.name,
            username: `bench-${run}-${created}`,
            passwordHash: placeholderHash,
            privacy: { create: {} },
          },
          select: { id: true },
        });

        await tx.membership.create({
          data: { userId: user.id, collegeId: college.id, role: "STUDENT", state: "INVITED" },
        });

        created += 1;
      }

      commitMs = performance.now() - start;

      // Everything above is real work against the real database; throwing here
      // rolls it back so the demo college is untouched.
      throw new Rollback();
    },
    { timeout: 60_000 },
  );
} catch (error) {
  if (!(error instanceof Rollback)) {
    console.error(error);
    process.exit(1);
  }
}

await db.$disconnect();

/* ------------------------------------------------------------- report */

const total = parseMs + planMs + hashMs + commitMs;
const pad = (value) => `${value.toFixed(0)}ms`.padStart(8);

console.log(`
  Import benchmark — ${ROWS} rows

  parse            ${pad(parseMs)}
  plan (dry run)   ${pad(planMs)}
  password hash    ${pad(hashMs)}   once, shared by every row
  commit           ${pad(commitMs)}   ${created} users + memberships, one transaction
  ${"".padStart(17)}${"".padStart(8, "-")}
  total            ${pad(total)}   budget ${BUDGET_MS}ms

  ${total < BUDGET_MS ? "PASS" : "FAIL"} — rolled back, nothing written
`);

process.exit(total < BUDGET_MS ? 0 : 1);
