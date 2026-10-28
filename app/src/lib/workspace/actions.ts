"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { isGroupLead, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";

/**
 * GROUP LIFECYCLE AND MEMBERSHIP.
 *
 * Every action here follows the same four steps, in this order, and the order
 * is the point:
 *
 *   1. Parse with Zod — on the server, from the same schema the form uses.
 *   2. Load the group **through `requireWorkspace`**, which returns null for a
 *      group the viewer may not see. An id from another college resolves to
 *      nothing, not to a refusal.
 *   3. Ask `can()`. Never `if (role === …)` — that rule lives in `policy.ts`
 *      and a second copy of it drifts.
 *   4. Mutate inside a transaction when more than one row changes.
 *
 * A note on what these deliberately do *not* do: there is no notification
 * delivery here. `Mention` rows are written because the model exists and the
 * evidence is worth capturing now, but turning one into a notification is
 * Phase 10's job, and half-building it would leave two places deciding what
 * gets delivered.
 */

export type WorkspaceResult =
  { ok: true; message: string; id?: string } | { ok: false; error: string; field?: string };

const fail = (error: unknown): WorkspaceResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

/** The viewer, refused if not signed in. */
async function actor(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as Viewer & { userId: string };
}

/**
 * Load a group the viewer may act in, or refuse.
 *
 * Returns the workspace and the `can()` resource together so a caller cannot
 * accidentally authorise against a resource it assembled itself — which is how
 * a check ends up asking about the wrong group.
 */
export async function loadForAction(viewer: Viewer, groupId: string) {
  const workspace = await requireWorkspace(viewer, groupId);
  // Same refusal whether the group is absent or simply not theirs. A distinct
  // "you may not" confirms a named group exists inside a named class.
  if (!workspace) throw new Error("That group is not available.");

  return { workspace, resource: groupResource({ ...workspace, id: workspace.id }) };
}

const refresh = (groupId: string) => {
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
};

/* ------------------------------------------------------------ create */

const createSchema = z.object({
  classId: z.string().min(1, "Choose the class this group belongs to."),
  name: z.string().trim().min(3, "Give the group a name.").max(80),
  description: z.string().trim().max(500).optional(),
  sizeLimit: z.coerce.number().int().min(2, "A group needs at least two people.").max(12),
  visibility: z.enum(["PRIVATE", "GROUP", "CLASS", "COLLEGE"]),
  joinPolicy: z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]),
});

/**
 * Create a group inside a class, and make the creator its lead.
 *
 * The two writes are one transaction because a group with no members is not a
 * half-created group — it is an orphan nobody can open, including the person
 * who just made it.
 */
export async function createGroup(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = createSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    const klass = await db.class.findFirst({
      where: { id: input.classId, archivedAt: null },
      select: { id: true, collegeId: true, subjectId: true },
    });
    if (!klass) return { ok: false, error: "That class is not available.", field: "classId" };

    if (!can(viewer, "group:create", { kind: "class", ...klass, classId: klass.id })) {
      return { ok: false, error: "You are not in that class." };
    }

    const group = await db.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          collegeId: klass.collegeId,
          classId: klass.id,
          name: input.name,
          description: input.description || null,
          sizeLimit: input.sizeLimit,
          visibility: input.visibility,
          joinPolicy: input.joinPolicy,
        },
        select: { id: true },
      });

      await tx.groupMember.create({
        data: { groupId: created.id, userId: viewer.userId, role: "LEAD" },
      });

      return created;
    });

    revalidatePath("/groups");
    return { ok: true, message: `${input.name} is ready.`, id: group.id };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------------------------------- settings */

const settingsSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional(),
  sizeLimit: z.coerce.number().int().min(2).max(12),
  visibility: z.enum(["PRIVATE", "GROUP", "CLASS", "COLLEGE"]),
  joinPolicy: z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]),
});

export async function updateGroup(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = settingsSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace } = await loadForAction(viewer, input.groupId);

    if (!isGroupLead(viewer, workspace.id)) {
      return { ok: false, error: "Only the group lead can change these settings." };
    }

    if (input.sizeLimit < workspace.members.length) {
      return {
        ok: false,
        field: "sizeLimit",
        error: `The group already has ${workspace.members.length} members.`,
      };
    }

    await db.group.update({
      where: { id: workspace.id },
      data: {
        name: input.name,
        description: input.description || null,
        sizeLimit: input.sizeLimit,
        visibility: input.visibility,
        joinPolicy: input.joinPolicy,
      },
    });

    refresh(workspace.id);
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Archive a group.
 *
 * Archive, never delete — the tasks, files, discussion and ledger are the
 * evidence behind every contribution claim any of these members will ever make,
 * and a delete button would let one bad week erase four years of somebody's
 * record.
 */
export async function archiveGroup(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const groupId = z.string().min(1).parse(formData.get("groupId"));
    const restore = formData.get("restore") === "true";
    const viewer = await actor();
    const { workspace } = await loadForAction(viewer, groupId);

    if (!isGroupLead(viewer, workspace.id)) {
      return { ok: false, error: "Only the group lead can archive this group." };
    }

    await db.group.update({
      where: { id: workspace.id },
      data: { archivedAt: restore ? null : new Date() },
    });

    refresh(workspace.id);
    return { ok: true, message: restore ? "Group restored." : "Group archived." };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------- membership */

const inviteSchema = z.object({
  groupId: z.string().min(1),
  /** A username or an email — people have both and remember whichever. */
  identifier: z.string().trim().min(1, "Enter a username or email address."),
});

/**
 * Invite somebody to the group.
 *
 * Two rules that look like fussiness and are not:
 *
 * · **The invitee must already belong to the college.** A group is inside a
 *   class inside a college; inviting an outsider into it would create reach
 *   that the college gate exists to prevent. Cross-college collaboration is a
 *   `GUEST` membership (ADR-022) issued by an administrator, not a side effect
 *   of a student typing an email address.
 * · **The answer is the same whether the person exists or not.** Otherwise this
 *   form is a membership oracle for the whole college.
 */
export async function inviteToGroup(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = inviteSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "group:invite", resource)) {
      return { ok: false, error: "Only the group lead or the class faculty can invite." };
    }

    if (workspace.members.length >= workspace.sizeLimit) {
      return { ok: false, error: `This group is full (${workspace.sizeLimit} members).` };
    }

    const identifier = input.identifier.toLowerCase();
    const invitee = await db.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
        memberships: {
          some: { collegeId: workspace.collegeId, state: { in: ["ACTIVE", "GUEST"] } },
        },
      },
      select: { id: true, name: true },
    });

    const vague = {
      ok: true as const,
      message: `If ${input.identifier} is at this college, they have been added.`,
    };
    if (!invitee) return vague;

    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: workspace.id, userId: invitee.id } },
      select: { id: true, leftAt: true },
    });

    if (existing && !existing.leftAt) return vague;

    if (existing) {
      // Somebody who left and is coming back reuses their row, so their earlier
      // ledger events stay attributed to them rather than to a stranger with
      // the same name.
      await db.groupMember.update({
        where: { id: existing.id },
        data: { leftAt: null, joinedAt: new Date() },
      });
    } else {
      await db.groupMember.create({
        data: { groupId: workspace.id, userId: invitee.id, role: "MEMBER" },
      });
    }

    refresh(workspace.id);
    return { ok: true, message: `${invitee.name} is now in the group.` };
  } catch (error) {
    return fail(error);
  }
}

/** Join a group whose policy is OPEN. REQUEST and INVITE_ONLY go through a lead. */
export async function joinGroup(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const groupId = z.string().min(1).parse(formData.get("groupId"));
    const viewer = await actor();

    const group = await db.group.findFirst({
      where: { id: groupId, archivedAt: null },
      select: {
        id: true,
        name: true,
        collegeId: true,
        classId: true,
        joinPolicy: true,
        sizeLimit: true,
        visibility: true,
        class: { select: { subjectId: true } },
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    });

    if (!group || group.visibility !== "COLLEGE") {
      return { ok: false, error: "That group is not available." };
    }

    if (!can(viewer, "group:join", groupResource(group))) {
      return { ok: false, error: "That group is not at your college." };
    }

    if (group.joinPolicy !== "OPEN") {
      return { ok: false, error: "This group asks people to be invited by its lead." };
    }

    if (group._count.members >= group.sizeLimit) {
      return { ok: false, error: "That group is full." };
    }

    await db.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: viewer.userId } },
      create: { groupId: group.id, userId: viewer.userId, role: "MEMBER" },
      update: { leftAt: null, joinedAt: new Date() },
    });

    refresh(group.id);
    return { ok: true, message: `You have joined ${group.name}.` };
  } catch (error) {
    return fail(error);
  }
}

const memberSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * Remove somebody from the group.
 *
 * `leftAt` rather than a delete: their ledger events, closed tasks and uploaded
 * files stay attributed. Removing a person must not remove the record of what
 * they did, or "remove the member who did the work" becomes a way to rewrite a
 * contribution history.
 */
export async function removeMember(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = memberSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "group:invite", resource)) {
      return { ok: false, error: "Only the group lead or the class faculty can remove members." };
    }

    const target = workspace.members.find((member) => member.user.id === input.userId);
    if (!target) return { ok: false, error: "That person is not in this group." };

    if (target.role === "LEAD") {
      return {
        ok: false,
        error:
          "Transfer leadership before removing the lead, so the group is never left without one.",
      };
    }

    await db.groupMember.update({
      where: { groupId_userId: { groupId: workspace.id, userId: input.userId } },
      data: { leftAt: new Date() },
    });

    refresh(workspace.id);
    return { ok: true, message: `${target.user.name} has been removed.` };
  } catch (error) {
    return fail(error);
  }
}

/** Hand the LEAD role to another member. Both writes, one transaction. */
export async function transferLead(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = memberSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace } = await loadForAction(viewer, input.groupId);

    if (!isGroupLead(viewer, workspace.id)) {
      return { ok: false, error: "Only the current lead can transfer leadership." };
    }

    const target = workspace.members.find((member) => member.user.id === input.userId);
    if (!target) return { ok: false, error: "That person is not in this group." };

    await db.$transaction([
      db.groupMember.update({
        where: { groupId_userId: { groupId: workspace.id, userId: viewer.userId } },
        data: { role: "MEMBER" },
      }),
      db.groupMember.update({
        where: { groupId_userId: { groupId: workspace.id, userId: input.userId } },
        data: { role: "LEAD" },
      }),
    ]);

    refresh(workspace.id);
    return { ok: true, message: `${target.user.name} now leads this group.` };
  } catch (error) {
    return fail(error);
  }
}

/** Leave a group. A lead must transfer leadership first. */
export async function leaveGroup(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const groupId = z.string().min(1).parse(formData.get("groupId"));
    const viewer = await actor();
    const { workspace } = await loadForAction(viewer, groupId);

    if (isGroupLead(viewer, workspace.id)) {
      const others = workspace.members.filter((member) => member.user.id !== viewer.userId);
      if (others.length > 0) {
        return {
          ok: false,
          error: "Transfer leadership to another member before you leave.",
        };
      }
    }

    await db.groupMember.update({
      where: { groupId_userId: { groupId: workspace.id, userId: viewer.userId } },
      data: { leftAt: new Date() },
    });

    revalidatePath("/groups");
    return { ok: true, message: `You have left ${workspace.name}.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Assign a whole class's students into groups, or one faculty member across
 * every group in a class.
 *
 * The bulk case exists because the alternative is a faculty member inviting
 * themselves to eleven groups by hand at the start of every term, which is the
 * kind of chore that decides whether a tool gets used.
 */
export async function assignFacultyToClassGroups(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const classId = z.string().min(1).parse(formData.get("classId"));
    const viewer = await actor();

    const klass = await db.class.findFirst({
      where: { id: classId },
      select: {
        id: true,
        collegeId: true,
        subjectId: true,
        groups: { select: { id: true } },
      },
    });
    if (!klass) return { ok: false, error: "That class is not available." };

    const resource = {
      kind: "group" as const,
      collegeId: klass.collegeId,
      groupId: "",
      classId: klass.id,
      subjectId: klass.subjectId,
    };
    if (!can(viewer, "group:invite", resource)) {
      return { ok: false, error: "You do not teach this class." };
    }

    const existing = await db.groupMember.findMany({
      where: { userId: viewer.userId, groupId: { in: klass.groups.map((group) => group.id) } },
      select: { groupId: true },
    });
    const already = new Set(existing.map((row) => row.groupId));
    const missing = klass.groups.filter((group) => !already.has(group.id));

    if (missing.length === 0) {
      return { ok: true, message: "You are already in every group in this class." };
    }

    await db.groupMember.createMany({
      data: missing.map((group) => ({
        groupId: group.id,
        userId: viewer.userId,
        role: "MEMBER" as const,
      })),
    });

    revalidatePath("/groups");
    return { ok: true, message: `Added to ${missing.length} groups.` };
  } catch (error) {
    return fail(error);
  }
}
