import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import "dotenv/config";

import { loadViewer } from "@/lib/auth/viewer";
import { can } from "@/lib/authz/policy";
import { ANONYMOUS, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

import { groupResource, groupVisibleTo, listMyGroups, requireWorkspace } from "./group";
import { getReviews, listFiles, listLedgerEvents } from "./workspace";

/**
 * THE WORKSPACE BOUNDARY, AT THE DATA LAYER.
 *
 * Phase 7's acceptance criteria 5 and 7 are both privacy claims, and both are
 * asserted here rather than through a page:
 *
 *   5 · A file uploaded by group A returns 404 to a member of group B.
 *   7 · A peer review submitted by member A is never visible to member B in
 *       any view, at any URL.
 *
 * "In any view, at any URL" is not something a test of one page can establish.
 * What *can* be established is that the query never returns the data — and
 * since every route in the workspace goes through these functions, a query that
 * cannot return it means no view can render it.
 *
 * Nothing here goes through a route, a guard or the proxy. Viewers are built by
 * hand and the query functions are called directly, which is precisely what a
 * forgotten guard or a Server Action reached out of order would do.
 *
 * Every denial suite needs a positive control (process lesson 9): if these
 * queries returned nothing to anybody, every assertion below would pass and
 * prove nothing. The first test in each section is the control.
 */

type Fixture = {
  groupA: { id: string; collegeId: string; classId: string | null; subjectId: string | null };
  groupB: { id: string; collegeId: string };
  memberA: Viewer;
  memberB: Viewer;
  memberA2: Viewer;
  memberAId: string;
  memberA2Id: string;
  faculty: Viewer;
};

let fx: Fixture;

const viewerFor = (userId: string): Promise<Viewer> => loadViewer(userId);

before(async () => {
  // Found rather than hard-coded: a seeded id in a test is a fixture that
  // silently stops meaning anything the next time the seed changes.
  const groups = await db.group.findMany({
    where: { classId: { not: null }, members: { some: {} } },
    select: {
      id: true,
      collegeId: true,
      classId: true,
      class: { select: { subjectId: true } },
      members: { where: { leftAt: null }, select: { userId: true } },
    },
    orderBy: { id: "asc" },
  });

  // Faculty scope is per SUBJECT, not per class (ADR-029 and the viewer's
  // `teaches` list). A group's supervising faculty member teaches its subject —
  // frequently through a different class of that same subject, which is what
  // the model intends and what the first version of this search got wrong.
  let found: (typeof groups)[number] | undefined;
  let facultyId: string | undefined;

  for (const group of groups) {
    if (group.members.length < 2 || !group.class) continue;

    const assignment = await db.subjectAssignment.findFirst({
      where: { class: { subjectId: group.class.subjectId } },
      select: { userId: true },
    });

    if (assignment) {
      found = group;
      facultyId = assignment.userId;
      break;
    }
  }

  assert.ok(found && facultyId, "seed the database first: npm run db:reset");
  const a = found;

  // Group B must share no members with A, or "member of B" proves nothing.
  const aMembers = new Set(a.members.map((row) => row.userId));
  const b = groups.find(
    (group) => group.id !== a.id && group.members.every((row) => !aMembers.has(row.userId)),
  );
  assert.ok(b, "the seed needs two groups with disjoint membership");

  const [memberAId, memberA2Id] = a.members.map((row) => row.userId) as [string, string];
  const memberBId = b.members[0]!.userId;

  fx = {
    groupA: {
      id: a.id,
      collegeId: a.collegeId,
      classId: a.classId,
      subjectId: a.class?.subjectId ?? null,
    },
    groupB: { id: b.id, collegeId: b.collegeId },
    memberA: await viewerFor(memberAId),
    memberA2: await viewerFor(memberA2Id),
    memberB: await viewerFor(memberBId),
    memberAId,
    memberA2Id,
    faculty: await viewerFor(facultyId),
  };
});

/* ------------------------------------------------------- workspace access */

describe("requireWorkspace", () => {
  it("POSITIVE CONTROL — a member reaches their own workspace", async () => {
    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace, "a member must be able to open their own group");
    assert.equal(workspace.id, fx.groupA.id);
  });

  it("returns null to a member of another group", async () => {
    assert.equal(await requireWorkspace(fx.memberB, fx.groupA.id), null);
  });

  it("returns null to the logged-out public", async () => {
    assert.equal(await requireWorkspace(ANONYMOUS, fx.groupA.id), null);
  });

  it("lets the supervising faculty member in", async () => {
    const workspace = await requireWorkspace(fx.faculty, fx.groupA.id);
    assert.ok(workspace, "faculty who teach the subject read the workspace");
  });

  it("keeps a college administrator out of the room", async () => {
    // Deliberate, and easy to get backwards: an administrator manages the
    // institution and does not get to read a team's working discussion. They
    // see reports, not the room.
    const admin = await db.membership.findFirst({
      where: { collegeId: fx.groupA.collegeId, role: "COLLEGE_ADMIN", state: "ACTIVE" },
      select: { userId: true },
    });
    assert.ok(admin, "the seed needs a college admin");

    const viewer = await viewerFor(admin.userId);
    // Not a member of this group, so the workspace is closed to them.
    if (!viewer.groups.some((group) => group.groupId === fx.groupA.id)) {
      assert.equal(await requireWorkspace(viewer, fx.groupA.id), null);
    }
  });

  it("agrees with can(workspace:read) on the same group", async () => {
    // Two implementations of one rule — the SQL predicate and the policy — must
    // not drift. One way it leaks; the other it produces mystery 404s.
    const group = await db.group.findUniqueOrThrow({
      where: { id: fx.groupA.id },
      select: {
        id: true,
        collegeId: true,
        classId: true,
        class: { select: { subjectId: true } },
      },
    });
    const resource = groupResource(group);

    for (const [label, viewer] of [
      ["member", fx.memberA],
      ["outsider", fx.memberB],
      ["faculty", fx.faculty],
      ["anonymous", ANONYMOUS],
    ] as const) {
      const viaQuery = (await requireWorkspace(viewer, fx.groupA.id)) !== null;
      const viaPolicy = can(viewer, "workspace:read", resource);
      assert.equal(
        viaQuery,
        viaPolicy,
        `${label}: query said ${viaQuery}, policy said ${viaPolicy}`,
      );
    }
  });
});

describe("groupVisibleTo", () => {
  it("matches nothing at all for the logged-out public", async () => {
    // The predicate must be impossible rather than empty: `{}` would match
    // every group in the database, which is the failure this shape prevents.
    const count = await db.group.count({ where: groupVisibleTo(ANONYMOUS) });
    assert.equal(count, 0);
  });

  it("POSITIVE CONTROL — a member's own groups are visible to them", async () => {
    const groups = await listMyGroups(fx.memberA);
    assert.ok(groups.length > 0, "a member with groups must see some");
    assert.ok(groups.some((group) => group.id === fx.groupA.id));
  });

  it("never lists another group's workspace among a member's own", async () => {
    const groups = await listMyGroups(fx.memberB);
    assert.ok(!groups.some((group) => group.id === fx.groupA.id));
  });
});

/* ------------------------------------------------- criterion 5: the files */

describe("files are scoped to their group", () => {
  it("POSITIVE CONTROL — a member sees their own group's files", async () => {
    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace);
    // The seed may not have given this particular group files; the control that
    // matters is that the call succeeds for a member and is refused below.
    assert.ok(Array.isArray(await listFiles(workspace)));
  });

  it("a file in group A is not reachable by a member of group B", async () => {
    const file = await db.fileAsset.findFirst({
      where: { groupId: fx.groupA.id, deletedAt: null },
      select: { id: true },
    });

    if (!file) return; // Nothing seeded for this group; the route test covers it.

    // The file route resolves the row, then asks can(workspace:read) on its
    // group. Reproduced exactly here, with no proxy in the way.
    const row = await db.fileAsset.findFirstOrThrow({
      where: { id: file.id },
      select: {
        group: {
          select: {
            id: true,
            collegeId: true,
            classId: true,
            class: { select: { subjectId: true } },
          },
        },
      },
    });

    assert.equal(can(fx.memberB, "workspace:read", groupResource(row.group)), false);
    assert.equal(can(ANONYMOUS, "workspace:read", groupResource(row.group)), false);
    assert.equal(can(fx.memberA, "workspace:read", groupResource(row.group)), true);
  });
});

/* ------------------------------------------ criterion 7: the peer reviews */

describe("peer review privacy (ADR-008)", () => {
  const REVIEW = {
    contribution: 4,
    reliability: 5,
    communication: 3,
    comment: "A distinctive sentence that must never reach the wrong reader.",
  };

  before(async () => {
    // Two reviews about member A, from two different authors: the aggregate is
    // deliberately withheld below two, so one would test the wrong branch.
    const others = await db.groupMember.findMany({
      where: { groupId: fx.groupA.id, leftAt: null, userId: { not: fx.memberAId } },
      select: { userId: true },
      take: 2,
    });

    for (const [index, author] of others.entries()) {
      await db.peerReview.upsert({
        where: {
          id: `test-review-${index}-${fx.groupA.id}`.slice(0, 60),
        },
        create: {
          id: `test-review-${index}-${fx.groupA.id}`.slice(0, 60),
          groupId: fx.groupA.id,
          authorId: author.userId,
          subjectId: fx.memberAId,
          ...REVIEW,
        },
        update: {},
      });
    }
  });

  it("POSITIVE CONTROL — the subject sees the aggregate about themselves", async () => {
    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace);

    const reviews = await getReviews(workspace, { userId: fx.memberAId, teachesSubject: false });
    assert.ok(reviews.aggregate, "the subject must see their own aggregate");
    assert.ok(reviews.aggregate.count >= 2);
    assert.ok(reviews.aggregate.comments.includes(REVIEW.comment));
  });

  it("the subject is never told WHO said what", async () => {
    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace);

    const reviews = await getReviews(workspace, { userId: fx.memberAId, teachesSubject: false });

    // The detail list is the only place an author id appears, and a member
    // never receives it.
    assert.deepEqual(reviews.detail, []);

    // And the aggregate itself carries no author anywhere in its shape — checked
    // by serialising it, so a field added later is caught rather than assumed
    // absent.
    const serialised = JSON.stringify(reviews.aggregate);
    for (const author of [fx.memberA2Id]) {
      assert.ok(!serialised.includes(author), "an author id reached the subject");
    }
  });

  it("a teammate sees nothing about the subject at all", async () => {
    const workspace = await requireWorkspace(fx.memberA2, fx.groupA.id);
    assert.ok(workspace, "the teammate is a member and can open the workspace");

    const reviews = await getReviews(workspace, { userId: fx.memberA2Id, teachesSubject: false });

    // They may see reviews they WROTE — those are theirs — and nothing written
    // about somebody else.
    assert.deepEqual(reviews.detail, []);
    assert.ok(
      reviews.mine.every((review) => review.subjectId !== fx.memberA2Id),
      "a review of yourself must never appear among reviews you wrote",
    );

    const serialised = JSON.stringify(reviews.aggregate);
    assert.ok(
      reviews.aggregate === null || !serialised.includes(fx.memberAId),
      "a teammate received the subject's aggregate",
    );
  });

  it("an outsider gets nothing, even holding a workspace they cannot open", async () => {
    assert.equal(await requireWorkspace(fx.memberB, fx.groupA.id), null);
  });

  it("faculty see the detail, with authors — that is the asymmetry", async () => {
    const workspace = await requireWorkspace(fx.faculty, fx.groupA.id);
    assert.ok(workspace);

    const reviews = await getReviews(workspace, {
      userId: fx.faculty.userId,
      teachesSubject: true,
    });

    assert.ok(reviews.detail.length >= 2, "faculty must see individual reviews");
    assert.ok(reviews.detail.every((review) => review.authorId.length > 0));
    assert.equal(reviews.aggregate, null, "faculty get detail, not the member's aggregate view");
  });

  it("withholds the aggregate below two reviews", async () => {
    // With one review, "the average about you" and "what that one person said"
    // are the same sentence, and the anonymity would be decorative.
    // Counted rather than filtered through a relation: what matters is
    // "fewer than two reviews in THIS group", and a `none: {}` filter on the
    // user would ask "none anywhere", which is a different question.
    const candidates = await db.groupMember.findMany({
      where: { groupId: fx.groupA.id, leftAt: null, userId: { not: fx.memberAId } },
      select: { userId: true },
    });

    let solo: { userId: string } | undefined;
    for (const candidate of candidates) {
      const count = await db.peerReview.count({
        where: { groupId: fx.groupA.id, subjectId: candidate.userId },
      });
      if (count < 2) {
        solo = candidate;
        break;
      }
    }

    if (!solo) return;

    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace);

    const reviews = await getReviews(workspace, { userId: solo.userId, teachesSubject: false });
    assert.equal(reviews.aggregate, null);
  });
});

/* ---------------------------------------------------------------- ledger */

describe("the ledger", () => {
  it("POSITIVE CONTROL — a member reads their group's ledger", async () => {
    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace);

    const events = await listLedgerEvents(workspace);
    assert.ok(events.length > 0, "the seeded group must have ledger events");
  });

  it("is visible to every member, not only to faculty", async () => {
    // The design decision the whole feature rests on. A ledger hidden from the
    // group is surveillance; a visible one changes behaviour during the project.
    const group = await db.group.findUniqueOrThrow({
      where: { id: fx.groupA.id },
      select: {
        id: true,
        collegeId: true,
        classId: true,
        class: { select: { subjectId: true } },
      },
    });
    const resource = groupResource(group);

    assert.equal(can(fx.memberA, "ledger:read", resource), true);
    assert.equal(can(fx.memberA2, "ledger:read", resource), true);
    assert.equal(can(fx.faculty, "ledger:read", resource), true);
    assert.equal(can(fx.memberB, "ledger:read", resource), false);
  });

  it("every event points at a row that exists", async () => {
    // db:verify asserts this over the whole seed; asserted here too because it
    // is the claim the feature's credibility rests on, and a query that
    // returned dangling events would still look fine on screen.
    const workspace = await requireWorkspace(fx.memberA, fx.groupA.id);
    assert.ok(workspace);

    const events = await listLedgerEvents(workspace);
    const byType = new Map<string, string[]>();
    for (const event of events) {
      byType.set(event.subjectType, [...(byType.get(event.subjectType) ?? []), event.subjectId]);
    }

    for (const [type, ids] of byType) {
      const unique = [...new Set(ids)];
      const found =
        type === "Task"
          ? await db.task.count({ where: { id: { in: unique } } })
          : type === "FileAsset"
            ? await db.fileAsset.count({ where: { id: { in: unique } } })
            : type === "Thread"
              ? await db.thread.count({ where: { id: { in: unique } } })
              : type === "Message"
                ? await db.message.count({ where: { id: { in: unique } } })
                : type === "Meeting"
                  ? await db.meeting.count({ where: { id: { in: unique } } })
                  : unique.length;

      assert.equal(
        found,
        unique.length,
        `${type}: ${unique.length - found} events point at nothing`,
      );
    }
  });
});
