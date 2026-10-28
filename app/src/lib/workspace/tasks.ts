"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { compensateLedgerEvent, recordLedgerEvent } from "@/lib/ledger/record";

import { loadForAction, type WorkspaceResult } from "./actions";
import { extractMentions } from "./mentions";

/**
 * TASKS.
 *
 * The one thing in this file that is not ordinary CRUD is `setTaskStatus`, and
 * it is the reason the phase spec calls the transaction boundary "the whole
 * feature":
 *
 * **Closing a task and recording the contribution are one transaction.** Not
 * two statements in sequence, not a write followed by an await — one atomic
 * unit. If the ledger write happened afterwards and the process died between
 * them, the board would show a closed task that the contribution record has
 * never heard of. That divergence is invisible, permanent, and it looks exactly
 * like a student's contribution being undercounted, which is the single thing
 * this feature must never do by accident.
 *
 * The other half of the same rule: **reopening a closed task compensates**. It
 * writes a second, negative event rather than deleting the first. "Closed on
 * Tuesday, reopened on Wednesday" is the honest account, and an update would
 * have destroyed it.
 */

const fail = (error: unknown): WorkspaceResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor() {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as typeof viewer & { userId: string };
}

const refresh = (groupId: string) => {
  revalidatePath(`/groups/${groupId}/tasks`);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups/my-tasks");
};

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"] as const;

/* ----------------------------------------------------------------- create */

const createSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(2, "Give the task a title.").max(160),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(STATUSES).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional(),
  assigneeIds: z.string().optional(),
  labels: z.string().optional(),
  milestoneId: z.string().optional(),
});

const parseDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const parseIds = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

export async function createTask(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = createSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "task:write", resource)) {
      return { ok: false, error: "You cannot add tasks to this group." };
    }

    // Assignment is restricted to people actually in the group — otherwise a
    // task can be parked on somebody who cannot see it, and the ledger records
    // work against a person with no way to do it.
    const memberIds = new Set(workspace.members.map((member) => member.user.id));
    const assignees = parseIds(input.assigneeIds).filter((id) => memberIds.has(id));
    const labels = parseIds(input.labels).slice(0, 6);

    const last = await db.task.findFirst({
      where: { groupId: workspace.id, status: input.status, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const task = await db.task.create({
      data: {
        groupId: workspace.id,
        creatorId: viewer.userId,
        title: input.title,
        description: input.description || null,
        status: input.status,
        priority: input.priority,
        dueDate: parseDate(input.dueDate),
        milestoneId: input.milestoneId || null,
        position: (last?.position ?? 0) + 1,
        assignees: { create: assignees.map((userId) => ({ userId })) },
        labels: { create: labels.map((name) => ({ name })) },
      },
      select: { id: true },
    });

    refresh(workspace.id);
    return { ok: true, message: "Task added.", id: task.id };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ edit */

const updateSchema = createSchema.extend({ taskId: z.string().min(1) });

export async function updateTask(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = updateSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "task:write", resource)) {
      return { ok: false, error: "You cannot edit tasks in this group." };
    }

    const existing = await db.task.findFirst({
      where: { id: input.taskId, groupId: workspace.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) return { ok: false, error: "That task no longer exists." };

    const memberIds = new Set(workspace.members.map((member) => member.user.id));
    const assignees = parseIds(input.assigneeIds).filter((id) => memberIds.has(id));
    const labels = parseIds(input.labels).slice(0, 6);

    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description || null,
          priority: input.priority,
          dueDate: parseDate(input.dueDate),
          milestoneId: input.milestoneId || null,
        },
      });

      // Assignees and labels are replaced rather than diffed: the form sends
      // the complete set, and a diff of two small sets is more code and one
      // more thing to get wrong.
      await tx.taskAssignee.deleteMany({ where: { taskId: existing.id } });
      if (assignees.length > 0) {
        await tx.taskAssignee.createMany({
          data: assignees.map((userId) => ({ taskId: existing.id, userId })),
        });
      }

      await tx.taskLabel.deleteMany({ where: { taskId: existing.id } });
      if (labels.length > 0) {
        await tx.taskLabel.createMany({
          data: labels.map((name) => ({ taskId: existing.id, name })),
        });
      }
    });

    // A status change is never applied here — it goes through setTaskStatus so
    // there is exactly one place that writes to the ledger.
    if (input.status !== existing.status) {
      return setTaskStatus(null, formDataOf({ ...input, status: input.status }));
    }

    refresh(workspace.id);
    return { ok: true, message: "Task updated." };
  } catch (error) {
    return fail(error);
  }
}

/** Rebuild a FormData for the one internal hand-off above. */
function formDataOf(values: Record<string, string | number | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) data.set(key, String(value));
  }
  return data;
}

/* ----------------------------------------------------- status & the ledger */

const statusSchema = z.object({
  groupId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.enum(STATUSES),
  /** Index within the destination column, for drag and drop. */
  position: z.coerce.number().int().optional(),
});

/**
 * Move a task, and record the contribution if that move closed it.
 *
 * Everything that must be atomic is inside one `$transaction` callback: the
 * status change, the `closedAt` stamp, and the ledger event or its
 * compensation. Nothing about the ledger is computed outside it.
 */
export async function setTaskStatus(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = statusSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "task:write", resource)) {
      return { ok: false, error: "You cannot move tasks in this group." };
    }

    const task = await db.task.findFirst({
      where: { id: input.taskId, groupId: workspace.id, deletedAt: null },
      select: {
        id: true,
        status: true,
        title: true,
        closedAt: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) return { ok: false, error: "That task no longer exists." };

    if (task.status === input.status && input.position === undefined) {
      return { ok: true, message: "Nothing changed." };
    }

    const closing = input.status === "DONE" && task.status !== "DONE";
    const reopening = task.status === "DONE" && input.status !== "DONE";

    /**
     * Who gets the credit.
     *
     * The assignees, because they did the work. When a task has none, the
     * person who closed it — otherwise a group that works off an unassigned
     * board records nothing at all, and the members who use the board most
     * carefully would end up with the emptiest ledgers.
     */
    const credited =
      task.assignees.length > 0 ? task.assignees.map((row) => row.userId) : [viewer.userId];

    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: {
          status: input.status,
          closedAt: closing ? new Date() : reopening ? null : task.closedAt,
          ...(input.position === undefined ? {} : { position: input.position }),
        },
      });

      if (closing) {
        for (const userId of credited) {
          await recordLedgerEvent(tx, {
            groupId: workspace.id,
            userId,
            kind: "TASK_CLOSED",
            subjectType: "Task",
            subjectId: task.id,
            metadata: { title: task.title, closedBy: viewer.userId },
          });
        }
      }

      if (reopening) {
        for (const userId of credited) {
          await compensateLedgerEvent(tx, {
            groupId: workspace.id,
            userId,
            kind: "TASK_CLOSED",
            subjectType: "Task",
            subjectId: task.id,
            metadata: { title: task.title, reopenedBy: viewer.userId },
          });
        }
      }
    });

    refresh(workspace.id);
    return { ok: true, message: closing ? "Task closed." : "Task moved." };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------------------------------------- delete */

export async function deleteTask(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({ groupId: z.string().min(1), taskId: z.string().min(1) })
      .parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "task:write", resource)) {
      return { ok: false, error: "You cannot remove tasks from this group." };
    }

    const task = await db.task.findFirst({
      where: { id: input.taskId, groupId: workspace.id, deletedAt: null },
      select: { id: true, status: true, title: true, assignees: { select: { userId: true } } },
    });
    if (!task) return { ok: false, error: "That task no longer exists." };

    await db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });

      // Deleting a closed task withdraws the credit it earned. Leaving it would
      // make deletion a way to keep points for work that is no longer on the
      // board — and the compensating event keeps the fact that it happened.
      if (task.status === "DONE") {
        const credited =
          task.assignees.length > 0 ? task.assignees.map((row) => row.userId) : [viewer.userId];

        for (const userId of credited) {
          await compensateLedgerEvent(tx, {
            groupId: workspace.id,
            userId,
            kind: "TASK_CLOSED",
            subjectType: "Task",
            subjectId: task.id,
            metadata: { title: task.title, deletedBy: viewer.userId },
          });
        }
      }
    });

    refresh(workspace.id);
    return { ok: true, message: "Task removed." };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- comments */

const commentSchema = z.object({
  groupId: z.string().min(1),
  taskId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(4000),
});

export async function commentOnTask(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = commentSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "discussion:post", resource)) {
      return { ok: false, error: "You cannot comment in this group." };
    }

    const task = await db.task.findFirst({
      where: { id: input.taskId, groupId: workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!task) return { ok: false, error: "That task no longer exists." };

    // Mentions are resolved against the group, never the whole college: an
    // @mention that reaches somebody outside the room would leak the room.
    const mentioned = extractMentions(input.body, workspace.members);

    await db.taskComment.create({
      data: { taskId: task.id, authorId: viewer.userId, body: input.body },
    });

    revalidatePath(`/groups/${workspace.id}/tasks/${task.id}`);
    return {
      ok: true,
      message:
        mentioned.length > 0 ? `Comment posted, ${mentioned.length} mentioned.` : "Comment posted.",
    };
  } catch (error) {
    return fail(error);
  }
}
