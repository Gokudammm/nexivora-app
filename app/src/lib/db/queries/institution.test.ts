import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import "dotenv/config";

import { ANONYMOUS, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

import {
  canAdminister,
  getClass,
  getCollege,
  getHierarchy,
  listClasses,
  listColleges,
  listDepartments,
  listPeople,
  listSubjects,
  listTerms,
  publicCollegeSlugs,
} from "./institution";

/**
 * ISOLATION FOR THE ADMIN CONSOLE — acceptance criterion 7.
 *
 * Phase 4 proved projects do not cross a college boundary. Phase 5 added a
 * whole console of new scoped queries, and each one is a fresh chance to forget
 * the predicate. So every one of them is called here as an administrator of the
 * *wrong* college and asserted empty, with a positive control proving the same
 * call succeeds for the right one.
 *
 * Nothing here goes through a route or the proxy, which is the point: this is
 * what a forgotten guard would reach.
 */

let nexivora: string;
let meridian: string;
let greenfield: string;

let adminOfNexivora: Viewer;
let adminOfMeridian: Viewer;
let guestAdmin: Viewer;

const viewerFor = (collegeId: string, overrides: Partial<Viewer> = {}): Viewer => ({
  userId: `test-${collegeId}`,
  emailVerified: true,
  memberships: [{ collegeId, role: "COLLEGE_ADMIN", state: "ACTIVE" }],
  groups: [],
  teaches: [],
  enrolledIn: [],
  isPlatformAdmin: false,
  ...overrides,
});

before(async () => {
  const colleges = await db.college.findMany({ select: { id: true, slug: true } });
  const bySlug = Object.fromEntries(colleges.map((college) => [college.slug, college.id]));

  nexivora = bySlug["nexivora-institute-of-technology"] ?? "";
  meridian = bySlug["meridian-college-of-engineering"] ?? "";
  greenfield = bySlug["greenfield-institute"] ?? "";

  assert.ok(nexivora && meridian && greenfield, "seed the database first: npm run db:reset");

  adminOfNexivora = viewerFor(nexivora);
  adminOfMeridian = viewerFor(meridian);

  // A guest membership that names COLLEGE_ADMIN. It must grant nothing (ADR-022).
  guestAdmin = viewerFor(nexivora, {
    userId: "test-guest-admin",
    memberships: [
      { collegeId: meridian, role: "STUDENT", state: "ACTIVE" },
      { collegeId: nexivora, role: "COLLEGE_ADMIN", state: "GUEST" },
    ],
  });
});

after(async () => {
  await db.$disconnect();
});

describe("canAdminister", () => {
  it("permits an administrator of their own college", () => {
    assert.equal(canAdminister(adminOfNexivora, nexivora), true);
  });

  it("refuses another college", () => {
    assert.equal(canAdminister(adminOfNexivora, meridian), false);
  });

  it("refuses a guest, whatever role the membership names", () => {
    assert.equal(canAdminister(guestAdmin, nexivora), false);
  });
});

describe("every admin query is scoped to its own college", () => {
  it("returns nothing for an administrator of another college", async () => {
    // Exhaustive over the console's read surface rather than a sample: a query
    // added later without the predicate should fail here, not in production.
    const results = await Promise.all([
      listDepartments(adminOfMeridian, nexivora),
      listSubjects(adminOfMeridian, nexivora),
      listTerms(adminOfMeridian, nexivora),
      listClasses(adminOfMeridian, nexivora),
      listPeople(adminOfMeridian, nexivora),
    ]);

    for (const [index, rows] of results.entries()) {
      assert.equal(rows.length, 0, `query ${index} leaked rows across a college boundary`);
    }

    assert.equal(await getHierarchy(adminOfMeridian, nexivora), null);
  });

  it("returns real data for the administrator of that college", async () => {
    // The positive control. Without it, a predicate that returned nothing at
    // all would pass every assertion above.
    const [departments, subjects, terms, classes, people] = await Promise.all([
      listDepartments(adminOfNexivora, nexivora),
      listSubjects(adminOfNexivora, nexivora),
      listTerms(adminOfNexivora, nexivora),
      listClasses(adminOfNexivora, nexivora),
      listPeople(adminOfNexivora, nexivora),
    ]);

    assert.ok(departments.length > 0, "expected departments");
    assert.ok(subjects.length > 0, "expected subjects");
    assert.ok(terms.length > 0, "expected terms");
    assert.ok(classes.length > 0, "expected classes");
    assert.ok(people.length > 0, "expected people");

    assert.ok(await getHierarchy(adminOfNexivora, nexivora));
  });

  it("gives a guest nothing, even at the college they are guesting in", async () => {
    assert.equal((await listDepartments(guestAdmin, nexivora)).length, 0);
    assert.equal(await getHierarchy(guestAdmin, nexivora), null);
  });

  it("resolves a class id from another college to nothing", async () => {
    const klass = await db.class.findFirst({
      where: { collegeId: nexivora },
      select: { id: true },
    });
    assert.ok(klass);

    // Scoped by collegeId as well as id, so a guessed id is not a way in.
    assert.equal(await getClass(adminOfMeridian, meridian, klass.id), null);
    assert.ok(await getClass(adminOfNexivora, nexivora, klass.id));
  });

  it("never returns another college's people to a search", async () => {
    const leaked = await listPeople(adminOfMeridian, nexivora, { q: "a" });
    assert.equal(leaked.length, 0);
  });
});

/**
 * The verification gate — acceptance criterion 5, at the query layer.
 *
 * Greenfield is seeded unverified precisely so this is exercised by a real row
 * rather than asserted in a comment.
 */
describe("the verification gate", () => {
  it("keeps an unverified college out of the public directory", async () => {
    const colleges = await listColleges(ANONYMOUS);

    assert.ok(colleges.length > 0, "verified colleges should still be listed");
    assert.ok(
      colleges.every((college) => college.verification === "VERIFIED"),
      "an unverified college reached the public directory",
    );
  });

  it("keeps an unverified college out of the sitemap", async () => {
    const slugs = await publicCollegeSlugs(ANONYMOUS);
    assert.ok(!slugs.includes("greenfield-institute"));
    assert.ok(slugs.includes("nexivora-institute-of-technology"));
  });

  it("returns null for an unverified college's public page", async () => {
    assert.equal(await getCollege(ANONYMOUS, "greenfield-institute"), null);
  });

  it("still shows an unverified college to its own members", async () => {
    // The gate is a quality control, not a barrier to entry: members must be
    // able to use the product while verification is pending.
    const member = viewerFor(greenfield, {
      userId: "test-greenfield",
      memberships: [{ collegeId: greenfield, role: "STUDENT", state: "ACTIVE" }],
    });

    assert.ok(await getCollege(member, "greenfield-institute"));
  });

  it("does not show an unverified college to a member of a different one", async () => {
    assert.equal(await getCollege(adminOfNexivora, "greenfield-institute"), null);
  });
});
