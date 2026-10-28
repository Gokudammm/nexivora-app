import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ANONYMOUS, type Viewer, type ViewerClass } from "./viewer";
import {
  ForbiddenError,
  assertCan,
  can,
  type Action,
  type CompanyResource,
  type ProjectResource,
  type Resource,
} from "./policy";

/**
 * THE PERMISSION MATRIX.
 *
 * `docs/ROLES-PERMISSIONS.md` is the contract. This asserts the implementation
 * matches it, role by role and scope by scope. It is the most valuable test in
 * the project for one reason: every later phase calls `can()`, so a permission
 * that is wrong here is wrong in eighteen places later, and permission bugs are
 * the kind that ship silently — nothing crashes when a student can read another
 * team's private work.
 *
 * The table below is written to be read against the document. Where a row looks
 * surprising, the surprise is the point and it carries a comment.
 */

/* ------------------------------------------------------------- the world */

const A = "college-a";
const B = "college-b";

const S1 = "subject-1";
const S2 = "subject-2";
const C1 = "class-1";
const C2 = "class-2";
const G1 = "group-1";
const G2 = "group-2";

const klass = (classId: string, subjectId: string, collegeId = A): ViewerClass => ({
  classId,
  subjectId,
  collegeId,
});

function viewer(overrides: Partial<Viewer> = {}): Viewer {
  return {
    userId: "u-someone",
    emailVerified: true,
    memberships: [],
    groups: [],
    teaches: [],
    enrolledIn: [],
    isPlatformAdmin: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------- the cast */

const anonymous = ANONYMOUS;

/** In group 1, an ordinary member, enrolled in the class it belongs to. */
const student = viewer({
  userId: "u-student",
  memberships: [{ collegeId: A, role: "STUDENT", state: "ACTIVE" }],
  groups: [{ groupId: G1, collegeId: A, role: "MEMBER" }],
  enrolledIn: [klass(C1, S1)],
});

const studentLead = viewer({
  userId: "u-lead",
  memberships: [{ collegeId: A, role: "STUDENT", state: "ACTIVE" }],
  groups: [{ groupId: G1, collegeId: A, role: "LEAD" }],
  enrolledIn: [klass(C1, S1)],
});

/** Same college, different group and class. The classmate who must not see in. */
const otherStudent = viewer({
  userId: "u-other",
  memberships: [{ collegeId: A, role: "STUDENT", state: "ACTIVE" }],
  groups: [{ groupId: G2, collegeId: A, role: "MEMBER" }],
  enrolledIn: [klass(C2, S2)],
});

/** Teaches the subject group 1's project sits under. */
const faculty = viewer({
  userId: "u-faculty",
  memberships: [{ collegeId: A, role: "FACULTY", state: "ACTIVE" }],
  teaches: [klass(C1, S1)],
});

/** Faculty at the same college, teaching a different subject. */
const otherFaculty = viewer({
  userId: "u-faculty-2",
  memberships: [{ collegeId: A, role: "FACULTY", state: "ACTIVE" }],
  teaches: [klass(C2, S2)],
});

const admin = viewer({
  userId: "u-admin",
  memberships: [{ collegeId: A, role: "COLLEGE_ADMIN", state: "ACTIVE" }],
});

const alumnus = viewer({
  userId: "u-alumni",
  memberships: [{ collegeId: A, role: "ALUMNI", state: "ALUMNI" }],
});

const company = viewer({
  userId: "u-company",
  memberships: [{ collegeId: A, role: "COMPANY", state: "ACTIVE" }],
});

const researcher = viewer({
  userId: "u-researcher",
  memberships: [{ collegeId: A, role: "RESEARCHER", state: "ACTIVE" }],
});

const platformAdmin = viewer({
  userId: "u-platform",
  memberships: [{ collegeId: A, role: "PLATFORM_ADMIN", state: "ACTIVE" }],
  isPlatformAdmin: true,
});

/** A student of college B. Every scoped check against college A must deny. */
const outsider = viewer({
  userId: "u-outsider",
  memberships: [{ collegeId: B, role: "STUDENT", state: "ACTIVE" }],
  groups: [{ groupId: "group-b", collegeId: B, role: "MEMBER" }],
  enrolledIn: [klass("class-b", "subject-b", B)],
});

/** From college B, guesting on group 1 at college A (ADR-022). */
const guest = viewer({
  userId: "u-guest",
  memberships: [
    { collegeId: B, role: "STUDENT", state: "ACTIVE" },
    { collegeId: A, role: "STUDENT", state: "GUEST" },
  ],
  groups: [{ groupId: G1, collegeId: A, role: "MEMBER" }],
});

const suspended = viewer({
  userId: "u-suspended",
  memberships: [{ collegeId: A, role: "STUDENT", state: "SUSPENDED" }],
  groups: [{ groupId: G1, collegeId: A, role: "MEMBER" }],
  enrolledIn: [klass(C1, S1)],
});

const unverifiedEmail = viewer({
  userId: "u-unverified",
  emailVerified: false,
  memberships: [{ collegeId: A, role: "STUDENT", state: "ACTIVE" }],
  groups: [{ groupId: G1, collegeId: A, role: "MEMBER" }],
  enrolledIn: [klass(C1, S1)],
});

/* --------------------------------------------------------- the resources */

function project(overrides: Partial<ProjectResource> = {}): ProjectResource {
  return {
    kind: "project",
    collegeId: A,
    groupId: G1,
    subjectId: S1,
    classId: C1,
    visibility: "COLLEGE",
    approved: true,
    status: "IN_PROGRESS",
    collegeVerified: true,
    embargoUntil: null,
    memberIds: ["u-student", "u-lead"],
    ...overrides,
  };
}

const publicProject = project({ visibility: "PUBLIC" });
const collegeProject = project({ visibility: "COLLEGE" });
const classProject = project({ visibility: "CLASS" });
const privateProject = project({ visibility: "PRIVATE", status: "DRAFT" });
const unapprovedPublic = project({ visibility: "PUBLIC", approved: false });
const unverifiedCollegeProject = project({ visibility: "PUBLIC", collegeVerified: false });
const otherCollegeProject = project({
  collegeId: B,
  groupId: "group-b",
  subjectId: "subject-b",
  classId: "class-b",
  visibility: "COLLEGE",
  memberIds: [],
});

const group1: Resource = { kind: "group", collegeId: A, groupId: G1, classId: C1, subjectId: S1 };
const group2: Resource = { kind: "group", collegeId: A, groupId: G2, classId: C2, subjectId: S2 };
const collegeA: Resource = { kind: "college", collegeId: A };
const collegeB: Resource = { kind: "college", collegeId: B };
const class1: Resource = { kind: "class", collegeId: A, classId: C1, subjectId: S1 };

const contactable: Resource = { kind: "user", userId: "u-target", collegeId: A, contactable: true };
const notContactable: Resource = {
  kind: "user",
  userId: "u-target",
  collegeId: A,
  contactable: false,
};

const verifiedCompany: CompanyResource = {
  kind: "company",
  companyUserId: "u-company",
  verified: true,
};
const unverifiedCompany: CompanyResource = {
  kind: "company",
  companyUserId: "u-company",
  verified: false,
};

/* ------------------------------------------------------------ the matrix */

type Row = [
  label: string,
  viewer: Viewer,
  action: Action,
  resource: Resource | undefined,
  expected: boolean,
];

const MATRIX: Row[] = [
  /* ------------------------------------------------- projects: reading */

  ["anonymous reads a public project", anonymous, "project:read", publicProject, true],
  ["anonymous cannot read a college project", anonymous, "project:read", collegeProject, false],
  ["anonymous cannot read a private project", anonymous, "project:read", privateProject, false],
  // ADR-010: public visibility alone is not enough. Approval is required, and it
  // is also a database check constraint.
  [
    "anonymous cannot read an unapproved public project",
    anonymous,
    "project:read",
    unapprovedPublic,
    false,
  ],
  // The anti-abuse gate: nothing from an unverified college is publicly reachable.
  [
    "anonymous cannot read work at an unverified college",
    anonymous,
    "project:read",
    unverifiedCollegeProject,
    false,
  ],

  ["a member reads their own private project", student, "project:read", privateProject, true],
  [
    "a classmate cannot read another group's private project",
    otherStudent,
    "project:read",
    privateProject,
    false,
  ],
  [
    "a classmate reads a college-visible project",
    otherStudent,
    "project:read",
    collegeProject,
    true,
  ],
  // CLASS visibility reaches the class, not the whole college.
  [
    "a student outside the class cannot read a class project",
    otherStudent,
    "project:read",
    classProject,
    false,
  ],
  ["a student in the class reads a class project", student, "project:read", classProject, true],

  [
    "the supervising faculty reads a private project",
    faculty,
    "project:read",
    privateProject,
    true,
  ],
  ["faculty from another subject cannot", otherFaculty, "project:read", privateProject, false],
  ["a college admin reads anything in their college", admin, "project:read", privateProject, true],

  [
    "a member of college B cannot read college A's work",
    outsider,
    "project:read",
    collegeProject,
    false,
  ],
  [
    "a member of college B cannot read college A's private work",
    outsider,
    "project:read",
    privateProject,
    false,
  ],
  ["college A cannot read college B's work", student, "project:read", otherCollegeProject, false],

  // A guest sees the group they were invited into and nothing else at that college.
  ["a guest reads their own group's project", guest, "project:read", privateProject, true],
  [
    "a guest cannot read the rest of the college",
    guest,
    "project:read",
    project({ groupId: G2, memberIds: [] }),
    false,
  ],

  [
    "an alumnus keeps reading a project they are credited on",
    viewer({
      userId: "u-student",
      memberships: [{ collegeId: A, role: "ALUMNI", state: "ALUMNI" }],
    }),
    "project:read",
    privateProject,
    true,
  ],

  /* ------------------------------------------------- projects: writing */

  ["a member edits sections", student, "project:edit", privateProject, true],
  // Faculty comment, they never edit — silent supervisor edits would destroy the
  // evidentiary value of the ledger.
  ["faculty cannot edit sections", faculty, "project:edit", privateProject, false],
  ["faculty can comment", faculty, "project:comment", privateProject, true],
  ["a college admin cannot edit sections", admin, "project:edit", privateProject, false],

  ["faculty approve a proposal", faculty, "project:approve", privateProject, true],
  [
    "a student cannot approve their own proposal",
    student,
    "project:approve",
    privateProject,
    false,
  ],
  ["a college admin cannot approve", admin, "project:approve", privateProject, false],

  ["faculty evaluate", faculty, "project:evaluate", collegeProject, true],
  ["a college admin cannot grade", admin, "project:evaluate", collegeProject, false],
  // An academic judgement belongs to the supervising faculty member, not to us.
  ["even a platform admin cannot grade", platformAdmin, "project:evaluate", collegeProject, false],

  ["a group lead submits for review", studentLead, "project:submit", privateProject, true],
  ["an ordinary member cannot submit", student, "project:submit", privateProject, false],

  ["a group lead changes visibility", studentLead, "project:visibility", privateProject, true],
  [
    "an ordinary member cannot change visibility",
    student,
    "project:visibility",
    privateProject,
    false,
  ],
  ["a college admin can change visibility", admin, "project:visibility", privateProject, true],

  ["a member deletes their own draft", student, "project:delete", privateProject, true],
  [
    "a member cannot delete a project in progress",
    student,
    "project:delete",
    collegeProject,
    false,
  ],
  ["faculty cannot delete", faculty, "project:delete", privateProject, false],

  ["anyone may build on what they can read", researcher, "project:fork", publicProject, true],
  ["you cannot build on what you cannot read", researcher, "project:fork", privateProject, false],

  /* ------------------------------------------------------- the workspace */

  ["a member reads the workspace", student, "workspace:read", group1, true],
  ["the supervising faculty reads the workspace", faculty, "workspace:read", group1, true],
  ["another group's member cannot", otherStudent, "workspace:read", group1, false],
  // The positive control for the row above. Without it, a policy that denied
  // *everything* would pass every denial assertion in this file.
  [
    "that same student reads their own group's workspace",
    otherStudent,
    "workspace:read",
    group2,
    true,
  ],
  ["the first group's member cannot read theirs either", student, "workspace:read", group2, false],
  // Deliberate: an administrator sees reports, not the room.
  ["a college admin cannot read a workspace", admin, "workspace:read", group1, false],
  ["college B cannot read college A's workspace", outsider, "workspace:read", group1, false],

  ["a member writes tasks", student, "task:write", group1, true],
  ["faculty write tasks", faculty, "task:write", group1, true],
  ["faculty upload files", faculty, "file:upload", group1, true],
  // Deletion by a supervisor is indistinguishable from tampering after the fact.
  ["faculty cannot delete files", faculty, "file:delete", group1, false],
  ["a member deletes files", student, "file:delete", group1, true],

  ["every member reads the ledger", student, "ledger:read", group1, true],
  ["faculty read the ledger", faculty, "ledger:read", group1, true],
  ["a college admin reads the ledger (aggregate)", admin, "ledger:read", group1, true],
  ["another group cannot read the ledger", otherStudent, "ledger:read", group1, false],

  ["a member submits a peer review", student, "peerreview:submit", group1, true],
  // ADR-008: honest review is impossible without this asymmetry.
  [
    "a member cannot read individual peer reviews",
    student,
    "peerreview:read:individual",
    group1,
    false,
  ],
  ["faculty read individual peer reviews", faculty, "peerreview:read:individual", group1, true],
  [
    "a college admin cannot read individual peer reviews",
    admin,
    "peerreview:read:individual",
    group1,
    false,
  ],

  ["a student creates a group in their class", student, "group:create", class1, true],
  ["a student cannot create a group in another class", otherStudent, "group:create", class1, false],
  ["faculty create a group in their class", faculty, "group:create", class1, true],
  ["a group lead invites", studentLead, "group:invite", group1, true],
  ["an ordinary member cannot invite", student, "group:invite", group1, false],

  /* --------------------------------------------------- administration */

  ["a college admin manages their college", admin, "college:manage", collegeA, true],
  ["faculty cannot manage the college", faculty, "college:manage", collegeA, false],
  ["a student cannot manage the college", student, "college:manage", collegeA, false],
  ["a college admin cannot manage another college", admin, "college:manage", collegeB, false],
  ["a college admin reads the audit log", admin, "audit:read", collegeA, true],
  ["faculty cannot read the audit log", faculty, "audit:read", collegeA, false],
  ["a college admin requests verification", admin, "college:verify:request", collegeA, true],
  // A college that could verify itself is not a trust gate.
  ["a college admin cannot grant verification", admin, "college:verify:grant", collegeA, false],
  ["a platform admin grants verification", platformAdmin, "college:verify:grant", collegeA, true],
  ["a college admin generates the accreditation export", admin, "export:generate", collegeA, true],

  /* ---------------------------------------------------------- the social */

  ["a student posts", student, "post:create", undefined, true],
  ["a company cannot post freely", company, "post:create", undefined, false],
  ["a company posts about its own opportunity", company, "post:create", verifiedCompany, true],
  ["a verified company posts an opportunity", company, "opportunity:post", verifiedCompany, true],
  // Fake internships charging a "certificate fee" are a real scam aimed at
  // exactly these students.
  [
    "an unverified company cannot post an opportunity",
    company,
    "opportunity:post",
    unverifiedCompany,
    false,
  ],
  ["a student cannot post an opportunity", student, "opportunity:post", verifiedCompany, false],

  ["a student sends a collaboration request", student, "collab:request", undefined, true],
  ["a company does not send collaboration requests", company, "collab:request", undefined, false],
  ["faculty offer mentorship", faculty, "mentorship:offer", undefined, true],
  ["alumni offer mentorship", alumnus, "mentorship:offer", undefined, true],
  ["a student does not offer mentorship", student, "mentorship:offer", undefined, false],

  // The difference between a talent platform and a spam channel.
  ["a company contacts a student who opted in", company, "student:contact", contactable, true],
  [
    "a company cannot contact a student who did not",
    company,
    "student:contact",
    notContactable,
    false,
  ],
  [
    "a classmate cannot contact a student who did not opt in",
    otherStudent,
    "student:contact",
    notContactable,
    false,
  ],

  ["anyone reports content", student, "report:create", undefined, true],
  [
    "faculty moderate in their subject",
    faculty,
    "report:moderate",
    { kind: "report", collegeId: A, subjectId: S1 },
    true,
  ],
  [
    "faculty do not moderate other subjects",
    faculty,
    "report:moderate",
    { kind: "report", collegeId: A, subjectId: S2 },
    false,
  ],
  [
    "a college admin moderates college-wide",
    admin,
    "report:moderate",
    { kind: "report", collegeId: A, subjectId: null },
    true,
  ],

  /* ------------------------------------------------------ special states */

  // Suspended is read-only on everything.
  ["a suspended member still reads", suspended, "project:read", privateProject, true],
  ["a suspended member cannot edit", suspended, "project:edit", privateProject, false],
  ["a suspended member cannot post", suspended, "post:create", undefined, false],
  ["a suspended member cannot write tasks", suspended, "task:write", group1, false],

  // Acceptance criterion 9: browse, but create nothing.
  ["an unverified account still reads", unverifiedEmail, "project:read", privateProject, true],
  ["an unverified account cannot edit", unverifiedEmail, "project:edit", privateProject, false],
  ["an unverified account cannot comment", unverifiedEmail, "comment:create", undefined, false],

  ["anonymous can do nothing but read public work", anonymous, "post:create", undefined, false],
  ["anonymous cannot fork", anonymous, "project:fork", publicProject, false],
];

/* ------------------------------------------------------------------ tests */

describe("can() — the permission matrix", () => {
  for (const [label, subject, action, resource, expected] of MATRIX) {
    it(`${expected ? "allows" : "denies"}: ${label}`, () => {
      assert.equal(
        can(subject, action, resource),
        expected,
        `expected can(${action}) to be ${expected}`,
      );
    });
  }
});

/**
 * Acceptance criterion 3, at the policy layer: a member of college B is denied
 * every scoped action against college A's data. Exhaustive over the action
 * union rather than a sample, so an action added later is covered whether or
 * not anyone remembers to add a row.
 */
describe("cross-college isolation", () => {
  const scopedResources: Resource[] = [
    collegeProject,
    privateProject,
    publicProject,
    group1,
    collegeA,
    class1,
  ];

  const ALL_ACTIONS: Action[] = [
    "project:create",
    "project:read",
    "project:edit",
    "project:approve",
    "project:visibility",
    "project:embargo",
    "project:submit",
    "project:evaluate",
    "project:archive",
    "project:delete",
    "project:fork",
    "project:comment",
    "group:create",
    "group:join",
    "group:invite",
    "workspace:read",
    "task:write",
    "file:upload",
    "file:delete",
    "discussion:post",
    "meeting:schedule",
    "ledger:read",
    "peerreview:submit",
    "peerreview:read:individual",
    "college:manage",
    "class:manage",
    "roster:manage",
    "invite:issue",
    "member:suspend",
    "college:edit",
    "college:verify:request",
    "college:verify:grant",
    "audit:read",
    "export:generate",
    "report:moderate",
  ];

  for (const action of ALL_ACTIONS) {
    it(`denies ${action} against another college`, () => {
      for (const resource of scopedResources) {
        // The one legitimate exception: genuinely public, approved work at a
        // verified college is readable by anyone, including the whole internet.
        const isPublicRead =
          resource === publicProject && (action === "project:read" || action === "project:fork");

        assert.equal(
          can(outsider, action, resource),
          isPublicRead,
          `${action} on ${resource.kind} leaked across a college boundary`,
        );
      }
    });
  }
});

describe("guests do not gain college-wide reach", () => {
  it("cannot read college-visible work outside their group", () => {
    assert.equal(can(guest, "project:read", project({ groupId: G2, memberIds: [] })), false);
  });

  it("cannot administer the host college even if somehow granted the role", () => {
    const adminGuest = viewer({
      userId: "u-guest-admin",
      memberships: [
        { collegeId: B, role: "STUDENT", state: "ACTIVE" },
        { collegeId: A, role: "COLLEGE_ADMIN", state: "GUEST" },
      ],
    });

    assert.equal(can(adminGuest, "college:manage", collegeA), false);
  });
});

describe("the default is denial", () => {
  it("denies an unknown action rather than allowing it", () => {
    // Casting past the union deliberately: this asserts the runtime behaviour a
    // future action would get if someone forgot to add a case.
    assert.equal(can(student, "totally:invented" as Action, privateProject), false);
  });

  it("denies a resource of the wrong kind", () => {
    assert.equal(can(student, "workspace:read", collegeA), false);
    assert.equal(can(faculty, "project:approve", group1), false);
  });

  it("denies when a resource is required and missing", () => {
    assert.equal(can(student, "project:read", undefined), false);
    assert.equal(can(faculty, "project:evaluate", undefined), false);
  });
});

describe("assertCan", () => {
  it("passes silently when permitted", () => {
    assert.doesNotThrow(() => assertCan(student, "project:edit", privateProject));
  });

  it("throws ForbiddenError when denied", () => {
    assert.throws(() => assertCan(otherStudent, "project:edit", privateProject), ForbiddenError);
  });

  it("names the action in the error", () => {
    try {
      assertCan(otherStudent, "project:edit", privateProject);
      assert.fail("expected a throw");
    } catch (error) {
      assert.ok(error instanceof ForbiddenError);
      assert.equal(error.action, "project:edit");
    }
  });
});
