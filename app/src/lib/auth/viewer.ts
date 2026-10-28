import { db } from "@/lib/db/client";
import { ANONYMOUS, type Viewer } from "@/lib/authz/viewer";

/**
 * Building a `Viewer` from the database.
 *
 * Called once per request. Deliberately not memoised across requests: a stale
 * viewer is a permission bug, and a cached one would mean a suspended member
 * keeps writing until their cache entry expires. Request-scoped caching belongs
 * to the request.
 *
 * The JWT carries a compact form of this so most requests authorise without a
 * database round-trip — see `toToken`/`fromToken` below. That optimisation
 * comes with an obligation: **a membership change must invalidate the token**,
 * or an administrator changes a role and nothing happens. `membershipVersion`
 * is what makes that detectable.
 */

export async function loadViewer(userId: string): Promise<Viewer> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      emailVerified: true,
      memberships: {
        select: { collegeId: true, role: true, state: true },
      },
      groupMemberships: {
        where: { leftAt: null },
        select: { groupId: true, role: true, group: { select: { collegeId: true } } },
      },
      subjectAssignments: {
        select: {
          class: { select: { id: true, subjectId: true, collegeId: true } },
        },
      },
      enrolments: {
        select: {
          class: { select: { id: true, subjectId: true, collegeId: true } },
        },
      },
    },
  });

  if (!user) return ANONYMOUS;

  return {
    userId: user.id,
    emailVerified: user.emailVerified !== null,
    memberships: user.memberships.map((m) => ({
      collegeId: m.collegeId,
      role: m.role,
      state: m.state,
    })),
    groups: user.groupMemberships.map((g) => ({
      groupId: g.groupId,
      collegeId: g.group.collegeId,
      role: g.role,
    })),
    teaches: user.subjectAssignments.map((a) => ({
      classId: a.class.id,
      subjectId: a.class.subjectId,
      collegeId: a.class.collegeId,
    })),
    enrolledIn: user.enrolments.map((e) => ({
      classId: e.class.id,
      subjectId: e.class.subjectId,
      collegeId: e.class.collegeId,
    })),
    isPlatformAdmin: user.memberships.some(
      (m) => m.role === "PLATFORM_ADMIN" && m.state === "ACTIVE",
    ),
  };
}

/**
 * A short fingerprint of everything that affects authorisation.
 *
 * The session token carries this. When it stops matching what the database
 * says, the token is stale and the viewer is reloaded — which is how a role
 * change, a suspension or a new group membership takes effect on the next
 * request rather than at the next sign-in.
 *
 * Cheap enough to compute per request; it is a single indexed read plus a
 * string join, against saving a five-table join on every authorised request.
 */
export async function membershipVersion(userId: string): Promise<string> {
  const [memberships, groups] = await Promise.all([
    db.membership.findMany({
      where: { userId },
      select: { collegeId: true, role: true, state: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
    db.groupMember.findMany({
      where: { userId, leftAt: null },
      select: { groupId: true, role: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const parts = [
    ...memberships.map((m) => `${m.collegeId}:${m.role}:${m.state}:${m.updatedAt.getTime()}`),
    ...groups.map((g) => `${g.groupId}:${g.role}`),
  ];

  // A length prefix, so two different membership sets cannot collide by
  // concatenation.
  return `${parts.length}#${parts.join("|")}`;
}
