import type { $Enums, Prisma } from "@prisma/client";

import { REQUIRED_SECTIONS, SECTION_ORDER } from "@/config/sections";
import { can } from "@/lib/authz/policy";
import { isGroupLead, teachesSubject, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { computeProgress, type Progress } from "@/lib/project/progress";

import { projectResource } from "./projects";

/**
 * THE EDITABLE PROJECT.
 *
 * A separate module from `queries/projects.ts` on purpose. That file answers
 * *"what may this viewer read"* and is composed by every public surface; this
 * one answers *"what may this viewer change"*, which is a narrower question
 * with a different shape — it loads sections, milestones, tasks and status
 * history that no public page wants to pay for.
 *
 * `requireEditable()` is the gate, and it follows the Phase 7 pattern exactly:
 * every function below takes an `EditableProject`, a value that can only come
 * from the gate, so a query cannot be called with an id straight off the URL.
 */

const editSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  abstract: true,
  status: true,
  visibility: true,
  approved: true,
  approvedAt: true,
  embargoUntil: true,
  domain: true,
  department: true,
  subject: true,
  techStack: true,
  keywords: true,
  facultyGuide: true,
  repositoryUrl: true,
  demoUrl: true,
  videoUrl: true,
  coverUrl: true,
  citationId: true,
  startedOn: true,
  completedOn: true,
  publishedOn: true,
  collegeId: true,
  groupId: true,
  createdAt: true,
  college: { select: { id: true, slug: true, name: true, shortName: true, verification: true } },
  group: {
    select: {
      id: true,
      name: true,
      classId: true,
      class: { select: { subjectId: true, subject: { select: { name: true, code: true } } } },
      members: {
        where: { leftAt: null },
        select: {
          role: true,
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
      },
    },
  },
  members: {
    select: {
      id: true,
      role: true,
      tier: true,
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  },
  topics: { select: { topic: { select: { slug: true, name: true } } } },
  sdgs: { select: { goal: true, primary: true } },
  sections: {
    select: {
      id: true,
      kind: true,
      body: true,
      wordCount: true,
      complete: true,
      updatedAt: true,
      lockedById: true,
      lockedAt: true,
      lastEditorId: true,
    },
  },
  milestones: {
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      state: true,
      position: true,
      completedAt: true,
      ownerId: true,
      _count: { select: { tasks: true } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  },
  statusEvents: {
    select: {
      id: true,
      from: true,
      to: true,
      reason: true,
      createdAt: true,
      actor: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  similarityChecks: {
    select: {
      id: true,
      matches: true,
      topScore: true,
      overrideReason: true,
      createdAt: true,
      overriddenBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  submissions: {
    select: { id: true, round: true, createdAt: true, submittedById: true },
    orderBy: { round: "desc" },
  },
} satisfies Prisma.ProjectSelect;

export type EditableProject = Prisma.ProjectGetPayload<{ select: typeof editSelect }>;

/**
 * A project this viewer may open in the editor, or null.
 *
 * Null for absent and for not-yours alike — a 403 confirms the project exists,
 * which is exactly what the visibility model exists to avoid (ADR-034's
 * reasoning, applied here).
 *
 * Note that this returns the project for **faculty too**, who may read it and
 * change its status but not edit its sections. Separating "can open" from "can
 * edit" is what lets the review screens reuse this loader instead of growing a
 * parallel one.
 */
export async function requireEditableProject(
  viewer: Viewer,
  slug: string,
): Promise<EditableProject | null> {
  if (!viewer.userId) return null;

  const project = await db.project.findFirst({
    where: { slug, deletedAt: null },
    select: editSelect,
  });

  if (!project) return null;

  // The same resource shape the rest of the product authorises against, so the
  // editor cannot drift from the public page's idea of who may read this.
  return can(viewer, "project:read", projectResource(project)) ? project : null;
}

/* ------------------------------------------------------------ capabilities */

export type ProjectCapabilities = {
  /** May change section bodies and metadata. */
  edit: boolean;
  /** May move the project through the lifecycle as the group. */
  lead: boolean;
  /** Teaches the subject: approves, rejects, requests changes, archives. */
  faculty: boolean;
  /** May set visibility or an embargo. */
  visibility: boolean;
};

/**
 * What this viewer may do, decided once and passed down.
 *
 * Every entry defers to `can()` — there is no `if (role === …)` here. The value
 * of computing it in one place is that a page renders the same set of controls
 * the server will actually accept, so a disabled button and a refused action
 * cannot disagree.
 */
export function capabilities(viewer: Viewer, project: EditableProject): ProjectCapabilities {
  const resource = projectResource(project);

  return {
    edit: can(viewer, "project:edit", resource),
    lead: isGroupLead(viewer, project.groupId),
    faculty: teachesSubject(viewer, project.group?.class?.subjectId ?? null),
    visibility: can(viewer, "project:visibility", resource),
  };
}

/* ---------------------------------------------------------------- progress */

/**
 * Progress, computed from the project's real state.
 *
 * Tasks count **only when they are linked to one of this project's
 * milestones** — not simply because they sit on the owning group's board. A
 * group may run more than one project (the seed has one with two), and counting
 * the whole board against each of them made a brand-new project open at 26%
 * before a word was written. `check:project` found that on its first run.
 *
 * The consequence is deliberate: a project with no milestones has no task
 * component, and the weighting redistributes to sections. That is the honest
 * answer — an unlinked task is work the group did, not evidence about *this*
 * project — and it is what makes "a milestone links to the tasks that
 * constitute it" mean something.
 */
export async function projectProgress(project: EditableProject): Promise<Progress> {
  const milestoneIds = project.milestones.map((milestone) => milestone.id);

  const tasks =
    milestoneIds.length > 0
      ? await db.task.findMany({
          where: { milestoneId: { in: milestoneIds }, deletedAt: null },
          select: { status: true },
        })
      : [];

  return computeProgress({
    sections: project.sections,
    requiredSections: REQUIRED_SECTIONS,
    milestones: project.milestones,
    tasks,
  });
}

/* ------------------------------------------------------------- one section */

export async function getSection(project: EditableProject, kind: $Enums.SectionKind) {
  return db.projectSection.findUnique({
    where: { projectId_kind: { projectId: project.id, kind } },
    select: {
      id: true,
      kind: true,
      body: true,
      wordCount: true,
      complete: true,
      updatedAt: true,
      lockedById: true,
      lockedAt: true,
      lastEditorId: true,
      versions: {
        select: {
          id: true,
          version: true,
          wordCount: true,
          createdAt: true,
          editor: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
        orderBy: { version: "desc" },
        take: 20,
      },
    },
  });
}

/** One historic version's body, for the restore preview. */
export async function getSectionVersion(project: EditableProject, versionId: string) {
  return db.projectSectionVersion.findFirst({
    where: { id: versionId, projectId: project.id },
    select: {
      id: true,
      version: true,
      body: true,
      wordCount: true,
      kind: true,
      createdAt: true,
      editor: { select: { name: true } },
    },
  });
}

/* ------------------------------------------------------- the viewer's list */

/** Projects the viewer works on, for `/my/projects` and the dashboard. */
export async function listMyProjects(viewer: Viewer) {
  if (!viewer.userId) return [];

  return db.project.findMany({
    where: {
      deletedAt: null,
      OR: [
        { members: { some: { userId: viewer.userId } } },
        { groupId: { in: viewer.groups.map((group) => group.groupId) } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      visibility: true,
      updatedAt: true,
      coverUrl: true,
      group: { select: { id: true, name: true } },
      sections: { select: { kind: true, complete: true } },
      milestones: { select: { state: true } },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/* --------------------------------------------------- the faculty proposal queue */

/**
 * Proposals waiting on this faculty member.
 *
 * Scoped to the subjects they teach, never to the college — a faculty member
 * approving proposals outside their subject is the failure ADR-029's
 * per-subject scope exists to prevent.
 */
export async function listPendingProposals(viewer: Viewer) {
  const subjectIds = [...new Set(viewer.teaches.map((klass) => klass.subjectId))];
  if (subjectIds.length === 0) return [];

  return db.project.findMany({
    where: {
      deletedAt: null,
      status: "PROPOSED",
      group: { class: { subjectId: { in: subjectIds } } },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      domain: true,
      createdAt: true,
      group: {
        select: {
          name: true,
          members: {
            where: { leftAt: null },
            select: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
      sections: { where: { kind: "PROBLEM" }, select: { body: true } },
      similarityChecks: {
        select: { topScore: true, matches: true, overrideReason: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      statusEvents: {
        where: { to: "PROPOSED" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "asc" },
  });
}

/** Completion state per section, in canonical order, for the navigator. */
export function sectionSummary(project: EditableProject) {
  const byKind = new Map(project.sections.map((section) => [section.kind, section]));

  return SECTION_ORDER.map((kind) => {
    const row = byKind.get(kind);
    return {
      kind,
      wordCount: row?.wordCount ?? 0,
      complete: row?.complete ?? false,
      updatedAt: row?.updatedAt ?? null,
      started: (row?.wordCount ?? 0) > 0,
    };
  });
}
