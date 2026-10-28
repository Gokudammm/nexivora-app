"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { recordLedgerEvent, recordLedgerEvents } from "@/lib/ledger/record";

import { loadForAction, type WorkspaceResult } from "./actions";

/**
 * MEETINGS.
 *
 * **We do not host video, and the interface says so out loud.** We store a
 * link — Meet, Zoom, Teams, whatever the group already uses — alongside the
 * agenda, the attendance and the minutes. Hosting video is a different company
 * with a different cost structure, and a half-built video feature would be the
 * most visible broken thing in the product.
 *
 * What we do own is the part nobody else keeps: the agenda that was set, who
 * actually turned up, what was decided, and the action items — which become
 * real tasks with one click, in the same transaction, so a decision made in a
 * meeting cannot evaporate on the way to the board.
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

/**
 * A join link must be an `https://` URL.
 *
 * Not fussiness: an unvalidated href is a `javascript:` URL waiting to be
 * clicked by five people who trust each other, and the workspace is exactly the
 * context where they would.
 */
const joinUrlSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine((value) => !value || /^https:\/\//i.test(value), {
    message: "A join link must start with https://",
  });

const meetingSchema = z.object({
  groupId: z.string().min(1),
  meetingId: z.string().optional(),
  title: z.string().trim().min(3, "Give the meeting a title.").max(160),
  agenda: z.string().trim().max(4000).optional(),
  startsAt: z.string().min(1, "Choose a date and time."),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  location: z.string().trim().max(160).optional(),
  joinUrl: joinUrlSchema,
});

export async function scheduleMeeting(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = meetingSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "meeting:schedule", resource)) {
      return { ok: false, error: "You cannot schedule meetings for this group." };
    }

    const startsAt = new Date(input.startsAt);
    if (!Number.isFinite(startsAt.getTime())) {
      return { ok: false, error: "That is not a valid date and time.", field: "startsAt" };
    }

    const data = {
      title: input.title,
      agenda: input.agenda || null,
      startsAt,
      durationMinutes: input.durationMinutes,
      location: input.location || null,
      joinUrl: input.joinUrl || null,
    };

    if (input.meetingId) {
      const existing = await db.meeting.findFirst({
        where: { id: input.meetingId, groupId: workspace.id },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "That meeting no longer exists." };

      await db.meeting.update({ where: { id: existing.id }, data });
      revalidatePath(`/groups/${workspace.id}/meetings`);
      return { ok: true, message: "Meeting updated.", id: existing.id };
    }

    const meeting = await db.meeting.create({
      data: {
        ...data,
        groupId: workspace.id,
        hostId: viewer.userId,
        // Everybody in the group is invited by default with no RSVP yet. A
        // meeting you have to be added to is one people miss.
        attendance: {
          create: workspace.members.map((member) => ({ userId: member.user.id })),
        },
      },
      select: { id: true },
    });

    revalidatePath(`/groups/${workspace.id}/meetings`);
    revalidatePath(`/groups/${workspace.id}`);
    return { ok: true, message: "Meeting scheduled.", id: meeting.id };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ rsvp */

export async function rsvp(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        meetingId: z.string().min(1),
        going: z.enum(["yes", "no"]),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "meeting:schedule", resource)) {
      return { ok: false, error: "You are not in this group." };
    }

    const meeting = await db.meeting.findFirst({
      where: { id: input.meetingId, groupId: workspace.id },
      select: { id: true },
    });
    if (!meeting) return { ok: false, error: "That meeting no longer exists." };

    await db.meetingAttendance.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId: viewer.userId } },
      create: { meetingId: meeting.id, userId: viewer.userId, rsvp: input.going === "yes" },
      update: { rsvp: input.going === "yes" },
    });

    revalidatePath(`/groups/${workspace.id}/meetings`);
    return { ok: true, message: input.going === "yes" ? "You are going." : "Marked as not going." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Mark who actually attended, and record it.
 *
 * Attendance is the one ledger event that is *asserted by a person* rather than
 * derived from an action, which makes it the weakest evidence in the ledger —
 * so it carries the smallest weight but one, and the interface shows who
 * recorded it.
 */
export async function markAttendance(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const groupId = z.string().min(1).parse(formData.get("groupId"));
    const meetingId = z.string().min(1).parse(formData.get("meetingId"));
    const attended = formData.getAll("attended").map(String);

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, groupId);

    if (!can(viewer, "meeting:schedule", resource)) {
      return { ok: false, error: "You cannot record attendance for this group." };
    }

    const meeting = await db.meeting.findFirst({
      where: { id: meetingId, groupId: workspace.id },
      select: {
        id: true,
        title: true,
        attendance: { select: { userId: true, attended: true } },
      },
    });
    if (!meeting) return { ok: false, error: "That meeting no longer exists." };

    const memberIds = workspace.members.map((member) => member.user.id);
    const present = new Set(attended.filter((id) => memberIds.includes(id)));

    // Only newly-present members earn an event. Re-saving the form must not
    // pay somebody twice for the same meeting, and the ledger has no update
    // path to fix it afterwards.
    const alreadyCredited = new Set(
      meeting.attendance.filter((row) => row.attended === true).map((row) => row.userId),
    );
    const newlyPresent = [...present].filter((id) => !alreadyCredited.has(id));

    await db.$transaction(async (tx) => {
      for (const userId of memberIds) {
        await tx.meetingAttendance.upsert({
          where: { meetingId_userId: { meetingId: meeting.id, userId } },
          create: { meetingId: meeting.id, userId, attended: present.has(userId) },
          update: { attended: present.has(userId) },
        });
      }

      await recordLedgerEvents(
        tx,
        newlyPresent.map((userId) => ({
          groupId: workspace.id,
          userId,
          kind: "MEETING_ATTENDED" as const,
          subjectType: "Meeting" as const,
          subjectId: meeting.id,
          metadata: { title: meeting.title, recordedBy: viewer.userId },
        })),
      );
    });

    revalidatePath(`/groups/${workspace.id}/meetings`);
    return { ok: true, message: `Attendance recorded for ${present.size} of ${memberIds.length}.` };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- minutes */

/**
 * Save the minutes, and turn the action items into tasks.
 *
 * One transaction, deliberately. The whole reason this button exists is that
 * action items agreed in a meeting are the things most likely to be forgotten;
 * a version where the minutes save and the tasks silently do not would be worse
 * than not offering it.
 *
 * Action items arrive one per line, optionally `@username` to assign.
 */
export async function saveMinutes(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        meetingId: z.string().min(1),
        notes: z.string().trim().max(8000).optional(),
        actionItems: z.string().trim().max(4000).optional(),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "meeting:schedule", resource)) {
      return { ok: false, error: "You cannot edit this meeting." };
    }

    const meeting = await db.meeting.findFirst({
      where: { id: input.meetingId, groupId: workspace.id },
      select: { id: true, title: true },
    });
    if (!meeting) return { ok: false, error: "That meeting no longer exists." };

    const items = (input.actionItems ?? "")
      .split("\n")
      .map((line) => line.replace(/^[-*\s]+/, "").trim())
      .filter((line) => line.length > 1)
      .slice(0, 20);

    const lastPosition = await db.task.findFirst({
      where: { groupId: workspace.id, status: "TODO", deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    let created = 0;

    await db.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meeting.id },
        data: { notes: input.notes || null },
      });

      let position = (lastPosition?.position ?? 0) + 1;

      for (const item of items) {
        const handle = /@([a-z0-9][a-z0-9-]{1,30})/i.exec(item)?.[1]?.toLowerCase();
        const assignee = handle
          ? workspace.members.find((member) => member.user.username?.toLowerCase() === handle)
          : undefined;

        const title = item
          .replace(/@[a-z0-9-]+/gi, "")
          .trim()
          .slice(0, 160);
        if (title.length < 2) continue;

        await tx.task.create({
          data: {
            groupId: workspace.id,
            creatorId: viewer.userId,
            title,
            description: `From the meeting "${meeting.title}".`,
            status: "TODO",
            position: position++,
            ...(assignee ? { assignees: { create: [{ userId: assignee.user.id }] } } : {}),
          },
        });
        created += 1;
      }
    });

    revalidatePath(`/groups/${workspace.id}/meetings`);
    revalidatePath(`/groups/${workspace.id}/tasks`);
    return {
      ok: true,
      message: created > 0 ? `Minutes saved, ${created} tasks created.` : "Minutes saved.",
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Log a contribution against a meeting that already happened.
 *
 * Used by the "I was there" self-report on a past meeting whose attendance
 * nobody recorded. Kept separate from `markAttendance` because it is a claim
 * about oneself rather than a record made by the host, and the metadata says
 * which it was.
 */
export async function selfReportAttendance(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({ groupId: z.string().min(1), meetingId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "meeting:schedule", resource)) {
      return { ok: false, error: "You are not in this group." };
    }

    const attendance = await db.meetingAttendance.findFirst({
      where: {
        meetingId: input.meetingId,
        userId: viewer.userId,
        meeting: { groupId: workspace.id },
      },
      select: { id: true, attended: true, meeting: { select: { id: true, title: true } } },
    });
    if (!attendance) return { ok: false, error: "You were not invited to that meeting." };
    if (attendance.attended === true) return { ok: true, message: "Already recorded." };

    await db.$transaction(async (tx) => {
      await tx.meetingAttendance.update({
        where: { id: attendance.id },
        data: { attended: true },
      });

      await recordLedgerEvent(tx, {
        groupId: workspace.id,
        userId: viewer.userId,
        kind: "MEETING_ATTENDED",
        subjectType: "Meeting",
        subjectId: attendance.meeting.id,
        metadata: { title: attendance.meeting.title, selfReported: true },
      });
    });

    revalidatePath(`/groups/${workspace.id}/meetings`);
    return { ok: true, message: "Recorded." };
  } catch (error) {
    return fail(error);
  }
}
