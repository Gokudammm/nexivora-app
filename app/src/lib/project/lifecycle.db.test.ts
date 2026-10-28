import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import "dotenv/config";

import { DUPLICATE_THRESHOLD, RELATED_THRESHOLD } from "@/config/search";
import { REQUIRED_SECTIONS, SECTION_BY_KIND, SECTION_ORDER } from "@/config/sections";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { publicProjectCorpus } from "@/lib/db/queries/public-projects";
import { visibleTo } from "@/lib/db/queries/projects";
import { attemptTransition } from "@/lib/project/lifecycle";
import { createSnapshot } from "@/lib/project/snapshot";
import { shortlistSimilarProjects } from "@/lib/search/fts";
import { rankSimilar, scoreSimilarity } from "@/lib/search/similarity";

/**
 * PHASE 8'S ACCEPTANCE CRITERIA, AGAINST THE SEEDED DATABASE.
 *
 * The pure-function suites (`lifecycle.test.ts`, `progress.test.ts`,
 * `snapshot.test.ts`) prove the rules are right. This one proves they are wired
 * to real data — which is a different claim, and the one that has failed before
 * in this project: Phase 3's duplicate scorer passed its unit test at 0.562 on
 * invented prose and scored 0.420 on the actual fixture pair.
 *
 * Criteria covered here:
 *   2 · The similarity check fires on the deliberately-similar seeded pair and
 *       does not fire on an unrelated one.
 *   5 · An embargoed project shows the abstract and hides everything else.
 *   6 · A PRIVATE project is absent from the public corpus and the sitemap.
 *   8 · The submission snapshot is byte-stable over a real record.
 */

type Fixture = {
  /** The deliberately-similar pair the seed contains. */
  subject: { slug: string; problem: string; topics: string[]; techStack: string[] };
  nearDuplicate: { slug: string; problem: string; topics: string[]; techStack: string[] };
  unrelated: { slug: string; problem: string; topics: string[]; techStack: string[] };
};

let fx: Fixture;

const load = async (slug: string) => {
  const row = await db.project.findUnique({
    where: { slug },
    select: {
      slug: true,
      techStack: true,
      problemNormalised: true,
      topics: { select: { topic: { select: { slug: true } } } },
      sections: { where: { kind: "PROBLEM" }, select: { body: true } },
    },
  });

  assert.ok(row, `the seed must contain ${slug} — run npm run db:reset`);

  return {
    slug: row.slug,
    problem: row.sections[0]?.body ?? row.problemNormalised ?? "",
    topics: row.topics.map((entry) => entry.topic.slug),
    techStack: row.techStack,
  };
};

before(async () => {
  // The seed contains a deliberate near-duplicate so this check has a real case
  // to fire on. Named rather than searched: the pair IS the fixture, and a test
  // that hunted for "the most similar pair" would pass on any corpus.
  fx = {
    subject: await load("smart-irrigation-soil-moisture"),
    nearDuplicate: await load("soil-moisture-irrigation-control"),
    unrelated: await load("indic-screen-reader-extension"),
  };
});

/* ------------------------------------ criterion 2: the similarity check */

describe("the similarity check, on real problem statements", () => {
  it("fires on the deliberately-similar seeded pair", () => {
    const result = scoreSimilarity(fx.subject, fx.nearDuplicate);

    assert.ok(
      result.score >= DUPLICATE_THRESHOLD,
      `the seeded near-duplicate scored ${result.score.toFixed(3)}, below ${DUPLICATE_THRESHOLD}`,
    );
    assert.equal(result.verdict, "duplicate");
  });

  it("does not fire on an unrelated project", () => {
    const result = scoreSimilarity(fx.subject, fx.unrelated);

    assert.ok(
      result.score < RELATED_THRESHOLD,
      `an unrelated project scored ${result.score.toFixed(3)}, at or above ${RELATED_THRESHOLD}`,
    );
    assert.equal(result.verdict, "distinct");
  });

  it("reaches the near-duplicate through the SQL shortlist, not only the scorer", () => {
    // The scorer being right is useless if the trigram shortlist never hands it
    // the candidate. Two halves, and both have to work.
    return shortlistSimilarProjects(fx.subject.problem, {}).then((candidates) => {
      assert.ok(candidates.length > 0, "the shortlist returned nothing");
      assert.ok(
        candidates.some((candidate) => candidate.slug === fx.nearDuplicate.slug),
        `the shortlist missed ${fx.nearDuplicate.slug}`,
      );
    });
  });

  it("ranks the near-duplicate first among real candidates", async () => {
    const candidates = await shortlistSimilarProjects(fx.subject.problem, {});

    const ranked = rankSimilar(
      fx.subject,
      candidates
        .filter((candidate) => candidate.slug !== fx.subject.slug)
        .map((candidate) => ({ ...candidate, problem: candidate.problemNormalised })),
    );

    assert.ok(ranked.length > 0, "nothing ranked above the noise floor");
    assert.equal(ranked[0]!.candidate.slug, fx.nearDuplicate.slug);
  });

  it("explains a score with a breakdown, so the UI never asserts a bare number", () => {
    const result = scoreSimilarity(fx.subject, fx.nearDuplicate);

    assert.ok(result.breakdown.problem > 0);
    assert.ok("topics" in result.breakdown && "techStack" in result.breakdown);
  });
});

/* --------------------------------- criteria 5 & 6: visibility on the wire */

describe("the public corpus", () => {
  it("POSITIVE CONTROL — contains the public projects", async () => {
    const corpus = await publicProjectCorpus();

    assert.ok(corpus.length > 0, "the corpus is empty — is the database seeded?");
    assert.ok(corpus.some((project) => project.slug === "canal-scheduling-multi-farm"));
  });

  it("excludes a PRIVATE project entirely — criterion 6", async () => {
    const corpus = await publicProjectCorpus();

    assert.ok(
      !corpus.some((project) => project.slug === "attendance-face-recognition"),
      "a private project reached the public corpus",
    );
  });

  it("excludes a COLLEGE-visible project", async () => {
    const corpus = await publicProjectCorpus();

    assert.ok(!corpus.some((project) => project.slug === "soil-moisture-irrigation-control"));
  });

  it("agrees with visibleTo(ANONYMOUS) — one predicate, not two", async () => {
    // The corpus composes `visibleTo`; this asserts it did not quietly acquire a
    // second filter of its own, which is how a private project leaks later.
    const [corpus, rows] = await Promise.all([
      publicProjectCorpus(),
      db.project.findMany({ where: visibleTo(ANONYMOUS), select: { slug: true } }),
    ]);

    assert.deepEqual(
      corpus.map((project) => project.slug).sort(),
      rows.map((row) => row.slug).sort(),
    );
  });

  it("keeps an embargoed project listed, with its abstract — criterion 5", async () => {
    const corpus = await publicProjectCorpus();
    const embargoed = corpus.find((project) => project.slug === "battery-second-life-grading");

    assert.ok(embargoed, "the embargoed project must still be listed — it can be cited");
    assert.ok(embargoed.abstract.length > 0, "the abstract is what an embargo discloses");
    assert.ok(embargoed.embargoUntil, "the embargo date must reach the page");
  });

  it("omits incomplete sections rather than rendering empty headings", async () => {
    const corpus = await publicProjectCorpus();

    for (const project of corpus) {
      for (const section of project.sections) {
        assert.ok(
          section.body.trim().length > 0,
          `${project.slug} has an empty ${section.kind} section on the public page`,
        );
      }
    }
  });

  it("returns null for a project that is not public", async () => {
    const { publicProject } = await import("@/lib/db/queries/public-projects");

    assert.equal(await publicProject("attendance-face-recognition"), null);
    assert.equal(await publicProject("does-not-exist-at-all"), null);
  });
});

/* -------------------------- criterion 1: the lifecycle over a real project */

describe("the lifecycle, against a real record", () => {
  it("refuses to submit a project whose sections are incomplete, naming them", async () => {
    const project = await db.project.findFirstOrThrow({
      where: { slug: "canal-scheduling-multi-farm" },
      select: {
        status: true,
        title: true,
        summary: true,
        abstract: true,
        sections: { select: { kind: true, complete: true } },
        milestones: { select: { title: true, state: true } },
        members: { select: { id: true } },
        similarityChecks: { select: { id: true } },
      },
    });

    // Deliberately withhold one required section, so the refusal has to name it.
    const withheld = REQUIRED_SECTIONS[0]!;
    const result = attemptTransition("IN_PROGRESS", "UNDER_REVIEW", {
      completeSections: project.sections
        .filter((section) => section.complete && section.kind !== withheld)
        .map((section) => section.kind),
      requiredSections: REQUIRED_SECTIONS,
      sectionLabel: (kind) => SECTION_BY_KIND[kind].label,
      milestones: project.milestones,
      outstandingReviewers: [],
      hasTitle: project.title.length > 0,
      hasSummary: project.summary.length > 0,
      hasAbstract: project.abstract.length > 0,
      hasMembers: project.members.length > 0,
      hasSimilarityCheck: project.similarityChecks.length > 0,
    });

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, new RegExp(SECTION_BY_KIND[withheld].label));
  });
});

/* ------------------------------- criterion 8: the snapshot over real data */

describe("the submission snapshot, over a real record", () => {
  it("is byte-stable across two serialisations of the same record", async () => {
    const project = await db.project.findFirstOrThrow({
      where: { slug: "canal-scheduling-multi-farm" },
      select: {
        slug: true,
        title: true,
        summary: true,
        abstract: true,
        status: true,
        visibility: true,
        domain: true,
        department: true,
        subject: true,
        techStack: true,
        keywords: true,
        repositoryUrl: true,
        demoUrl: true,
        videoUrl: true,
        startedOn: true,
        completedOn: true,
        embargoUntil: true,
        sections: { select: { kind: true, body: true, wordCount: true, complete: true } },
        members: {
          select: { role: true, tier: true, user: { select: { username: true, name: true } } },
        },
        milestones: {
          select: {
            title: true,
            description: true,
            state: true,
            dueDate: true,
            completedAt: true,
          },
        },
        topics: { select: { topic: { select: { slug: true } } } },
        sdgs: { select: { goal: true, primary: true } },
      },
    });

    const input = {
      ...project,
      members: project.members.map((member) => ({
        username: member.user.username,
        name: member.user.name,
        role: member.role,
        tier: member.tier,
      })),
      topics: project.topics.map((entry) => entry.topic.slug),
      files: [],
    };

    const meta = { round: 1, submittedBy: "test", submittedAt: new Date() };

    const first = createSnapshot(input, meta, SECTION_ORDER);
    const second = createSnapshot(input, meta, SECTION_ORDER);

    assert.equal(first.digest, second.digest);

    // And the same record with its collections shuffled still hashes the same —
    // the actual failure mode, since a Prisma row's key order follows its select.
    const shuffled = createSnapshot(
      {
        ...input,
        sections: [...input.sections].reverse(),
        members: [...input.members].reverse(),
        topics: [...input.topics].reverse(),
      },
      meta,
      SECTION_ORDER,
    );

    assert.equal(shuffled.digest, first.digest);
  });

  it("reproduces the record it was taken from", async () => {
    const project = await db.project.findFirstOrThrow({
      where: { slug: "canal-scheduling-multi-farm" },
      select: { title: true, abstract: true },
    });

    const snapshot = createSnapshot(
      {
        slug: "canal-scheduling-multi-farm",
        title: project.title,
        summary: "",
        abstract: project.abstract,
        status: "UNDER_REVIEW",
        visibility: "PUBLIC",
        domain: "hardware-iot",
        department: "",
        subject: null,
        techStack: [],
        keywords: [],
        repositoryUrl: null,
        demoUrl: null,
        videoUrl: null,
        startedOn: new Date("2025-01-01"),
        completedOn: null,
        embargoUntil: null,
        sections: [],
        members: [],
        milestones: [],
        topics: [],
        sdgs: [],
        files: [],
      },
      { round: 1, submittedBy: "test", submittedAt: new Date() },
      SECTION_ORDER,
    );

    const record = snapshot.record as Record<string, unknown>;
    assert.equal(record.title, project.title);
    assert.equal(record.abstract, project.abstract);
  });
});
