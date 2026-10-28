"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { recordLedgerEvent } from "@/lib/ledger/record";

import { loadForAction, type WorkspaceResult } from "./actions";
import { extractMentions } from "./mentions";

/**
 * DISCUSSION.
 *
 * Threads with a title and a body, one level of replies, four kinds. Not chat.
 *
 * **We deliberately do not build chat.** Students already have a group chat and
 * it is better than ours would be. What they do not have is a place where a
 * decision is recorded with the reasoning that produced it, findable three
 * months later when somebody asks why the project uses MQTT. That is what a
 * `DECISION` thread is for, and it is the reason threads have kinds and a
 * resolution rather than just a timestamp.
 *
 * **One nesting level.** Deeper threading helps nobody: it turns a five-person
 * conversation into a tree that has to be explored rather than read, and the
 * reply that answered the question ends up three levels down where nobody sees
 * it. Resolution is the mechanism instead — a `QUESTION` or `BLOCKER` is closed
 * by marking the reply that settled it.
 *
 * **Storage is plain text, rendered through the markdown-lite renderer**
 * (ADR-036). That renderer emits React elements and never
 * `dangerouslySetInnerHTML`, so the XSS class this input would otherwise open
 * does not exist rather than being closed by a sanitiser we have to keep right.
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

const THREAD_KINDS = ["GENERAL", "QUESTION", "DECISION", "BLOCKER"] as const;

/* ---------------------------------------------------------------- create */

const threadSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(3, "Give the thread a title.").max(160),
  body: z.string().trim().min(1, "Write something first.").max(8000),
  kind: z.enum(THREAD_KINDS).default("GENERAL"),
});

export async function startThread(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = threadSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "discussion:post", resource)) {
      return { ok: false, error: "You cannot post in this group." };
    }

    const thread = await db.$transaction(async (tx) => {
      const created = await tx.thread.create({
        data: {
          groupId: workspace.id,
          authorId: viewer.userId,
          title: input.title,
          body: input.body,
          kind: input.kind,
        },
        select: { id: true },
      });

      await recordLedgerEvent(tx, {
        groupId: workspace.id,
        userId: viewer.userId,
        kind: "THREAD_STARTED",
        subjectType: "Thread",
        subjectId: created.id,
        metadata: { title: input.title, kind: input.kind },
      });

      return created;
    });

    revalidatePath(`/groups/${workspace.id}/discussion`);
    revalidatePath(`/groups/${workspace.id}`);
    return { ok: true, message: "Thread posted.", id: thread.id };
  } catch (error) {
    return fail(error);
  }
}

/* ----------------------------------------------------------------- reply */

const replySchema = z.object({
  groupId: z.string().min(1),
  threadId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(8000),
  /** Set when this reply is the one that answers the question. */
  resolves: z.string().optional(),
});

export async function replyToThread(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = replySchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "discussion:post", resource)) {
      return { ok: false, error: "You cannot post in this group." };
    }

    const thread = await db.thread.findFirst({
      where: { id: input.threadId, groupId: workspace.id, deletedAt: null },
      select: { id: true, kind: true, authorId: true, resolvedAt: true },
    });
    if (!thread) return { ok: false, error: "That thread no longer exists." };

    const mentioned = extractMentions(input.body, workspace.members);
    const resolving = input.resolves === "true" && thread.resolvedAt === null;

    await db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { threadId: thread.id, authorId: viewer.userId, body: input.body },
        select: { id: true },
      });

      if (mentioned.length > 0) {
        await tx.mention.createMany({
          data: mentioned.map((mention) => ({ messageId: message.id, userId: mention.userId })),
        });
      }

      if (resolving) {
        await tx.thread.update({
          where: { id: thread.id },
          data: { resolvedAt: new Date(), resolvedByMessageId: message.id },
        });
      }

      await recordLedgerEvent(tx, {
        groupId: workspace.id,
        userId: viewer.userId,
        kind: "MESSAGE_POSTED",
        subjectType: "Message",
        subjectId: message.id,
        metadata: { threadId: thread.id, ...(resolving ? { resolved: true } : {}) },
      });
    });

    revalidatePath(`/groups/${workspace.id}/discussion/${thread.id}`);
    return { ok: true, message: resolving ? "Reply posted and thread resolved." : "Reply posted." };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- moderate */

/**
 * Pin a thread, or unpin it.
 *
 * Any member can pin. A pinned thread is a shared bookmark inside a room of
 * five people, not an authority claim, and requiring a lead for it just means
 * nobody ever uses it.
 */
export async function pinThread(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({ groupId: z.string().min(1), threadId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "discussion:post", resource)) {
      return { ok: false, error: "You cannot change threads in this group." };
    }

    const thread = await db.thread.findFirst({
      where: { id: input.threadId, groupId: workspace.id, deletedAt: null },
      select: { id: true, pinned: true },
    });
    if (!thread) return { ok: false, error: "That thread no longer exists." };

    await db.thread.update({ where: { id: thread.id }, data: { pinned: !thread.pinned } });

    revalidatePath(`/groups/${workspace.id}/discussion`);
    return { ok: true, message: thread.pinned ? "Unpinned." : "Pinned." };
  } catch (error) {
    return fail(error);
  }
}

/** Reopen a resolved question or blocker. */
export async function reopenThread(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({ groupId: z.string().min(1), threadId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "discussion:post", resource)) {
      return { ok: false, error: "You cannot change threads in this group." };
    }

    await db.thread.updateMany({
      where: { id: input.threadId, groupId: workspace.id },
      data: { resolvedAt: null, resolvedByMessageId: null },
    });

    revalidatePath(`/groups/${workspace.id}/discussion/${input.threadId}`);
    return { ok: true, message: "Thread reopened." };
  } catch (error) {
    return fail(error);
  }
}
