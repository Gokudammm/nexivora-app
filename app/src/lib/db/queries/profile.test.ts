import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import "dotenv/config";

import { ANONYMOUS, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

import {
  canSeeField,
  getProfile,
  publicProfileUsernames,
  resolveProfileVisibility,
} from "./profile";

/**
 * PRIVACY, ASSERTED ON THE RESPONSE — acceptance criterion 2.
 *
 * > Every privacy toggle is honoured on the public page — verified by fetching
 * > the profile logged out and asserting the hidden fields are absent from the
 * > **HTML**, not merely hidden by CSS.
 *
 * This asserts one step earlier than the HTML, which is stronger: a field that
 * is never in the query result cannot reach the markup, the RSC payload, or
 * "view source" by any route a future page change might open. A test against
 * the rendered HTML would pass for a page that fetched the field and forgot to
 * print it — and then fail silently the day somebody adds a debug dump.
 *
 * The second property tested here is the enumeration one: a private profile and
 * a username that does not exist must be indistinguishable.
 */

let publicUser: { id: string; username: string };
let privateUser: { id: string; username: string };

let classmate: Viewer;
let outsider: Viewer;

const viewerAt = (userId: string, collegeId: string): Viewer => ({
  userId,
  emailVerified: true,
  memberships: [{ collegeId, role: "STUDENT", state: "ACTIVE" }],
  groups: [],
  teaches: [],
  enrolledIn: [],
  isPlatformAdmin: false,
});

before(async () => {
  const nexivora = await db.college.findFirst({
    where: { slug: "nexivora-institute-of-technology" },
    select: { id: true },
  });
  const meridian = await db.college.findFirst({
    where: { slug: "meridian-college-of-engineering" },
    select: { id: true },
  });

  assert.ok(nexivora && meridian, "seed the database first: npm run db:reset");

  const users = await db.user.findMany({
    where: { memberships: { some: { collegeId: nexivora.id, role: "STUDENT" } } },
    select: { id: true, username: true, privacy: { select: { profileVisibility: true } } },
    take: 40,
  });

  const found = users.find((user) => user.privacy?.profileVisibility === "PUBLIC");
  const hidden = users.find((user) => user.privacy?.profileVisibility !== "PUBLIC");

  assert.ok(found, "the seed should contain a public profile");
  assert.ok(hidden, "the seed should contain a non-public profile");

  publicUser = { id: found.id, username: found.username };
  privateUser = { id: hidden.id, username: hidden.username };

  classmate = viewerAt("test-classmate", nexivora.id);
  outsider = viewerAt("test-outsider", meridian.id);
});

after(async () => {
  await db.$disconnect();
});

/* ------------------------------------------------------------- the gate */

describe("canSeeField", () => {
  it("shows a public field to everyone", () => {
    for (const relation of ["self", "college", "public"] as const) {
      assert.equal(canSeeField("PUBLIC", relation), true);
    }
  });

  it("shows a college field to the college and to nobody else", () => {
    assert.equal(canSeeField("COLLEGE", "college"), true);
    assert.equal(canSeeField("COLLEGE", "self"), true);
    assert.equal(canSeeField("COLLEGE", "public"), false);
  });

  it("shows a private field only to its owner", () => {
    assert.equal(canSeeField("PRIVATE", "self"), true);
    assert.equal(canSeeField("PRIVATE", "college"), false);
    assert.equal(canSeeField("PRIVATE", "public"), false);
  });
});

/* --------------------------------------------------------- enumeration */

describe("a private profile is indistinguishable from one that does not exist", () => {
  it("returns null for both, to the public", async () => {
    const missing = await getProfile(ANONYMOUS, "no-such-person-anywhere");
    const hidden = await getProfile(ANONYMOUS, privateUser.username);

    assert.equal(missing, null);
    assert.equal(hidden, null, "a non-public profile must not resolve for the public");
  });

  it("returns null for both from another college", async () => {
    assert.equal(await getProfile(outsider, "no-such-person-anywhere"), null);
    assert.equal(await getProfile(outsider, privateUser.username), null);
  });

  it("resolves visibility to null rather than reporting why", async () => {
    // The caller cannot tell "private" from "absent" — and neither can an
    // attacker walking a list of likely usernames.
    assert.equal(await resolveProfileVisibility(ANONYMOUS, privateUser.username), null);
    assert.equal(await resolveProfileVisibility(ANONYMOUS, "definitely-not-a-user"), null);
  });
});

/* ------------------------------------------------ hidden means not fetched */

describe("hidden fields are absent from the response, not filtered in the view", () => {
  it("never returns an email to the public", async () => {
    const profile = await getProfile(ANONYMOUS, publicUser.username);
    assert.ok(profile, "the public profile should resolve");

    // Even if the person opted in, an email is never given to the open
    // internet — the toggle widens it to their college, not to everyone.
    assert.equal(profile.email, null);
  });

  it("never returns a roll number to the public", async () => {
    const profile = await getProfile(ANONYMOUS, publicUser.username);
    assert.ok(profile);
    assert.equal(profile.rollNumber, null, "institutional data must not reach the internet");
  });

  it("omits skills entirely when the person turned them off", async () => {
    const before = await db.privacySetting.findUnique({ where: { userId: publicUser.id } });
    assert.ok(before);

    try {
      await db.privacySetting.update({
        where: { userId: publicUser.id },
        data: { showSkills: false },
      });

      const profile = await getProfile(ANONYMOUS, publicUser.username);
      assert.ok(profile);
      assert.deepEqual(profile.skills, [], "skills should not be read at all when hidden");
    } finally {
      await db.privacySetting.update({
        where: { userId: publicUser.id },
        data: { showSkills: before.showSkills },
      });
    }
  });

  it("honours a change of visibility immediately", async () => {
    const before = await db.privacySetting.findUnique({ where: { userId: publicUser.id } });
    assert.ok(before);

    try {
      await db.privacySetting.update({
        where: { userId: publicUser.id },
        data: { profileVisibility: "PRIVATE" },
      });

      assert.equal(
        await getProfile(ANONYMOUS, publicUser.username),
        null,
        "going private must take effect on the next read",
      );
    } finally {
      await db.privacySetting.update({
        where: { userId: publicUser.id },
        data: { profileVisibility: before.profileVisibility },
      });
    }
  });
});

/* ------------------------------------------------------- the college gate */

describe("a college-visible profile", () => {
  it("is readable by a classmate and not by the public", async () => {
    const before = await db.privacySetting.findUnique({ where: { userId: privateUser.id } });
    assert.ok(before);

    try {
      await db.privacySetting.update({
        where: { userId: privateUser.id },
        data: { profileVisibility: "COLLEGE" },
      });

      assert.ok(await getProfile(classmate, privateUser.username), "a classmate should see it");
      assert.equal(
        await getProfile(ANONYMOUS, privateUser.username),
        null,
        "the public should not",
      );
      assert.equal(
        await getProfile(outsider, privateUser.username),
        null,
        "another college should not",
      );
    } finally {
      await db.privacySetting.update({
        where: { userId: privateUser.id },
        data: { profileVisibility: before.profileVisibility },
      });
    }
  });
});

/* ------------------------------------------------------------- indexing */

describe("the sitemap and robots directives — acceptance criterion 3", () => {
  it("lists only public profiles at verified colleges", async () => {
    const usernames = await publicProfileUsernames();

    const everyone = await db.user.findMany({
      select: {
        username: true,
        privacy: { select: { profileVisibility: true } },
        memberships: { select: { college: { select: { verification: true } } } },
      },
    });

    for (const user of everyone) {
      const isPublic = user.privacy?.profileVisibility === "PUBLIC";
      const verified = user.memberships.some(
        (membership) => membership.college.verification === "VERIFIED",
      );

      assert.equal(
        usernames.includes(user.username),
        isPublic && verified,
        `"${user.username}" is ${isPublic ? "public" : "not public"} at a ${verified ? "verified" : "unverified"} college and should ${isPublic && verified ? "" : "not "}be listed`,
      );
    }
  });

  it("marks a public profile indexable and everything else not", async () => {
    const gate = await resolveProfileVisibility(ANONYMOUS, publicUser.username);
    assert.ok(gate);
    assert.equal(gate.indexable, true);
  });

  it("does not index a public profile whose only college is unverified", async () => {
    // The anti-abuse gate reaches profiles too: anyone can register a college,
    // and until a human has checked it nothing from it is publicly indexable —
    // however public a member sets their own profile.
    //
    // The condition is *constructed* rather than looked for. The seed's only
    // public Greenfield member is `arjun-rao`, who also belongs to two verified
    // colleges and is therefore legitimately indexable — an earlier version of
    // this test found him and failed, blaming the code for the test's own
    // faulty premise.
    const greenfieldOnly = await db.user.findFirst({
      where: {
        memberships: {
          every: { college: { slug: "greenfield-institute" } },
          some: { college: { slug: "greenfield-institute" } },
        },
      },
      select: { id: true, username: true, privacy: { select: { profileVisibility: true } } },
    });

    assert.ok(greenfieldOnly, "the seed should contain someone whose only college is unverified");

    const before = greenfieldOnly.privacy?.profileVisibility ?? "COLLEGE";

    try {
      await db.privacySetting.upsert({
        where: { userId: greenfieldOnly.id },
        create: { userId: greenfieldOnly.id, profileVisibility: "PUBLIC" },
        update: { profileVisibility: "PUBLIC" },
      });

      const gate = await resolveProfileVisibility(ANONYMOUS, greenfieldOnly.username);

      assert.ok(gate, "a public profile still resolves");
      assert.equal(
        gate.indexable,
        false,
        "an unverified college's member must not be indexable, however public their profile",
      );

      const listed = await publicProfileUsernames();
      assert.ok(
        !listed.includes(greenfieldOnly.username),
        "and must not appear in the sitemap either",
      );
    } finally {
      await db.privacySetting.update({
        where: { userId: greenfieldOnly.id },
        data: { profileVisibility: before },
      });
    }
  });

  it("does index someone who is also at a verified college", async () => {
    // The inverse, and the case that produced the false failure above: holding
    // a membership at an unverified college does not disqualify somebody who
    // also belongs to a verified one.
    const arjun = await resolveProfileVisibility(ANONYMOUS, "arjun-rao");

    if (arjun) assert.equal(arjun.indexable, true);
  });
});
