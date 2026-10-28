import type { Prisma } from "@prisma/client";

import { hasRoleAt, membershipsAt, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

/**
 * Institution queries: colleges and the hierarchy beneath them.
 *
 * Two predicates carry this module, and both are written once here.
 *
 * **`publiclyListed`** — a college reaches the open internet only when it is
 * VERIFIED. That is the anti-abuse gate: anyone can register a "college", and
 * until a human has checked it, nothing it contains is indexable and it does
 * not appear in inter-college surfaces. Enforcing it here rather than in the
 * page is what stops an unverified college leaking into the sitemap, which is
 * the failure mode `docs/phases/phase-05` calls out by name.
 *
 * **`manageableBy`** — an administrator manages exactly one college's
 * hierarchy: their own. Guests are excluded, so a guest membership at a partner
 * college can never become administrative reach (ADR-022).
 */

/* ------------------------------------------------------------- predicates */

export const publiclyListed: Prisma.CollegeWhereInput = { verification: "VERIFIED" };

/** Colleges this viewer may administer. Empty for everyone who is not an admin. */
export function administeredCollegeIds(viewer: Viewer): string[] {
  if (viewer.isPlatformAdmin) return [];

  return [...new Set(viewer.memberships.map((membership) => membership.collegeId))].filter(
    (collegeId) =>
      // A GUEST membership never grants administration, whatever role it names.
      membershipsAt(viewer, collegeId).some(
        (membership) => membership.role === "COLLEGE_ADMIN" && membership.state !== "GUEST",
      ),
  );
}

export function canAdminister(viewer: Viewer, collegeId: string): boolean {
  if (viewer.isPlatformAdmin) return true;
  return hasRoleAt(viewer, collegeId, "COLLEGE_ADMIN") && !isGuestOnly(viewer, collegeId);
}

function isGuestOnly(viewer: Viewer, collegeId: string): boolean {
  const relevant = membershipsAt(viewer, collegeId);
  return relevant.length > 0 && relevant.every((membership) => membership.state === "GUEST");
}

/**
 * What a viewer may see of a college.
 *
 * Verified colleges are public. An unverified one is visible only to its own
 * members — they can use the product internally while verification is pending,
 * which is what makes the gate a quality control rather than a barrier to entry.
 */
export function collegeVisibleTo(viewer: Viewer): Prisma.CollegeWhereInput {
  if (viewer.isPlatformAdmin) return {};
  if (viewer.userId === null) return publiclyListed;

  return {
    OR: [publiclyListed, { id: { in: [...new Set(viewer.memberships.map((m) => m.collegeId))] } }],
  };
}

/* ------------------------------------------------------------- public read */

const collegeCardSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  code: true,
  city: true,
  state: true,
  website: true,
  description: true,
  foundingDate: true,
  logoUrl: true,
  accentColor: true,
  verification: true,
  // Counted here rather than by loading the rows: the directory shows a number,
  // not a list, and archived departments must not inflate it.
  _count: { select: { departments: { where: { archivedAt: null } } } },
} satisfies Prisma.CollegeSelect;

export type CollegeCard = Prisma.CollegeGetPayload<{ select: typeof collegeCardSelect }>;

export async function listColleges(viewer: Viewer): Promise<CollegeCard[]> {
  return db.college.findMany({
    where: collegeVisibleTo(viewer),
    select: collegeCardSelect,
    orderBy: { name: "asc" },
  });
}

export async function getCollege(viewer: Viewer, slug: string) {
  return db.college.findFirst({
    where: { AND: [collegeVisibleTo(viewer), { slug }] },
    select: {
      ...collegeCardSelect,
      timezone: true,
      emailDomains: true,
      verifiedAt: true,
      departments: {
        where: { archivedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

/**
 * Slugs for `generateStaticParams` and the sitemap.
 *
 * Always called with the anonymous viewer, and takes one anyway so a future
 * change that made it viewer-sensitive is explicit rather than accidental.
 */
export async function publicCollegeSlugs(viewer: Viewer): Promise<string[]> {
  const rows = await db.college.findMany({
    where: collegeVisibleTo(viewer),
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  return rows.map((row) => row.slug);
}

/**
 * Headline numbers for a college page.
 *
 * Counted through the same visibility rules as the listings, so the number
 * above a list always matches the length of the list. A count that disagrees
 * with what is shown is the kind of small dishonesty that makes people stop
 * trusting the rest of the page.
 */
export async function collegeStats(
  viewer: Viewer,
  collegeId: string,
  projectWhere: Prisma.ProjectWhereInput,
): Promise<{ projects: number; students: number; faculty: number }> {
  const [projects, students, faculty] = await Promise.all([
    db.project.count({ where: { AND: [projectWhere, { collegeId }] } }),
    // Guests belong to another college and must not be counted here.
    db.membership.count({
      where: { collegeId, role: "STUDENT", state: { in: ["ACTIVE", "INVITED"] } },
    }),
    db.membership.count({ where: { collegeId, role: "FACULTY", state: "ACTIVE" } }),
  ]);

  return { projects, students, faculty };
}

/* -------------------------------------------------------------- hierarchy */

/**
 * The whole hierarchy for an administrator.
 *
 * Returns null rather than throwing when the viewer may not administer it, so
 * a college admin poking at another college's id gets a 404 rather than a
 * confirmation that it exists.
 */
export async function getHierarchy(viewer: Viewer, collegeId: string) {
  if (!canAdminister(viewer, collegeId)) return null;

  return db.college.findUnique({
    where: { id: collegeId },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      verification: true,
      emailDomains: true,
      departments: {
        select: {
          id: true,
          name: true,
          code: true,
          archivedAt: true,
          _count: { select: { programmes: true, subjects: true } },
        },
        orderBy: { name: "asc" },
      },
      terms: {
        select: { id: true, name: true, startsOn: true, endsOn: true, isActive: true },
        orderBy: { startsOn: "desc" },
      },
    },
  });
}

export async function listDepartments(viewer: Viewer, collegeId: string) {
  if (!canAdminister(viewer, collegeId)) return [];

  return db.department.findMany({
    where: { collegeId },
    select: {
      id: true,
      name: true,
      code: true,
      archivedAt: true,
      programmes: {
        select: {
          id: true,
          name: true,
          code: true,
          degreeType: true,
          durationYears: true,
          archivedAt: true,
        },
        orderBy: { name: "asc" },
      },
      _count: { select: { subjects: true } },
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
  });
}

export async function listSubjects(viewer: Viewer, collegeId: string) {
  if (!canAdminister(viewer, collegeId)) return [];

  return db.subject.findMany({
    where: { collegeId },
    select: {
      id: true,
      name: true,
      code: true,
      credits: true,
      semester: true,
      archivedAt: true,
      department: { select: { id: true, name: true } },
      programme: { select: { id: true, name: true } },
      _count: { select: { classes: true } },
    },
    orderBy: [{ archivedAt: "asc" }, { code: "asc" }],
  });
}

export async function listTerms(viewer: Viewer, collegeId: string) {
  if (!canAdminister(viewer, collegeId)) return [];

  return db.term.findMany({
    where: { collegeId },
    select: {
      id: true,
      name: true,
      startsOn: true,
      endsOn: true,
      isActive: true,
      _count: { select: { classes: true, projects: true } },
    },
    orderBy: { startsOn: "desc" },
  });
}

export async function listClasses(
  viewer: Viewer,
  collegeId: string,
  options: { termId?: string } = {},
) {
  if (!canAdminister(viewer, collegeId)) return [];

  return db.class.findMany({
    where: { collegeId, ...(options.termId ? { termId: options.termId } : {}) },
    select: {
      id: true,
      section: true,
      archivedAt: true,
      subject: { select: { id: true, name: true, code: true } },
      term: { select: { id: true, name: true, isActive: true } },
      assignments: { select: { user: { select: { id: true, name: true, username: true } } } },
      _count: { select: { enrolments: true, groups: true } },
    },
    orderBy: [{ archivedAt: "asc" }, { section: "asc" }],
  });
}

export async function getClass(viewer: Viewer, collegeId: string, classId: string) {
  if (!canAdminister(viewer, collegeId)) return null;

  return db.class.findFirst({
    // Scoped by collegeId as well as id, so an id from another college resolves
    // to nothing rather than to another college's roster.
    where: { id: classId, collegeId },
    select: {
      id: true,
      section: true,
      archivedAt: true,
      subject: {
        select: { id: true, name: true, code: true, department: { select: { name: true } } },
      },
      term: { select: { id: true, name: true, startsOn: true, endsOn: true } },
      assignments: {
        select: {
          id: true,
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
      },
      enrolments: {
        select: {
          id: true,
          user: { select: { id: true, name: true, username: true, avatarUrl: true, email: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
      groups: {
        select: { id: true, name: true, _count: { select: { members: true, projects: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
}

/* ----------------------------------------------------------------- people */

export type PeopleFilter = {
  q?: string;
  role?: Prisma.EnumRoleFilter;
  state?: Prisma.EnumMembershipStateFilter;
  take?: number;
  skip?: number;
};

/**
 * The administrative roster.
 *
 * Guests appear with their state visible rather than being hidden: an
 * administrator should be able to see who has been let in from a partner
 * college. They are excluded from *counts* and from the public directory,
 * which is a different question.
 */
export async function listPeople(viewer: Viewer, collegeId: string, filter: PeopleFilter = {}) {
  if (!canAdminister(viewer, collegeId)) return [];

  const { q, role, state, take = 50, skip = 0 } = filter;

  return db.membership.findMany({
    where: {
      collegeId,
      ...(role ? { role } : {}),
      ...(state ? { state } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      role: true,
      state: true,
      title: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatarUrl: true,
          emailVerified: true,
          lastLoginAt: true,
        },
      },
    },
    orderBy: [{ state: "asc" }, { user: { name: "asc" } }],
    take,
    skip,
  });
}

export async function countPeople(viewer: Viewer, collegeId: string, filter: PeopleFilter = {}) {
  if (!canAdminister(viewer, collegeId)) return 0;

  return db.membership.count({
    where: {
      collegeId,
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.state ? { state: filter.state } : {}),
    },
  });
}

/**
 * The public directory for a college page.
 *
 * Three gates, all of which must pass: the person opted into a public profile,
 * they opted into being discoverable, and their membership is a real one rather
 * than a guest's. Defaults are the most private useful setting, so this list is
 * short by design — that is correct, not a bug.
 */
export async function publicDirectory(collegeId: string, take = 12) {
  return db.user.findMany({
    where: {
      deletedAt: null,
      privacy: { profileVisibility: "PUBLIC", inCollegeDirectory: true },
      memberships: {
        some: { collegeId, state: { in: ["ACTIVE", "ALUMNI"] } },
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      headline: true,
      memberships: {
        where: { collegeId },
        select: { role: true, state: true },
      },
    },
    orderBy: { name: "asc" },
    take,
  });
}
