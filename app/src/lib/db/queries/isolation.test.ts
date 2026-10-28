import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import "dotenv/config";

import { can, type ProjectResource } from "@/lib/authz/policy";
import { ANONYMOUS, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

import { listProjects, projectResource, publicProjectSlugs, visibleTo } from "./projects";

/**
 * CROSS-COLLEGE ISOLATION, AT THE DATA LAYER.
 *
 * Phase 4's acceptance criterion 3, and the most important test in this phase:
 *
 * > A member of college B receives `null` from every scoped query against
 * > college A's data, **with the proxy disabled** — proving the data layer is a
 * > real boundary, not a decoration.
 *
 * Nothing here goes through a route, a guard or the proxy. It builds a viewer
 * by hand and calls the query functions directly, which is exactly what a
 * forgotten guard, a new route handler or a Server Action reached out of order
 * would do.
 *
 * It runs against the seeded database, so it is testing the real predicate
 * against real rows rather than a fixture that agrees with it by construction.
 */

type Ids = {
  nexivora: string;
  meridian: string;
  greenfield: string;
};

let ids: Ids;
let studentAtMeridian: Viewer;
let studentAtNexivora: Viewer;

before(async () => {
  const colleges = await db.college.findMany({ select: { id: true, slug: true } });
  const bySlug = Object.fromEntries(colleges.map((c) => [c.slug, c.id]));

  ids = {
    nexivora: bySlug["nexivora-institute-of-technology"] ?? "",
    meridian: bySlug["meridian-college-of-engineering"] ?? "",
    greenfield: bySlug["greenfield-institute"] ?? "",
  };

  assert.ok(ids.nexivora && ids.meridian, "seed the database first: npm run db:reset");

  studentAtMeridian = {
    userId: "test-outsider",
    emailVerified: true,
    memberships: [{ collegeId: ids.meridian, role: "STUDENT", state: "ACTIVE" }],
    groups: [],
    teaches: [],
    enrolledIn: [],
    isPlatformAdmin: false,
  };

  studentAtNexivora = {
    ...studentAtMeridian,
    userId: "test-insider",
    memberships: [{ collegeId: ids.nexivora, role: "STUDENT", state: "ACTIVE" }],
  };
});

after(async () => {
  await db.$disconnect();
});

describe("cross-college isolation at the data layer", () => {
  it("returns no non-public work from another college", async () => {
    const results = await listProjects(studentAtMeridian, {
      collegeId: ids.nexivora,
      take: 500,
    });

    const leaked = results.filter(
      (project) => project.visibility !== "PUBLIC" && project.collegeId === ids.nexivora,
    );

    assert.equal(
      leaked.length,
      0,
      `leaked ${leaked.length} non-public projects across a college boundary: ${leaked
        .map((p) => `${p.slug} (${p.visibility})`)
        .join(", ")}`,
    );
  });

  it("still returns another college's genuinely public work", async () => {
    // Isolation is not "see nothing". Public, approved work at a verified
    // college is the whole point of the public archive.
    const results = await listProjects(studentAtMeridian, { collegeId: ids.nexivora, take: 500 });

    assert.ok(
      results.length > 0,
      "a public archive that nobody outside can read is not an archive",
    );
    assert.ok(results.every((project) => project.visibility === "PUBLIC"));
  });

  it("a member of the college does see its college-visible work", async () => {
    // The inverse assertion. Without it, a predicate that returns nothing at
    // all would pass every isolation test in this file.
    const results = await listProjects(studentAtNexivora, { collegeId: ids.nexivora, take: 500 });

    const collegeVisible = results.filter((project) => project.visibility === "COLLEGE");
    assert.ok(collegeVisible.length > 0, "college members should see college-visible work");
  });

  it("never returns work from an unverified college to the public", async () => {
    // Greenfield is seeded unverified on purpose. Its work must not reach the
    // open internet even when marked PUBLIC — the anti-abuse gate (ADR-010).
    const slugs = await publicProjectSlugs(ANONYMOUS);

    const greenfield = await db.project.findMany({
      where: { collegeId: ids.greenfield },
      select: { slug: true },
    });

    for (const project of greenfield) {
      assert.ok(
        !slugs.includes(project.slug),
        `"${project.slug}" is at an unverified college and reached the public list`,
      );
    }
  });

  it("returns nothing private to an anonymous viewer", async () => {
    const results = await listProjects(ANONYMOUS, { take: 500 });

    assert.ok(
      results.every((project) => project.visibility === "PUBLIC"),
      "the anonymous viewer received non-public work",
    );
  });
});

/**
 * The SQL predicate and the in-memory policy must agree.
 *
 * They are written separately — one filters lists in the database, the other
 * decides about a single loaded row — and nothing but this test stops them
 * drifting. A drift in one direction leaks; in the other it produces mystery
 * 404s on work people can legitimately see.
 */
describe("visibleTo() agrees with can('project:read')", () => {
  const viewers = () => [
    { label: "anonymous", viewer: ANONYMOUS },
    { label: "student at Meridian", viewer: studentAtMeridian },
    { label: "student at Nexivora", viewer: studentAtNexivora },
  ];

  it("selects exactly the projects the policy permits", async () => {
    const all = await db.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        slug: true,
        collegeId: true,
        groupId: true,
        visibility: true,
        approved: true,
        status: true,
        embargoUntil: true,
        college: { select: { verification: true } },
        group: { select: { classId: true, class: { select: { subjectId: true } } } },
        members: { select: { userId: true } },
      },
    });

    for (const { label, viewer } of viewers()) {
      const visible = await db.project.findMany({
        where: visibleTo(viewer),
        select: { slug: true },
      });
      const fromSql = new Set(visible.map((row) => row.slug));

      for (const project of all) {
        const resource: ProjectResource = projectResource(project);
        const fromPolicy = can(viewer, "project:read", resource);

        assert.equal(
          fromSql.has(project.slug),
          fromPolicy,
          `${label}: SQL says ${fromSql.has(project.slug)} but the policy says ${fromPolicy} for "${project.slug}" (${project.visibility})`,
        );
      }
    }
  });
});
