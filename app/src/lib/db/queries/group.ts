import type { $Enums, Prisma } from "@prisma/client";

import { can, type GroupResource } from "@/lib/authz/policy";
import { groupIds, isGroupMember, taughtSubjectIds, type Viewer } from "@/lib/authz/viewer";
import { OPEN_TASK_STATUSES } from "@/config/tasks";
import { db } from "@/lib/db/client";

/**
 * GROUP & WORKSPACE QUERIES.
 *
 * The workspace is the most private surface in the product — a group's unposed
 * working conversation, half-finished files and unclosed tasks — so the rule
 * from `docs/ARCHITECTURE.md` matters more here than anywhere: **the query is
 * the security boundary, and `proxy.ts` is a convenience** (ADR-028). Every
 * function below is written to be safe with route gating switched off entirely,
 * because `isolation.test.ts` runs it that way.
 *
 * Two predicates carry the module, and each is written exactly once:
 *
 * **`groupVisibleTo(viewer)`** — which groups exist, as far as this viewer is
 * concerned. Phases 4, 5 and 6 each recorded that this was still owed; it is
 * this phase's deliverable, and folding the group into visibility here is what
 * lets every later query compose it instead of re-deriving membership.
 *
 * **`requireWorkspace(viewer, groupId)`** — the gate for a workspace route.
 * Returns the group when the viewer may read it and `null` when they may not,
 * with no distinction between "this group does not exist" and "this group is
 * not yours". That is the same discipline as ADR-034 for private profiles, for
 * the same reason: a 403 confirms the group exists, and the existence of a
 * named group inside a named class is itself information.
 *
 * A college admin is deliberately excluded from reading a workspace at all.
 * They administer the institution; they do not get to read a team's room. That
 * is `policy.ts`'s decision, not this file's, and it is asserted there.
 */

/* ------------------------------------------------------------- predicates */

/**
 * The group visibility predicate, once.
 *
 * A group is visible to its own members, to the faculty who teach its class's
 * subject, and — only when it is `COLLEGE`-visible and not archived — to full
 * members of the college who might want to ask to join it. Nothing here reaches
 * the logged-out public: a group is never public, at any visibility, because
 * the public surface of a team's work is its *project page*, which Phase 8
 * owns and which has its own approval gate.
 */
export function groupVisibleTo(viewer: Viewer): Prisma.GroupWhereInput {
  if (viewer.isPlatformAdmin) return {};

  // The logged-out public sees no groups at all. Returning an impossible
  // predicate rather than an empty object keeps every composed query safe by
  // construction — an empty object would match everything.
  if (viewer.userId === null) return { id: { in: [] } };

  return {
    OR: [
      { id: { in: groupIds(viewer) } },
      { class: { subjectId: { in: taughtSubjectIds(viewer) } } },
      {
        visibility: "COLLEGE",
        archivedAt: null,
        collegeId: { in: [...new Set(viewer.memberships.map((m) => m.collegeId))] },
      },
    ],
  };
}

/** The shape `can()` reasons about, built once so the two cannot drift. */
export function groupResource(group: {
  collegeId: string;
  id: string;
  classId: string | null;
  class?: { subjectId: string } | null;
}): GroupResource {
  return {
    kind: "group",
    collegeId: group.collegeId,
    groupId: group.id,
    classId: group.classId,
    subjectId: group.class?.subjectId ?? null,
  };
}

/* --------------------------------------------------------------- the gate */

const workspaceSelect = {
  id: true,
  name: true,
  description: true,
  sizeLimit: true,
  joinPolicy: true,
  visibility: true,
  archivedAt: true,
  createdAt: true,
  collegeId: true,
  classId: true,
  college: { select: { id: true, slug: true, name: true, shortName: true } },
  class: {
    select: {
      id: true,
      section: true,
      subjectId: true,
      subject: { select: { id: true, name: true, code: true } },
      term: { select: { name: true } },
    },
  },
  members: {
    where: { leftAt: null },
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  },
  projects: {
    where: { deletedAt: null },
    select: { id: true, slug: true, title: true, status: true, visibility: true },
  },
} satisfies Prisma.GroupSelect;

export type Workspace = Prisma.GroupGetPayload<{ select: typeof workspaceSelect }>;

/** A workspace the viewer may read, or null. Null covers "absent" and "not yours" alike. */
export async function requireWorkspace(viewer: Viewer, groupId: string): Promise<Workspace | null> {
  if (!viewer.userId) return null;

  const group = await db.group.findFirst({
    where: { AND: [groupVisibleTo(viewer), { id: groupId }] },
    select: workspaceSelect,
  });

  if (!group) return null;

  // Visibility got us the row; the policy decides whether the *workspace* — as
  // opposed to the group's existence — may be read. A COLLEGE-visible group is
  // discoverable by a classmate who is not in it, and its room is still shut.
  return can(viewer, "workspace:read", groupResource(group)) ? group : null;
}

/** True when the viewer is a member of this group with the LEAD role. */
export function isLead(workspace: Workspace, userId: string | null): boolean {
  if (!userId) return false;
  return workspace.members.some((member) => member.user.id === userId && member.role === "LEAD");
}

export function memberOf(workspace: Workspace, userId: string | null): boolean {
  if (!userId) return false;
  return workspace.members.some((member) => member.user.id === userId);
}

/* ------------------------------------------------------------------ lists */

export type GroupCard = {
  id: string;
  name: string;
  description: string | null;
  visibility: $Enums.Visibility;
  joinPolicy: $Enums.GroupJoinPolicy;
  archivedAt: Date | null;
  sizeLimit: number;
  memberCount: number;
  members: { id: string; name: string; username: string | null; avatarUrl: string | null }[];
  className: string | null;
  subjectName: string | null;
  projectTitle: string | null;
  openTaskCount: number;
  myOpenTaskCount: number;
  nextDeadline: { title: string; dueDate: Date; kind: "task" | "meeting" } | null;
  role: $Enums.GroupRole | null;
};

/**
 * The groups this viewer belongs to, with everything `/groups` shows.
 *
 * Assembled in a handful of grouped aggregates rather than per-card queries: a
 * student on six groups would otherwise cost 6 × 4 round trips for a page whose
 * entire purpose is to load instantly.
 */
export async function listMyGroups(viewer: Viewer): Promise<GroupCard[]> {
  if (!viewer.userId) return [];

  const mine = groupIds(viewer);
  const taught = taughtSubjectIds(viewer);
  if (mine.length === 0 && taught.length === 0) return [];

  const groups = await db.group.findMany({
    where: {
      OR: [{ id: { in: mine } }, { class: { subjectId: { in: taught } } }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      joinPolicy: true,
      archivedAt: true,
      sizeLimit: true,
      class: {
        select: { section: true, subject: { select: { name: true, code: true } } },
      },
      members: {
        where: { leftAt: null },
        select: {
          role: true,
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      projects: {
        where: { deletedAt: null },
        select: { title: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
  });

  const ids = groups.map((group) => group.id);
  if (ids.length === 0) return [];

  const [openTasks, myTasks, nextTasks, nextMeetings] = await Promise.all([
    db.task.groupBy({
      by: ["groupId"],
      where: { groupId: { in: ids }, deletedAt: null, status: { in: OPEN_TASK_STATUSES } },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: ids },
        deletedAt: null,
        status: { in: OPEN_TASK_STATUSES },
        assignees: { some: { userId: viewer.userId } },
      },
      _count: { _all: true },
    }),
    db.task.findMany({
      where: {
        groupId: { in: ids },
        deletedAt: null,
        status: { in: OPEN_TASK_STATUSES },
        dueDate: { not: null },
      },
      select: { groupId: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    db.meeting.findMany({
      where: { groupId: { in: ids }, startsAt: { gte: new Date() } },
      select: { groupId: true, title: true, startsAt: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const countOf = (rows: { groupId: string; _count: { _all: number } }[], id: string) =>
    rows.find((row) => row.groupId === id)?._count._all ?? 0;

  return groups.map((group) => {
    const task = nextTasks.find((row) => row.groupId === group.id);
    const meeting = nextMeetings.find((row) => row.groupId === group.id);

    // Whichever comes first — a deadline the group has to care about does not
    // sort itself into two lists in anybody's head.
    const candidates: NonNullable<GroupCard["nextDeadline"]>[] = [];
    if (task?.dueDate) candidates.push({ title: task.title, dueDate: task.dueDate, kind: "task" });
    if (meeting) {
      candidates.push({ title: meeting.title, dueDate: meeting.startsAt, kind: "meeting" });
    }
    candidates.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      joinPolicy: group.joinPolicy,
      archivedAt: group.archivedAt,
      sizeLimit: group.sizeLimit,
      memberCount: group.members.length,
      members: group.members.map((member) => member.user),
      className: group.class
        ? `${group.class.subject.code}${group.class.section ? ` · ${group.class.section}` : ""}`
        : null,
      subjectName: group.class?.subject.name ?? null,
      projectTitle: group.projects[0]?.title ?? null,
      openTaskCount: countOf(openTasks, group.id),
      myOpenTaskCount: countOf(myTasks, group.id),
      nextDeadline: candidates[0] ?? null,
      role: group.members.find((member) => member.user.id === viewer.userId)?.role ?? null,
    };
  });
}

/**
 * Groups in the viewer's classes that they could ask to join.
 *
 * Only `COLLEGE`-visible, unarchived, not full, and not one they are already
 * in — a discovery list that shows a group you cannot join is a list of dead
 * ends.
 */
export async function listJoinableGroups(viewer: Viewer) {
  if (!viewer.userId) return [];

  const classIds = viewer.enrolledIn.map((klass) => klass.classId);
  if (classIds.length === 0) return [];

  const groups = await db.group.findMany({
    where: {
      classId: { in: classIds },
      archivedAt: null,
      visibility: "COLLEGE",
      joinPolicy: { in: ["OPEN", "REQUEST"] },
      id: { notIn: groupIds(viewer) },
    },
    select: {
      id: true,
      name: true,
      description: true,
      sizeLimit: true,
      joinPolicy: true,
      collegeId: true,
      classId: true,
      class: { select: { subjectId: true, subject: { select: { name: true, code: true } } } },
      members: {
        where: { leftAt: null },
        select: { user: { select: { id: true, name: true, avatarUrl: true, username: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return groups
    .filter((group) => group.members.length < group.sizeLimit)
    .map((group) => ({
      ...group,
      full: false,
      memberCount: group.members.length,
    }));
}

/* -------------------------------------------------------------- workspace */

/** Everything the workspace home shows, in one round of parallel reads. */
export async function getWorkspaceHome(viewer: Viewer, workspace: Workspace) {
  const now = new Date();
  const groupId = workspace.id;

  const [statusCounts, myTasks, upcomingTasks, meetings, threads, files, activity] =
    await Promise.all([
      db.task.groupBy({
        by: ["status"],
        where: { groupId, deletedAt: null },
        _count: { _all: true },
      }),
      viewer.userId
        ? db.task.findMany({
            where: {
              groupId,
              deletedAt: null,
              status: { in: OPEN_TASK_STATUSES },
              assignees: { some: { userId: viewer.userId } },
            },
            select: { id: true, title: true, status: true, priority: true, dueDate: true },
            orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
            take: 8,
          })
        : Promise.resolve([]),
      db.task.findMany({
        where: {
          groupId,
          deletedAt: null,
          status: { in: OPEN_TASK_STATUSES },
          dueDate: { not: null },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          assignees: { select: { user: { select: { name: true, avatarUrl: true } } } },
        },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      db.meeting.findMany({
        where: { groupId, startsAt: { gte: now } },
        select: { id: true, title: true, startsAt: true, durationMinutes: true, joinUrl: true },
        orderBy: { startsAt: "asc" },
        take: 4,
      }),
      db.thread.findMany({
        where: { groupId, deletedAt: null },
        select: {
          id: true,
          title: true,
          kind: true,
          pinned: true,
          resolvedAt: true,
          createdAt: true,
          author: { select: { name: true, avatarUrl: true } },
          _count: { select: { messages: true } },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      db.fileAsset.count({ where: { groupId, deletedAt: null } }),
      db.ledgerEvent.findMany({
        where: { groupId },
        select: {
          id: true,
          kind: true,
          createdAt: true,
          subjectType: true,
          subjectId: true,
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

  const total = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const done = statusCounts.find((row) => row.status === "DONE")?._count._all ?? 0;

  return {
    progress: { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) },
    statusCounts,
    myTasks,
    upcomingTasks,
    meetings,
    threads,
    fileCount: files,
    activity,
  };
}

/* ------------------------------------------------------------ my open work */

/** Open tasks assigned to the viewer, across every group. Powers `/groups/my-tasks`. */
export async function listMyTasks(viewer: Viewer) {
  if (!viewer.userId) return [];

  return db.task.findMany({
    where: {
      deletedAt: null,
      status: { in: OPEN_TASK_STATUSES },
      assignees: { some: { userId: viewer.userId } },
      groupId: { in: groupIds(viewer) },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      group: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
  });
}

/** Classes the viewer could create a group inside. */
export async function listClassesForGroupCreation(viewer: Viewer) {
  if (!viewer.userId) return [];

  const classIds = [
    ...new Set([
      ...viewer.enrolledIn.map((klass) => klass.classId),
      ...viewer.teaches.map((klass) => klass.classId),
    ]),
  ];
  if (classIds.length === 0) return [];

  return db.class.findMany({
    where: { id: { in: classIds }, archivedAt: null },
    select: {
      id: true,
      section: true,
      collegeId: true,
      subjectId: true,
      subject: { select: { name: true, code: true } },
      term: { select: { name: true, endsOn: true } },
    },
    orderBy: [{ subject: { code: "asc" } }, { section: "asc" }],
  });
}

/** True when the viewer belongs to this group — the cheap check, off the viewer. */
export const inGroup = (viewer: Viewer, groupId: string): boolean => isGroupMember(viewer, groupId);
