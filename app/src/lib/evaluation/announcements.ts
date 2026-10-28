"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { teachesSubject, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

/**
 * ANNOUNCEMENTS AND DEADLINE BROADCAST.
 *
 * The plainest feature in the phase and the one most likely to decide whether a
 * faculty member comes back: it is the thing they already do, badly, over email.
 *
 * Two deliberate limits.
 *
 * **Scheduled means stored with a future `publishAt`, not queued.** There is no
 * job runner in this product and pretending otherwise would mean a scheduled
 * announcement that silently never fires. A future `publishAt` is simply not
 * yet visible, and the query filters on it — no infrastructure, no way for it
 * to fail quietly.
 *
 * **A deadline broadcast creates real tasks**, one per group, rather than a
 * separate "class deadline" concept the group's board knows nothing about. A
 * date that does not appear on the board people actually look at is a date
 * nobody meets.
 */

export type AnnounceResult =
  { ok: true; message: string } | { ok: false; error: string; field?: string };

const fail = (error: unknown): AnnounceResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as Viewer & { userId: string };
}

const parseDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/* ---------------------------------------------------------- announcements */

const announceSchema = z.object({
  classId: z.string().min(1, "Choose a class."),
  title: z.string().trim().min(4, "Give it a subject line.").max(160),
  body: z.string().trim().min(10, "Say something.").max(8000),
  /** Blank means now. */
  publishAt: z.string().optional(),
});

export async function postAnnouncement(
  _previous: AnnounceResult | null,
  formData: FormData,
): Promise<AnnounceResult> {
  try {
    const input = announceSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    const klass = await db.class.findUnique({
      where: { id: input.classId },
      select: { id: true, collegeId: true, subjectId: true, _count: { select: { groups: true } } },
    });
    if (!klass) return { ok: false, field: "classId", error: "That class is not available." };

    if (!teachesSubject(viewer, klass.subjectId)) {
      return { ok: false, error: "You do not teach that class." };
    }

    const publishAt = parseDate(input.publishAt) ?? new Date();

    await db.announcement.create({
      data: {
        collegeId: klass.collegeId,
        authorId: viewer.userId,
        classId: klass.id,
        title: input.title,
        body: input.body,
        publishAt,
      },
    });

    revalidatePath("/faculty/announcements");
    revalidatePath(`/faculty/classes/${klass.id}`);

    const scheduled = publishAt > new Date();
    return {
      ok: true,
      message: scheduled
        ? `Scheduled for ${publishAt.toLocaleString("en-IN", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}. It is invisible until then.`
        : `Posted to ${klass._count.groups} ${klass._count.groups === 1 ? "group" : "groups"}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAnnouncement(
  _previous: AnnounceResult | null,
  formData: FormData,
): Promise<AnnounceResult> {
  try {
    const id = z.string().min(1).parse(formData.get("announcementId"));
    const viewer = await actor();

    const announcement = await db.announcement.findUnique({
      where: { id },
      select: { id: true, authorId: true, classId: true, publishAt: true },
    });
    if (!announcement) return { ok: false, error: "That announcement no longer exists." };

    if (announcement.authorId !== viewer.userId) {
      return { ok: false, error: "Only the author can withdraw an announcement." };
    }

    // Deleting one people have already read is dishonest; withdrawing one that
    // has not published yet is just editing. Only the second is allowed.
    if (announcement.publishAt <= new Date()) {
      return {
        ok: false,
        error:
          "This has already been published. Post a correction rather than removing it — people have read it.",
      };
    }

    await db.announcement.delete({ where: { id: announcement.id } });

    revalidatePath("/faculty/announcements");
    return { ok: true, message: "Withdrawn before publication." };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------ deadline broadcast */

const deadlineSchema = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(3, "Name the deadline.").max(160),
  dueDate: z.string().min(1, "Choose a date."),
  description: z.string().trim().max(1000).optional(),
});

/**
 * Set a deadline for every group in a class.
 *
 * Creates one `Task` per group, in `TODO`, due on the date. It lands on the
 * board they already look at, counts toward their progress, and shows in the
 * deadline strip — none of which a separate "class deadline" table would do.
 *
 * Idempotent by title and date: running it twice does not give every group two
 * identical tasks, which is the mistake somebody makes in the first week.
 */
export async function broadcastDeadline(
  _previous: AnnounceResult | null,
  formData: FormData,
): Promise<AnnounceResult> {
  try {
    const input = deadlineSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    const klass = await db.class.findUnique({
      where: { id: input.classId },
      select: {
        id: true,
        subjectId: true,
        groups: { where: { archivedAt: null }, select: { id: true } },
      },
    });
    if (!klass) return { ok: false, error: "That class is not available." };

    if (!teachesSubject(viewer, klass.subjectId)) {
      return { ok: false, error: "You do not teach that class." };
    }

    const dueDate = parseDate(input.dueDate);
    if (!dueDate) return { ok: false, field: "dueDate", error: "That is not a valid date." };

    if (klass.groups.length === 0) {
      return { ok: false, error: "This class has no groups yet." };
    }

    const existing = await db.task.findMany({
      where: {
        groupId: { in: klass.groups.map((group) => group.id) },
        title: input.title,
        deletedAt: null,
      },
      select: { groupId: true },
    });
    const already = new Set(existing.map((task) => task.groupId));
    const targets = klass.groups.filter((group) => !already.has(group.id));

    if (targets.length === 0) {
      return { ok: true, message: "Every group already has this deadline." };
    }

    await db.task.createMany({
      data: targets.map((group) => ({
        groupId: group.id,
        creatorId: viewer.userId,
        title: input.title,
        description: input.description || "Set by your faculty guide for the whole class.",
        status: "TODO" as const,
        priority: "HIGH" as const,
        dueDate,
      })),
    });

    for (const group of targets) revalidatePath(`/groups/${group.id}/tasks`);
    revalidatePath(`/faculty/classes/${klass.id}`);

    return {
      ok: true,
      message: `Added to ${targets.length} ${targets.length === 1 ? "group's board" : "groups' boards"}${
        already.size > 0 ? ` — ${already.size} already had it` : ""
      }.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------- questions */

/**
 * Answer a question raised in a supervised workspace.
 *
 * Posts into the group's own thread rather than a private faculty channel: the
 * answer belongs where the next person to ask will look for it, and a group
 * mate who had the same question should not have to ask it again.
 */
export async function answerQuestion(
  _previous: AnnounceResult | null,
  formData: FormData,
): Promise<AnnounceResult> {
  try {
    const input = z
      .object({
        threadId: z.string().min(1),
        body: z.string().trim().min(5, "Write an answer.").max(8000),
        resolve: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();

    const thread = await db.thread.findUnique({
      where: { id: input.threadId },
      select: {
        id: true,
        groupId: true,
        resolvedAt: true,
        group: { select: { class: { select: { subjectId: true } } } },
      },
    });
    if (!thread) return { ok: false, error: "That thread no longer exists." };

    if (!teachesSubject(viewer, thread.group?.class?.subjectId ?? null)) {
      return { ok: false, error: "That group is not in a subject you teach." };
    }

    const resolving = input.resolve === "true" && thread.resolvedAt === null;

    await db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { threadId: thread.id, authorId: viewer.userId, body: input.body },
        select: { id: true },
      });

      if (resolving) {
        await tx.thread.update({
          where: { id: thread.id },
          data: { resolvedAt: new Date(), resolvedByMessageId: message.id },
        });
      }
    });

    // Deliberately no ledger event. The ledger measures the group's own
    // contribution, and a faculty answer is not the group's work — crediting it
    // would inflate a number the group is assessed on.
    revalidatePath(`/groups/${thread.groupId}/discussion/${thread.id}`);
    revalidatePath("/faculty");

    return { ok: true, message: resolving ? "Answered and resolved." : "Answered." };
  } catch (error) {
    return fail(error);
  }
}
