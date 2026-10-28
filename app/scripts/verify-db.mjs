#!/usr/bin/env node
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import process from "node:process";

import "dotenv/config";

import { DUPLICATE_THRESHOLD, RELATED_THRESHOLD } from "@/config/search";
import { projects as allProjects } from "@/content/projects";
import { publicProjects } from "@/content/index";
import { publicProjectSlugs } from "@/lib/db/queries/projects";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { scoreSimilarity } from "@/lib/search/similarity";

/**
 * DATABASE INTEGRITY SUITE.
 *
 * Every assertion here corresponds to a rule the product depends on. Several
 * are also enforced by check constraints — those are asserted anyway, because
 * a constraint that was never observed to fire is a constraint you do not
 * actually know is there.
 *
 * Two of these (the FTS ranking and the duplicate detector) are behavioural
 * rather than structural: they assert that the search infrastructure produces
 * the right answer, not merely that its columns are populated. Those are the
 * ones most likely to break silently, so they are the ones worth running.
 *
 *   npm run db:verify
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `npm run db:up` first.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/* ---------------------------------------------------------------- harness */

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const one = async (sql) => {
  const rows = await db.$queryRawUnsafe(sql);
  return Number(rows[0]?.count ?? 0);
};

/* --------------------------------------------------------------- structure */

await check("Every Post has exactly one anchor", async () => {
  const bad = await one(`
    SELECT count(*) AS count FROM "Post"
     WHERE (("projectId" IS NOT NULL)::int + ("ideaId" IS NOT NULL)::int
          + ("questionId" IS NOT NULL)::int + ("resourceId" IS NOT NULL)::int) <> 1
  `);
  assert(bad === 0, `${bad} posts violate the single-anchor rule (ADR-006)`);

  const total = await one(`SELECT count(*) AS count FROM "Post"`);
  return `${total} posts`;
});

await check("Every Post is generated, not hand-written", async () => {
  const authored = await one(`SELECT count(*) AS count FROM "Post" WHERE "source" <> 'GENERATED'`);
  assert(
    authored === 0,
    `${authored} posts were written directly rather than derived from an event`,
  );
  return "the feed is entirely derived from activity";
});

await check("No public project was published without approval", async () => {
  const bad = await one(`
    SELECT count(*) AS count FROM "Project"
     WHERE "visibility" = 'PUBLIC' AND "approved" = false
  `);
  assert(bad === 0, `${bad} public projects were never approved (ADR-010)`);

  const published = await one(
    `SELECT count(*) AS count FROM "Project" WHERE "visibility" = 'PUBLIC'`,
  );
  return `${published} public projects, all approved`;
});

await check("No approved project is missing its approval timestamp", async () => {
  const bad = await one(
    `SELECT count(*) AS count FROM "Project" WHERE "approved" = true AND "approvedAt" IS NULL`,
  );
  assert(bad === 0, `${bad} approved projects have no approvedAt`);
});

await check("Every LedgerEvent points at an action that exists", async () => {
  // The ledger's entire claim is that it records what happened. An event with
  // no corresponding row is a number nobody can audit.
  const orphans = await db.$queryRawUnsafe(`
    SELECT l."subjectType", count(*) AS count
      FROM "LedgerEvent" l
     WHERE NOT EXISTS (
       SELECT 1 FROM "Task"        t WHERE l."subjectType" = 'Task'        AND t."id" = l."subjectId"
       UNION ALL
       SELECT 1 FROM "FileAsset"   f WHERE l."subjectType" = 'FileAsset'   AND f."id" = l."subjectId"
       UNION ALL
       SELECT 1 FROM "FileVersion" v WHERE l."subjectType" = 'FileVersion' AND v."id" = l."subjectId"
       UNION ALL
       SELECT 1 FROM "Thread"      h WHERE l."subjectType" = 'Thread'      AND h."id" = l."subjectId"
       UNION ALL
       SELECT 1 FROM "Message"     m WHERE l."subjectType" = 'Message'     AND m."id" = l."subjectId"
       UNION ALL
       SELECT 1 FROM "Meeting"     g WHERE l."subjectType" = 'Meeting'     AND g."id" = l."subjectId"
     )
     GROUP BY l."subjectType"
  `);

  assert(
    orphans.length === 0,
    `orphaned ledger events: ${orphans.map((row) => `${row.subjectType}×${row.count}`).join(", ")}`,
  );

  const total = await one(`SELECT count(*) AS count FROM "LedgerEvent"`);
  return `${total} events, all traceable`;
});

await check("Every ledger event was written by a member of that group", async () => {
  const bad = await one(`
    SELECT count(*) AS count FROM "LedgerEvent" l
     WHERE NOT EXISTS (
       SELECT 1 FROM "GroupMember" m
        WHERE m."groupId" = l."groupId" AND m."userId" = l."userId")
  `);
  assert(bad === 0, `${bad} ledger events credit a non-member`);
});

await check("No project sits outside its own college's hierarchy", async () => {
  const badTerm = await one(`
    SELECT count(*) AS count FROM "Project" p
      JOIN "Term" t ON t."id" = p."termId"
     WHERE t."collegeId" <> p."collegeId"
  `);
  assert(badTerm === 0, `${badTerm} projects reference another college's term`);

  const badGroup = await one(`
    SELECT count(*) AS count FROM "Project" p
      JOIN "Group" g ON g."id" = p."groupId"
     WHERE g."collegeId" <> p."collegeId"
  `);
  assert(badGroup === 0, `${badGroup} projects are owned by another college's group`);
});

await check("Every group member has a membership at that group's college", async () => {
  // The isolation rule. Every authorisation question in the product reduces to
  // "is this user a member of this college", so a group member without one
  // would be a hole each of those checks has to special-case.
  const bad = await one(`
    SELECT count(*) AS count
      FROM "GroupMember" gm
      JOIN "Group" g ON g."id" = gm."groupId"
     WHERE NOT EXISTS (
       SELECT 1 FROM "Membership" m
        WHERE m."userId" = gm."userId" AND m."collegeId" = g."collegeId")
  `);
  assert(bad === 0, `${bad} group members are not members of that group's college`);
});

await check("Every cross-college member is a guest under a real partnership", async () => {
  // The previous assertion only proves a membership exists. This one proves it
  // is the RIGHT kind: someone working outside their home college must hold a
  // GUEST membership, and the two colleges must have an accepted partnership.
  // Without this, "add a membership" would be an unremarked way around
  // isolation rather than a deliberate, auditable exception.
  const notGuests = await db.$queryRawUnsafe(`
    SELECT u."username", c."slug" AS host
      FROM "Membership" host_m
      JOIN "User" u ON u."id" = host_m."userId"
      JOIN "College" c ON c."id" = host_m."collegeId"
     WHERE host_m."state" <> 'GUEST'
       AND EXISTS (
         SELECT 1 FROM "Membership" home
          WHERE home."userId" = host_m."userId"
            AND home."collegeId" <> host_m."collegeId"
            AND home."state" <> 'GUEST')
  `);

  assert(
    notGuests.length === 0,
    `holding full membership at two colleges: ${notGuests.map((r) => `${r.username}@${r.host}`).join(", ")}`,
  );

  const unpartnered = await db.$queryRawUnsafe(`
    SELECT u."username", host."slug" AS host, home."slug" AS home
      FROM "Membership" gm
      JOIN "User" u ON u."id" = gm."userId"
      JOIN "College" host ON host."id" = gm."collegeId"
      JOIN "Membership" hm ON hm."userId" = gm."userId" AND hm."state" <> 'GUEST'
      JOIN "College" home ON home."id" = hm."collegeId"
     WHERE gm."state" = 'GUEST'
       AND NOT EXISTS (
         SELECT 1 FROM "CollegePartnership" p
          WHERE p."state" = 'ACCEPTED'
            AND ((p."aId" = gm."collegeId" AND p."bId" = hm."collegeId")
              OR (p."bId" = gm."collegeId" AND p."aId" = hm."collegeId")))
  `);

  assert(
    unpartnered.length === 0,
    `guests without a partnership: ${unpartnered.map((r) => `${r.username} ${r.home}→${r.host}`).join(", ")}`,
  );

  const guests = await one(`SELECT count(*) AS count FROM "Membership" WHERE "state" = 'GUEST'`);
  return `${guests} guest memberships, all under an accepted partnership`;
});

await check("Every class sits in its own college's term and subject", async () => {
  const bad = await one(`
    SELECT count(*) AS count FROM "Class" c
      JOIN "Term" t ON t."id" = c."termId"
      JOIN "Subject" s ON s."id" = c."subjectId"
     WHERE t."collegeId" <> c."collegeId" OR s."collegeId" <> c."collegeId"
  `);
  assert(bad === 0, `${bad} classes cross a college boundary`);
});

await check("Every Follow target resolves", async () => {
  // Follow carries no foreign key — targetId points into five tables depending
  // on targetType. This is the assertion that replaces the constraint we
  // deliberately could not write.
  const bad = await db.$queryRawUnsafe(`
    SELECT f."targetType", count(*) AS count FROM "Follow" f
     WHERE (f."targetType" = 'USER'    AND NOT EXISTS (SELECT 1 FROM "User"    u WHERE u."id" = f."targetId"))
        OR (f."targetType" = 'PROJECT' AND NOT EXISTS (SELECT 1 FROM "Project" p WHERE p."id" = f."targetId"))
        OR (f."targetType" = 'TOPIC'   AND NOT EXISTS (SELECT 1 FROM "Topic"   t WHERE t."id" = f."targetId"))
        OR (f."targetType" = 'COLLEGE' AND NOT EXISTS (SELECT 1 FROM "College" c WHERE c."id" = f."targetId"))
        OR (f."targetType" = 'GROUP'   AND NOT EXISTS (SELECT 1 FROM "Group"   g WHERE g."id" = f."targetId"))
     GROUP BY f."targetType"
  `);

  assert(
    bad.length === 0,
    `dangling follows: ${bad.map((r) => `${r.targetType}×${r.count}`).join(", ")}`,
  );

  const total = await one(`SELECT count(*) AS count FROM "Follow"`);
  return `${total} follows, all resolving`;
});

await check("Every FACULTY_ATTESTED contribution has an attestation", async () => {
  // The top proof tier exists only because a named human signed it. A tier
  // without a signature is exactly the quiet inflation the model prevents.
  const bad = await one(`
    SELECT count(*) AS count FROM "ProjectMember" pm
     WHERE pm."tier" = 'FACULTY_ATTESTED'
       AND NOT EXISTS (
         SELECT 1 FROM "Attestation" a
          WHERE a."subjectType" = 'ProjectMember' AND a."subjectId" = pm."id")
  `);
  assert(bad === 0, `${bad} attested contributions have no attestation behind them`);
});

await check("Post counters match the rows behind them", async () => {
  const bad = await one(`
    SELECT count(*) AS count FROM "Post" p
     WHERE p."reactionCount" <> (SELECT count(*) FROM "Reaction" r WHERE r."postId" = p."id")
        OR p."commentCount"  <> (SELECT count(*) FROM "Comment"  c WHERE c."postId" = p."id")
        OR p."saveCount"     <> (SELECT count(*) FROM "Save"     s WHERE s."postId" = p."id")
  `);
  assert(bad === 0, `${bad} posts have a denormalised counter that disagrees with its rows`);
});

await check("Rubric criterion weights sum to 100", async () => {
  const bad = await db.$queryRawUnsafe(`
    SELECT r."name", sum(c."weight") AS total
      FROM "Rubric" r JOIN "RubricCriterion" c ON c."rubricId" = r."id"
     GROUP BY r."id", r."name" HAVING sum(c."weight") <> 100
  `);
  assert(
    bad.length === 0,
    `rubrics not summing to 100: ${bad.map((r) => `${r.name}=${r.total}`).join(", ")}`,
  );
});

await check("Every project SDG set has exactly one primary goal", async () => {
  const bad = await one(`
    SELECT count(*) AS count FROM (
      SELECT "projectId" FROM "ProjectSdg" GROUP BY "projectId"
       HAVING count(*) FILTER (WHERE "primary") <> 1
    ) x
  `);
  assert(bad === 0, `${bad} projects do not have exactly one primary SDG`);
});

await check("The lineage graph is acyclic", async () => {
  // A cycle makes the lineage tree infinite and every ancestor walk hang.
  const cycles = await db.$queryRawUnsafe(`
    WITH RECURSIVE walk("startId", "currentId", depth) AS (
      SELECT "childId", "parentId", 1 FROM "ProjectLineage"
      UNION ALL
      SELECT w."startId", l."parentId", w.depth + 1
        FROM walk w JOIN "ProjectLineage" l ON l."childId" = w."currentId"
       WHERE w.depth < 25
    )
    SELECT DISTINCT "startId" FROM walk WHERE "startId" = "currentId"
  `);
  assert(cycles.length === 0, `${cycles.length} lineage cycles found`);

  const depth = await db.$queryRawUnsafe(`
    WITH RECURSIVE walk("startId", "currentId", depth) AS (
      SELECT "childId", "parentId", 1 FROM "ProjectLineage"
      UNION ALL
      SELECT w."startId", l."parentId", w.depth + 1
        FROM walk w JOIN "ProjectLineage" l ON l."childId" = w."currentId"
       WHERE w.depth < 25
    )
    SELECT max(depth) AS max FROM walk
  `);

  const deepest = Number(depth[0]?.max ?? 0);
  // The demo needs a real chain, not a single link, or the lineage tree is a
  // feature nobody can see working.
  assert(
    deepest >= 2,
    `deepest lineage chain is ${deepest}; the demo needs at least a three-level chain`,
  );
  return `deepest chain: ${deepest + 1} levels`;
});

/* ----------------------------------------------------------------- search */

await check("Every search vector is populated", async () => {
  for (const table of ["Project", "Idea", "Post", "User", "Resource"]) {
    const missing = await one(
      `SELECT count(*) AS count FROM "${table}" WHERE "searchVector" IS NULL`,
    );
    assert(
      missing === 0,
      `${missing} rows in "${table}" have no search vector — check the trigger`,
    );
  }
  return "Project, Idea, Post, User, Resource";
});

await check("Every project has a normalised problem statement", async () => {
  const missing = await one(`
    SELECT count(*) AS count FROM "Project"
     WHERE "problemNormalised" IS NULL OR "problemNormalised" = ''
  `);
  assert(missing === 0, `${missing} projects have no normalised problem statement`);
});

await check("The FTS trigger reacts to an edit", async () => {
  // A trigger that fires on insert but not on update is the classic FTS bug:
  // search silently serves stale content and nobody notices for months.
  const [project] = await db.$queryRawUnsafe(
    `SELECT "id", "title" FROM "Project" ORDER BY "slug" LIMIT 1`,
  );
  const probe = "zzqqxx-fts-probe-token";

  await db.$executeRawUnsafe(
    `UPDATE "Project" SET "title" = $1 WHERE "id" = $2`,
    `${project.title} ${probe}`,
    project.id,
  );

  const found = await one(
    `SELECT count(*) AS count FROM "Project" WHERE "searchVector" @@ to_tsquery('english', 'zzqqxx')`,
  );

  await db.$executeRawUnsafe(
    `UPDATE "Project" SET "title" = $1 WHERE "id" = $2`,
    project.title,
    project.id,
  );

  assert(found === 1, "editing a project title did not update its search vector");
  return "title edit propagates";
});

await check("A section edit updates the parent project's vector", async () => {
  // The section trigger is separate from the project trigger, and this is the
  // only thing that proves the second one is wired up.
  const [section] = await db.$queryRawUnsafe(`
    SELECT s."id", s."body", s."projectId" FROM "ProjectSection" s
     WHERE s."kind" = 'METHODOLOGY' AND length(s."body") > 0
     ORDER BY s."id" LIMIT 1
  `);

  await db.$executeRawUnsafe(
    `UPDATE "ProjectSection" SET "body" = $1 WHERE "id" = $2`,
    `${section.body} wwvvuu-section-probe`,
    section.id,
  );

  const found = await one(`
    SELECT count(*) AS count FROM "Project"
     WHERE "id" = '${section.projectId}'
       AND "searchVector" @@ to_tsquery('english', 'wwvvuu')
  `);

  await db.$executeRawUnsafe(
    `UPDATE "ProjectSection" SET "body" = $1 WHERE "id" = $2`,
    section.body,
    section.id,
  );

  assert(found === 1, "editing a section did not update the parent project's search vector");
  return "section edit propagates to the project";
});

await check("Weighting ranks a title match above a body-only match", async () => {
  // Acceptance criterion 3: a term appearing only in a methodology section must
  // still match, but must rank below one where it appears in the title.
  const rows = await db.$queryRawUnsafe(`
    SELECT "slug", ts_rank_cd("searchVector", to_tsquery('english', 'irrigation')) AS rank,
           ("title" ILIKE '%irrigation%') AS in_title
      FROM "Project"
     WHERE "searchVector" @@ to_tsquery('english', 'irrigation')
     ORDER BY rank DESC
  `);

  assert(rows.length >= 2, `expected several irrigation matches, got ${rows.length}`);

  const firstBodyOnly = rows.findIndex((row) => !row.in_title);
  const lastTitled = rows.map((row) => row.in_title).lastIndexOf(true);

  assert(firstBodyOnly !== -1, "no body-only match found — the D weight may not be indexed");
  assert(
    lastTitled < firstBodyOnly,
    "a body-only match outranked a title match; the A/B/C/D weighting is not being applied",
  );

  return `${rows.length} matches, title matches ranked first`;
});

/* ------------------------------------------------- the Phase 2 → 5 contract */

await check("The query layer returns exactly what the fixtures do", async () => {
  // Phase 5 swaps every public page from `@/content/*` to `@/lib/db/queries/*`
  // and no rendered page may change. This is the assertion that makes that a
  // fact rather than a hope: the same visibility predicate, applied to the
  // database and to the fixtures, must select the same projects.
  //
  // If this fails, Phase 5 would have silently published or hidden student work.
  const fromDb = await publicProjectSlugs(ANONYMOUS);
  const fromFixtures = publicProjects()
    .map((project) => project.slug)
    .sort();

  const missing = fromFixtures.filter((slug) => !fromDb.includes(slug));
  const extra = fromDb.filter((slug) => !fromFixtures.includes(slug));

  assert(
    missing.length === 0 && extra.length === 0,
    `public project sets differ — missing from db: [${missing.join(", ")}], ` +
      `present in db but not public in fixtures: [${extra.join(", ")}]`,
  );

  return `${fromDb.length} public projects, identical to the fixtures`;
});

await check("Every fixture project round-trips through the schema", async () => {
  // Acceptance criterion 6: every content type has a model that can hold it.
  // Counting rows proves storage; comparing sections and members proves the
  // shape survived, which is the part that would actually break a page.
  for (const fixture of allProjects) {
    const row = await db.project.findUnique({
      where: { slug: fixture.slug },
      select: {
        title: true,
        abstract: true,
        techStack: true,
        keywords: true,
        _count: { select: { sections: true, members: true, topics: true, sdgs: true } },
      },
    });

    assert(row, `fixture project "${fixture.slug}" is not in the database`);
    assert(row.title === fixture.title, `title differs for "${fixture.slug}"`);
    assert(row.abstract === fixture.abstract, `abstract differs for "${fixture.slug}"`);
    assert(
      row._count.sections === fixture.sections.length,
      `"${fixture.slug}": ${row._count.sections} sections stored, ${fixture.sections.length} in the fixture`,
    );
    assert(
      row._count.members === fixture.members.length,
      `"${fixture.slug}": ${row._count.members} members stored, ${fixture.members.length} in the fixture`,
    );
    assert(row._count.topics === fixture.topics.length, `"${fixture.slug}": topic count differs`);
    assert(row._count.sdgs === fixture.sdgs.length, `"${fixture.slug}": SDG count differs`);
  }

  return `${allProjects.length} projects, sections and members intact`;
});

/* ------------------------------------------------------------- similarity */

await check("The duplicate detector fires on the deliberate near-duplicate", async () => {
  const pairs = await loadPairs();
  const { subject, nearDuplicate } = pairs;

  const result = scoreSimilarity(subject, nearDuplicate);
  assert(
    result.score >= DUPLICATE_THRESHOLD,
    `the seeded near-duplicate scored ${result.score.toFixed(3)}, below the ${DUPLICATE_THRESHOLD} threshold`,
  );

  return `${result.score.toFixed(3)} (threshold ${DUPLICATE_THRESHOLD})`;
});

await check("The duplicate detector does not fire on an unrelated project", async () => {
  const { subject, unrelated } = await loadPairs();

  const result = scoreSimilarity(subject, unrelated);
  assert(
    result.score < RELATED_THRESHOLD,
    `an unrelated project scored ${result.score.toFixed(3)}, at or above the related threshold`,
  );

  return `${result.score.toFixed(3)} (below ${RELATED_THRESHOLD})`;
});

await check("The SQL shortlist finds the near-duplicate the scorer flags", async () => {
  // The index and the scorer must agree. If the shortlist misses a pair the
  // scorer would flag, duplicate detection silently under-reports and nobody
  // can tell, because the answer it gives still looks plausible.
  const { subject, nearDuplicateSlug } = await loadPairs();

  const rows = await db.$queryRawUnsafe(
    `SELECT "slug", similarity("problemNormalised", $1) AS score
       FROM "Project"
      WHERE "slug" <> $2 AND similarity("problemNormalised", $1) > 0.15
      ORDER BY score DESC LIMIT 25`,
    subject.problemNormalised,
    subject.slug,
  );

  const found = rows.some((row) => row.slug === nearDuplicateSlug);
  assert(
    found,
    `the shortlist did not return "${nearDuplicateSlug}" — the index and the scorer disagree`,
  );

  return `shortlisted ${rows.length} candidates`;
});

/**
 * The pair the corpus deliberately contains: an archived irrigation project and
 * a proposed one covering nearly the same ground. Resolved by querying rather
 * than hardcoding ids, so a fixture rename fails loudly here instead of quietly
 * disabling the assertion.
 */
async function loadPairs() {
  const load = async (slug) => {
    const [row] = await db.$queryRawUnsafe(
      `SELECT p."slug", p."techStack", COALESCE(p."problemNormalised", '') AS "problemNormalised",
              COALESCE(ARRAY(SELECT t."slug" FROM "ProjectTopic" pt
                               JOIN "Topic" t ON t."id" = pt."topicId"
                              WHERE pt."projectId" = p."id"), ARRAY[]::text[]) AS topics
         FROM "Project" p WHERE p."slug" = $1`,
      slug,
    );

    if (!row) throw new Error(`fixture project "${slug}" is missing — the assertion cannot run`);

    return { ...row, problem: row.problemNormalised, techStack: row.techStack ?? [] };
  };

  const subject = await load("smart-irrigation-soil-moisture");
  const nearDuplicate = await load("soil-moisture-irrigation-control");
  const unrelated = await load("attendance-face-recognition");

  return {
    subject,
    nearDuplicate,
    unrelated,
    nearDuplicateSlug: "soil-moisture-irrigation-control",
  };
}

/* ----------------------------------------------------------------- report */

await db.$disconnect();

const failed = results.filter((row) => !row.ok);

console.log("");
for (const row of results) {
  const mark = row.ok ? "PASS" : "FAIL";
  const detail = row.detail ? `  — ${row.detail}` : "";
  console.log(`  ${mark}  ${row.name}${detail}`);
}

console.log(
  `\n  ${results.length - failed.length}/${results.length} assertions passed` +
    (failed.length ? ` — ${failed.length} FAILED\n` : "\n"),
);

process.exit(failed.length > 0 ? 1 : 0);
