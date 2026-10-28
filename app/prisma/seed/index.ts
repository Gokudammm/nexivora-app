import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { seedActivity } from "./activity.ts";
import { seedEvaluation } from "./evaluation.ts";
import { seedFacultyDesk } from "./faculty.ts";
import { seedEnrolment, seedGroups } from "./groups.ts";
import { seedHierarchy } from "./hierarchy.ts";
import { seedIdeas } from "./ideas.ts";
import { DEMO_PASSWORD, SEED, makeRng } from "./lib.ts";
import { seedNetwork } from "./network.ts";
import { seedPeople } from "./people.ts";
import { seedProjects } from "./projects.ts";
import { seedTaxonomy } from "./taxonomy.ts";
import { seedWorkspace } from "./workspace.ts";

/**
 * The demo world.
 *
 * Order matters and is not negotiable: taxonomy before content that tags it,
 * hierarchy before people who belong to it, groups before the projects they
 * own, projects before the workspace that produces their ledger, and the feed
 * last because every post is derived from something that already exists.
 *
 * Run with `npm run db:seed`, or `npm run db:reset` to rebuild from empty.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Run `npm run db:up` first.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const started = Date.now();
  console.log("\nSeeding Nexivora demo world\n");

  // One stream for the whole run, so the output is byte-identical every time.
  const rng = makeRng(SEED);

  await seedTaxonomy(db);
  const hierarchy = await seedHierarchy(db);
  const cast = await seedPeople(db, rng);
  const groups = await seedGroups(db, rng, cast, hierarchy);
  await seedEnrolment(db, rng, cast, hierarchy);
  const projectIndex = await seedProjects(db, rng, cast);
  await seedWorkspace(db, rng, groups, projectIndex);
  await seedEvaluation(db, rng, cast, groups, projectIndex);
  await seedFacultyDesk(db, cast);
  await seedIdeas(db, rng, cast);
  await seedNetwork(db, rng, cast);
  await seedActivity(db, rng, cast, groups, projectIndex);

  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  console.log(
    `\nSeeded in ${elapsed}s. Sign in as any seeded user with the password: ${DEMO_PASSWORD}\n`,
  );
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
