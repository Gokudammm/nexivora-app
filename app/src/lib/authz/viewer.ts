import type { $Enums } from "@prisma/client";

/**
 * THE VIEWER.
 *
 * Everything the authorisation layer is allowed to know about who is asking.
 * Built once per request from the session, then passed explicitly — never read
 * from a global, never re-fetched inside a query.
 *
 * The shape is dictated by one rule from `docs/ROLES-PERMISSIONS.md`:
 *
 * > **Roles are per-membership, not global.**
 *
 * A user can be `ALUMNI` at one college and `COMPANY` at an employer at the
 * same time. There is deliberately no `viewer.role`, because the question
 * "what is this person's role" has no answer — only "what is their role *here*"
 * does. A single role column would break the alumni transition and the
 * multi-college case, and unwinding it later would touch every phase.
 *
 * Faculty scope is narrower still: a faculty member may read every project in
 * **their subject**, not every project in the college. That is why `teaches`
 * exists as a list of subjects rather than a boolean.
 */

export type ViewerMembership = {
  collegeId: string;
  role: $Enums.Role;
  state: $Enums.MembershipState;
};

export type ViewerGroup = {
  groupId: string;
  collegeId: string;
  role: $Enums.GroupRole;
};

export type ViewerClass = {
  classId: string;
  subjectId: string;
  collegeId: string;
};

export type Viewer = {
  /** Null for the public internet. */
  userId: string | null;

  /**
   * Unverified users may browse and may not create. Carried on the viewer
   * rather than checked at each call site, so the rule is enforced in one place
   * (acceptance criterion 9).
   */
  emailVerified: boolean;

  memberships: readonly ViewerMembership[];
  groups: readonly ViewerGroup[];
  /** Classes this viewer teaches — the faculty SUBJECT scope. */
  teaches: readonly ViewerClass[];
  /** Classes this viewer is enrolled in — the student CLASS scope. */
  enrolledIn: readonly ViewerClass[];

  isPlatformAdmin: boolean;
};

/**
 * The logged-out public. A real viewer, not a null.
 *
 * Naming the anonymous case keeps it on the same code path as every other
 * viewer. The alternative — `viewer?: Viewer` — means every query has to
 * remember to handle undefined, and the one that forgets serves private data.
 */
export const ANONYMOUS: Viewer = {
  userId: null,
  emailVerified: false,
  memberships: [],
  groups: [],
  teaches: [],
  enrolledIn: [],
  isPlatformAdmin: false,
};

/* ------------------------------------------------------------------ states */

/**
 * States that grant access at all. `INVITED` has not accepted yet; `SUSPENDED`
 * is read-only and is handled separately, because it must still be able to read.
 */
const READ_STATES: ReadonlySet<$Enums.MembershipState> = new Set([
  "ACTIVE",
  "ALUMNI",
  "GUEST",
  "SUSPENDED",
]);

const WRITE_STATES: ReadonlySet<$Enums.MembershipState> = new Set(["ACTIVE", "ALUMNI", "GUEST"]);

export const isAnonymous = (viewer: Viewer): boolean => viewer.userId === null;

/** Memberships that grant any access at all. */
export function membershipsAt(viewer: Viewer, collegeId: string): ViewerMembership[] {
  return viewer.memberships.filter(
    (membership) => membership.collegeId === collegeId && READ_STATES.has(membership.state),
  );
}

export function hasRoleAt(viewer: Viewer, collegeId: string, role: $Enums.Role): boolean {
  return membershipsAt(viewer, collegeId).some((membership) => membership.role === role);
}

/**
 * A suspended member is read-only on everything: they cannot post, comment,
 * submit or be assigned. Checked once in `can()` rather than per action.
 */
export function isSuspendedAt(viewer: Viewer, collegeId: string): boolean {
  const relevant = viewer.memberships.filter((m) => m.collegeId === collegeId);
  if (relevant.length === 0) return false;

  return relevant.every((m) => m.state === "SUSPENDED");
}

export function canWriteAt(viewer: Viewer, collegeId: string): boolean {
  return viewer.memberships.some(
    (membership) => membership.collegeId === collegeId && WRITE_STATES.has(membership.state),
  );
}

/**
 * A guest belongs to a partner college and has project-scoped access only
 * (ADR-022). They must never receive college-wide reach, which is exactly what
 * `belongsTo()` would grant them if guests were not separated out here.
 */
export function isGuestAt(viewer: Viewer, collegeId: string): boolean {
  const relevant = membershipsAt(viewer, collegeId);
  return relevant.length > 0 && relevant.every((m) => m.state === "GUEST");
}

/** True for full membership of a college — deliberately excludes guests. */
export function belongsTo(viewer: Viewer, collegeId: string): boolean {
  return membershipsAt(viewer, collegeId).some((m) => m.state !== "GUEST");
}

/* ------------------------------------------------------------------ scopes */

export const groupIds = (viewer: Viewer): string[] => viewer.groups.map((group) => group.groupId);

/** Colleges the viewer can see college-scoped content in. Excludes guests. */
export const collegeIds = (viewer: Viewer): string[] => [
  ...new Set(
    viewer.memberships
      .filter((m) => READ_STATES.has(m.state) && m.state !== "GUEST")
      .map((m) => m.collegeId),
  ),
];

export const taughtSubjectIds = (viewer: Viewer): string[] => [
  ...new Set(viewer.teaches.map((klass) => klass.subjectId)),
];

export const taughtClassIds = (viewer: Viewer): string[] => [
  ...new Set(viewer.teaches.map((klass) => klass.classId)),
];

export const enrolledClassIds = (viewer: Viewer): string[] => [
  ...new Set(viewer.enrolledIn.map((klass) => klass.classId)),
];

export function isGroupMember(viewer: Viewer, groupId: string | null | undefined): boolean {
  return groupId !== null && groupId !== undefined && groupIds(viewer).includes(groupId);
}

export function isGroupLead(viewer: Viewer, groupId: string | null | undefined): boolean {
  if (!groupId) return false;
  return viewer.groups.some((group) => group.groupId === groupId && group.role === "LEAD");
}

export function teachesSubject(viewer: Viewer, subjectId: string | null | undefined): boolean {
  if (!subjectId) return false;
  return viewer.teaches.some((klass) => klass.subjectId === subjectId);
}

export function teachesClass(viewer: Viewer, classId: string | null | undefined): boolean {
  if (!classId) return false;
  return viewer.teaches.some((klass) => klass.classId === classId);
}

export function enrolledInClass(viewer: Viewer, classId: string | null | undefined): boolean {
  if (!classId) return false;
  return viewer.enrolledIn.some((klass) => klass.classId === classId);
}

/** Any role at any college — for the coarse gates only, never for a resource check. */
export function hasAnyRole(viewer: Viewer, role: $Enums.Role): boolean {
  return viewer.memberships.some((m) => m.role === role && READ_STATES.has(m.state));
}
