import type { $Enums, Prisma } from "@prisma/client";

import { TASK_COLUMNS } from "@/config/tasks";
import { db } from "@/lib/db/client";

import type { Workspace } from "./group";

/**
 * WORKSPACE READS.
 *
 * Every function here takes a `Workspace` rather than a group id, and that is a
 * deliberate safety property rather than a convenience: a `Workspace` value can
 * only be obtained from `requireWorkspace()`, which has already authorised the
 * viewer. A function that took an id could be called with one that came
 * straight off the URL, and the authorisation would be somebody else's problem
 * to remember.
 *
 * Peer review is the exception that proves it — see `getReviewsFor` at the
 * bottom, which takes the viewer as well, because *who is asking* changes what
 * comes back (ADR-008).
 */

/* ----------------------------------------------------------------- tasks */

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  position: true,
  closedAt: true,
  createdAt: true,
  milestoneId: true,
  creator: { select: { id: true, name: true } },
  assignees: {
    select: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
  },
  labels: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskSelect;

export type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export async function listTasks(workspace: Workspace): Promise<TaskRow[]> {
  return db.task.findMany({
    where: { groupId: workspace.id, deletedAt: null },
    select: taskSelect,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function getTask(workspace: Workspace, taskId: string) {
  return db.task.findFirst({
    where: { id: taskId, groupId: workspace.id, deletedAt: null },
    select: {
      ...taskSelect,
      comments: {
        where: { deletedAt: null },
        select: { id: true, body: true, createdAt: true, authorId: true },
        orderBy: { createdAt: "asc" },
      },
      milestone: { select: { id: true, title: true, state: true } },
    },
  });
}

/** Group tasks into board columns, preserving the column order above. */
export function toColumns(
  tasks: readonly TaskRow[],
): { status: $Enums.TaskStatus; tasks: TaskRow[] }[] {
  return TASK_COLUMNS.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));
}

/* ----------------------------------------------------------------- files */

const fileSelect = {
  id: true,
  name: true,
  folder: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  quarantined: true,
  uploader: { select: { id: true, name: true, username: true, avatarUrl: true } },
  versions: {
    select: {
      id: true,
      version: true,
      note: true,
      sizeBytes: true,
      createdAt: true,
      uploader: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { version: "desc" },
  },
} satisfies Prisma.FileAssetSelect;

export type FileRow = Prisma.FileAssetGetPayload<{ select: typeof fileSelect }>;

export async function listFiles(
  workspace: Workspace,
  options: { trashed?: boolean; q?: string; folder?: string } = {},
): Promise<FileRow[]> {
  const search = options.q?.trim();

  return db.fileAsset.findMany({
    where: {
      groupId: workspace.id,
      deletedAt: options.trashed ? { not: null } : null,
      ...(options.folder && options.folder !== "/" ? { folder: options.folder } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    select: fileSelect,
    orderBy: [{ folder: "asc" }, { name: "asc" }],
  });
}

/** Bytes in use, for the quota bar. Counts rows, which is what the quota gates. */
export async function storageUsed(workspace: Workspace): Promise<number> {
  const used = await db.fileAsset.aggregate({
    where: { groupId: workspace.id, deletedAt: null },
    _sum: { sizeBytes: true },
  });
  return used._sum.sizeBytes ?? 0;
}

/* ------------------------------------------------------------ discussion */

const threadSelect = {
  id: true,
  title: true,
  body: true,
  kind: true,
  pinned: true,
  resolvedAt: true,
  resolvedByMessageId: true,
  createdAt: true,
  author: { select: { id: true, name: true, username: true, avatarUrl: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.ThreadSelect;

export type ThreadRow = Prisma.ThreadGetPayload<{ select: typeof threadSelect }>;

export async function listThreads(
  workspace: Workspace,
  options: { kind?: $Enums.ThreadKind } = {},
): Promise<ThreadRow[]> {
  return db.thread.findMany({
    where: {
      groupId: workspace.id,
      deletedAt: null,
      ...(options.kind ? { kind: options.kind } : {}),
    },
    select: threadSelect,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
}

export async function getThread(workspace: Workspace, threadId: string) {
  return db.thread.findFirst({
    where: { id: threadId, groupId: workspace.id, deletedAt: null },
    select: {
      ...threadSelect,
      messages: {
        where: { deletedAt: null },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, username: true, avatarUrl: true } },
          mentions: { select: { userId: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/* -------------------------------------------------------------- meetings */

const meetingSelect = {
  id: true,
  title: true,
  agenda: true,
  notes: true,
  startsAt: true,
  durationMinutes: true,
  location: true,
  joinUrl: true,
  host: { select: { id: true, name: true, avatarUrl: true } },
  attendance: {
    select: {
      rsvp: true,
      attended: true,
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.MeetingSelect;

export type MeetingRow = Prisma.MeetingGetPayload<{ select: typeof meetingSelect }>;

export async function listMeetings(workspace: Workspace, now = new Date()) {
  const [upcoming, past] = await Promise.all([
    db.meeting.findMany({
      where: { groupId: workspace.id, startsAt: { gte: now } },
      select: meetingSelect,
      orderBy: { startsAt: "asc" },
    }),
    db.meeting.findMany({
      where: { groupId: workspace.id, startsAt: { lt: now } },
      select: meetingSelect,
      orderBy: { startsAt: "desc" },
      take: 20,
    }),
  ]);

  return { upcoming, past };
}

/* ---------------------------------------------------------------- ledger */

export async function listLedgerEvents(workspace: Workspace) {
  return db.ledgerEvent.findMany({
    where: { groupId: workspace.id },
    select: {
      id: true,
      userId: true,
      kind: true,
      weight: true,
      subjectType: true,
      subjectId: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The workspace activity stream — every event, filterable.
 *
 * Reads `ActivityEvent` and `LedgerEvent` together because they answer the same
 * question from two angles: the ledger records what counted as contribution,
 * activity records what happened. A member looking for "who changed the join
 * policy" needs the second, and it is not a contribution.
 */
export async function listActivity(
  workspace: Workspace,
  options: { userId?: string; take?: number } = {},
) {
  const take = options.take ?? 60;

  const [ledger, activity] = await Promise.all([
    db.ledgerEvent.findMany({
      where: { groupId: workspace.id, ...(options.userId ? { userId: options.userId } : {}) },
      select: {
        id: true,
        kind: true,
        weight: true,
        subjectType: true,
        subjectId: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.activityEvent.findMany({
      where: { groupId: workspace.id, ...(options.userId ? { actorId: options.userId } : {}) },
      select: {
        id: true,
        kind: true,
        subjectType: true,
        subjectId: true,
        metadata: true,
        createdAt: true,
        actorId: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  return { ledger, activity };
}

/* ------------------------------------------------------------ milestones */

export async function listMilestones(workspace: Workspace) {
  return db.milestone.findMany({
    where: { project: { groupId: workspace.id } },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      state: true,
      completedAt: true,
      ownerId: true,
      project: { select: { id: true, title: true } },
      _count: { select: { reviews: true } },
    },
    orderBy: [{ dueDate: "asc" }, { position: "asc" }],
  });
}

/* ----------------------------------------------------------- peer review */

export type ReviewAggregate = {
  subjectId: string;
  count: number;
  contribution: number;
  reliability: number;
  communication: number;
  /** Comments, detached from their authors. Only ever shown to the subject. */
  comments: string[];
};

export type ReviewDetail = {
  id: string;
  authorId: string;
  authorName: string;
  subjectId: string;
  contribution: number;
  reliability: number;
  communication: number;
  comment: string;
  createdAt: Date;
};

/**
 * Peer review, read through the one-directional privacy rule (ADR-008).
 *
 * Three audiences, three shapes, and the difference is enforced **here** rather
 * than by a page choosing what to render:
 *
 *  · **Faculty** who teach the subject get `detail` — every review with its
 *    author. They are the ones who have to act on it.
 *  · **A member** gets `aggregate` about *themselves only*: the averages and
 *    the comments with the authors stripped, plus `mine` — the reviews they
 *    themselves wrote, which they are always entitled to see.
 *  · **Anybody else** gets nothing.
 *
 * The member case is the one that must not be got wrong. Note that it queries
 * `subjectId: viewer.userId` rather than fetching the group's reviews and
 * filtering in TypeScript — the same discipline as ADR-033 for private profile
 * fields. A review about somebody else is never read, so it cannot reach the
 * RSC payload, the markup, or a later refactor that renders one more field.
 */
export async function getReviews(
  workspace: Workspace,
  viewer: { userId: string | null; teachesSubject: boolean },
): Promise<{ aggregate: ReviewAggregate | null; mine: ReviewDetail[]; detail: ReviewDetail[] }> {
  if (!viewer.userId) return { aggregate: null, mine: [], detail: [] };

  if (viewer.teachesSubject) {
    const rows = await db.peerReview.findMany({
      where: { groupId: workspace.id },
      select: {
        id: true,
        authorId: true,
        subjectId: true,
        contribution: true,
        reliability: true,
        communication: true,
        comment: true,
        createdAt: true,
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const detail: ReviewDetail[] = rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      authorName: row.author.name,
      subjectId: row.subjectId,
      contribution: row.contribution,
      reliability: row.reliability,
      communication: row.communication,
      comment: row.comment,
      createdAt: row.createdAt,
    }));

    return { aggregate: null, mine: [], detail };
  }

  const isMember = workspace.members.some((member) => member.user.id === viewer.userId);
  if (!isMember) return { aggregate: null, mine: [], detail: [] };

  const [aboutMe, byMe] = await Promise.all([
    // No `authorId` in this select. It is not filtered out later — it is never
    // read, so there is no code path on which it could be rendered.
    db.peerReview.findMany({
      where: { groupId: workspace.id, subjectId: viewer.userId },
      select: {
        contribution: true,
        reliability: true,
        communication: true,
        comment: true,
      },
    }),
    db.peerReview.findMany({
      where: { groupId: workspace.id, authorId: viewer.userId },
      select: {
        id: true,
        subjectId: true,
        contribution: true,
        reliability: true,
        communication: true,
        comment: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mean = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

  /**
   * Below this many reviews, the aggregate is withheld.
   *
   * With one review, "the aggregate about you" and "what that one person said
   * about you" are the same sentence, and the anonymity is decorative. Two is
   * the smallest number at which an average is genuinely an average.
   */
  const MIN_FOR_AGGREGATE = 2;

  const aggregate: ReviewAggregate | null =
    aboutMe.length >= MIN_FOR_AGGREGATE
      ? {
          subjectId: viewer.userId,
          count: aboutMe.length,
          contribution: mean(aboutMe.map((row) => row.contribution)),
          reliability: mean(aboutMe.map((row) => row.reliability)),
          communication: mean(aboutMe.map((row) => row.communication)),
          // Shuffled, so the order does not map onto the member list and hand
          // back the attribution the averages just removed.
          comments: shuffle(aboutMe.map((row) => row.comment)),
        }
      : null;

  const names = new Map(workspace.members.map((member) => [member.user.id, member.user.name]));

  const mine: ReviewDetail[] = byMe.map((row) => ({
    id: row.id,
    authorId: viewer.userId!,
    authorName: "You",
    subjectId: row.subjectId,
    contribution: row.contribution,
    reliability: row.reliability,
    communication: row.communication,
    comment: row.comment,
    createdAt: row.createdAt,
  }));

  return {
    aggregate,
    mine: mine.map((review) => ({
      ...review,
      authorName: names.get(review.subjectId) ?? "A teammate",
    })),
    detail: [],
  };
}

/**
 * Fisher–Yates, seeded by nothing.
 *
 * Deliberately not stable across renders: a stable order over repeated visits
 * would let a member correlate a comment's position with a teammate joining or
 * leaving the review round, which is the attribution the aggregate exists to
 * remove.
 */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/** Which teammates the viewer still owes a review, for the prompt. */
export async function outstandingReviews(
  workspace: Workspace,
  userId: string,
  milestoneId: string | null,
) {
  const submitted = await db.peerReview.findMany({
    where: { groupId: workspace.id, authorId: userId, milestoneId },
    select: { subjectId: true },
  });
  const done = new Set(submitted.map((row) => row.subjectId));

  return workspace.members
    .filter((member) => member.user.id !== userId && !done.has(member.user.id))
    .map((member) => member.user);
}
