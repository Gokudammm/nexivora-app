import type { $Enums, Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";

import type { ProjectResource } from "@/lib/authz/policy";
import {
  belongsTo,
  collegeIds,
  enrolledClassIds,
  groupIds,
  isGroupMember,
  membershipsAt,
  taughtClassIds,
  taughtSubjectIds,
  type Viewer,
} from "@/lib/authz/viewer";

/** Colleges where the viewer is an administrator — full read across the college. */
const adminCollegeIds = (viewer: Viewer): string[] =>
  collegeIds(viewer).filter((collegeId) =>
    membershipsAt(viewer, collegeId).some((m) => m.role === "COLLEGE_ADMIN"),
  );

/**
 * Project queries.
 *
 * This module is the Phase 5 target: the public pages currently import from
 * `@/content/projects`, and switching them to import from here must not change
 * a single rendered page. `scripts/verify-db.mjs` and the fixtures together are
 * what make that checkable rather than hoped for.
 *
 * The one rule: **`visibleTo()` is the only place the visibility predicate is
 * written.** Every query below composes it. Phase 2 learned this the hard way
 * on the fixture side (`src/content/index.ts` has the same single predicate) —
 * a second copy of "which projects can this person see" is a leak waiting for a
 * refactor.
 */

/**
 * The predicate, once.
 *
 * Public visibility is derived, never asserted (ADR-010): a project reaches the
 * open internet only if it is PUBLIC *and* faculty-approved *and* its college
 * is verified. The first two are also enforced by a check constraint; the
 * college gate cannot be, because it lives on another table.
 */
export function visibleTo(viewer: Viewer): Prisma.ProjectWhereInput {
  const publiclyVisible: Prisma.ProjectWhereInput = {
    visibility: "PUBLIC",
    approved: true,
    college: { verification: "VERIFIED" },
  };

  if (viewer.isPlatformAdmin) return { deletedAt: null };

  if (viewer.userId === null) return { deletedAt: null, ...publiclyVisible };

  const taughtSubjects = taughtSubjectIds(viewer);
  const classes = [...enrolledClassIds(viewer), ...taughtClassIds(viewer)];

  return {
    deletedAt: null,
    OR: [
      publiclyVisible,

      // College-wide work, for full members of that college. Guests are
      // excluded by `collegeIds()` — they see their own groups, nothing more.
      { collegeId: { in: collegeIds(viewer) }, visibility: "COLLEGE" },

      // Class-visible work reaches the class, not the whole college.
      {
        collegeId: { in: collegeIds(viewer) },
        visibility: "CLASS",
        group: { classId: { in: classes } },
      },

      // A college admin reads everything inside their own college.
      { collegeId: { in: adminCollegeIds(viewer) } },

      // The supervising faculty member, scoped to the subject they teach —
      // never to the whole college.
      { group: { class: { subjectId: { in: taughtSubjects } } } },

      // Their own group's work, at any visibility including PRIVATE.
      { groupId: { in: groupIds(viewer) } },

      // Anything they are personally credited on. Authorship persists forever,
      // including after graduation.
      { members: { some: { userId: viewer.userId } } },
    ],
  };
}

/**
 * Turn a loaded project row into the shape `can()` reasons about.
 *
 * This exists so the two halves of the visibility rule cannot drift: `visibleTo`
 * filters lists in SQL, `can(viewer, 'project:read', …)` decides about a single
 * loaded row, and `policy.test.ts` asserts they agree on the seeded corpus.
 * Without a shared adapter the two would be written twice and would eventually
 * disagree — which is a leak in one direction and a mystery 404 in the other.
 */
export function projectResource(project: {
  collegeId: string;
  groupId: string | null;
  visibility: $Enums.Visibility;
  approved: boolean;
  status: $Enums.ProjectStatus;
  embargoUntil: Date | null;
  college?: { verification: $Enums.VerificationState } | null;
  group?: { classId: string | null; class?: { subjectId: string } | null } | null;
  members?: readonly { user?: { id?: string } | null; userId?: string }[];
}): ProjectResource {
  return {
    kind: "project",
    collegeId: project.collegeId,
    groupId: project.groupId,
    subjectId: project.group?.class?.subjectId ?? null,
    classId: project.group?.classId ?? null,
    visibility: project.visibility,
    approved: project.approved,
    status: project.status,
    collegeVerified: project.college?.verification === "VERIFIED",
    embargoUntil: project.embargoUntil,
    memberIds: (project.members ?? [])
      .map((member) => member.userId ?? member.user?.id)
      .filter((id): id is string => typeof id === "string"),
  };
}

/**
 * An embargoed project is listed but its body is withheld — the work can be
 * cited without being disclosed. Members and faculty at the college still see
 * it in full.
 */
export function isEmbargoed(
  project: { embargoUntil: Date | null; collegeId: string; groupId: string | null },
  viewer: Viewer,
  now = new Date(),
): boolean {
  if (!project.embargoUntil || project.embargoUntil <= now) return false;
  if (viewer.isPlatformAdmin) return false;
  if (isGroupMember(viewer, project.groupId)) return false;

  return !belongsTo(viewer, project.collegeId);
}

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  visibility: true,
  domain: true,
  techStack: true,
  startedOn: true,
  completedOn: true,
  publishedOn: true,
  embargoUntil: true,
  collegeId: true,
  groupId: true,
  college: { select: { slug: true, name: true, shortName: true } },
  topics: { select: { topic: { select: { slug: true, name: true } } } },
  sdgs: { select: { goal: true, primary: true } },
  members: {
    select: {
      role: true,
      tier: true,
      user: { select: { username: true, name: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.ProjectSelect;

export type ProjectCard = Prisma.ProjectGetPayload<{ select: typeof cardSelect }>;

export async function listProjects(
  viewer: Viewer,
  options: {
    collegeId?: string;
    domain?: string;
    topicSlug?: string;
    sdg?: number;
    status?: Prisma.EnumProjectStatusFilter;
    take?: number;
    skip?: number;
  } = {},
): Promise<ProjectCard[]> {
  const { collegeId, domain, topicSlug, sdg, status, take = 24, skip = 0 } = options;

  return db.project.findMany({
    where: {
      AND: [
        visibleTo(viewer),
        collegeId ? { collegeId } : {},
        domain ? { domain } : {},
        topicSlug ? { topics: { some: { topic: { slug: topicSlug } } } } : {},
        sdg ? { sdgs: { some: { goal: sdg } } } : {},
        status ? { status } : {},
      ],
    },
    select: cardSelect,
    orderBy: [{ publishedOn: "desc" }, { startedOn: "desc" }],
    take,
    skip,
  });
}

export async function countProjects(
  viewer: Viewer,
  options: { collegeId?: string; domain?: string } = {},
): Promise<number> {
  return db.project.count({
    where: {
      AND: [
        visibleTo(viewer),
        options.collegeId ? { collegeId: options.collegeId } : {},
        options.domain ? { domain: options.domain } : {},
      ],
    },
  });
}

/**
 * A single project, or null.
 *
 * Null rather than a thrown error, because "not visible to you" and "does not
 * exist" must be indistinguishable from outside. A 403 on a private project
 * confirms the project exists, which is itself a leak.
 */
export async function getProject(viewer: Viewer, slug: string) {
  return db.project.findFirst({
    where: { AND: [visibleTo(viewer), { slug }] },
    select: {
      ...cardSelect,
      abstract: true,
      keywords: true,
      department: true,
      subject: true,
      facultyGuide: true,
      citationId: true,
      repositoryUrl: true,
      demoUrl: true,
      videoUrl: true,
      approved: true,
      sections: {
        select: { kind: true, body: true, complete: true },
        orderBy: { kind: "asc" },
      },
      metrics: { select: { label: true, value: true }, orderBy: { position: "asc" } },
      links: { select: { label: true, url: true } },
      term: { select: { name: true } },
      parentLinks: {
        select: {
          kind: true,
          note: true,
          parent: { select: { slug: true, title: true, summary: true, visibility: true } },
        },
      },
      childLinks: {
        select: {
          kind: true,
          note: true,
          child: { select: { slug: true, title: true, summary: true, visibility: true } },
        },
      },
    },
  });
}

/**
 * Slugs for `generateStaticParams` and the sitemap.
 *
 * Deliberately takes a viewer like everything else, and is always called with
 * ANONYMOUS — so a future change that made it viewer-sensitive would be
 * explicit rather than accidental.
 */
export async function publicProjectSlugs(viewer: Viewer): Promise<string[]> {
  const rows = await db.project.findMany({
    where: visibleTo(viewer),
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  return rows.map((row) => row.slug);
}
