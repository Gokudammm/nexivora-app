import type { Prisma } from "@prisma/client";

import { thresholdsFor } from "@/config/health";
import { REQUIRED_SECTIONS } from "@/config/sections";
import { taughtSubjectIds, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { groupHealth, healthLevel, type HealthSignal } from "@/lib/ledger/health";
import { scoreMembers } from "@/lib/ledger/score";
import { computeProgress } from "@/lib/project/progress";
import { milestoneState } from "@/lib/project/progress";

/**
 * THE FACULTY QUERY LAYER.
 *
 * One predicate governs this whole file and it is acceptance criterion 8:
 * **a faculty member sees the groups in the subjects they teach, never the
 * college.** `taughtSubjectIds(viewer)` is that predicate, and every query below
 * composes it rather than re-deriving one. ADR-029 made faculty scope
 * per-subject precisely so this could not be widened by accident.
 *
 * The other property worth stating: the dashboard is assembled from a handful of
 * grouped queries rather than one per group. A faculty member supervising
 * fifteen groups would otherwise pay fifteen round trips for a page whose entire
 * purpose is to be glanceable, and a dashboard that takes four seconds is a
 * dashboard nobody opens on a Tuesday.
 */

/** Statuses after which silence in the workspace is the expected state. */
const FINISHED = new Set(["COMPLETED", "ARCHIVED"]);

/** Subjects this viewer teaches. Empty for everybody else. */
export const supervisedSubjectIds = (viewer: Viewer): string[] => taughtSubjectIds(viewer);

export const isFaculty = (viewer: Viewer): boolean => supervisedSubjectIds(viewer).length > 0;

/** Groups inside the subjects this viewer teaches. The scope, once. */
export function supervisedGroups(viewer: Viewer): Prisma.GroupWhereInput {
  const subjectIds = supervisedSubjectIds(viewer);
  // An impossible predicate rather than an empty object: `{}` would match every
  // group in the database, which is the failure this shape prevents.
  if (subjectIds.length === 0) return { id: { in: [] } };

  return { class: { subjectId: { in: subjectIds } } };
}

export function supervisedProjects(viewer: Viewer): Prisma.ProjectWhereInput {
  const subjectIds = supervisedSubjectIds(viewer);
  if (subjectIds.length === 0) return { id: { in: [] } };

  return { deletedAt: null, group: { class: { subjectId: { in: subjectIds } } } };
}

/* -------------------------------------------------------------- the group */

export type SupervisedGroup = {
  id: string;
  name: string;
  collegeId: string;
  className: string | null;
  subjectName: string | null;
  members: { id: string; name: string; username: string | null; avatarUrl: string | null }[];
  project: { slug: string; title: string; status: string } | null;
  progress: number;
  signals: HealthSignal[];
  level: ReturnType<typeof healthLevel>;
  lastActivityAt: Date | null;
};

/**
 * Every supervised group with its health, computed.
 *
 * The expensive part is the ledger, and it is loaded once for all groups rather
 * than per group. `scoreMembers` and `groupHealth` are then pure functions over
 * what is already in memory — the same functions the group's own ledger page
 * uses, which is what makes the two views agree by construction rather than by
 * discipline.
 */
export async function listSupervisedGroups(
  viewer: Viewer,
  now = new Date(),
): Promise<SupervisedGroup[]> {
  const groups = await db.group.findMany({
    where: { AND: [supervisedGroups(viewer), { archivedAt: null }] },
    select: {
      id: true,
      name: true,
      collegeId: true,
      class: {
        select: { section: true, subject: { select: { name: true, code: true } } },
      },
      members: {
        where: { leftAt: null },
        select: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
      projects: {
        where: { deletedAt: null },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          sections: { select: { kind: true, complete: true } },
          milestones: { select: { id: true, title: true, state: true, dueDate: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const ids = groups.map((group) => group.id);
  if (ids.length === 0) return [];

  const [ledger, blockers, overdue, milestoneTasks] = await Promise.all([
    db.ledgerEvent.findMany({
      where: { groupId: { in: ids } },
      select: { groupId: true, userId: true, kind: true, weight: true, createdAt: true },
    }),
    db.thread.findMany({
      where: { groupId: { in: ids }, kind: "BLOCKER", resolvedAt: null, deletedAt: null },
      select: { id: true, groupId: true, title: true, createdAt: true },
    }),
    db.task.findMany({
      where: {
        groupId: { in: ids },
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW"] },
        dueDate: { lt: now },
      },
      select: { id: true, groupId: true, title: true, dueDate: true },
    }),
    db.task.findMany({
      where: { groupId: { in: ids }, deletedAt: null, milestoneId: { not: null } },
      select: { groupId: true, status: true, milestoneId: true },
    }),
  ]);

  return groups.map((group) => {
    const events = ledger.filter((event) => event.groupId === group.id);
    const members = group.members.map((member) => member.user);
    const scores = scoreMembers(members, events);
    const project = group.projects[0] ?? null;

    const thresholds = thresholdsFor(group.collegeId);

    const slipped = (project?.milestones ?? [])
      .filter((milestone) => milestoneState(milestone, now) === "AT_RISK")
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        dueOn: milestone.dueDate!,
      }));

    const lastActivityAt =
      events.length === 0
        ? null
        : events.reduce(
            (latest, event) => (event.createdAt > latest ? event.createdAt : latest),
            events[0]!.createdAt,
          );

    const signals = groupHealth(
      {
        scores,
        totalEvents: events.length,
        overdueTasks: overdue
          .filter((task) => task.groupId === group.id)
          .map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate! })),
        slippedMilestones: slipped,
        openBlockers: blockers
          .filter((thread) => thread.groupId === group.id)
          .map((thread) => ({ id: thread.id, title: thread.title, openedAt: thread.createdAt })),
        lastActivityAt,
        // A delivered project's group is not stalled; it is finished. Without
        // this every completed group carries a warning and the panel stops
        // being a queue.
        active: project === null || !FINISHED.has(project.status),
        thresholds,
      },
      now,
    );

    const milestoneIds = new Set((project?.milestones ?? []).map((milestone) => milestone.id));
    const tasks = milestoneTasks.filter(
      (task) => task.groupId === group.id && task.milestoneId && milestoneIds.has(task.milestoneId),
    );

    const progress = project
      ? computeProgress({
          sections: project.sections,
          requiredSections: REQUIRED_SECTIONS,
          milestones: project.milestones,
          tasks,
        }).percent
      : 0;

    return {
      id: group.id,
      name: group.name,
      collegeId: group.collegeId,
      className: group.class
        ? `${group.class.subject.code}${group.class.section ? ` · ${group.class.section}` : ""}`
        : null,
      subjectName: group.class?.subject.name ?? null,
      members,
      project: project
        ? { slug: project.slug, title: project.title, status: project.status }
        : null,
      progress,
      signals,
      level: healthLevel(signals),
      lastActivityAt,
    };
  });
}

/* ------------------------------------------------------------- the queue */

/** Projects awaiting review, oldest first — a queue, not an inventory. */
export async function listSubmissionQueue(viewer: Viewer) {
  return db.project.findMany({
    where: { AND: [supervisedProjects(viewer), { status: "UNDER_REVIEW" }] },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      updatedAt: true,
      group: {
        select: {
          id: true,
          name: true,
          members: {
            where: { leftAt: null },
            select: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
      submissions: {
        select: { id: true, round: true, createdAt: true },
        orderBy: { round: "desc" },
        take: 1,
      },
      evaluations: {
        select: { id: true, round: true, releasedAt: true },
        orderBy: { round: "desc" },
        take: 1,
      },
      statusEvents: {
        where: { to: "UNDER_REVIEW" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "asc" },
  });
}

/* --------------------------------------------------------------- classes */

export async function listSupervisedClasses(viewer: Viewer) {
  const subjectIds = supervisedSubjectIds(viewer);
  if (subjectIds.length === 0) return [];

  const classIds = [...new Set(viewer.teaches.map((klass) => klass.classId))];

  return db.class.findMany({
    where: { id: { in: classIds }, archivedAt: null },
    select: {
      id: true,
      section: true,
      subject: { select: { id: true, name: true, code: true } },
      term: { select: { name: true, startsOn: true, endsOn: true } },
      _count: { select: { enrolments: true, groups: true } },
    },
    orderBy: [{ subject: { code: "asc" } }, { section: "asc" }],
  });
}

export async function getSupervisedClass(viewer: Viewer, classId: string) {
  if (!viewer.teaches.some((klass) => klass.classId === classId)) return null;

  return db.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      section: true,
      collegeId: true,
      subject: { select: { id: true, name: true, code: true } },
      term: { select: { name: true, startsOn: true, endsOn: true } },
      enrolments: {
        select: {
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
      groups: {
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          members: {
            where: { leftAt: null },
            select: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          projects: {
            where: { deletedAt: null },
            select: { slug: true, title: true, status: true },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      },
      announcements: {
        select: { id: true, title: true, body: true, publishAt: true },
        orderBy: { publishAt: "desc" },
        take: 10,
      },
    },
  });
}

/* --------------------------------------------------------------- rubrics */

export async function listRubrics(viewer: Viewer, collegeId: string) {
  const subjectIds = supervisedSubjectIds(viewer);

  return db.rubric.findMany({
    where: {
      collegeId,
      archivedAt: null,
      // A rubric is either subject-specific or college-wide. A faculty member
      // sees the ones for their own subjects plus the shared ones — not another
      // department's.
      OR: [{ subjectId: { in: subjectIds } }, { subjectId: null }],
    },
    select: {
      id: true,
      name: true,
      version: true,
      subjectId: true,
      createdAt: true,
      subject: { select: { name: true, code: true } },
      creator: { select: { name: true } },
      criteria: {
        select: { id: true, name: true, weight: true, descriptors: true, position: true },
        orderBy: { position: "asc" },
      },
      _count: { select: { evaluations: true } },
    },
    orderBy: [{ name: "asc" }, { version: "desc" }],
  });
}

export async function getRubric(viewer: Viewer, rubricId: string) {
  const rubric = await db.rubric.findUnique({
    where: { id: rubricId },
    select: {
      id: true,
      name: true,
      version: true,
      collegeId: true,
      subjectId: true,
      criteria: {
        select: { id: true, name: true, weight: true, descriptors: true, position: true },
        orderBy: { position: "asc" },
      },
      _count: { select: { evaluations: true } },
    },
  });

  if (!rubric) return null;

  // Readable when it is for a subject they teach, or college-wide.
  const subjectIds = supervisedSubjectIds(viewer);
  const allowed = rubric.subjectId === null || subjectIds.includes(rubric.subjectId);

  return allowed ? rubric : null;
}

/* ----------------------------------------------------------- attestations */

export async function listAttestations(viewer: Viewer) {
  if (!viewer.userId) return [];

  const attestations = await db.attestation.findMany({
    where: { attesterId: viewer.userId },
    select: {
      id: true,
      code: true,
      subjectType: true,
      subjectId: true,
      statement: true,
      issuedAt: true,
      revokedAt: true,
      revokedReason: true,
      subject: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  // `subjectId` is a project id but not a foreign key — an attestation can
  // outlive the record it describes, deliberately. Resolving the titles here
  // rather than leaving the page to guess is what stops an older attestation
  // rendering as "a project": the list is the faculty member's own history, and
  // a history that cannot name what it is about is not a history.
  const projects = await db.project.findMany({
    where: { id: { in: [...new Set(attestations.map((row) => row.subjectId))] } },
    select: { id: true, slug: true, title: true },
  });

  const byId = new Map(projects.map((project) => [project.id, project]));

  return attestations.map((attestation) => ({
    ...attestation,
    project: byId.get(attestation.subjectId) ?? null,
  }));
}

/* --------------------------------------------------- announcements & Q&A */

/**
 * Everything this faculty member has posted, scheduled included.
 *
 * Scoped by author rather than by class: a scheduled announcement is invisible
 * to everybody else until it publishes, so the only place its author can see it
 * is a list of their own. Ordered by `publishAt` descending, which puts the
 * not-yet-published ones at the top where they can still be withdrawn.
 */
export async function listAuthoredAnnouncements(viewer: Viewer) {
  if (!viewer.userId) return [];

  return db.announcement.findMany({
    where: { authorId: viewer.userId },
    select: {
      id: true,
      title: true,
      body: true,
      publishAt: true,
      createdAt: true,
      classId: true,
      class: {
        select: { id: true, section: true, subject: { select: { name: true, code: true } } },
      },
    },
    orderBy: { publishAt: "desc" },
    take: 50,
  });
}

/** Open questions in supervised groups, oldest first — a queue, like the other one. */
export async function listOpenQuestions(viewer: Viewer) {
  return db.thread.findMany({
    where: {
      AND: [
        { group: supervisedGroups(viewer) },
        { kind: "QUESTION", resolvedAt: null, deletedAt: null },
      ],
    },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      groupId: true,
      group: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
}

/* --------------------------------------------------------- the dashboard */

/**
 * Everything `/faculty` shows, in one round of parallel reads.
 *
 * Acceptance criterion 1 is *"opens `/faculty` and, without clicking, knows what
 * needs attention today"*, and that is as much a performance requirement as a
 * design one — a dashboard assembled from twenty sequential queries is a
 * dashboard that loads after the person has moved on.
 */
export async function facultyDashboard(viewer: Viewer, now = new Date()) {
  const [groups, queue, proposals, classes, unanswered] = await Promise.all([
    listSupervisedGroups(viewer, now),
    listSubmissionQueue(viewer),
    db.project.findMany({
      where: { AND: [supervisedProjects(viewer), { status: "PROPOSED" }] },
      select: {
        slug: true,
        title: true,
        updatedAt: true,
        group: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    listSupervisedClasses(viewer),
    db.thread.findMany({
      where: {
        AND: [
          { group: supervisedGroups(viewer) },
          { kind: "QUESTION", resolvedAt: null, deletedAt: null },
        ],
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        groupId: true,
        group: { select: { name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
  ]);

  const groupIds = groups.map((group) => group.id);

  const [deadlines, recent] = await Promise.all([
    groupIds.length === 0
      ? Promise.resolve([])
      : db.task.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW"] },
            dueDate: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) },
          },
          select: {
            id: true,
            title: true,
            dueDate: true,
            group: { select: { id: true, name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 12,
        }),
    groupIds.length === 0
      ? Promise.resolve([])
      : db.ledgerEvent.findMany({
          where: { groupId: { in: groupIds } },
          select: {
            id: true,
            kind: true,
            createdAt: true,
            group: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
  ]);

  // Ranked worst first, so the panel is a work queue. A group with a warning
  // outranks one with only an advisory signal, and a group with nothing does
  // not appear at all.
  const atRisk = groups
    .filter((group) => group.signals.length > 0)
    .sort((a, b) =>
      a.level === b.level ? b.signals.length - a.signals.length : a.level === "attention" ? -1 : 1,
    );

  return {
    groups,
    queue,
    proposals,
    classes,
    unanswered,
    deadlines,
    recent,
    atRisk,
    counts: {
      groups: groups.length,
      students: new Set(groups.flatMap((group) => group.members.map((m) => m.id))).size,
      classes: classes.length,
      awaitingReview: queue.length,
      awaitingApproval: proposals.length,
      atRisk: atRisk.length,
    },
  };
}
